"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export type JobRun = {
  id: string;
  source: string;
  keyword: string;
  location: string;
  status: "running" | "completed" | "failed" | string;
  limit_count: number;
  result_count: number;
  started_at: string;
  finished_at: string | null;
  error: string | null;
};

const POLL_INTERVAL_MS = 3_000;

export function JobsList({ initialRuns }: { initialRuns: JobRun[] }) {
  const [runs, setRuns] = useState<JobRun[]>(initialRuns);
  const [polling, setPolling] = useState(false);
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const anyRunning = useMemo(
    () => runs.some((r) => r.status === "running"),
    [runs]
  );

  // Polling effect: while any run is in progress, poll the API every 3s.
  // Stops automatically when nothing is running so we don't burn cycles
  // refreshing a static list.
  useEffect(() => {
    if (!anyRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setPolling(false);
      return;
    }
    setPolling(true);
    async function pollOnce() {
      try {
        const res = await fetch("/api/scan/runs", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { runs: JobRun[] };
        setRuns(json.runs ?? []);
        setLastPolledAt(Date.now());
      } catch {
        /* network blip — try again on next interval */
      }
    }
    pollOnce();
    timerRef.current = setInterval(pollOnce, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [anyRunning]);

  const running = runs.filter((r) => r.status === "running");
  const finished = runs.filter((r) => r.status !== "running");

  return (
    <div className="space-y-6">
      <LiveStatusStrip
        anyRunning={anyRunning}
        polling={polling}
        lastPolledAt={lastPolledAt}
        runningCount={running.length}
      />

      {running.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            Running now ({running.length})
          </h2>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {running.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </AnimatePresence>
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
          {running.length > 0 ? "Recent history" : "Recent jobs"}{" "}
          ({finished.length})
        </h2>
        {finished.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-[var(--ink-subtle)]" />
            <h3 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
              No jobs yet
            </h3>
            <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
              Click <span className="font-semibold">Generate</span> to kick off
              your first scrape. The job runs in the background — close this
              tab if you want.
            </p>
            <Link
              href="/user/generate"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
            >
              <Sparkles className="h-4 w-4" />
              Generate leads
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {finished.map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LiveStatusStrip({
  anyRunning,
  polling,
  lastPolledAt,
  runningCount,
}: {
  anyRunning: boolean;
  polling: boolean;
  lastPolledAt: number | null;
  runningCount: number;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
        anyRunning
          ? "border-[var(--brand-100)] bg-[var(--brand-50)]/60 text-[var(--brand-700)]"
          : "border-[var(--border)] bg-[var(--surface-sunken)]/40 text-[var(--ink-muted)]"
      }`}
    >
      {anyRunning ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="font-semibold">
            {runningCount} job{runningCount === 1 ? "" : "s"} running
          </span>
          <span>·</span>
          <RefreshCw
            className={`h-3 w-3 ${polling ? "animate-spin" : ""}`}
          />
          <span>
            Auto-refreshing every 3s
            {lastPolledAt ? ` · last poll ${timeAgoShort(lastPolledAt)}` : ""}
          </span>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success-700)]" />
          <span>All jobs are complete — nothing running right now.</span>
        </>
      )}
    </div>
  );
}

function RunCard({ run }: { run: JobRun }) {
  const pct =
    run.limit_count > 0
      ? Math.min(100, Math.round((run.result_count / run.limit_count) * 100))
      : 0;
  const elapsedMs =
    new Date(run.finished_at ?? Date.now()).getTime() -
    new Date(run.started_at).getTime();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="surface-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold capitalize text-[var(--ink-strong)]">
              {run.keyword}
            </h3>
            <span className="text-xs text-[var(--ink-muted)]">
              · {run.location}
            </span>
            <StatusPill status={run.status} />
          </div>
          <div className="mt-1 text-[11px] text-[var(--ink-subtle)]">
            Started {new Date(run.started_at).toLocaleString()}
            {run.status !== "running" ? (
              <>
                {" · "}
                {formatDuration(elapsedMs)}
              </>
            ) : (
              <>
                {" · "}
                {formatDuration(elapsedMs)} elapsed
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {run.status !== "failed" && run.result_count > 0 ? (
            <Link
              href={`/user/leads?campaign=${run.id}`}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-600)] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[var(--brand-700)]"
            >
              View leads
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
          <span>
            <span className="font-semibold tabular-nums text-[var(--ink-strong)]">
              {run.result_count.toLocaleString()}
            </span>
            {" / "}
            <span className="tabular-nums">
              {run.limit_count.toLocaleString()}
            </span>{" "}
            leads
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
          <motion.div
            className={`h-full rounded-full ${
              run.status === "failed"
                ? "bg-[var(--danger-500)]"
                : run.status === "completed"
                  ? "bg-[var(--success-500)]"
                  : "bg-gradient-to-r from-[var(--brand-500)] to-[var(--sky-500)]"
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {run.error ? (
        <div className="mt-2 rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">
          {run.error}
        </div>
      ) : null}
    </motion.div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--brand-700)]">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Running
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--success-100)] bg-[var(--success-50)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--success-700)]">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Done
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--danger-100)] bg-[var(--danger-50)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--danger-700)]">
        <XCircle className="h-2.5 w-2.5" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-sunken)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
      <Clock className="h-2.5 w-2.5" />
      {status}
    </span>
  );
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function timeAgoShort(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}
