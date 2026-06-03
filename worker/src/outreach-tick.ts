// Outreach autopilot — fires on a 15-min interval from server.ts.
//
// For every active campaign, finds prospects whose next step is due
// (next_send_at <= now, or null = send immediately), sends the next
// step via Resend, advances prospect state, and logs to email_sends.
//
// Status transitions per prospect:
//   pending  → in_progress (after first send)
//   in_progress → completed (when last step sent)
//   any  → replied / bounced / failed (terminal; tick skips)
//
// Concurrency safety: we "claim" the batch by bumping next_send_at
// 10 min into the future before sending. If a tick takes longer than
// 10 min (shouldn't happen at small scale), a second tick could grab
// the same row — accept that for v1; revisit when volume grows.

import { supabase } from "./db.js";

type Step = {
  step_order: number;
  delay_days: number;
  subject: string;
  body: string;
};

type ActiveCampaign = {
  id: string;
  user_id: string;
  name: string;
  steps: Step[];
  senderName: string;
  replyTo: string | null;
};

type Prospect = {
  id: string;
  campaign_id: string;
  lead_id: string;
  email: string;
  current_step: number;
  lead: { name: string; category: string | null } | null;
};

export type TickResult = {
  campaigns: number;
  due: number;
  sent: number;
  failed: number;
};

let running = false;

export async function runOutreachTick(): Promise<TickResult> {
  if (running) {
    console.log("[outreach-tick] previous tick still running, skipping");
    return { campaigns: 0, due: 0, sent: 0, failed: 0 };
  }
  running = true;
  try {
    return await tick();
  } finally {
    running = false;
  }
}

