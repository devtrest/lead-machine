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
  Radar,
  Globe,
  Play,
  StopCircle,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

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

  // When the server data refreshes (e.g. GenerateForm calls router.refresh()
  // right after starting a campaign), adopt it immediately so the new run
  // appears without a manual page refresh — and so polling kicks in for it.
  useEffect(() => {
    setRuns(initialRuns);
  }, [initialRuns]);

  const anyRunning = useMemo(
    () => runs.some((r) => r.status === "running"),
    [runs]
  );

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

  const totalLeads = runs.reduce((s, r) => s + (r.result_count || 0), 0);
  const completedCount = runs.filter((r) => r.status === "completed").length;

  return (
    // Stable anchor the GenerateForm scrolls to after a campaign starts — it
    // always exists, unlike the per-state Running/Recent section ids.
    <div id="campaigns" className="scroll-mt-24 space-y-8">
      <StatsRow
        running={running.length}
        completed={completedCount}
        totalLeads={totalLeads}
        polling={polling}
        lastPolledAt={lastPolledAt}
      />

      {running.length > 0 ? (
        <Section title="Running now" count={running.length} accent>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {running.map((run) => (
                <RunCard key={run.id} run={run} variant="running" />
              ))}
            </AnimatePresence>
          </div>
        </Section>
      ) : null}

      <Section
        title={running.length > 0 ? "Recent history" : "Recent campaigns"}
        count={finished.length}
      >
        {finished.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {finished.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                variant={run.status === "failed" ? "failed" : "completed"}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function StatsRow({
  running,
  completed,
  totalLeads,
  polling,
  lastPolledAt,
}: {
  running: number;
  completed: number;
  totalLeads: number;
  polling: boolean;
  lastPolledAt: number | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        label="Active scrapes"
        value={running}
        icon={Radar}
        accent="brand"
        suffix={
          running > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-50)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--brand-700)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-500)] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--brand-600)]" />
              </span>
              Live
            </span>
          ) : null
        }
      />
      <StatCard
        label="Completed runs"
        value={completed}
        icon={CheckCircle2}
        accent="success"
      />
      <StatCard
        label="Total leads scraped"
        value={totalLeads.toLocaleString()}
        icon={Globe}
        accent="sky"
        suffix={
          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--ink-subtle)]">
            <RefreshCw
              className={`h-2.5 w-2.5 ${polling ? "animate-spin text-[var(--brand-600)]" : ""}`}
            />
            {polling ? "auto-refresh on" : "live when scraping"}
            {lastPolledAt ? ` · ${shortAgo(lastPolledAt)}` : ""}
          </span>
        }
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  suffix,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "brand" | "success" | "sky";
  suffix?: React.ReactNode;
}) {
  const accentBg = {
    brand: "bg-[var(--brand-50)] ring-1 ring-[var(--brand-100)]",
    success: "bg-[var(--success-50)] ring-1 ring-[var(--success-100)]",
    sky: "bg-[var(--sky-100)] ring-1 ring-[var(--sky-200)]",
  }[accent];
  const accentText = {
    brand: "text-[var(--brand-700)]",
    success: "text-[var(--success-700)]",
    sky: "text-[var(--sky-600)]",
  }[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="surface-card p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            {label}
          </div>
          <div className="mt-2.5 text-3xl font-semibold tracking-tight tabular-nums text-[var(--ink-strong)]">
            {value}
          </div>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentBg} ${accentText}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {suffix ? <div className="mt-3">{suffix}</div> : null}
    </motion.div>
  );
}

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  // Stable DOM id derived from the title so GenerateForm can scroll to
  // 'Running now' (id=running-now) or 'Recent history' (id=recent-history)
  // after the user submits a new campaign. scroll-mt-24 leaves space for
  // the sticky topbar.
  const sectionId = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section id={sectionId} className="space-y-3 scroll-mt-24">
      <div className="flex items-center gap-2">
        <h2
          className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${accent ? "text-[var(--brand-700)]" : "text-[var(--ink-subtle)]"}`}
        >
          {title}
        </h2>
        <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--ink-muted)]">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function RunCard({
  run,
  variant,
}: {
  run: JobRun;
  variant: "running" | "completed" | "failed";
}) {
  const pct =
    run.limit_count > 0
      ? Math.min(100, Math.round((run.result_count / run.limit_count) * 100))
      : 0;
  // When discovery has produced its full lead count but status is still
  // 'running', we're in the email-enrichment phase — visit each lead's
  // website to pull contact emails. The 'Scraping live' pill at this point
  // looks contradictory next to a 100% progress bar; swap it for
  // 'Enriching emails' so the user knows what's still happening.
  const phaseVariant: "running" | "enriching" | "completed" | "failed" =
    variant === "running" &&
    run.limit_count > 0 &&
    run.result_count >= run.limit_count
      ? "enriching"
      : variant;
  const elapsedMs =
    new Date(run.finished_at ?? Date.now()).getTime() -
    new Date(run.started_at).getTime();

  // Refined icon tile — soft tinted square per state, not a heavy solid circle.
  const iconTile =
    variant === "running"
      ? "bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-100)]"
      : variant === "completed"
        ? "bg-[var(--success-50)] text-[var(--success-700)] ring-1 ring-[var(--success-100)]"
        : "bg-[var(--danger-50)] text-[var(--danger-700)] ring-1 ring-[var(--danger-100)]";

  const cardRing =
    variant === "running" ? "ring-1 ring-[var(--brand-100)]" : "";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`surface-card relative overflow-hidden ${cardRing}`}
    >
      <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
        {/* Left: icon + identity + progress */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconTile}`}
            >
              {variant === "running" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : variant === "completed" ? (
                <Play
                  className="h-4 w-4 translate-x-[1px]"
                  fill="currentColor"
                  strokeWidth={0}
                />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold capitalize text-[var(--ink-strong)]">
                  {run.keyword}
                </h3>
                <StatusPill variant={phaseVariant} />
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                {run.location}
              </p>
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--ink-subtle)]">
                <Clock className="h-2.5 w-2.5" />
                {variant === "running"
                  ? `${formatDuration(elapsedMs)} elapsed`
                  : formatDuration(elapsedMs)}
                <span>·</span>
                <span>Started {formatTimestamp(run.started_at)}</span>
              </div>
            </div>
          </div>

          {/* Progress block */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm">
                <span className="text-lg font-bold tabular-nums text-[var(--ink-strong)]">
                  {run.result_count.toLocaleString()}
                </span>
                <span className="text-[var(--ink-muted)]">
                  {" "}
                  / {run.limit_count.toLocaleString()} leads
                </span>
              </div>
              <div
                className={`text-sm font-bold tabular-nums ${
                  variant === "failed"
                    ? "text-[var(--danger-700)]"
                    : "text-[var(--brand-700)]"
                }`}
              >
                {pct}%
              </div>
            </div>
            <ProgressBar pct={pct} variant={variant} />
          </div>
        </div>

        {/* Right: actions */}
        <RunCardActions run={run} variant={variant} />
      </div>

      {run.error ? (
        <div className="mx-5 mb-5 -mt-1 flex items-start gap-2 rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {run.error}
        </div>
      ) : null}
    </motion.article>
  );
}

