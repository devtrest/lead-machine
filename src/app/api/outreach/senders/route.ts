import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";
import { presetForKey, type SenderPresetKey } from "@/lib/sender-providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// GET /api/outreach/senders — list this user's connected senders.
// app_password is masked in the response so it never leaks back to the client.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("outreach_senders")
    .select(
      "id,email,display_name,provider,smtp_host,smtp_port,imap_host,imap_port,daily_limit,sends_today,last_reset_at,status,last_error,created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ senders: data ?? [] });
}

// POST /api/outreach/senders — add a sender (any provider).
// Body shape:
//   { provider: 'gmail' | 'outlook' | 'titan' | 'zoho' | 'yahoo' | 'custom',
//     email, appPassword, displayName?,
//     // ONLY required when provider = 'custom':
//     smtpHost?, smtpPort?, smtpSecure?, imapHost?, imapPort?, imapSecure? }
//
// The SMTP credentials are verified live (transporter.verify) against the
// resolved host before we touch the database — wrong creds = no row inserted.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    provider?: string;
    email?: string;
    appPassword?: string;
    displayName?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    imapHost?: string;
    imapPort?: number;
    imapSecure?: boolean;
  };

  const providerKey = (body.provider ?? "gmail") as SenderPresetKey;
  const preset = presetForKey(providerKey);

  const email = body.email?.trim().toLowerCase();
  const appPassword = body.appPassword;
  const displayName = body.displayName?.trim() || null;

  if (!email || !appPassword) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Provider-specific password format checks. Custom skips, everything else
  // requires at minimum 4 chars (sanity floor) — Gmail additionally requires
  // exactly 16.
  if (preset.enforceAppPasswordFormat) {
    const stripped = appPassword.replace(/\s+/g, "");
    if (stripped.length !== 16) {
      return NextResponse.json(
        {
          error: `Gmail app passwords are exactly 16 characters. Generate one at ${preset.helpUrl}`,
        },
        { status: 400 }
      );
    }
  } else if (appPassword.length < 4) {
    return NextResponse.json(
      { error: "Password is too short" },
      { status: 400 }
    );
  }

  // Resolve final hosts. Preset wins for everything except 'custom', where
  // the user supplies them. Validates that custom values aren't empty.
  const smtpHost =
    providerKey === "custom"
      ? body.smtpHost?.trim() ?? ""
      : preset.smtpHost;
  const smtpPort =
    providerKey === "custom"
      ? Number(body.smtpPort ?? preset.smtpPort)
      : preset.smtpPort;
  const smtpSecure =
    providerKey === "custom"
      ? Boolean(body.smtpSecure ?? preset.smtpSecure)
      : preset.smtpSecure;
  const imapHost =
    providerKey === "custom"
      ? body.imapHost?.trim() ?? ""
      : preset.imapHost;
  const imapPort =
    providerKey === "custom"
      ? Number(body.imapPort ?? preset.imapPort)
      : preset.imapPort;
  const imapSecure =
    providerKey === "custom"
      ? Boolean(body.imapSecure ?? preset.imapSecure)
      : preset.imapSecure;

  if (providerKey === "custom") {
    if (!smtpHost) {
      return NextResponse.json(
        { error: "SMTP host is required for custom providers" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(smtpPort) || smtpPort <= 0 || smtpPort > 65535) {
      return NextResponse.json(
        { error: "SMTP port must be between 1 and 65535" },
        { status: 400 }
      );
    }
    if (!imapHost) {
      return NextResponse.json(
        { error: "IMAP host is required for custom providers (or remove to skip inbox polling)" },
        { status: 400 }
      );
    }
  }

  // Verify SMTP credentials against the actual host before saving. Same
  // pattern as before, just no longer pinned to smtp.gmail.com.
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    requireTLS: !smtpSecure,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: {
      user: email,
      pass: preset.enforceAppPasswordFormat
        ? appPassword.replace(/\s+/g, "")
        : appPassword,
    },
  } as Parameters<typeof nodemailer.createTransport>[0]);

  try {
    await transporter.verify();
  } catch (err) {
    transporter.close();
    const raw = err instanceof Error ? err.message : "Authentication failed";
    const friendly = humanizeVerifyError(raw, preset.label);
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
  transporter.close();

  // daily_limit defaults reflect each provider's typical hard ceiling so we
  // don't accidentally blow past it. Gmail caps ~500/day free, ~2000 paid.
  // Outlook is roughly 300/day. Custom hosts default to 500 — the user
  // should tune via PATCH if they know better.
  const defaultDailyLimit =
    providerKey === "gmail"
      ? 500
      : providerKey === "outlook"
        ? 300
        : providerKey === "yahoo"
          ? 100
          : 500;

  const { error } = await supabase.from("outreach_senders").insert({
    user_id: user.id,
    email,
    display_name: displayName,
    provider: providerKey,
    app_password: preset.enforceAppPasswordFormat
      ? appPassword.replace(/\s+/g, "")
      : appPassword,
    smtp_host: smtpHost,
    smtp_port: smtpPort,
    smtp_secure: smtpSecure,
    imap_host: imapHost,
    imap_port: imapPort,
    imap_secure: imapSecure,
    daily_limit: defaultDailyLimit,
    status: "active",
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This sender is already connected" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

function humanizeVerifyError(raw: string, providerLabel: string): string {
  if (/Invalid login|Username and Password not accepted|535|BadCredentials/i.test(raw)) {
    return `${providerLabel} rejected those credentials. Double-check the email + password and (for Gmail/Yahoo/Outlook) confirm 2-step verification is enabled and the password is an APP PASSWORD, not your normal login password.`;
  }
  if (/SMTP AUTH/i.test(raw)) {
    return `${providerLabel} refused SMTP authentication. For Microsoft 365 mailboxes, an admin needs to enable SMTP AUTH for this user.`;
  }
  if (/timeout|ETIMEDOUT|ENOTFOUND|ECONNREFUSED/i.test(raw)) {
    return `Couldn't reach the ${providerLabel} SMTP server. Check the host + port and try again.`;
  }
  return raw.slice(0, 240);
}
