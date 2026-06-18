import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import dns from "node:dns";
import { runScrapeJob, type JobEvent } from "./scrape-job.js";
import { supabase } from "./db.js";
import { runOutreachTick } from "./outreach-tick.js";
import { runInboxCheck } from "./inbox-check.js";
import { runTrialCharge } from "./trial-charge.js";
import { runReenrich } from "./reenrich-job.js";

// Force IPv4 first for ALL DNS lookups in this process. Railway's egress
// IPv6 routing to Google's edge (smtp.gmail.com, imap.gmail.com) is unreliable
// — Node 22 default of 'verbatim' result order often picks the AAAA record
// first, the socket hangs because Google's edge doesn't accept Railway's
// IPv6 reverse-DNS, and we wait the full 30s socketTimeout before nodemailer
// gives up. Forcing IPv4 picks the A record path which Google's edge accepts
// from any cloud egress. Fixes the cascading "Connection timeout" failure
// mode we hit on every outreach tick.
dns.setDefaultResultOrder("ipv4first");

// Last-resort safety nets so a stray async error (e.g. an IMAP socket timeout
// emitting 'error' on an unwatched EventEmitter) can't crash the whole worker.
// Railway restarts on crash, but each restart drops in-memory state (sender
// rotation cursor, transporter cache, scheduler positions) and a tick loop
// that's mid-batch leaves prospects in inconsistent retry state.
process.on("uncaughtException", (err) => {
  console.error("[worker] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[worker] unhandledRejection:", reason);
});

const app = express();
app.use(express.json({ limit: "1mb" }));

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = process.env.WORKER_TOKEN?.trim();
  if (!token) {
    res.status(500).json({ error: "Worker missing WORKER_TOKEN" });
    return;
  }
  const header = req.headers.authorization ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (provided !== token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, activeScrapes, maxScrapes: MAX_CONCURRENT_SCRAPES });
});

// Bound how many scrapes run at once on this instance so a burst of campaigns
// (many users at once) can't exhaust memory / sockets / Places quota. Extra
// requests queue — their SSE connection is held open by the heartbeat — until a
// slot frees. To scale past one box, run multiple worker replicas behind the
// same WORKER_URL (the DB is the shared source of truth) and/or raise this.
const MAX_CONCURRENT_SCRAPES = Number(process.env.SCRAPE_CONCURRENCY) || 12;
let activeScrapes = 0;
const scrapeWaiters: Array<() => void> = [];
async function acquireScrapeSlot(): Promise<void> {
  if (activeScrapes >= MAX_CONCURRENT_SCRAPES) {
    await new Promise<void>((resolve) => scrapeWaiters.push(resolve));
  }
  activeScrapes++;
}
function releaseScrapeSlot(): void {
  activeScrapes = Math.max(0, activeScrapes - 1);
  scrapeWaiters.shift()?.();
}

