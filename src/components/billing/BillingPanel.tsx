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
    credits: 250,
    blurb: "Lifetime access. Best for solo founders.",
    perks: ["250 lead credits (never expire)", "CSV + Excel export", "AI niche expansion"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$149",
    credits: 1000,
    blurb: "Lifetime access. For weekly outbound.",
    perks: [
      "1,000 lead credits (never expire)",
      "Email + phone enrichment",
      "Priority extraction speed",
      "Campaign deep-links",
    ],
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$399",
    credits: 5000,
    blurb: "Lifetime access. For agencies at scale.",
    perks: [
      "5,000 lead credits (never expire)",
      "Everything in Premium",
      "Webhooks (beta)",
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
