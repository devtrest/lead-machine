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
import { simpleParser } from "mailparser";
import { supabase } from "./db.js";

type SenderRow = {
  id: string;
  user_id: string;
  email: string;
  app_password: string;
  last_inbox_check_at: string | null;
  provider: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean | null;
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
      "id,user_id,email,app_password,last_inbox_check_at,provider,imap_host,imap_port,imap_secure"
    )
    .eq("status", "active");

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
    // Skip senders that don't have an IMAP endpoint configured. Custom
    // SMTP-only senders (relays / outbound-only setups) don't have a
    // mailbox to poll and we shouldn't flag them as errored.
    if (!s.imap_host) continue;
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
    // Per-sender IMAP. Falls back to Gmail's defaults if the multi-provider
    // migration hasn't run yet on a given environment.
    host: s.imap_host ?? "imap.gmail.com",
    port: s.imap_port ?? 993,
    secure: s.imap_secure ?? true,
    auth: {
      user: s.email,
      pass: (s.provider ?? "gmail") === "gmail"
        ? s.app_password.replace(/\s+/g, "")
        : s.app_password,
    },
    logger: false,
    // Fail fast on a wedged connection so we don't sit idle for 30s+ while
    // Gmail's edge holds the socket open. Pair with the explicit 'error'
    // listener below so async socket timeouts can't crash the worker.
    socketTimeout: 30_000,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
  });

  // CRITICAL: imapflow's ImapFlow is an EventEmitter. If the underlying TLS
  // socket times out mid-operation it emits 'error' asynchronously. With no
  // listener, Node throws 'Unhandled error event' and kills the worker
  // process — Railway then restarts it and we lose retry state. Swallow it
  // here; the await calls below will reject independently and we handle
  // them in the outer try/catch.
  client.on("error", (err) => {
    console.warn(
      `[inbox-check] async IMAP error for ${s.email}:`,
      err instanceof Error ? err.message : err
    );
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
      // lock.release can throw on a dead socket — swallow it.
      try {
        lock.release();
      } catch {
        /* ignore */
      }
    }
  } finally {
    // logout can throw on a dead socket; close() is a synchronous force-kill
    // of the underlying TCP connection. Belt-and-suspenders so a wedged
    // connection can't leak into the next tick.
    await client.logout().catch(() => {});
    try {
      client.close();
    } catch {
      /* ignore */
    }
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

  // Match strategy (in order):
  //   1. Did we send to this address from this user? Anything in email_sends
  //      with recipient_email = fromEmail counts — covers real campaign
  //      sends, follow-ups, test sends, anything that left from us. If so:
  //      it's a reply, record it.
  //   2. If we ALSO have a prospect row with this email, link the reply to
  //      the prospect/lead/campaign so the autopilot stops sending
  //      follow-ups.
  //
  // Replies from random addresses we never emailed (newsletters, colleagues,
  // etc.) get skipped.

  const { data: priorSend } = await supabase
    .from("email_sends")
    .select("id,campaign_id,lead_id")
    .eq("user_id", sender.user_id)
    .eq("recipient_email", fromEmail)
    .limit(1)
    .maybeSingle();

  if (!priorSend) {
    return false;
  }

  const { data: prospect } = await supabase
    .from("outreach_prospects")
    .select("id,lead_id,campaign_id,outreach_campaigns!inner(user_id)")
    .eq("email", fromEmail)
    .eq("outreach_campaigns.user_id", sender.user_id)
    .maybeSingle();

  const snippet = await extractSnippet(msg);

  // Idempotent insert — unique (sender_id, message_id) rejects duplicates
  // if we re-poll.
  const { error: insErr } = await supabase
    .from("outreach_replies")
    .upsert(
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

  if (insErr) {
    console.error("[inbox-check] reply insert failed:", insErr.message);
    return false;
  }

  // If a campaign prospect exists for this address, mark it replied so the
  // tick stops sending follow-ups. Only flip non-terminal statuses.
  if (prospect) {
    await supabase
      .from("outreach_prospects")
      .update({ status: "replied", next_send_at: null })
      .eq("id", prospect.id)
      .in("status", ["pending", "in_progress"]);
  }

  return true;
}

// Pulls a clean ~500-char preview from the raw message source.
// mailparser handles MIME parsing, quoted-printable / base64 decoding,
// charset conversion, and picking the text/plain part of multipart messages.
// On top of that we strip the "On [date] [name] wrote:" attribution and the
// quoted lines that follow it (everything prefixed with ">") so the snippet
// shows only what the replier actually wrote, not the original message we
// sent them.
async function extractSnippet(
  msg: FetchMessageObject
): Promise<string | null> {
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

  // Cut at the "On [date], [name] <email> wrote:" attribution line. Matches
  // Gmail/Outlook/Apple Mail conventions.
  const attribution = text.match(
    /\n+On\s.{0,200}?wrote:\s*\n/i
  );
  if (attribution && attribution.index !== undefined) {
    text = text.slice(0, attribution.index);
  }

  // Strip quoted lines (anything starting with ">") line-by-line.
  text = text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");

  // Final normalize.
  return text.replace(/\s+/g, " ").trim().slice(0, 500) || null;
}
