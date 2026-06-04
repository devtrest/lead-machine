// Outreach autopilot — fires on a 15-min interval from server.ts.
//
// For every ACTIVE campaign:
//   1. Check the campaign's send window (timezone + days + hours).
//      Skip if out-of-window so we don't ping leads at 3am.
//   2. Find prospects whose next step is due (next_send_at <= now).
//   3. For each, render and send via Gmail SMTP (or Resend) with a
//      random 30-90s wait between sends — looks human to Gmail, dodges
//      spam-rate-limit heuristics.
//   4. Advance prospect state (current_step++, set next_send_at to
//      now + next step's delay_days).
//   5. On send failure: bump retry_count; after 3 attempts flip the
//      prospect to 'bounced' with the error stored in bounce_reason.
//
// Sender strategy (first-configured wins):
//   1. Gmail SMTP via nodemailer (GMAIL_USER + GMAIL_APP_PASSWORD)
//   2. Resend HTTP API (RESEND_API_KEY + OUTREACH_FROM)
//   3. console.log fallback
//
// Concurrency safety: we "claim" each batch by bumping next_send_at
// 10 min into the future before sending. Coupled with the in-process
// `running` lock, this prevents double-send under load.

import nodemailer, { type Transporter } from "nodemailer";
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
  sendWindowStart: string; // "09:00"
  sendWindowEnd: string;   // "17:00"
  sendDays: string[];      // ['mon','tue',...]
  timezone: string;        // "America/New_York"
};

type Prospect = {
  id: string;
  campaign_id: string;
  lead_id: string;
  email: string;
  current_step: number;
  retry_count: number;
  lead: { name: string; category: string | null } | null;
};

export type TickResult = {
  campaigns: number;
  due: number;
  sent: number;
  failed: number;
  skipped: number; // out-of-window
};

const MAX_RETRIES = 3;
const MIN_INTER_SEND_MS = 30_000;
const MAX_INTER_SEND_MS = 90_000;
const CLAIM_WINDOW_MS = 10 * 60 * 1000;

let running = false;

export async function runOutreachTick(): Promise<TickResult> {
  if (running) {
    console.log("[outreach-tick] previous tick still running, skipping");
    return { campaigns: 0, due: 0, sent: 0, failed: 0, skipped: 0 };
  }
  running = true;
  const t0 = Date.now();
  try {
    const result = await tick();
    console.log(
      `[outreach-tick] tick done in ${Date.now() - t0}ms — campaigns:${result.campaigns} due:${result.due} sent:${result.sent} failed:${result.failed} skipped:${result.skipped}`
    );
    return result;
  } finally {
    running = false;
  }
}

