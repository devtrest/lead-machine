import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { runScrapeJob, type JobEvent } from "./scrape-job.js";
import { supabase } from "./db.js";
import { runOutreachTick } from "./outreach-tick.js";

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
  res.json({ ok: true });
});

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
    clearInterval(heartbeat);
    res.end();
  }
});

// Outreach autopilot — manual trigger endpoint for testing + on-demand kicks.
// Same Bearer auth as /scrape; lets the frontend force a tick after a user
// clicks "Start Campaign" so the first send fires within seconds instead of
// waiting for the next interval.
app.post("/outreach/tick", requireAuth, async (_req, res) => {
  try {
    const result = await runOutreachTick();
    res.json(result);
  } catch (err) {
    console.error("[/outreach/tick]", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Tick failed" });
  }
});

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`[lead-machine-worker] listening on :${PORT}`);

  // Background autopilot — fires every 15 min while the worker is up.
  // First tick after 30 s of warmup so the server is reachable when Railway
  // probes /health.
  const FIFTEEN_MIN_MS = 15 * 60 * 1000;
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
});
