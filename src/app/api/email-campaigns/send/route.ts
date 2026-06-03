import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderTemplate } from "@/lib/email-templates";

// Hobby tier max function duration is 30 s. A small concurrency cap lets us
// fire ~30 sends within that window without slamming Resend.
const SEND_CONCURRENCY = 4;

type AttachmentInput = {
  filename: string;
  contentType: string;
  base64: string;
};

type Body = {
  runId?: string;
  subject?: string;
  body?: string;
  leadIds?: string[];
  attachments?: AttachmentInput[];
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as Body;
  const { runId, subject, body, leadIds, attachments } = payload;

  if (
    typeof runId !== "string" ||
    typeof subject !== "string" ||
    typeof body !== "string" ||
    !Array.isArray(leadIds) ||
    leadIds.length === 0
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Verify the scan run belongs to the caller.
  const { data: run } = await supabase
    .from("scan_runs")
    .select("id")
    .eq("id", runId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!run) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Pull leads + contacts in one shot. RLS already constrains to the user.
  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id,name,category,lead_contacts(email)")
    .eq("user_id", user.id)
    .eq("scan_run_id", runId)
    .in("id", leadIds);

  if (leadsErr) {
    return NextResponse.json({ error: leadsErr.message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email")
    .eq("id", user.id)
    .maybeSingle();
  const senderName =
    profile?.full_name?.trim() || profile?.email || user.email || "your team";
  const replyTo = profile?.email ?? user.email ?? null;

  const FROM =
    process.env.OUTREACH_FROM ??
    process.env.MAIL_FROM ??
    "Lead Machine <hello@leadmachine.app>";
  const apiKey = process.env.RESEND_API_KEY?.trim();

  type Task = { leadId: string; name: string; category: string | null; to: string };
  const tasks: Task[] = [];
  for (const lead of leads ?? []) {
    const contacts =
      (lead.lead_contacts as { email: string | null }[] | null) ?? [];
    const email = contacts
      .map((c) => c.email)
      .find((e): e is string => Boolean(e && e.length > 0));
    if (!email) continue;
    tasks.push({
      leadId: lead.id as string,
      name: lead.name as string,
      category: (lead.category as string | null) ?? null,
      to: email,
    });
  }

  if (tasks.length === 0) {
    return NextResponse.json(
      { error: "None of the selected leads have an email address." },
      { status: 400 }
    );
  }

  const attachmentPayload = (attachments ?? []).map((a) => ({
    filename: a.filename,
    content: a.base64,
    content_type: a.contentType,
  }));
  const attachmentCount = attachmentPayload.length;

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Small concurrency pool — avoid hammering Resend and stay within Vercel's
  // 30 s function ceiling for moderate batches.
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(SEND_CONCURRENCY, tasks.length) }).map(
      async () => {
        while (true) {
          const i = cursor++;
          if (i >= tasks.length) break;
          const task = tasks[i];

          const renderedSubject = renderTemplate(subject, {
            name: task.name,
            category: task.category ?? undefined,
            sender: senderName,
          });
          const renderedBody = renderTemplate(body, {
            name: task.name,
            category: task.category ?? undefined,
            sender: senderName,
          });
          const html = bodyToHtml(renderedBody);

          let status: "sent" | "failed" = "failed";
          let providerMessageId: string | null = null;
          let errorMsg: string | null = null;

          if (!apiKey) {
            // No Resend key configured — log instead of sending. Matches
            // the existing mailer.ts pattern. UI is still testable.
            console.log("[email-campaigns] (no RESEND_API_KEY — logging)");
            console.log("[email-campaigns] to:", task.to);
            console.log("[email-campaigns] subject:", renderedSubject);
            status = "sent";
          } else {
            try {
              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: FROM,
                  to: [task.to],
                  subject: renderedSubject,
                  html,
                  ...(replyTo ? { reply_to: replyTo } : {}),
                  ...(attachmentPayload.length > 0
                    ? { attachments: attachmentPayload }
                    : {}),
                }),
              });
              const json = (await res
                .json()
                .catch(() => ({}))) as {
                id?: string;
                message?: string;
                name?: string;
              };
              if (res.ok && json.id) {
                status = "sent";
                providerMessageId = json.id;
              } else {
                status = "failed";
                errorMsg =
                  json.message ?? json.name ?? `Resend returned ${res.status}`;
              }
            } catch (err) {
              status = "failed";
              errorMsg =
                err instanceof Error ? err.message : "Network error.";
            }
          }

          if (status === "sent") sent += 1;
          else {
            failed += 1;
            if (errorMsg) errors.push(`${task.name}: ${errorMsg}`);
          }

          await supabase.from("email_sends").insert({
            user_id: user.id,
            lead_id: task.leadId,
            scan_run_id: runId,
            recipient_email: task.to,
            subject: renderedSubject,
            body: renderedBody,
            status,
            error: errorMsg,
            provider_message_id: providerMessageId,
            attachment_count: attachmentCount,
            sent_at: status === "sent" ? new Date().toISOString() : null,
          });
        }
      }
    )
  );

  return NextResponse.json({ sent, failed, errors });
}

// Minimal plain-text → HTML conversion. Preserves paragraphs and line breaks,
// escapes HTML-significant characters. No external sanitizer needed because we
// emit no untrusted HTML — only the user's own typed body.
function bodyToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:Inter,system-ui,Arial,sans-serif;color:#0c0a09;font-size:14px">${paragraphs}</div>`;
}
