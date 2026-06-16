"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Sparkles, Building2 } from "lucide-react";

type Plan = {
  id: "starter" | "growth" | "pro";
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
    blurb: "For creators getting started",
    perks: ["3,000 credits / mo (roll over)", "All engines", "CSV + Excel export"],
  },
  {
    id: "growth",
    name: "Growth",
    price: "$99",
    credits: 15_000,
    blurb: "For weekly outbound",
    perks: [
      "15,000 credits / mo (roll over)",
      "Email + phone enrichment",
      "Unibox with reply detection",
    ],
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$149",
    credits: 100_000,
    blurb: "For teams & power users",
    perks: [
      "100,000 credits / mo (roll over)",
      "Everything in Growth",
      "Priority extraction queue",
    ],
  },
];

export function PlanPicker() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startTrial(plan: Plan["id"]) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlan: plan }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Unable to start trial");
      if (json.url) {
        window.location.href = json.url as string;
        return;
      }
      throw new Error("Checkout returned no URL");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start trial");
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">
          <Sparkles className="h-3 w-3" />
          Welcome to Lead Machine
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
          Pick a plan to start your trial
        </h1>
        <p className="mt-3 text-sm text-[var(--ink-muted)] md:text-base">
          <span className="font-semibold text-[var(--ink-strong)]">$1 for the first 3 days.</span>{" "}
          Cancel anytime. After the trial your plan activates automatically and
          your monthly credits roll over — they never expire.
        </p>
      </div>

      {error ? (
        <div className="mx-auto mt-5 max-w-md rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3.5 py-2.5 text-center text-sm text-[var(--danger-700)]">
          {error}
        </div>
      ) : null}

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.32 }}
            className={`surface-card relative flex flex-col p-6 ${
              plan.highlighted ? "ring-2 ring-[var(--brand-500)]" : ""
            }`}
          >
            {plan.highlighted ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-600)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-[var(--shadow-sm)]">
                Most popular
              </div>
            ) : null}
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
              {plan.name}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight tabular-nums text-[var(--ink-strong)]">
                {plan.price}
              </span>
              <span className="text-xs text-[var(--ink-subtle)]">/mo</span>
            </div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--brand-700)]">
              {plan.credits.toLocaleString()} credits / mo
            </div>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">{plan.blurb}</p>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm text-[var(--ink-strong)]">
              {plan.perks.map((perk) => (
                <li key={perk} className="flex gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--success-100)] text-[var(--success-700)]">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => startTrial(plan.id)}
              disabled={busy !== null}
              className={`mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                plan.highlighted
                  ? "bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)]"
                  : "border border-[var(--border)] bg-[var(--surface-elev)] text-[var(--ink-strong)] hover:bg-[var(--surface-sunken)]"
              }`}
            >
              {busy === plan.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {busy === plan.id ? "Redirecting…" : "Start for $1"}
            </button>
          </motion.div>
        ))}
      </div>

      <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-2 text-xs text-[var(--ink-subtle)]">
        <Building2 className="h-3.5 w-3.5" />
        Need more?{" "}
        <a
          href="mailto:hello@leadmachine.ai?subject=Enterprise%20plan"
          className="font-semibold text-[var(--brand-700)] hover:underline"
        >
          Talk to sales about Enterprise
        </a>
      </div>
      <p className="mt-3 text-center text-xs text-[var(--ink-subtle)]">
        Secure checkout by Stripe. We never see your card details.
      </p>
    </div>
  );
}
