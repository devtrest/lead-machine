"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Target,
  Gauge,
  ShieldCheck,
  Workflow,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const principles = [
  {
    icon: Workflow,
    tone: "brand",
    title: "Automate the grind, not the judgment",
    body: "Discovery, enrichment, sending, and follow-ups are repetitive — so the machine owns them. Deciding who to close stays with you.",
  },
  {
    icon: Gauge,
    tone: "amber",
    title: "Speed is the whole point",
    body: "A niche should go from idea to a sending sequence in minutes. If a step makes you wait or babysit it, we cut it.",
  },
  {
    icon: ShieldCheck,
    tone: "success",
    title: "Stay deliverable, stay honest",
    body: "Human-like delays, per-sender daily caps, and sender rotation keep your mailboxes healthy. No spray-and-pray, no burned domains.",
  },
  {
    icon: Target,
    tone: "brand",
    title: "Own your data",
    body: "Every lead, contact, and reply is yours — per-account isolation, row-level security, export whenever you want.",
  },
] as const;

const toneMap = {
  brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
  amber: "bg-[var(--accent-50)] text-[var(--accent-700)]",
  success: "bg-[var(--success-50)] text-[var(--success-700)]",
} as const;

const stats = [
  { value: "2 min", label: "From niche to a sending sequence" },
  { value: "100%", label: "Of leads owned and exportable by you" },
  { value: "24/7", label: "Autopilot — scraping & follow-ups while you sleep" },
];

export function AboutContent({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      {/* Mission */}
      <section className="relative py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            Our mission
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-3xl">
            Prospecting should run itself.
          </h2>
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-[var(--ink-muted)] md:text-base">
            <p>
              Every business that lives off new clients runs the same loop: find
              the right companies, dig up real contact details, write the first
              email, then chase the follow-ups. It&apos;s the most important work
              there is — and the most repetitive. Most people do it for a week,
              get busy, and let the pipeline go cold.
            </p>
            <p>
              We built Lead Machine so that loop never stops. You tell it a niche
              and a city. It scrapes verified businesses, enriches them with real
              emails and phones, and runs a multi-step email sequence across your
              own mailboxes — sending, pausing, and following up on a human-like
              schedule. Replies are detected and sorted into one inbox.
            </p>
            <p className="font-medium text-[var(--ink-strong)]">
              The result: the person who sets it up before bed wakes up to
              interested replies — while everyone else is still copy-pasting into
              a spreadsheet.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative pb-4">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="grid gap-5 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="surface-card p-6 text-center">
                <div className="text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
                  <span className="brand-text-gradient">{s.value}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--ink-muted)]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="relative py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
              What we believe
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
              The principles behind the product.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {principles.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.article
                  key={p.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{
                    delay: (i % 2) * 0.06,
                    duration: 0.36,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="surface-card flex gap-4 p-6"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneMap[p.tone]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-[var(--ink-strong)]">
                      {p.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]">
                      {p.body}
                    </p>
                  </div>
                </motion.article>
              );
            })}
          </div>

          <div className="mt-12 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-[var(--ink-muted)]">
              Ready to put your prospecting on autopilot?
            </p>
            <Link
              href={signedIn ? "/user" : "/signup"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)] transition hover:bg-[var(--brand-700)]"
            >
              <Sparkles className="h-4 w-4" />
              {signedIn ? "Open dashboard" : "Start for $1"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