function ProgressBar({
  pct,
  variant,
}: {
  pct: number;
  variant: "running" | "completed" | "failed";
}) {
  // Solid brand blue across all states for visual consistency. Failed runs
  // overlay a subtle danger tint via the icon + status pill — the bar itself
  // stays brand so the page reads cohesively top-to-bottom.
  const fillClass =
    variant === "failed"
      ? "bg-[var(--danger-500)]"
      : "bg-[var(--brand-600)]";
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
      <motion.div
        className={`relative h-full overflow-hidden rounded-full ${fillClass}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {variant === "running" ? (
          <motion.span
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "300%" }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ) : null}
      </motion.div>
    </div>
  );
}

function RunCardActions({
  run,
  variant,
}: {
  run: JobRun;
  variant: "running" | "completed" | "failed";
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"cancel" | "delete" | null>(null);

  // Stop a running scrape — soft-cancel via PATCH. Worker sees the status
  // change to 'failed' on its next DB check and bails out, keeping whatever
  // leads it's already inserted.
  async function cancel() {
    if (!confirm("Stop this scrape? Leads already saved will be kept.")) return;
    setBusy("cancel");
    const res = await fetch(`/api/scan/runs/${run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    setBusy(null);
    if (res.ok) {
      toast.success("Scrape cancelled", `"${run.keyword}" stopped`);
      router.refresh();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error("Couldn't cancel", j.error);
    }
  }

  // Hard-delete the run + all its leads (FK cascade). Works on any status,
  // including currently-running scrapes — the worker's subsequent writes
  // against this id become no-ops.
  async function remove() {
    if (
      !confirm(
        `Delete "${run.keyword}" and all ${run.result_count.toLocaleString()} leads from it? This can't be undone.`
      )
    ) {
      return;
    }
    setBusy("delete");
    const res = await fetch(`/api/scan/runs/${run.id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      toast.success("Scrape deleted", `"${run.keyword}" removed`);
      router.refresh();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error("Couldn't delete", j.error);
    }
  }

  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5 md:flex-col md:items-end">
      {variant !== "failed" && run.result_count > 0 ? (
        <Link
          href={`/user/leads?campaign=${run.id}`}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-600)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-700)]"
        >
          View leads
          <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}

      <div className="flex items-center gap-1">
        {variant === "running" ? (
          <button
            type="button"
            onClick={cancel}
            disabled={busy !== null}
            title="Stop this scrape"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ink-strong)] transition hover:border-[var(--warning-300)] hover:bg-[var(--warning-50)] hover:text-[var(--warning-700)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "cancel" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <StopCircle className="h-3 w-3" />
            )}
            Stop
          </button>
        ) : null}

        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          title="Delete this scrape and all its leads"
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ink-muted)] transition hover:border-[var(--danger-300)] hover:bg-[var(--danger-50)] hover:text-[var(--danger-700)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "delete" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
          Delete
        </button>
      </div>
    </div>
  );
}

function StatusPill({
  variant,
}: {
  variant: "running" | "enriching" | "completed" | "failed";
}) {
  if (variant === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--brand-700)]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-500)] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--brand-600)]" />
        </span>
        Scraping live
      </span>
    );
  }
  if (variant === "enriching") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-100)] bg-[var(--accent-50)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--accent-700)]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-500)] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent-600)]" />
        </span>
        Enriching emails
      </span>
    );
  }
  if (variant === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--success-100)] bg-[var(--success-50)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--success-700)]">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Delivered
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--danger-100)] bg-[var(--danger-50)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--danger-700)]">
      <XCircle className="h-2.5 w-2.5" />
      Failed
    </span>
  );
}

function EmptyState() {
  return (
    <div className="surface-card flex flex-col items-center p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-100)]">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[var(--ink-strong)]">
        No scraping campaigns yet
      </h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--ink-muted)]">
        Start a new run from the Generate page. The scrape executes on our
        worker — you can close this tab and come back to see the result.
      </p>
      <Link
        href="/user/generate"
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
      >
        <Sparkles className="h-4 w-4" />
        Start a scraping campaign
      </Link>
    </div>
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

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return `today ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) {
    return `yesterday ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString();
}

function shortAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}
