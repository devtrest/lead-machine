// Manual inbox check — handles the "Check now" button in the unified inbox.
//
// Previously this just poked the Railway worker's /inbox/check endpoint,
// but Railway's egress to imap.gmail.com is unreliable (same anti-spam IP
// blocklist that wrecked SMTP) so we'd get "Command failed" / "Socket
// timeout" every other try. Vercel's AWS Lambda egress works fine, so we
// run the IMAP poll right here.
//
// The worker still has its scheduled 10-minute poll as a fallback — when
// it succeeds it advances the high-water mark too — but the manual button
// is now always-reliable and that's what matters for "I just sent a test
// and want to see the reply RIGHT NOW".

import { NextResponse } from "next/server";
import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type SenderRow = {
  id: string;
  user_id: string;
  email: string;
  app_password: string;
  last_inbox_check_at: string | null;
};

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role key not configured");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST() {
  const authed = await createAuthedClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = serviceRoleClient();
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Service role not configured",
      },
      { status: 500 }
    );
  }

  const { data: senders, error } = await admin
    .from("outreach_senders")
    .select("id,user_id,email,app_password,last_inbox_check_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("provider", "gmail");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!senders || senders.length === 0) {
    return NextResponse.json({ senders: 0, fetched: 0, matched: 0, errors: 0 });
  }

  let totalFetched = 0;
  let totalMatched = 0;
  let totalErrors = 0;

  for (const s of senders as SenderRow[]) {
    try {
      const { fetched, matched } = await checkSender(admin, s);
      totalFetched += fetched;
      totalMatched += matched;
      await admin
        .from("outreach_senders")
        .update({
          last_inbox_check_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", s.id);
    } catch (err) {
      totalErrors += 1;
      const msg = err instanceof Error ? err.message : "IMAP error";
      await admin
        .from("outreach_senders")
        .update({ last_error: friendlyError(msg) })
        .eq("id", s.id);
    }
  }

  return NextResponse.json({
    senders: senders.length,
    fetched: totalFetched,
    matched: totalMatched,
    errors: totalErrors,
  });
}

async function checkSender(
  admin: ReturnType<typeof serviceRoleClient>,
  s: SenderRow
): Promise<{ fetched: number; matched: number }> {
  const since = s.last_inbox_check_at
    ? new Date(s.last_inbox_check_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: s.email,
      pass: s.app_password.replace(/\s+/g, ""),
    },
    logger: false,
    socketTimeout: 30_000,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
  });

  client.on("error", () => {
    /* handled via promise rejections below */
  });

  await client.connect();
  let fetched = 0;
  let matched = 0;
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      for await (const msg of client.fetch(
        { since },
        { envelope: true, uid: true, source: true, bodyStructure: true }
      )) {
        fetched += 1;
        const matchedOne = await ingestMessage(admin, s, msg);
        if (matchedOne) matched += 1;
      }
    } finally {
      try {
        lock.release();
      } catch {
        /* ignore */
      }
    }
  } finally {
    await client.logout().catch(() => {});
    try {
      client.close();
    } catch {
      /* ignore */
    }
  }

  return { fetched, matched };
}

async function ingestMessage(
  admin: ReturnType<typeof serviceRoleClient>,
  sender: SenderRow,
  msg: FetchMessageObject
): Promise<boolean> {
  const env = msg.envelope;
  if (!env) return false;
  const fromAddr = env.from?.[0];
  if (!fromAddr?.address) return false;
  const fromEmail = fromAddr.address.toLowerCase();
  const fromName = fromAddr.name ?? null;
  const subject = env.subject ?? null;
  const messageId = env.messageId ?? null;
  const receivedAt = env.date ?? new Date();

  const { data: priorSend } = await admin
    .from("email_sends")
    .select("id,campaign_id,lead_id")
    .eq("user_id", sender.user_id)
    .eq("recipient_email", fromEmail)
    .limit(1)
    .maybeSingle();

  // Only ingest replies to addresses we actually sent to. Newsletters and
  // colleagues get skipped.
  if (!priorSend) return false;

  const { data: prospect } = await admin
    .from("outreach_prospects")
    .select("id,lead_id,campaign_id,outreach_campaigns!inner(user_id)")
    .eq("email", fromEmail)
    .eq("outreach_campaigns.user_id", sender.user_id)
    .maybeSingle();

  const snippet = await extractSnippet(msg);

  const { error: insErr } = await admin.from("outreach_replies").upsert(
    {
      user_id: sender.user_id,
      sender_id: sender.id,
      prospect_id: prospect?.id ?? null,
      lead_id: prospect?.lead_id ?? priorSend.lead_id ?? null,
      campaign_id: prospect?.campaign_id ?? priorSend.campaign_id ?? null,
      message_id: messageId,
      from_email: fromEmail,
      from_name: fromName,
      subject,
      snippet,
      received_at: receivedAt.toISOString(),
    },
    { onConflict: "sender_id,message_id", ignoreDuplicates: true }
  );

  if (insErr) return false;

  if (prospect) {
    await admin
      .from("outreach_prospects")
      .update({ status: "replied", next_send_at: null })
      .eq("id", prospect.id)
      .in("status", ["pending", "in_progress"]);
  }

  return true;
}

async function extractSnippet(msg: FetchMessageObject): Promise<string | null> {
  if (!msg.source) return null;
  let text: string;
  try {
    const parsed = await simpleParser(msg.source);
    const htmlText =
      typeof parsed.html === "string"
        ? parsed.html.replace(/<[^>]+>/g, " ")
        : null;
    text = parsed.text ?? htmlText ?? "";
  } catch {
    return null;
  }
  if (!text) return null;

  const attribution = text.match(/\n+On\s.{0,200}?wrote:\s*\n/i);
  if (attribution && attribution.index !== undefined) {
    text = text.slice(0, attribution.index);
  }
  text = text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
  return text.replace(/\s+/g, " ").trim().slice(0, 500) || null;
}

function friendlyError(raw: string): string {
  if (/Invalid login|Authentication|535|BadCredentials/i.test(raw)) {
    return "Authentication failed — the Gmail app password may have been revoked.";
  }
  if (/timeout|ETIMEDOUT/i.test(raw)) {
    return "Couldn't reach imap.gmail.com — try again in a minute.";
  }
  if (/Command failed/i.test(raw)) {
    return "Gmail rejected the IMAP command. If this persists, regenerate the app password.";
  }
  return raw.slice(0, 200);
}
