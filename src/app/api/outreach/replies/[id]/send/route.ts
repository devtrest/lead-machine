import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// POST /api/outreach/replies/[id]/send
// Body: { body: string }
//
// Sends a reply to the original sender of this incoming reply, using the
// same Gmail sender account that received it. Sets In-Reply-To + References
// so Gmail (and other clients) thread the conversation naturally.
//
// Logs to email_sends so the next reply from the same address can be matched
// + the conversation stays trackable. Auto-marks the reply as read.
export async function POST(req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as { body?: string };
  const replyBody = payload.body?.trim();
  if (!replyBody) {
    return NextResponse.json(
      { error: "Reply body is empty" },
      { status: 400 }
    );
  }

  // Pull the original incoming reply + sender credentials in one shot.
  const { data: reply } = await supabase
    .from("outreach_replies")
    .select(
      "id,from_email,from_name,subject,message_id,sender_id,campaign_id,lead_id,prospect_id,outreach_senders(id,email,display_name,app_password,status,provider,smtp_host,smtp_port,smtp_secure)"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!reply) {
    return NextResponse.json({ error: "Reply not found" }, { status: 404 });
  }

  type SenderRow = {
    id: string;
    email: string;
    display_name: string | null;
    app_password: string;
    status: string;
    provider: string | null;
    smtp_host: string | null;
    smtp_port: number | null;
    smtp_secure: boolean | null;
  };
  const sender = (Array.isArray(reply.outreach_senders)
    ? reply.outreach_senders[0]
    : reply.outreach_senders) as SenderRow | null;

  if (!sender) {
    return NextResponse.json(
      { error: "Original sender account no longer connected" },
      { status: 400 }
    );
  }
  if (sender.status !== "active") {
    return NextResponse.json(
      { error: "Sender is paused — resume it from the Senders page" },
      { status: 400 }
    );
  }

  // Use the sender's OWN stored SMTP config — NOT a hardcoded Gmail host.
  // Custom-domain / Outlook / Titan senders have their own host:port, and
  // pinning to smtp.gmail.com here would fail auth for every non-Gmail
  // mailbox. Fall back to Gmail defaults only if the columns are somehow
  // empty (legacy rows predating multi-provider senders).
  const provider = sender.provider ?? "gmail";
  const smtpHost = sender.smtp_host || "smtp.gmail.com";
  const smtpPort = sender.smtp_port && sender.smtp_port > 0 ? sender.smtp_port : 587;
  const smtpSecure = sender.smtp_secure ?? false;
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    requireTLS: !smtpSecure,
    connectionTimeout: 25_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth: {
      user: sender.email,
      // Gmail app passwords are stored/displayed with spaces; strip them.
      // Other providers may have meaningful whitespace — leave those alone.
      pass:
        provider === "gmail"
          ? sender.app_password.replace(/\s+/g, "")
          : sender.app_password,
    },
  });

  const fromHeader = sender.display_name
    ? `${sender.display_name} <${sender.email}>`
    : `<${sender.email}>`;

  // Preserve subject with Re: prefix if not already there.
  const originalSubject = (reply.subject as string | null) ?? "(no subject)";
  const subject = /^re:/i.test(originalSubject)
    ? originalSubject
    : `Re: ${originalSubject}`;

  // Threading headers — referencing the incoming reply's Message-ID keeps
  // the conversation tree intact in Gmail and other clients.
  const inReplyTo = reply.message_id as string | null;
  const references = inReplyTo ? inReplyTo : undefined;

  try {
    const info = await transporter.sendMail({
      from: fromHeader,
      to: reply.from_email as string,
      subject,
      html: bodyToHtml(replyBody),
      ...(inReplyTo
        ? { inReplyTo, references: references ? [references] : undefined }
        : {}),
    });

    // Log the outgoing reply to email_sends so future replies can match
    // against this address. Includes sender_id for per-sender attribution;
    // strips it and retries if the migration hasn't been applied yet so the
    // reply still succeeds on an un-migrated DB.
    const sendRow = {
      user_id: user.id,
      lead_id: reply.lead_id ?? null,
      scan_run_id: null,
      campaign_id: reply.campaign_id ?? null,
      sender_id: sender.id,
      step_order: 0,
      recipient_email: reply.from_email,
      subject,
      body: replyBody,
      status: "sent",
      provider_message_id: info.messageId ?? null,
      attachment_count: 0,
      sent_at: new Date().toISOString(),
    };
    const logRes = await supabase.from("email_sends").insert(sendRow);
    if (logRes.error && /sender_id/i.test(logRes.error.message)) {
      const { sender_id: _omit, ...rest } = sendRow;
      void _omit;
      await supabase.from("email_sends").insert(rest);
    }

    // Auto-mark the incoming reply as read since the user has now responded.
    await supabase
      .from("outreach_replies")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gmail SMTP send failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
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