async function tick(): Promise<TickResult> {
  // 1. Fetch all active campaigns (with steps + schedule).
  const { data: campaignsRaw, error: campErr } = await supabase
    .from("outreach_campaigns")
    .select(
      "id,user_id,name,send_window_start,send_window_end,send_days,timezone,outreach_steps(step_order,delay_days,subject,body)"
    )
    .eq("status", "active");

  if (campErr) {
    console.error("[outreach-tick] fetch campaigns failed:", campErr);
    return { campaigns: 0, due: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const campaigns = (campaignsRaw ?? []) as Array<{
    id: string;
    user_id: string;
    name: string;
    send_window_start: string;
    send_window_end: string;
    send_days: string[];
    timezone: string;
    outreach_steps: Step[];
  }>;

  console.log(
    `[outreach-tick] found ${campaigns.length} active campaign(s)`
  );

  if (campaigns.length === 0) {
    return { campaigns: 0, due: 0, sent: 0, failed: 0, skipped: 0 };
  }

  // 2. Resolve sender profiles.
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

  // 3. Build campaign map, filtering out those outside their send window.
  const campaignMap = new Map<string, ActiveCampaign>();
  let skippedOutOfWindow = 0;
  for (const c of campaigns) {
    const prof = profileMap.get(c.user_id);
    const senderName =
      prof?.full_name?.trim() || prof?.email || "your team";
    const steps = (c.outreach_steps ?? [])
      .slice()
      .sort((a, b) => a.step_order - b.step_order);

    const active: ActiveCampaign = {
      id: c.id,
      user_id: c.user_id,
      name: c.name,
      steps,
      senderName,
      replyTo: prof?.email ?? null,
      sendWindowStart: c.send_window_start ?? "09:00",
      sendWindowEnd: c.send_window_end ?? "17:00",
      sendDays: c.send_days ?? ["mon", "tue", "wed", "thu", "fri"],
      timezone: c.timezone ?? "UTC",
    };

    if (!isWithinSendWindow(active)) {
      console.log(
        `[outreach-tick] campaign "${active.name}" out of window (${active.sendWindowStart}-${active.sendWindowEnd} ${active.timezone}), skipping`
      );
      skippedOutOfWindow += 1;
      continue;
    }
    campaignMap.set(c.id, active);
  }

  if (campaignMap.size === 0) {
    return {
      campaigns: campaigns.length,
      due: 0,
      sent: 0,
      failed: 0,
      skipped: skippedOutOfWindow,
    };
  }

  // 4. Find due prospects.
  const nowIso = new Date().toISOString();
  const activeCampaignIds = Array.from(campaignMap.keys());
  const { data: prospects, error: prospErr } = await supabase
    .from("outreach_prospects")
    .select(
      "id,campaign_id,lead_id,email,current_step,retry_count,leads(name,category)"
    )
    .in("campaign_id", activeCampaignIds)
    .in("status", ["pending", "in_progress"])
    .or(`next_send_at.is.null,next_send_at.lte.${nowIso}`)
    .limit(200);

  if (prospErr) {
    console.error("[outreach-tick] fetch prospects failed:", prospErr);
    return {
      campaigns: campaigns.length,
      due: 0,
      sent: 0,
      failed: 0,
      skipped: skippedOutOfWindow,
    };
  }

  const due = (prospects ?? []).map((p) => ({
    id: p.id as string,
    campaign_id: p.campaign_id as string,
    lead_id: p.lead_id as string,
    email: p.email as string,
    current_step: p.current_step as number,
    retry_count: (p.retry_count as number) ?? 0,
    lead: Array.isArray(p.leads)
      ? (p.leads[0] as { name: string; category: string | null } | null) ?? null
      : (p.leads as { name: string; category: string | null } | null) ?? null,
  })) as Prospect[];

  console.log(`[outreach-tick] ${due.length} prospect(s) due`);

  if (due.length === 0) {
    await sweepCompletedCampaigns(activeCampaignIds);
    return {
      campaigns: campaigns.length,
      due: 0,
      sent: 0,
      failed: 0,
      skipped: skippedOutOfWindow,
    };
  }

  // 5. Claim the batch.
  const claimUntil = new Date(Date.now() + CLAIM_WINDOW_MS).toISOString();
  await supabase
    .from("outreach_prospects")
    .update({ next_send_at: claimUntil })
    .in(
      "id",
      due.map((p) => p.id)
    );

  // 6. Process each prospect with a randomized inter-send delay.
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < due.length; i++) {
    const p = due[i];
    const campaign = campaignMap.get(p.campaign_id);
    if (!campaign) continue;

    const nextStepOrder = p.current_step + 1;
    const nextStep = campaign.steps.find((s) => s.step_order === nextStepOrder);

    if (!nextStep) {
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

    // Random delay between sends (skip on the first iteration). Spam filters
    // flag dead-uniform bot intervals; this looks more like a person typing.
    if (i > 0) {
      const delay = randInRange(MIN_INTER_SEND_MS, MAX_INTER_SEND_MS);
      console.log(
        `[outreach-tick] waiting ${Math.round(delay / 1000)}s before next send (humanization)`
      );
      await sleep(delay);
    }

    console.log(
      `[outreach-tick] sending step ${nextStepOrder} → ${p.email} (campaign "${campaign.name}")`
    );

    const sendOutcome = await sendEmail({
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
          retry_count: 0,
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
      const newRetryCount = p.retry_count + 1;
      console.warn(
        `[outreach-tick] send failed (attempt ${newRetryCount}/${MAX_RETRIES}) for ${p.email}: ${sendOutcome.error}`
      );

      if (newRetryCount >= MAX_RETRIES) {
        // Give up on this prospect.
        await supabase
          .from("outreach_prospects")
          .update({
            status: "bounced",
            bounce_reason: sendOutcome.error,
            next_send_at: null,
            retry_count: newRetryCount,
          })
          .eq("id", p.id);
      } else {
        // Exponential backoff: 1h, 4h, 12h
        const backoffMs =
          [60, 240, 720][newRetryCount - 1] * 60 * 1000;
        await supabase
          .from("outreach_prospects")
          .update({
            next_send_at: new Date(Date.now() + backoffMs).toISOString(),
            retry_count: newRetryCount,
          })
          .eq("id", p.id);
      }

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

  await sweepCompletedCampaigns(activeCampaignIds);

  return {
    campaigns: campaigns.length,
    due: due.length,
    sent,
    failed,
    skipped: skippedOutOfWindow,
  };
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

// Returns true when the campaign's current time-in-its-timezone falls inside
// (sendWindowStart..sendWindowEnd) AND today's weekday is in sendDays.
function isWithinSendWindow(c: ActiveCampaign): boolean {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: c.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    const parts = fmt.formatToParts(new Date());
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    const weekday =
      parts.find((p) => p.type === "weekday")?.value.toLowerCase() ?? "";
    const day3 = weekday.slice(0, 3);

    const lowerDays = (c.sendDays ?? []).map((d) => d.toLowerCase().slice(0, 3));
    if (!lowerDays.includes(day3)) return false;

    const nowMin = parseInt(hour, 10) * 60 + parseInt(minute, 10);
    const startMin = toMinutes(c.sendWindowStart);
    const endMin = toMinutes(c.sendWindowEnd);
    return nowMin >= startMin && nowMin < endMin;
  } catch (err) {
    console.error("[outreach-tick] window check failed:", err);
    return true; // fail-open so a bad timezone string doesn't freeze sending
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
}

function randInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SendOutcome =
  | { ok: true; id: string }
  | { ok: false; error: string };

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  replyTo: string | null;
};

async function sendEmail(args: SendArgs): Promise<SendOutcome> {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return sendViaGmail(args);
  }
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(args);
  }
  console.log("[outreach-tick] (no sender configured — logging)");
  console.log("[outreach-tick] to:", args.to, "subject:", args.subject);
  return { ok: true, id: "console-log-" + Date.now() };
}

let gmailTransporter: Transporter | null = null;
function getGmailTransporter(): Transporter {
  if (gmailTransporter) return gmailTransporter;
  gmailTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, ""),
    },
  });
  return gmailTransporter;
}

async function sendViaGmail(args: SendArgs): Promise<SendOutcome> {
  const user = process.env.GMAIL_USER!;
  const from = user.includes("<") ? user : `<${user}>`;
  try {
    const info = await getGmailTransporter().sendMail({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
    });
    return { ok: true, id: info.messageId || `gmail-${Date.now()}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gmail SMTP error",
    };
  }
}

async function sendViaResend(args: SendArgs): Promise<SendOutcome> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const FROM =
    process.env.OUTREACH_FROM ??
    process.env.MAIL_FROM ??
    "Lead Machine <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
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

function renderTemplate(
  text: string,
  values: { name?: string; category?: string; sender?: string }
): string {
  return text
    .replace(/\{\{\s*name\s*\}\}/g, values.name ?? "{{name}}")
    .replace(/\{\{\s*category\s*\}\}/g, values.category ?? "{{category}}")
    .replace(/\{\{\s*sender\s*\}\}/g, values.sender ?? "{{sender}}");
}

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
