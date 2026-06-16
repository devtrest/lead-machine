"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  Rocket,
  Store,
  Users,
  Moon,
  Sunrise,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const audiences = [
  {
    icon: Briefcase,
    tone: "brand",
    name: "Agencies",
    pain: "Manually building prospect lists and sending one-off emails eats the hours you should bill to clients.",
    win: "Spin up a campaign per client niche, let the autopilot send and follow up, and hand over a pipeline of replies — not a spreadsheet.",
  },
  {
    icon: Rocket,
    tone: "amber",
    name: "SaaS founders",
    pain: "You need your first 50 customers, but cold outreach is a second full-time job you don't have time for.",
    win: "Point Lead Machine at your ICM's niche + city, and wake up to interested replies sitting in your Unibox.",
  },
  {
    icon: Users,
    tone: "success",
    name: "Freelancers & consultants",
    pain: "Feast-or-famine. When you're busy delivering, the pipeline goes dry — and then you're hunting again.",
    win: "Keep a sequence running in the background so there's always a fresh conversation waiting when a project wraps.",
  },
  {
    icon: Store,
    tone: "brand",
    name: "Local service businesses",
    pain: "Your best customers are other local businesses, but knocking on doors doesn't scale.",
    win: "Pull every matching business in your city with verified contacts, then let the sequence introduce you on autopilot.",
  },
  {
    icon: Building2,
    tone: "amber",
    name: "B2B sales teams",
    pain: "Reps burn the morning on list-building and copy-pasting instead of talking to live prospects.",
    win: "Feed the team a steady stream of warm replies. Reps spend their day closing, not prospecting.",
  },
  {
    icon: Users,
    tone: "success",
    name: "Recruiters",
    pain: "Sourcing companies that are hiring — and reaching the right person — is slow, repetitive work.",
    win: "Target the industry and region, enrich decision-maker contacts, and let multi-step follow-ups do the chasing.",
  },
] as const;

const toneMap = {
  brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
  amber: "bg-[var(--accent-50)] text-[var(--accent-700)]",
  success: "bg-[var(--success-50)] text-[var(--success-700)]",
} as const;

export function UseCases({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      {/* The core "while you sleep" narrative */}
      <section className="relative py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="surface-card relative overflow-hidden p-8 md:p-12">
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-40 blur-3xl"
              aria-hidden
            />
            <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
                  <Sparkles className="h-3 w-3" />
                  Set it once
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
                  Start it tonight.{" "}
                  <span className="brand-text-gradient">
                    Wake up to opportunities.
                  </span>
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-[var(--ink-muted)] md:text-base">
                  Lead Machine isn&apos;t just a scraper. It finds verified
                  businesses in your niche, enriches them with real emails and
                  phones, then runs a multi-step email sequence on autopilot —
                  sending, waiting, and following up across your own mailboxes.
                  Replies land in a unified inbox. You just decide who to close.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href={signedIn ? "/user" : "/signup"}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)] transition hover:bg-[var(--brand-700)]"
                  >
                    <Sparkles className="h-4 w-4" />
                    {signedIn ? "Open dashboard" : "Start for $1"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/how-it-works"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] px-5 py-3 text-sm font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
                  >
                    See how it works
                  </Link>
                </div>
              </div>

              <div className="space-y-4">
                <div className="surface-sunken flex items-start gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)]">
                    <Moon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--ink-strong)]">
                      While you sleep
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
                      The autopilot scrapes, enriches, sends the next due step,
                      and rotates across your senders — respecting daily limits
                      and human-like delays so you stay deliverable.
                    </p>
                  </div>
                </div>
                <div className="surface-sunken flex items-start gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-50)] text-[var(--accent-700)]">
                    <Sunrise className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--ink-strong)]">
                      When you wake up
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
                      Replies are detected and sorted in your Unibox —
                      interested, meeting-booked, not now. You spend your morning
                      closing, not prospecting.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Audience grid */}
      <section className="relative pb-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
              Who it&apos;s for
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
              Built for anyone who lives off a full pipeline.
            </h2>
            <p className="mt-3 text-sm text-[var(--ink-muted)] md:text-base">
              If your growth depends on reaching the right businesses first,
              Lead Machine turns that grind into a background process.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {audiences.map((a, i) => {
              const Icon = a.icon;
              return (
                <motion.article
                  key={a.name}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{
                    delay: (i % 3) * 0.06,
                    duration: 0.36,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="surface-card flex flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneMap[a.tone]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-[var(--ink-strong)]">
                    {a.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                    {a.pain}
                  </p>
                  <div className="mt-4 flex items-start gap-2 border-t border-[var(--border)] pt-4">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-600)]" />
                    <p className="text-sm leading-relaxed text-[var(--ink-strong)]">
                      {a.win}
                    </p>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
