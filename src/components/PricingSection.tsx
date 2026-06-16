"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2 } from "lucide-react";

type Props = {
  signedIn: boolean;
  /** Legacy prop, ignored — design is unified light. */
  editorial?: boolean;
  /** Hide the section's own title/subtitle (e.g. the /pricing page already
   *  renders a PageHero, so the inline header would duplicate it). */
  hideHeader?: boolean;
};

const tiers = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "$49",
    cadence: "after $1 trial · lifetime",
    blurb: "Solo founders validating their first niche.",
    perks: [
      "3,000 lead credits (never expire)",
      "1 credit per scraped lead",
      "Unlimited outreach follow-ups (free)",
      "CSV + Excel export",
      "AI niche expansion",
    ],
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "$149",
    cadence: "after $1 trial · lifetime",
    blurb: "Growth teams running outbound week to week.",
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
    id: "pro" as const,
    name: "Pro",
    price: "$499",
    cadence: "after $1 trial · lifetime",
    blurb: "Agencies running lead-gen at scale.",
    perks: [
      "100,000 lead credits (never expire)",
      "Everything in Premium",
      "Webhooks (beta)",
      "Priority extraction queue",
      "Priority support",
    ],
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "Custom",
    cadence: "· talk to us",
    blurb: "High-volume teams with custom integrations.",
    perks: [
      "Unlimited credits",
      "Dedicated infrastructure",
      "SSO & audit logs",
      "Onboarding & SLA",
    ],
    enterprise: true,
  },
];

export function PricingSection({ signedIn, hideHeader }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const [enterpriseNote, setEnterpriseNote] = useState("");

  async function choosePlan(plan: "starter" | "premium" | "pro") {
    // All paid plans now flow through the $1 trial. The user's selected plan
    // is stored as trial_target_plan, $1 is charged immediately, and after
    // the trial window the worker auto-converts to the full plan price using
    // the saved card (off-session PaymentIntent). One CTA, three target
    // plans, same payment experience.
    setBusy(plan);
    setBanner(null);
    try {
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlan: plan }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Unable to start trial");
      }
      if (json.url) {
        window.location.href = json.url as string;
        return;
      }
      throw new Error("Checkout returned no URL");
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Unable to start trial");
      setBusy(null);
    }
  }

  async function submitEnterprise() {
    setBusy("enterprise");
    setBanner(null);
    try {
      const res = await fetch("/api/enterprise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: enterpriseNote }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setEnterpriseOpen(false);
      setEnterpriseNote("");
      setBanner("Got it. Our team will reach out within one business day.");
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="plans" className="scroll-mt-28 space-y-10 py-12">
      {!hideHeader ? (
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            Pricing
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
            Simple plans. Real <span className="brand-text-gradient">leads</span>.
          </h2>
          <p className="text-sm text-[var(--ink-muted)] md:text-base">
            One-time payment. Credits never expire. No subscriptions, no surprises.
          </p>
        </div>
      ) : null}

      {banner ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl rounded-2xl border border-[var(--brand-100)] bg-[var(--brand-50)] px-5 py-3 text-center text-sm text-[var(--brand-700)]"
        >
          {banner}
        </motion.div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-4">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: i * 0.06, duration: 0.32 }}
            className={`relative flex flex-col rounded-2xl border bg-[var(--surface-elev)] p-6 ${
              tier.highlighted
                ? "border-[var(--brand-200)] shadow-[0_18px_40px_rgba(79,70,229,0.12)] ring-1 ring-[var(--brand-100)]"
                : "border-[var(--border)] shadow-[var(--shadow-xs)]"
            }`}
          >
            {tier.highlighted ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-500)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-md">
                Most popular
              </div>
            ) : null}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
                {tier.name}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
                  {tier.price}
                </span>
                <span className="text-xs text-[var(--ink-subtle)]">
                  {tier.cadence}
                </span>
              </div>
              <p className="text-sm text-[var(--ink-muted)]">{tier.blurb}</p>
            </div>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm text-[var(--ink-strong)]">
              {tier.perks.map((perk) => (
                <li key={perk} className="flex gap-2">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      tier.highlighted
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

            <div className="mt-6">
              {tier.enterprise ? (
                signedIn ? (
                  <button
                    type="button"
                    onClick={() => setEnterpriseOpen(true)}
                    className="w-full rounded-xl border border-[var(--ink-strong)] bg-transparent py-2.5 text-sm font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--ink-strong)] hover:text-[var(--surface)]"
                  >
                    Talk to sales
                  </button>
                ) : (
                  <Link
                    href="/signup"
                    className="block w-full rounded-xl border border-[var(--ink-strong)] bg-transparent py-2.5 text-center text-sm font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--ink-strong)] hover:text-[var(--surface)]"
                  >
                    Talk to sales
                  </Link>
                )
              ) : signedIn ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    choosePlan(tier.id as "starter" | "premium" | "pro")
                  }
                  className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                    tier.highlighted
                      ? "bg-[var(--brand-600)] text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)] hover:bg-[var(--brand-700)]"
                      : "border border-[var(--border)] bg-[var(--surface-elev)] text-[var(--ink-strong)] hover:bg-[var(--surface-sunken)]"
                  }`}
                >
                  {busy === tier.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {busy === tier.id ? "Redirecting…" : "Start for $1"}
                </button>
              ) : (
                <Link
                  href={`/signup?plan=${tier.id}`}
                  className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition ${
                    tier.highlighted
                      ? "bg-[var(--brand-600)] text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)] hover:bg-[var(--brand-700)]"
                      : "border border-[var(--border)] bg-[var(--surface-elev)] text-[var(--ink-strong)] hover:bg-[var(--surface-sunken)]"
                  }`}
                >
                  Start for $1
                </Link>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {enterpriseOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEnterpriseOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 surface-card-elev p-7"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--ink-strong)]">
                    Tell us about your team
                  </h3>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    Volume, integrations, contract requirements — anything that
                    helps us prep.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnterpriseOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={enterpriseNote}
                onChange={(e) => setEnterpriseNote(e.target.value)}
                placeholder="e.g. We need 50K leads/mo across LATAM, integrate with HubSpot…"
                className="mt-5 h-32 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] px-3.5 py-2.5 text-sm text-[var(--ink-strong)] outline-none placeholder:text-[var(--ink-subtle)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
              />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEnterpriseOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy === "enterprise"}
                  onClick={submitEnterprise}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-50"
                >
                  {busy === "enterprise" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {busy === "enterprise" ? "Sending…" : "Send"}
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