async function tick(): Promise<TickResult> {
  // 1. Fetch all active campaigns + steps in one shot.
  const { data: campaignsRaw, error: campErr } = await supabase
    .from("outreach_campaigns")
    .select(
      "id,user_id,name,outreach_steps(step_order,delay_days,subject,body)"
    )
    .eq("status", "active");

  if (campErr) {
    console.error("[outreach-tick] fetch campaigns failed:", campErr);
    return { campaigns: 0, due: 0, sent: 0, failed: 0 };
  }

  const campaigns = (campaignsRaw ?? []) as Array<{
    id: string;
    user_id: string;
    name: string;
    outreach_steps: Step[];
  }>;

  if (campaigns.length === 0) {
    return { campaigns: 0, due: 0, sent: 0, failed: 0 };
  }

  // 2. Resolve sender profile per campaign (one batched query).
  const userIds = Array.from(new Set(campaigns.map((c) => c.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .in("id", userIds);
  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        full_name: (p.full_name as string | null) ?? null,
        email: (p.email as string | null) ?? null,
      },
    ])
  );

  const campaignMap = new Map<string, ActiveCampaign>();
  for (const c of campaigns) {
    const prof = profileMap.get(c.user_id);
    const senderName =
      prof?.full_name?.trim() || prof?.email || "your team";
    const steps = (c.outreach_steps ?? [])
      .slice()
      .sort((a, b) => a.step_order - b.step_order);
    campaignMap.set(c.id, {
      id: c.id,
      user_id: c.user_id,
      name: c.name,
      steps,
      senderName,
      replyTo: prof?.email ?? null,
    });
  }

  // 3. Find due prospects across all active campaigns.
  const nowIso = new Date().toISOString();
  const campaignIds = campaigns.map((c) => c.id);
  const { data: prospects, error: prospErr } = await supabase
    .from("outreach_prospects")
    .select(
      "id,campaign_id,lead_id,email,current_step,leads(name,category)"
    )
    .in("campaign_id", campaignIds)
    .in("status", ["pending", "in_progress"])
    .or(`next_send_at.is.null,next_send_at.lte.${nowIso}`)
    .limit(200);

  if (prospErr) {
    console.error("[outreach-tick] fetch prospects failed:", prospErr);
    return { campaigns: campaigns.length, due: 0, sent: 0, failed: 0 };
  }

  const due = (prospects ?? []).map((p) => ({
    id: p.id as string,
    campaign_id: p.campaign_id as string,
    lead_id: p.lead_id as string,
    email: p.email as string,
    current_step: p.current_step as number,
    lead: Array.isArray(p.leads)
      ? (p.leads[0] as { name: string; category: string | null } | null) ?? null
      : (p.leads as { name: string; category: string | null } | null) ?? null,
  })) as Prospect[];

  if (due.length === 0) {
    // Even if no sends, check if any campaigns are now empty and should
    // be marked completed.
    await sweepCompletedCampaigns(campaignIds);
    return { campaigns: campaigns.length, due: 0, sent: 0, failed: 0 };
  }

  // 4. Claim the batch — bump next_send_at forward to prevent a
  //    concurrent tick from grabbing the same rows.
  const claimUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabase
    .from("outreach_prospects")
    .update({ next_send_at: claimUntil })
    .in(
      "id",
      due.map((p) => p.id)
    );

  // 5. Process each prospect serially. Resend handles bursts fine; we don't
  //    need internal concurrency here and serial keeps DB ordering simple.
  let sent = 0;
  let failed = 0;

  for (const p of due) {
    const campaign = campaignMap.get(p.campaign_id);
    if (!campaign) continue;

    const nextStepOrder = p.current_step + 1;
    const nextStep = campaign.steps.find((s) => s.step_order === nextStepOrder);

    if (!nextStep) {
      // No more steps — mark completed.
      await supabase
        .from("outreach_prospects")
        .update({ status: "completed", next_send_at: null })
        .eq("id", p.id);
      continue;
    }

    const leadName = p.lead?.name ?? "there";
    const leadCategory = p.lead?.category ?? undefined;
    const renderedSubject = renderTemplate(nextStep.subject, {
      name: leadName,
      category: leadCategory,
      sender: campaign.senderName,
    });
    const renderedBody = renderTemplate(nextStep.body, {
      name: leadName,
      category: leadCategory,
      sender: campaign.senderName,
    });

    const sendOutcome = await sendViaResend({
      to: p.email,
      subject: renderedSubject,
      html: bodyToHtml(renderedBody),
      replyTo: campaign.replyTo,
    });

    if (sendOutcome.ok) {
      sent += 1;
      const stepAfter = campaign.steps.find(
        (s) => s.step_order === nextStepOrder + 1
      );
      const newNextSendAt = stepAfter
        ? new Date(
            Date.now() + stepAfter.delay_days * 24 * 60 * 60 * 1000
          ).toISOString()
        : null;
      const newStatus = stepAfter ? "in_progress" : "completed";

      await supabase
        .from("outreach_prospects")
        .update({
          current_step: nextStepOrder,
          last_sent_at: new Date().toISOString(),
          next_send_at: newNextSendAt,
          status: newStatus,
        })
        .eq("id", p.id);

      await supabase.from("email_sends").insert({
        user_id: campaign.user_id,
        lead_id: p.lead_id,
        scan_run_id: null,
        campaign_id: campaign.id,
        step_order: nextStepOrder,
        recipient_email: p.email,
        subject: renderedSubject,
        body: renderedBody,
        status: "sent",
        provider_message_id: sendOutcome.id,
        attachment_count: 0,
        sent_at: new Date().toISOString(),
      });
    } else {
      failed += 1;
      // Retry in 1 hour. After 3 failures (tracked elsewhere later),
      // we'd flip to bounced — for v1, just keep retrying.
      await supabase
        .from("outreach_prospects")
        .update({
          next_send_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .eq("id", p.id);

      await supabase.from("email_sends").insert({
        user_id: campaign.user_id,
        lead_id: p.lead_id,
        scan_run_id: null,
        campaign_id: campaign.id,
        step_order: nextStepOrder,
        recipient_email: p.email,
        subject: renderedSubject,
        body: renderedBody,
        status: "failed",
        error: sendOutcome.error,
        provider_message_id: null,
        attachment_count: 0,
        sent_at: null,
      });
    }
  }

  // 6. Sweep — mark campaigns completed when no pending/in_progress
  //    prospects remain.
  await sweepCompletedCampaigns(campaignIds);

  console.log(
    `[outreach-tick] processed ${due.length}, sent ${sent}, failed ${failed}`
  );
  return { campaigns: campaigns.length, due: due.length, sent, failed };
}

async function sweepCompletedCampaigns(campaignIds: string[]): Promise<void> {
  for (const cid of campaignIds) {
    const { count } = await supabase
      .from("outreach_prospects")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", cid)
      .in("status", ["pending", "in_progress"]);
    if (count === 0) {
      await supabase
        .from("outreach_campaigns")
        .update({
          status: "completed",
          finished_at: new Date().toISOString(),
        })
        .eq("id", cid)
        .eq("status", "active");
    }
  }
}

type SendOutcome =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function sendViaResend({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo: string | null;
}): Promise<SendOutcome> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const FROM =
    process.env.OUTREACH_FROM ??
    process.env.MAIL_FROM ??
    "Lead Machine <onboarding@resend.dev>";

  if (!apiKey) {
    // No key — log instead. Same pattern as src/lib/mailer.ts.
    console.log("[outreach-tick] (no RESEND_API_KEY — logging)");
    console.log("[outreach-tick] to:", to, "subject:", subject);
    return { ok: true, id: "console-log-" + Date.now() };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (res.ok && json.id) return { ok: true, id: json.id };
    return {
      ok: false,
      error: json.message ?? json.name ?? `Resend returned ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// Mirrored from src/lib/email-templates.ts — worker is a separate package
// so we can't import. Tiny enough to keep both copies in sync by eye.
function renderTemplate(
  text: string,
  values: { name?: string; category?: string; sender?: string }
): string {
  return text
    .replace(/\{\{\s*name\s*\}\}/g, values.name ?? "{{name}}")
    .replace(/\{\{\s*category\s*\}\}/g, values.category ?? "{{category}}")
    .replace(/\{\{\s*sender\s*\}\}/g, values.sender ?? "{{sender}}");
}

// Plain text → HTML. Same as src/app/api/email-campaigns/send/route.ts.
function bodyToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
  return `<div style="font-family:Inter,system-ui,Arial,sans-serif;color:#0c0a09;font-size:14px">${paragraphs}</div>`;
}
