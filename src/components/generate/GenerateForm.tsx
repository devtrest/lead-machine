"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  MapPin,
  Target,
  Hash,
  ArrowRight,
  Check,
  AlertTriangle,
  Loader2,
  Rocket,
  Search,
  Database,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Counter } from "@/components/ui/Counter";
import { useToast } from "@/components/ui/Toast";

// Drain an SSE response to completion without driving the UI — keeps the
// connection open so the server finishes the run + refunds unused credits,
type Phase =
  | "launching"
  | "searching"
  | "discovering"
  | "extracting"
  | "enriching"
  | "harvesting"
  | "saving"
  | "saved";

type RunningState = {
  kind: "running";
  phase: Phase;
  count: number;
  target: number;
};

type Stage =
  | { kind: "idle" }
  | { kind: "starting" }
  | RunningState
  | { kind: "done"; runId?: string; total: number; requested: number }
  | { kind: "error"; message: string };

const presets = [25, 50, 100, 250, 500];

const phaseMeta: Record<
  Phase,
  { label: string; detail: string; icon: React.ReactNode; weight: number }
> = {
  launching: {
    label: "Spinning up",
    detail: "Booting an isolated browser instance",
    icon: <Rocket className="h-3.5 w-3.5" />,
    weight: 0.04,
  },
  searching: {
    label: "Querying directories",
    detail: "Locking the city anchor",
    icon: <Search className="h-3.5 w-3.5" />,
    weight: 0.06,
  },
  discovering: {
    label: "Discovering leads",
    detail: "Scrolling the results feed",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    weight: 0.30,
  },
  extracting: {
    label: "Extracting contact details",
    detail: "Parallel fetch — websites, phones, addresses",
    icon: <Loader2 className="h-3.5 w-3.5" />,
    weight: 0.50,
  },
  enriching: {
    label: "Extracting contact details",
    detail: "Parallel fetch — websites, phones, addresses",
    icon: <Loader2 className="h-3.5 w-3.5" />,
    weight: 0.40,
  },
  harvesting: {
    label: "Harvesting emails",
    detail: "Crawling websites for contact emails",
    icon: <Loader2 className="h-3.5 w-3.5" />,
    weight: 0.15,
  },
  saving: {
    label: "Saving to your database",
    detail: "Deduping and writing leads",
    icon: <Database className="h-3.5 w-3.5" />,
    weight: 0.07,
  },
  saved: {
    label: "Done",
    detail: "Leads ready to view",
    icon: <Save className="h-3.5 w-3.5" />,
    weight: 0.03,
  },
};

const orderedPhases: Phase[] = [
  "launching",
  "searching",
  "discovering",
  "extracting",
  "harvesting",
  "saving",
];

function parseTarget(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(5000, Math.floor(n));
}

function progressFor(state: RunningState): number {
  // Cumulative weight of completed phases + within-phase progress
  let pct = 0;
  for (const p of orderedPhases) {
    if (p === state.phase || (p === "extracting" && state.phase === "enriching")) {
      const weight = phaseMeta[p].weight;
      const within =
        state.target > 0
          ? Math.min(1, state.count / state.target)
          : (state.phase === "discovering" || state.phase === "extracting" || state.phase === "enriching")
            ? 0
            : 1;
      pct += weight * within * 100;
      break;
    }
    pct += phaseMeta[p].weight * 100;
  }
  return Math.min(99, Math.max(2, pct));
}

