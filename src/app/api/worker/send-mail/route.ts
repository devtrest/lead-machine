// Internal endpoint — called by the Railway worker to actually fire the
// SMTP send for outreach emails.
//
// Why this exists: Google silently drops TCP connections from Railway's
// egress IP ranges to smtp.gmail.com (anti-spam / cloud-IP reputation), so
// every nodemailer send from Railway times out at the socket layer with no
// diagnostic. Vercel's serverless egress comes from AWS Lambda IPs that
// aren't on the same blocklists — same code, different egress, sends go
// through. The worker still owns the scheduling, retry, and state machine
// logic; this endpoint is purely a "do the actual SMTP handshake" relay.
//
// Auth: Bearer WORKER_TOKEN — the same shared secret the worker uses to
// hit Railway's /scrape and /outreach/tick endpoints (just inverted —
// here the worker is the caller, Vercel is the server). App passwords
// arrive in the JSON body because the worker reads them from Supabase
// per-send and we don't want to duplicate the credential cache here.

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  senderEmail?: unknown;
  senderPassword?: unknown;
  from?: unknown;
  to?: unknown;
  subject?: unknown;
  html?: unknown;
  replyTo?: unknown;
};

export async function POST(req: NextRequest) {
  const expected = process.env.WORKER_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "WORKER_TOKEN unset on Vercel" },
      { status: 500 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const senderEmail = typeof body.senderEmail === "string" ? body.senderEmail : "";
  const senderPassword =
    typeof body.senderPassword === "string" ? body.senderPassword : "";
  const from = typeof body.from === "string" ? body.from : "";
  const to = typeof body.to === "string" ? body.to : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  const html = typeof body.html === "string" ? body.html : "";
  const replyTo = typeof body.replyTo === "string" ? body.replyTo : null;

  if (!senderEmail || !senderPassword || !from || !to || !subject || !html) {
    return NextResponse.json(
      { ok: false, error: "Missing required field" },
      { status: 400 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 25_000,
    auth: {
      user: senderEmail,
      pass: senderPassword.replace(/\s+/g, ""),
    },
  });

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return NextResponse.json({ ok: true, id: info.messageId ?? `vercel-${Date.now()}` });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "SMTP send failed",
      },
      { status: 502 }
    );
  } finally {
    try {
      transporter.close();
    } catch {
      /* ignore */
    }
  }
}