app.post("/scrape", requireAuth, async (req, res) => {
  const { scanRunId, userId, keyword, location, target } = (req.body ?? {}) as {
    scanRunId?: string;
    userId?: string;
    keyword?: string;
    location?: string;
    target?: number;
  };

  if (
    typeof scanRunId !== "string" ||
    typeof userId !== "string" ||
    typeof keyword !== "string" ||
    typeof location !== "string" ||
    typeof target !== "number"
  ) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: JobEvent | { phase: "error"; message: string }) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      /* response closed */
    }
  };

  // Heartbeat every 15s — keeps proxies from closing the stream during
  // long Puppeteer phases where no progress events fire.
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      /* response closed */
    }
  }, 15_000);

  // Wait for a free slot (heartbeat keeps the stream alive while queued).
  await acquireScrapeSlot();

  try {
    await runScrapeJob({
      scanRunId,
      userId,
      keyword,
      location,
      target,
      onEvent: send,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "The lead engine couldn't complete this run.";
    console.error("[/scrape]", err);

    await supabase
      .from("scan_runs")
      .update({
        status: "failed",
        error: message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", scanRunId)
      .then(({ error }) => {
        if (error) console.error("[/scrape] mark failed", error);
      });

    send({ phase: "error", message });
  } finally {
    releaseScrapeSlot();
    clearInterval(heartbeat);
    res.end();
  }
});

// Re-enrich endpoint — re-runs email harvesting against the existing leads
// in a scan_run without re-scraping Google Places. Lets a user fill in
// missing emails for a campaign that was enriched under an older / slower
// code version. Fire-and-forget on the caller side: we kick off the work and
// return immediately so the Vercel function doesn't time out at 30s on
// large campaigns.
app.post("/scrape/reenrich", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { scanRunId?: unknown; userId?: unknown };
  const scanRunId =
    typeof body.scanRunId === "string" ? body.scanRunId : null;
  const userId = typeof body.userId === "string" ? body.userId : null;
  if (!scanRunId || !userId) {
    res.status(400).json({ error: "scanRunId and userId are required" });
    return;
  }
  // Acknowledge fast — the actual work runs after the response is sent.
  res.json({ ok: true, queued: true });
  void runReenrich(scanRunId, userId).catch((err) => {
    console.error("[/scrape/reenrich]", err);
  });
});

// Outreach autopilot — manual trigger endpoint for testing + on-demand kicks.
// Same Bearer auth as /scrape; lets the frontend force a tick after a user
// clicks "Start Campaign" so the first send fires within seconds instead of
// waiting for the next interval.
app.post("/outreach/tick", requireAuth, async (req, res) => {
  try {
    const body = (req.body ?? {}) as { fast?: unknown; campaignId?: unknown };
    const result = await runOutreachTick({
      fast: body.fast === true,
      campaignId:
        typeof body.campaignId === "string" ? body.campaignId : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error("[/outreach/tick]", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Tick failed" });
  }
});

// Manual inbox poll — triggered from the Inbox page's "Check now" button so
// users don't wait up to 10 minutes for the next scheduled IMAP poll.
app.post("/inbox/check", requireAuth, async (_req, res) => {
  try {
    const result = await runInboxCheck();
    res.json(result);
  } catch (err) {
    console.error("[/inbox/check]", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Inbox check failed" });
  }
});

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`[lead-machine-worker] listening on :${PORT}`);

  // Background autopilot — outreach tick every 15 min, inbox check every
  // 10 min. Each guards against re-entry with its own running flag.
  const FIFTEEN_MIN_MS = 15 * 60 * 1000;
  const TEN_MIN_MS = 10 * 60 * 1000;

  setTimeout(() => {
    runOutreachTick().catch((err) =>
      console.error("[outreach-tick] initial run failed:", err)
    );
    setInterval(() => {
      runOutreachTick().catch((err) =>
        console.error("[outreach-tick] interval run failed:", err)
      );
    }, FIFTEEN_MIN_MS);
  }, 30_000);

  // Inbox check starts 60s after boot (gives the outreach-tick room) and
  // then runs every 10 min independently.
  setTimeout(() => {
    runInboxCheck().catch((err) =>
      console.error("[inbox-check] initial run failed:", err)
    );
    setInterval(() => {
      runInboxCheck().catch((err) =>
        console.error("[inbox-check] interval run failed:", err)
      );
    }, TEN_MIN_MS);
  }, 60_000);

  // Trial conversion runs hourly. First run after 2 min of warmup so the
  // worker is fully online and Vercel's webhook surface is reachable. Stripe
  // off-session PaymentIntents fire payment_intent.succeeded webhooks which
  // Vercel handles — the worker just kicks off the charges.
  const ONE_HOUR_MS = 60 * 60 * 1000;
  setTimeout(() => {
    runTrialCharge().catch((err) =>
      console.error("[trial-charge] initial run failed:", err)
    );
    setInterval(() => {
      runTrialCharge().catch((err) =>
        console.error("[trial-charge] interval run failed:", err)
      );
    }, ONE_HOUR_MS);
  }, 120_000);
});
