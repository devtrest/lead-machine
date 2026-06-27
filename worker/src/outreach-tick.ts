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
  delay_unit?: "minutes" | "hours" | "days";
  subject: string;
  body: string;
};

// Convert a step's (delay_days, delay_unit) into milliseconds. delay_days is
// the magnitude; delay_unit decides what 1 unit means. Default 'days' keeps
// legacy rows working without a backfill.
function stepDelayMs(step: Step): number {
  const v = Math.max(0, step.delay_days);
  if (step.delay_unit === "minutes") return v * 60 * 1000;
  if (step.delay_unit === "hours") return v * 60 * 60 * 1000;
  return v * 24 * 60 * 60 * 1000;
}

type Sender = {
  id: string;
  email: string;
  display_name: string | null;
  app_password: string;
  daily_limit: number;
  sends_today: number;
  last_reset_at: string;
  status: string;
  // Multi-provider SMTP — null for legacy Gmail rows that pre-date the
  // migration. transporterFor() falls back to Gmail's defaults in that case.
  provider: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
};

type ActiveCampaign = {
  id: string;
  user_id: string;
  name: string;
  steps: Step[];
  senderName: string;
  replyTo: string | null;
  senders: Sender[];      // active senders assigned to this campaign
  sendWindowStart: string; // "09:00"
  sendWindowEnd: string;   // "17:00"
  sendDays: string[];      // ['mon','tue',...]
  timezone: string;        // "America/New_York"
  dailyLimit: number;      // total emails this campaign can send per UTC day
  sentToday: number;       // already-sent count for today (loaded at tick start)
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

type TickOpts = {
  // fast mode (set by the "Send all now" button):
  //   - skips inter-send humanization sleeps
  //   - ignores send window (timezone + days + hours)
  //   - ignores daily_limit cap
  //   - filters to the single campaign we want to blast
  fast?: boolean;
  campaignId?: string;
};

export async function runOutreachTick(opts: TickOpts = {}): Promise<TickResult> {
  if (running) {
    console.log("[outreach-tick] previous tick still running, skipping");
    return { campaigns: 0, due: 0, sent: 0, failed: 0, skipped: 0 };
  }
  running = true;
  const t0 = Date.now();
  try {
    const result = await tick(opts);
    console.log(
      `[outreach-tick]${opts.fast ? " (fast)" : ""} tick done in ${Date.now() - t0}ms — campaigns:${result.campaigns} due:${result.due} sent:${result.sent} failed:${result.failed} skipped:${result.skipped}`
    );
    return result;
  } finally {
    running = false;
  }
}

async function tick(opts: TickOpts = {}): Promise<TickResult> {
  // 1. Fetch all active campaigns (with steps, schedule, sender refs, limit).
  let campaignsQuery = supabase
    .from("outreach_campaigns")
    .select(
      "id,user_id,name,send_window_start,send_window_end,send_days,timezone,daily_limit,outreach_steps(step_order,delay_days,delay_unit,subject,body),outreach_campaign_senders(sender_id)"
    )
    .eq("status", "active");
  if (opts.campaignId) {
    campaignsQuery = campaignsQuery.eq("id", opts.campaignId);
  }
  const { data: campaignsRaw, error: campErr } = await campaignsQuery;

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
    daily_limit: number;
    outreach_steps: Step[];
    outreach_campaign_senders: { sender_id: string }[];
  }>;

  console.log(
    `[outreach-tick] found ${campaigns.length} active campaign(s)`
  );

  if (campaigns.length === 0) {
    return { campaigns: 0, due: 0, sent: 0, failed: 0, skipped: 0 };
  }

  // 2. Resolve user profiles + active senders + today's sends per campaign.
  const userIds = Array.from(new Set(campaigns.map((c) => c.user_id)));
  const campaignIdsAll = campaigns.map((c) => c.id);
  const todayMidnightUtc = new Date();
  todayMidnightUtc.setUTCHours(0, 0, 0, 0);
  const [profilesRes, sendersRes, todaySendsRes] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email").in("id", userIds),
    supabase
      .from("outreach_senders")
      .select(
        "id,user_id,email,display_name,app_password,daily_limit,sends_today,last_reset_at,status,provider,smtp_host,smtp_port,smtp_secure"
      )
      .in("user_id", userIds)
      .eq("status", "active"),
    supabase
      .from("email_sends")
      .select("campaign_id")
      .in("campaign_id", campaignIdsAll)
      .eq("status", "sent")
      .gte("sent_at", todayMidnightUtc.toISOString()),
  ]);

  // Bucket today's sends by campaign so we can enforce daily_limit.
  const sentTodayByCampaign = new Map<string, number>();
  for (const row of todaySendsRes.data ?? []) {
    const cid = row.campaign_id as string;
    sentTodayByCampaign.set(cid, (sentTodayByCampaign.get(cid) ?? 0) + 1);
  }
  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [
      p.id as string,
      {
        full_name: (p.full_name as string | null) ?? null,
        email: (p.email as string | null) ?? null,
      },
    ])
  );
  const sendersById = new Map<string, Sender>();
  for (const s of sendersRes.data ?? []) {
    // Roll over sends_today at midnight UTC. Tick will UPDATE the row when
    // we actually use a sender below.
    const lastReset = s.last_reset_at as string;
    const today = new Date().toISOString().slice(0, 10);
    const sendsToday = lastReset === today ? (s.sends_today as number) : 0;
    sendersById.set(s.id as string, {
      id: s.id as string,
      email: s.email as string,
      display_name: (s.display_name as string | null) ?? null,
      app_password: s.app_password as string,
      daily_limit: s.daily_limit as number,
      sends_today: sendsToday,
      last_reset_at: today,
      status: s.status as string,
      provider: (s.provider as string | null) ?? "gmail",
      smtp_host: (s.smtp_host as string | null) ?? null,
      smtp_port: (s.smtp_port as number | null) ?? null,
      smtp_secure: (s.smtp_secure as boolean | null) ?? null,
    });
  }

  // 3. Build campaign map, filtering out those outside their send window OR
  //    those with no usable senders.
  const campaignMap = new Map<string, ActiveCampaign>();
  let skippedOutOfWindow = 0;
  for (const c of campaigns) {
    const prof = profileMap.get(c.user_id);
    const senderName =
      prof?.full_name?.trim() || prof?.email || "your team";
    const steps = (c.outreach_steps ?? [])
      .slice()
      .sort((a, b) => a.step_order - b.step_order);

    const assignedSenders = (c.outreach_campaign_senders ?? [])
      .map((rel) => sendersById.get(rel.sender_id))
      .filter((s): s is Sender => Boolean(s));

    // Fallback: if no senders are assigned to a campaign yet, allow the
    // legacy env-var Gmail to keep working. New campaigns from the wizard
    // will always have at least one sender assigned.
    const hasEnvSender = Boolean(
      process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    );
    if (assignedSenders.length === 0 && !hasEnvSender) {
      console.warn(
        `[outreach-tick] campaign "${c.name}" has no senders assigned and no env fallback — skipping`
      );
      skippedOutOfWindow += 1;
      continue;
    }

    const active: ActiveCampaign = {
      id: c.id,
      user_id: c.user_id,
      name: c.name,
      steps,
      senderName,
      replyTo: prof?.email ?? null,
      senders: assignedSenders,
      sendWindowStart: c.send_window_start ?? "09:00",
      sendWindowEnd: c.send_window_end ?? "17:00",
      sendDays: c.send_days ?? ["mon", "tue", "wed", "thu", "fri"],
      timezone: c.timezone ?? "UTC",
      dailyLimit: c.daily_limit ?? 50,
      sentToday: sentTodayByCampaign.get(c.id) ?? 0,
    };

    if (!opts.fast && !isWithinSendWindow(active)) {
      console.log(
        `[outreach-tick] campaign "${active.name}" out of window (${active.sendWindowStart}-${active.sendWindowEnd} ${active.timezone}), skipping`
      );
      skippedOutOfWindow += 1;
      continue;
    }
    if (!opts.fast && active.sentToday >= active.dailyLimit) {
      console.log(
        `[outreach-tick] campaign "${active.name}" hit daily limit (${active.sentToday}/${active.dailyLimit}), deferring to tomorrow`
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

    // Stop sending this campaign if today's quota is exhausted. Defer the
    // remaining prospects to tomorrow midnight UTC so they get a fresh
    // budget on the next tick after rollover. Skipped in fast mode — the
    // "Send all now" button overrides daily caps by design.
    if (!opts.fast && campaign.sentToday >= campaign.dailyLimit) {
      const tomorrow = new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      await supabase
        .from("outreach_prospects")
        .update({ next_send_at: tomorrow.toISOString() })
        .eq("id", p.id);
      continue;
    }

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
    // Fast mode (the "Send all now" button) bypasses this so the whole queue
    // fires instantly — used for demos / urgent blasts where instant is
    // worth the spam-rating tradeoff.
    if (i > 0 && !opts.fast) {
      const delay = randInRange(MIN_INTER_SEND_MS, MAX_INTER_SEND_MS);
      console.log(
        `[outreach-tick] waiting ${Math.round(delay / 1000)}s before next send (humanization)`
      );
      await sleep(delay);
    }

    console.log(
      `[outreach-tick] sending step ${nextStepOrder} → ${p.email} (campaign "${campaign.name}")`
    );

    // Round-robin across the campaign's connected senders so usage stays
    // balanced across accounts. Skips senders at Gmail's daily ceiling.
    const pickedSender = pickRoundRobin(campaign.id, campaign.senders);
    if (!pickedSender && campaign.senders.length > 0) {
      console.warn(
        `[outreach-tick] all senders for "${campaign.name}" at daily limit, deferring`
      );
      // Try again in 4 hours (might be past midnight UTC and limits reset).
      await supabase
        .from("outreach_prospects")
        .update({
          next_send_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", p.id);
      continue;
    }

    // Generate unique open token for this send (tracking pixel URL).
    const openToken = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    const trackedHtml = injectTrackingPixel(bodyToHtml(renderedBody), openToken);

    const sendOutcome = await sendEmail({
      to: p.email,
      subject: renderedSubject,
      html: trackedHtml,
      replyTo: campaign.replyTo,
      sender: pickedSender,
    });

    if (sendOutcome.ok) {
      sent += 1;
      campaign.sentToday += 1; // local counter so subsequent loop iterations see the new total
      const stepAfter = campaign.steps.find(
        (s) => s.step_order === nextStepOrder + 1
      );
      const newNextSendAt = stepAfter
        ? new Date(Date.now() + stepDelayMs(stepAfter)).toISOString()
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

      await insertEmailSend({
        user_id: campaign.user_id,
        lead_id: p.lead_id,
        scan_run_id: null,
        campaign_id: campaign.id,
        sender_id: pickedSender?.id ?? null,
        step_order: nextStepOrder,
        recipient_email: p.email,
        subject: renderedSubject,
        body: renderedBody,
        status: "sent",
        provider_message_id: sendOutcome.id,
        attachment_count: 0,
        sent_at: new Date().toISOString(),
        open_token: openToken,
      });

      // Increment sender's sends_today counter (DB tracking — independent of
      // the in-memory `pickedSender.sends_today` we updated for batch logic).
      if (pickedSender) {
        await supabase
          .from("outreach_senders")
          .update({
            sends_today: pickedSender.sends_today,
            last_reset_at: pickedSender.last_reset_at,
          })
          .eq("id", pickedSender.id);
      }
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

      await insertEmailSend({
        user_id: campaign.user_id,
        lead_id: p.lead_id,
        scan_run_id: null,
        campaign_id: campaign.id,
        sender_id: pickedSender?.id ?? null,
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

// Insert an email_sends row, tolerating a DB that hasn't run the sender_id
// migration yet. If the column is missing, Postgres errors on the unknown
// column; we strip sender_id and retry so sending never breaks on deploy
// ordering (worker code can ship before the migration is applied).
async function insertEmailSend(
  row: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("email_sends").insert(row);
  if (!error) return;
  if (/sender_id/i.test(error.message)) {
    const { sender_id: _omit, ...rest } = row;
    void _omit;
    const retry = await supabase.from("email_sends").insert(rest);
    if (retry.error) {
      console.error(
        "[outreach-tick] email_sends insert failed (post-retry):",
        retry.error.message
      );
    }
    return;
  }
  console.error("[outreach-tick] email_sends insert failed:", error.message);
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
  sender: Sender | null;
};

async function sendEmail(args: SendArgs): Promise<SendOutcome> {
  // Preferred path: a sender row from the DB (one of the user's connected
  // Gmail accounts).
  if (args.sender) {
    const result = await sendViaGmailWith(args.sender, args);
    if (result.ok) {
      args.sender.sends_today += 1;
    }
    return result;
  }
  // Fallback: legacy env-var Gmail (still works for users who haven't
  // migrated to the senders table).
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return sendViaEnvGmail(args);
  }
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(args);
  }
  console.log("[outreach-tick] (no sender configured — logging)");
  console.log("[outreach-tick] to:", args.to, "subject:", args.subject);
  return { ok: true, id: "console-log-" + Date.now() };
}

// Round-robin sender rotation. Each campaign keeps an in-memory cursor that
// advances once per send so consecutive sends cycle through senders evenly.
// Senders that have hit their per-account daily ceiling are skipped (rare —
// the ceiling is Gmail's ~500/day, not a user-set cap).
const rrCursor = new Map<string, number>();

function pickRoundRobin(
  campaignId: string,
  senders: Sender[]
): Sender | null {
  if (senders.length === 0) return null;
  let cursor = rrCursor.get(campaignId) ?? 0;
  // Walk at most senders.length positions before giving up — covers the case
  // where every sender is at daily cap.
  for (let i = 0; i < senders.length; i++) {
    const idx = (cursor + i) % senders.length;
    const candidate = senders[idx];
    if (candidate.daily_limit - candidate.sends_today > 0) {
      rrCursor.set(campaignId, (idx + 1) % senders.length);
      return candidate;
    }
  }
  return null;
}

// Per-sender transporter cache so we only build one nodemailer connection
// per (user, gmail-address) pair across the worker's lifetime.
//
// Tunings against the "Connection timeout" failure mode we hit when Gmail
// throttles the IP:
//   - port 587 + STARTTLS instead of 465 + implicit TLS. Same protocol; 587
//     is the more universally-routed of the two and we've seen it stay open
//     when 465 silently drops.
//   - explicit timeouts so we fail in ~25s instead of waiting the default
//     60s. Faster fail = faster retry on next tick = shorter outage window.
//   - pool:true keeps an open connection across sends for the same sender,
//     which avoids repeated handshakes that Gmail can rate-limit.
//   - on error, we EVICT the cached transporter so the next send for that
//     sender builds a fresh one — protects against a wedged socket sticking
//     around forever.
const transporterCache = new Map<string, Transporter>();

function transporterFor(sender: Sender): Transporter {
  let t = transporterCache.get(sender.id);
  if (t) return t;
  // Per-sender SMTP host. Falls back to Gmail's defaults (smtp.gmail.com:465
  // implicit-TLS) for legacy rows that pre-date the multi-provider migration.
  // For Gmail-style senders the app-password whitespace strip stays. Other
  // providers may have meaningful whitespace so we leave the password alone.
  const host = sender.smtp_host ?? "smtp.gmail.com";
  const port = sender.smtp_port ?? 465;
  const secure = sender.smtp_secure ?? true;
  const isGmail = (sender.provider ?? "gmail") === "gmail";
  t = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    connectionTimeout: 25_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth: {
      user: sender.email,
      pass: isGmail ? sender.app_password.replace(/\s+/g, "") : sender.app_password,
    },
    family: 4,
  } as Parameters<typeof nodemailer.createTransport>[0]);
  transporterCache.set(sender.id, t);
  return t;
}

function evictTransporter(senderId: string): void {
  const t = transporterCache.get(senderId);
  if (t) {
    try {
      t.close();
    } catch {
      /* ignore */
    }
    transporterCache.delete(senderId);
  }
}

async function sendViaGmailWith(
  sender: Sender,
  args: SendArgs
): Promise<SendOutcome> {
  const fromName = sender.display_name?.trim();
  const from = fromName ? `${fromName} <${sender.email}>` : `<${sender.email}>`;

  // RELAY-VIA-VERCEL: Google silently drops TCP from Railway's egress IPs to
  // smtp.gmail.com (anti-spam blocklist), so direct nodemailer SMTP from the
  // worker times out at the socket layer every time. We POST the send payload
  // to a Vercel internal endpoint which does the actual nodemailer.sendMail()
  // from AWS Lambda's egress — those IPs aren't blocked. The endpoint is
  // protected with the same WORKER_TOKEN we use for /scrape.
  //
  // Local-direct fallback: if WORKER_RELAY_URL is unset we fall back to the
  // old direct-SMTP path, which still works from anywhere except Railway.
  const relayUrl = (
    process.env.WORKER_RELAY_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  ).replace(/\/$/, "");
  const token = process.env.WORKER_TOKEN?.trim();

  if (relayUrl && token) {
    try {
      const res = await fetch(`${relayUrl}/api/worker/send-mail`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          senderEmail: sender.email,
          senderPassword: sender.app_password,
          from,
          to: args.to,
          subject: args.subject,
          html: args.html,
          replyTo: args.replyTo,
          // Per-sender SMTP routing — relay now knows which host to dial
          // instead of always going to smtp.gmail.com. Legacy rows without
          // these columns pass null and the relay falls back to Gmail.
          smtpHost: sender.smtp_host,
          smtpPort: sender.smtp_port,
          smtpSecure: sender.smtp_secure,
          provider: sender.provider,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };
      if (res.ok && json.ok && json.id) {
        return { ok: true, id: json.id };
      }
      return {
        ok: false,
        error: json.error ?? `Relay returned ${res.status}`,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Relay network error",
      };
    }
  }

  // Direct path — kept for local dev and any env that doesn't have the relay
  // env vars configured.
  try {
    const info = await transporterFor(sender).sendMail({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
    });
    return { ok: true, id: info.messageId || `gmail-${Date.now()}` };
  } catch (err) {
    evictTransporter(sender.id);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gmail SMTP error",
    };
  }
}

// Legacy env-var Gmail (for users who haven't moved to per-user senders yet).
let envGmailTransporter: Transporter | null = null;
function getEnvGmailTransporter(): Transporter {
  if (envGmailTransporter) return envGmailTransporter;
  envGmailTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    connectionTimeout: 25_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, ""),
    },
    family: 4,
  } as Parameters<typeof nodemailer.createTransport>[0]);
  return envGmailTransporter;
}

async function sendViaEnvGmail(args: SendArgs): Promise<SendOutcome> {
  const user = process.env.GMAIL_USER!;
  const from = user.includes("<") ? user : `<${user}>`;
  try {
    const info = await getEnvGmailTransporter().sendMail({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
    });
    return { ok: true, id: info.messageId || `gmail-${Date.now()}` };
  } catch (err) {
    try {
      envGmailTransporter?.close();
    } catch {
      /* ignore */
    }
    envGmailTransporter = null;
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gmail SMTP error",
    };
  }
}

// Inject a 1x1 tracking pixel at the end of the email body. When the
// recipient's mail client renders the email, it fetches the pixel from our
// /api/track/open/[token] endpoint which logs the open.
function injectTrackingPixel(html: string, token: string): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://lead-machine-m9i9.vercel.app";
  const pixel = `<img src="${appUrl}/api/track/open/${token}" width="1" height="1" style="display:none;border:0;" alt="" />`;
  return html + pixel;
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