export function GenerateForm() {
  const router = useRouter();
  const toast = useToast();
  // Empty defaults so the form looks deliberate, not pre-filled. Users always
  // see the placeholder text — no accidentally launching a "dentist in
  // Islamabad" campaign because they clicked Submit too fast.
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const target = parseTarget(targetInput);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (keyword.trim().length < 2) {
      setStage({ kind: "error", message: "Enter a niche or keyword (at least 2 characters)." });
      return;
    }
    if (location.trim().length < 2) {
      setStage({ kind: "error", message: "Enter a location — city and country." });
      return;
    }
    if (target < 1) {
      setTargetError("Enter how many leads you want (1–5000).");
      return;
    }
    setTargetError(null);
    setStage({ kind: "starting" });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/google-maps-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, location, target }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Surface errors (out of credits, missing profile, etc.) inline.
        const text = await res.text().catch(() => "");
        let message = "Couldn't start campaign.";
        try {
          const json = JSON.parse(text);
          message = json.error ?? message;
        } catch {
          if (text) message = text;
        }
        setStage({ kind: "error", message });
        return;
      }

      // Campaign created. The API now returns immediately (no SSE) and the
      // worker keeps running in the background. We don't drain a stream
      // anymore — credit refunds happen on the server when the worker
      // finishes. Just poll for the credit balance once after a delay so
      // the topbar picks up the refund without a manual refresh.
      setTimeout(() => {
        router.refresh();
        window.dispatchEvent(new Event("leadmachine:credits"));
      }, 5_000);

      // Credits were reserved up front — reflect the charge in the topbar now.
      window.dispatchEvent(new Event("leadmachine:credits"));

      toast.success(
        "Campaign started",
        "It’s running now — watch it fill in your campaigns below."
      );
      setKeyword("");
      setLocation("");
      setTargetInput("");
      setStage({ kind: "idle" });
      router.refresh();

      // Auto-scroll DOWN to the campaigns list so the user sees their new
      // run actually populating instead of staring at the empty form again.
      // 250ms delay lets router.refresh() reflow the page first; otherwise
      // we measure the old layout and land at the wrong offset.
      setTimeout(() => {
        const target =
          document.getElementById("running-now") ??
          document.getElementById("recent-history");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 250);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setStage({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  function reset() {
    abortRef.current?.abort();
    setStage({ kind: "idle" });
  }

  return (
    <div className="surface-card-elev relative overflow-hidden p-6 md:p-8">
      <div
        className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-50 blur-3xl"
        aria-hidden
      />

      <AnimatePresence mode="wait">
        {stage.kind === "idle" ||
        stage.kind === "error" ||
        stage.kind === "starting" ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            onSubmit={submit}
            className="relative space-y-5"
          >
            <Input
              label="Niche or keyword"
              iconLeft={<Target className="h-4 w-4" />}
              placeholder="e.g. dentist, yoga studio, rooftop cafe"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Input
              label="Location"
              iconLeft={<MapPin className="h-4 w-4" />}
              placeholder="City, country"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />

            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)]">
                <span className="inline-flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  How many leads?
                </span>
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={5000}
                    required
                    placeholder="e.g. 50"
                    value={targetInput}
                    onChange={(e) => {
                      setTargetInput(e.target.value);
                      if (targetError) setTargetError(null);
                    }}
                    className={`w-32 rounded-xl border bg-[var(--surface-elev)] px-3.5 py-2 text-sm font-semibold text-[var(--ink-strong)] outline-none transition focus:ring-2 ${
                      targetError
                        ? "border-[var(--danger-500)] focus:border-[var(--danger-500)] focus:ring-[var(--danger-500)]/20"
                        : "border-[var(--border)] focus:border-[var(--brand-500)] focus:ring-[var(--brand-500)]/20"
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
                    leads
                  </span>
                </div>
                <span className="text-[11px] text-[var(--ink-subtle)]">or pick</span>
                {presets.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setTargetInput(String(n));
                      setTargetError(null);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      target === n
                        ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white shadow-[0_2px_10px_rgba(79,70,229,0.20)]"
                        : "border-[var(--border)] bg-[var(--surface-elev)] text-[var(--ink-muted)] hover:border-[var(--brand-200)] hover:text-[var(--brand-700)]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {targetError ? (
                <p className="mt-2 text-xs font-medium text-[var(--danger-700)]">
                  {targetError}
                </p>
              ) : (
                <p className="mt-2 text-xs text-[var(--ink-subtle)]">
                  {target > 0
                    ? `If your city has fewer than ${target.toLocaleString()}, our AI expands the niche to related keywords and merges results.`
                    : "Required — enter any number from 1 to 5000."}
                </p>
              )}
            </div>

            {stage.kind === "error" ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 rounded-xl border border-[var(--danger-100)] bg-[var(--danger-50)] px-3.5 py-2.5 text-sm text-[var(--danger-700)]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{stage.message}</span>
              </motion.div>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={stage.kind === "starting"}
              disabled={stage.kind === "starting"}
              iconLeft={
                stage.kind === "starting" ? undefined : (
                  <Sparkles className="h-4 w-4" />
                )
              }
              iconRight={
                stage.kind === "starting" ? undefined : (
                  <ArrowRight className="h-4 w-4" />
                )
              }
            >
              {stage.kind === "starting"
                ? "Starting campaign…"
                : target > 0
                  ? `Start campaign · ${target.toLocaleString()} leads`
                  : "Start campaign"}
            </Button>
          </motion.form>
        ) : null}

        {stage.kind === "running" ? (
          <RunningView
            key="running"
            state={stage}
            onCancel={reset}
          />
        ) : null}

        {stage.kind === "done" ? (
          <DoneView
            key="done"
            total={stage.total}
            requested={stage.requested}
            runId={stage.runId}
            onReset={reset}
            onGoLeads={() =>
              router.push(
                stage.runId
                  ? `/user/leads?campaign=${encodeURIComponent(stage.runId)}`
                  : "/user/leads"
              )
            }
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function RunningView({
  state,
  onCancel,
}: {
  state: RunningState;
  onCancel: () => void;
}) {
  const pct = progressFor(state);
  const meta = phaseMeta[state.phase] ?? phaseMeta.discovering;
  const showCount =
    (state.phase === "discovering" ||
      state.phase === "extracting" ||
      state.phase === "enriching" ||
      state.phase === "harvesting") &&
    state.target > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22 }}
      className="relative space-y-6 py-2"
    >
      <div className="flex items-start gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-600)] text-white animate-pulse-ring">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--ink-strong)]">
              {meta.label}…
            </div>
            <div className="text-xs font-semibold tabular-nums text-[var(--brand-700)]">
              {Math.round(pct)}%
            </div>
          </div>
          <div className="mt-1 text-xs text-[var(--ink-muted)]">
            {showCount ? (
              <>
                <Counter value={state.count} duration={400} /> of{" "}
                {state.target.toLocaleString()}{" "}
                {state.phase === "harvesting" ? "websites" : "leads"} ·{" "}
                <span className="text-[var(--ink-subtle)]">{meta.detail}</span>
              </>
            ) : (
              meta.detail
            )}
          </div>
        </div>
      </div>

      <ProgressBar value={pct} />

      <ol className="space-y-2.5">
        {orderedPhases.map((p, i) => {
          const isCurrent =
            p === state.phase ||
            (p === "extracting" && state.phase === "enriching");
          const isDone =
            !isCurrent &&
            orderedPhases.indexOf(p) <
              orderedPhases.indexOf(
                state.phase === "enriching" ? "extracting" : state.phase
              );
          const m = phaseMeta[p];
          return (
            <motion.li
              key={p}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-start gap-3 rounded-xl border px-4 py-2.5 transition ${
                isCurrent
                  ? "border-[var(--brand-200)] bg-[var(--brand-50)]/60"
                  : "border-[var(--border)] bg-[var(--surface-elev)]"
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  isDone
                    ? "bg-[var(--success-500)] text-white"
                    : isCurrent
                      ? "bg-[var(--brand-600)] text-white"
                      : "bg-[var(--surface-sunken)] text-[var(--ink-subtle)]"
                }`}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : isCurrent ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  i + 1
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--ink-strong)]">
                  {m.label}
                </div>
                <div className="text-xs text-[var(--ink-muted)]">{m.detail}</div>
              </div>
            </motion.li>
          );
        })}
      </ol>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink-strong)]"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

function DoneView({
  total,
  requested,
  onReset,
  onGoLeads,
}: {
  total: number;
  requested: number;
  runId?: string;
  onReset: () => void;
  onGoLeads: () => void;
}) {
  const fulfilled = total >= requested;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="relative py-4 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 18 }}
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-100)] text-[var(--success-700)]"
      >
        <Check className="h-7 w-7" />
      </motion.div>
      <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
        <Counter value={total} /> leads generated
      </h3>
      <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
        {fulfilled
          ? "Saved to your database. Open this campaign to filter, export, or contact."
          : `Found ${total} of ${requested} requested. Try a broader niche or larger city for more.`}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button
          onClick={onGoLeads}
          iconRight={<ArrowRight className="h-4 w-4" />}
        >
          Open campaign
        </Button>
        <Button variant="secondary" onClick={onReset}>
          Run another
        </Button>
      </div>
    </motion.div>
  );
}
