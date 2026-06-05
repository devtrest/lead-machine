// Unibox / reply detection.
//
// Polls each active sender's Gmail INBOX via IMAP (same app password we use
// for SMTP send). For every new message:
//   1. Look up the sender (FROM address) in outreach_prospects scoped to
//      this user. Match found = it's a reply to one of our outreach
//      campaigns.
//   2. Insert into outreach_replies (idempotent via unique (sender_id,
//      message_id)).
//   3. Mark the matching prospect status='replied' so the autopilot stops
//      sending follow-ups.
//
// Cadence: scheduled every 10 minutes from server.ts.
// State: outreach_senders.last_inbox_check_at tracks the high-water mark per
// account so we only fetch messages newer than that.

import { ImapFlow, type FetchMessageObject } from "imapflow";
import { supabase } from "./db.js";

type SenderRow = {
  id: string;
  user_id: string;
  email: string;
  app_password: string;
  last_inbox_check_at: string | null;
};

export type InboxResult = {
  senders: number;
  fetched: number;
  matched: number;
  errors: number;
};

let running = false;

export async function runInboxCheck(): Promise<InboxResult> {
  if (running) {
    console.log("[inbox-check] previous run still active, skipping");
    return { senders: 0, fetched: 0, matched: 0, errors: 0 };
  }
  running = true;
  const t0 = Date.now();
  try {
    const result = await check();
    console.log(
      `[inbox-check] done in ${Date.now() - t0}ms — senders:${result.senders} fetched:${result.fetched} matched:${result.matched} errors:${result.errors}`
    );
    return result;
  } finally {
    running = false;
  }
}

async function check(): Promise<InboxResult> {
  const { data: senders, error } = await supabase
    .from("outreach_senders")
    .select(
      "id,user_id,email,app_password,last_inbox_check_at"
    )
    .eq("status", "active")
    .eq("provider", "gmail");

  if (error) {
    console.error("[inbox-check] fetch senders failed:", error);
    return { senders: 0, fetched: 0, matched: 0, errors: 1 };
  }
  if (!senders || senders.length === 0) {
    return { senders: 0, fetched: 0, matched: 0, errors: 0 };
  }

  let totalFetched = 0;
  let totalMatched = 0;
  let totalErrors = 0;

  for (const s of senders as SenderRow[]) {
    try {
      const { fetched, matched } = await checkSender(s);
      totalFetched += fetched;
      totalMatched += matched;
    } catch (err) {
      totalErrors += 1;
      console.error(
        `[inbox-check] sender ${s.email} failed:`,
        err instanceof Error ? err.message : err
      );
      // Flag the sender's last_error so the UI can show it. Don't flip to
      // status='error' — IMAP can flake and we want SMTP send to keep working.
      await supabase
        .from("outreach_senders")
        .update({
          last_error: err instanceof Error ? err.message : "IMAP error",
        })
        .eq("id", s.id);
    }
  }

  return {
    senders: senders.length,
    fetched: totalFetched,
    matched: totalMatched,
    errors: totalErrors,
  };
}

async function checkSender(s: SenderRow): Promise<{ fetched: number; matched: number }> {
  // Fetch messages newer than last check, or last 24h on first run.
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
  });

  await client.connect();
  let fetched = 0;
  let matched = 0;
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Pull every prospect address for this user once — used to filter
      // incoming messages to ones that match a campaign target.
      const { data: prospects } = await supabase
        .from("outreach_prospects")
        .select("id,email,lead_id,campaign_id")
        .eq("email", "__placeholder__"); // we'll requery per message below

      void prospects; // we'll use a query-per-message strategy instead

      for await (const msg of client.fetch(
        { since },
        {
          envelope: true,
          uid: true,
          source: true,
          bodyStructure: true,
        }
      )) {
        fetched += 1;
        const matchedOne = await ingestMessage(s, msg);
        if (matchedOne) matched += 1;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  // High-water mark — only advance on successful poll.
  await supabase
    .from("outreach_senders")
    .update({
      last_inbox_check_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", s.id);

  return { fetched, matched };
}

async function ingestMessage(
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

  // Try to match this incoming email to one of our outreach prospects
  // for the same user. Only count it as a reply if the from address is one
  // we've actually emailed in a campaign.
  const { data: prospect } = await supabase
    .from("outreach_prospects")
    .select("id,lead_id,campaign_id,outreach_campaigns!inner(user_id)")
    .eq("email", fromEmail)
    .eq("outreach_campaigns.user_id", sender.user_id)
    .maybeSingle();

  if (!prospect) {
    // Not a campaign reply — could be a personal message, a newsletter,
    // a colleague, etc. Skip without recording.
    return false;
  }

  const snippet = extractSnippet(msg);

  // Idempotent insert — the unique (sender_id, message_id) constraint
  // silently rejects duplicates if we re-poll.
  const { error: insErr } = await supabase
    .from("outreach_replies")
    .upsert(
      {
        user_id: sender.user_id,
        sender_id: sender.id,
        prospect_id: prospect.id,
        lead_id: prospect.lead_id,
        campaign_id: prospect.campaign_id,
        message_id: messageId,
        from_email: fromEmail,
        from_name: fromName,
        subject,
        snippet,
        received_at: receivedAt.toISOString(),
      },
      { onConflict: "sender_id,message_id", ignoreDuplicates: true }
    );

  if (insErr) {
    console.error("[inbox-check] reply insert failed:", insErr.message);
    return false;
  }

  // Mark the prospect as replied so the tick stops sending follow-ups.
  // Only flip if not already terminal (replied/bounced/completed) so we
  // don't undo a manual override.
  await supabase
    .from("outreach_prospects")
    .update({ status: "replied", next_send_at: null })
    .eq("id", prospect.id)
    .in("status", ["pending", "in_progress"]);

  return true;
}

function extractSnippet(msg: FetchMessageObject): string | null {
  if (!msg.source) return null;
  const text = msg.source.toString("utf-8", 0, Math.min(msg.source.length, 8192));
  // Strip headers — first blank line marks header/body boundary in RFC 822.
  const blank = text.indexOf("\r\n\r\n");
  const body = blank >= 0 ? text.slice(blank + 4) : text;
  // De-MIME-escape minimally + clean.
  return body
    .replace(/=\r?\n/g, "")
    .replace(/=[0-9A-F]{2}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
