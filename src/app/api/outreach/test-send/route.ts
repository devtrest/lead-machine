import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";
import { renderTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

// POST /api/outreach/test-send
// Body: { to: string, senderId: string, subject: string, body: string,
//         sampleName?: string, sampleCategory?: string }
//
// Sends one test email to `to` using `senderId` (must be a Gmail SMTP sender
// owned by the user). Uses the same nodemailer + Gmail-App-Password path as
// the worker's outreach-tick, so a successful test means the production
// pipeline will work too.
//
// Logged to email_sends with campaign_id=null (it's a one-off test, not part
// of a campaign).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    to?: string;
    senderId?: string;
    subject?: string;
    body?: string;
    sampleName?: string;
    sampleCategory?: string;
  };

  const to = body.to?.trim().toLowerCase();
  const senderId = body.senderId?.trim();
  const subject = body.subject ?? "";
  const bodyText = body.body ?? "";
  const sampleName = body.sampleName?.trim() || "Test Lead";
  const sampleCategory = body.sampleCategory?.trim() || "your business";

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { error: "Enter a valid recipient email" },
      { status: 400 }
    );
  }
  if (!senderId) {
    return NextResponse.json(
      { error: "Pick a sender to send the test from" },
      { status: 400 }
    );
  }
  if (!subject.trim() || !bodyText.trim()) {
    return NextResponse.json(
      { error: "Subject and body can't be empty" },
      { status: 400 }
    );
  }

  // Verify the sender belongs to this user + is active.
  const { data: sender } = await supabase
    .from("outreach_senders")
    .select("id,email,display_name,app_password,status")
    .eq("id", senderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sender) {
    return NextResponse.json({ error: "Sender not found" }, { status: 404 });
  }
  if (sender.status !== "active") {
    return NextResponse.json(
      { error: "Sender is paused. Resume it from the Senders page first." },
      { status: 400 }
    );
  }

  // Profile email becomes the Reply-To.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email")
    .eq("id", user.id)
    .maybeSingle();
  const senderDisplay =
    profile?.full_name?.trim() || profile?.email || "your team";
  const replyTo = profile?.email ?? user.email ?? null;

  const renderedSubject = renderTemplate(subject, {
    name: sampleName,
    category: sampleCategory,
    sender: senderDisplay,
  });
  const renderedBody = renderTemplate(bodyText, {
    name: sampleName,
    category: sampleCategory,
    sender: senderDisplay,
  });

  // Build a one-shot nodemailer transporter (no caching — test sends are
  // infrequent and we don't want to leak transports per request).
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: sender.email as string,
      pass: (sender.app_password as string).replace(/\s+/g, ""),
    },
  });

  const fromHeader = sender.display_name
    ? `${sender.display_name as string} <${sender.email as string}>`
    : `<${sender.email as string}>`;

  try {
    const info = await transporter.sendMail({
      from: fromHeader,
      to,
      subject: `[TEST] ${renderedSubject}`,
      html: bodyToHtml(renderedBody),
      ...(replyTo ? { replyTo } : {}),
    });

    // Log to email_sends with campaign_id=null so the IMAP reply matcher has
    // something to anchor against when a reply comes back. Campaign analytics
    // stay clean because we filter by campaign_id when computing per-campaign
    // stats.
    await supabase.from("email_sends").insert({
      user_id: user.id,
      lead_id: null,
      scan_run_id: null,
      campaign_id: null,
      step_order: 0,
      recipient_email: to,
      subject: `[TEST] ${renderedSubject}`,
      body: renderedBody,
      status: "sent",
      provider_message_id: info.messageId ?? null,
      attachment_count: 0,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      messageId: info.messageId,
      from: sender.email,
      to,
    });
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
