import { runReenrich } from "./reenrich-job.js";

// Background email-scrape jobs, one per scan_run. The "Scrape emails" button
// streams progress, but the actual work must NOT stop when the user switches
// tabs, navigates away, or the Vercel proxy hits its time limit. So the job
// runs here, decoupled from any single request: clients ATTACH to stream
// progress and DETACH on disconnect, while the job runs to full completion.
//
// In-memory + single worker instance (same assumption as the scrape slot pool).

type Evt = Record<string, unknown>;
type Listener = (e: Evt) => void;

type Job = {
  userId: string;
  startedAt: number;
  finished: boolean;
  // Latest progress frame — replayed to anyone who (re)attaches.
  snapshot: { phase: "progress"; done: number; total: number; newEmails: number };
  // Recent per-site frames (capped) so a reconnecting client sees a feed.
  feed: Evt[];
  result: Evt | null; // final 'done' or 'error' frame
  listeners: Set<Listener>;
};

const jobs = new Map<string, Job>();
const FEED_CAP = 40;
const RETAIN_AFTER_FINISH_MS = 120_000; // keep finished jobs for late reconnects

export function reenrichJobRunning(scanRunId: string): boolean {
  const j = jobs.get(scanRunId);
  return Boolean(j && !j.finished);
}

/**
 * Attach a listener to the scan_run's scrape job, starting it if not already
 * running. Immediately replays the current snapshot + recent feed (+ final
 * result if already finished) to the listener. Returns an unsubscribe fn —
 * calling it only detaches the listener; the job keeps running.
 */
export function attachReenrich(
  scanRunId: string,
  userId: string,
  listener: Listener
): () => void {
  const existing = jobs.get(scanRunId);

  if (existing) {
    listener({ ...existing.snapshot });
    for (const f of existing.feed) listener(f);
    if (existing.finished && existing.result) listener(existing.result);
    existing.listeners.add(listener);
    return () => existing.listeners.delete(listener);
  }

  const job: Job = {
    userId,
    startedAt: Date.now(),
    finished: false,
    snapshot: { phase: "progress", done: 0, total: 0, newEmails: 0 },
    feed: [],
    result: null,
    listeners: new Set([listener]),
  };
  jobs.set(scanRunId, job);

  const broadcast = (e: Evt) => {
    for (const l of job.listeners) {
      try {
        l(e);
      } catch {
        /* a dead client's writer threw — ignore, job continues */
      }
    }
  };

  // NO deadline → run every due lead to completion. The worker's harvest
  // concurrency + browser cap already bound resource use.
  runReenrich(scanRunId, userId, {
    onProgress: (p) => {
      job.snapshot = {
        phase: "progress",
        done: p.done,
        total: p.total,
        newEmails: p.newEmails,
      };
      const e: Evt = { phase: "progress", ...p };
      if (p.url) {
        job.feed.push(e);
        if (job.feed.length > FEED_CAP) job.feed.shift();
      }
      broadcast(e);
    },
  })
    .then((result) => {
      job.result = { phase: "done", ...result };
    })
    .catch((err) => {
      job.result = {
        phase: "error",
        message: err instanceof Error ? err.message : "Re-enrich failed",
      };
    })
    .finally(() => {
      job.finished = true;
      if (job.result) broadcast(job.result);
      setTimeout(() => jobs.delete(scanRunId), RETAIN_AFTER_FINISH_MS);
    });

  return () => job.listeners.delete(listener);
}
