"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, AlertTriangle, Sparkles } from "lucide-react";

type Plan = {
  id: "starter" | "premium" | "pro";
  name: string;
  price: string;
  credits: number;
  blurb: string;
  perks: string[];
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$49",
    credits: 3_000,
    blurb: "Lifetime access. Best for solo founders.",
    perks: [
      "3,000 lead credits (never expire)",
      "1 credit per scraped lead",
      "Unlimited outreach follow-ups (free)",
      "CSV + Excel export",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$149",
    credits: 15_000,
    blurb: "Lifetime access. For weekly outbound.",
    perks: [
      "15,000 lead credits (never expire)",
      "Email + phone enrichment",
      "Unlimited Gmail senders + rotation",
      "Unibox with reply detection",
      "Open tracking + analytics",
    ],
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$499",
    credits: 100_000,
    blurb: "Lifetime access. For agencies at scale.",
    perks: [
      "100,000 lead credits (never expire)",
      "Everything in Premium",
      "Webhooks (beta)",
      "Priority extraction queue",
      "Priority support",
    ],
  },
];

export function BillingPanel() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function purchase(plan: Plan["id"]) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Unable to start checkout");
      if (json.url) {
        window.location.href = json.url as string;
        return;
      }
      throw new Error("Checkout returned no URL");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start checkout");
      setBusy(null);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[var(--ink-strong)]">
          Buy credits
        </h2>
        <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
          Pick a credit pack. One-time payment, credits added to your account
          instantly.
        </p>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--danger-100)] bg-[var(--danger-50)] px-3.5 py-2.5 text-sm text-[var(--danger-700)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <TrialCard onError={setError} />

      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.32 }}
            className={`relative flex flex-col rounded-2xl border bg-[var(--surface-elev)] p-6 ${
              plan.highlighted
                ? "border-[var(--brand-200)] shadow-[0_18px_40px_rgba(79,70,229,0.10)] ring-1 ring-[var(--brand-100)]"
                : "border-[var(--border)] shadow-[var(--shadow-xs)]"
            }`}
          >
            {plan.highlighted ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[var(--brand-700)] to-[var(--sky-500)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-md">
                Most popular
              </div>
            ) : null}
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
              {plan.name}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
                {plan.price}
              </span>
              <span className="text-xs text-[var(--ink-subtle)]">one-time</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--brand-700)]">
              + {plan.credits.toLocaleString()} credits
            </div>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">{plan.blurb}</p>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm text-[var(--ink-strong)]">
              {plan.perks.map((perk) => (
                <li key={perk} className="flex gap-2">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      plan.highlighted
                        ? "bg-[var(--brand-600)] text-white"
                        : "bg-[var(--success-100)] text-[var(--success-700)]"
                    }`}
                  >
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => purchase(plan.id)}
              disabled={busy !== null}
              className={`mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                plan.highlighted
                  ? "bg-[var(--brand-600)] text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)] hover:bg-[var(--brand-700)]"
                  : "border border-[var(--border)] bg-[var(--surface-elev)] text-[var(--ink-strong)] hover:bg-[var(--surface-sunken)]"
              }`}
            >
              {busy === plan.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {busy === plan.id ? "Redirecting…" : "Buy"}
            </button>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-xs text-[var(--ink-subtle)]">
        Payments are processed securely by Stripe. You&apos;ll get an email
        confirmation when credits are added.
      </p>
    </section>
  );
}

const TRIAL_PLAN_OPTIONS = [
  { id: "starter", name: "Starter", price: "$49", credits: 3_000 },
  { id: "premium", name: "Premium", price: "$149", credits: 15_000 },
  { id: "pro", name: "Pro", price: "$499", credits: 100_000 },
] as const;

function TrialCard({ onError }: { onError: (msg: string | null) => void }) {
  const [picked, setPicked] = useState<"starter" | "premium" | "pro">(
    "premium"
  );
  const [busy, setBusy] = useState(false);

  async function startTrial() {
    setBusy(true);
    onError(null);
    try {
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlan: picked }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Unable to start trial");
      if (json.url) {
        window.location.href = json.url as string;
        return;
      }
      throw new Error("Checkout returned no URL");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Unable to start trial");
      setBusy(false);
    }
  }

  const chosen = TRIAL_PLAN_OPTIONS.find((p) => p.id === picked)!;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="relative overflow-hidden rounded-2xl border border-[var(--brand-200)] bg-gradient-to-br from-[var(--brand-50)] via-white to-[var(--sky-50)] p-6 shadow-[0_18px_40px_rgba(79,70,229,0.10)]"
    >
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-[var(--brand-300)]/30 to-transparent blur-3xl" />
      <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-gradient-to-tr from-[var(--sky-300)]/30 to-transparent blur-3xl" />

      <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-200)] bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand-700)] backdrop-blur">
            <Sparkles className="h-3 w-3" />
            7-day trial
          </div>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink-strong)]">
            Try Lead Machine for{" "}
            <span className="text-[var(--brand-700)]">$1</span>
          </h3>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            100 credits, 7 days. Auto-upgrades to your selected plan unless
            you cancel.
          </p>

          <div className="mt-4 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
              Pick the plan to upgrade to
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {TRIAL_PLAN_OPTIONS.map((p) => {
                const active = picked === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPicked(p.id)}
                    className={`flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-[var(--brand-500)] bg-white shadow-[0_2px_10px_rgba(79,70,229,0.18)] ring-2 ring-[var(--brand-500)]/20"
                        : "border-[var(--border)] bg-white/70 hover:border-[var(--brand-300)]"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--ink-subtle)]">
                      {p.name}
                      {active ? (
                        <Check className="h-3 w-3 text-[var(--brand-700)]" />
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[var(--ink-strong)]">
                      {p.price}
                    </div>
                    <div className="text-[10px] text-[var(--ink-muted)]">
                      {p.credits.toLocaleString()} credits
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:w-56">
          <button
            type="button"
            onClick={startTrial}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.30)] transition hover:bg-[var(--brand-700)] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {busy ? "Redirecting…" : "Start $1 trial"}
          </button>
          <p className="text-center text-[10px] leading-relaxed text-[var(--ink-subtle)]">
            On day 7 we&apos;ll charge{" "}
            <span className="font-semibold text-[var(--ink-muted)]">
              {chosen.price}
            </span>{" "}
            for {chosen.name}. Cancel anytime before then in Settings.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
