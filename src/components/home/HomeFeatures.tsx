"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  Layers,
  Filter,
  Download,
  Zap,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI niche expansion",
    body: "Asked for 500 leads but your city only has 60? Our AI clusters related niches and merges results — automatically.",
    tone: "brand",
  },
  {
    icon: Layers,
    title: "Verified contact data",
    body: "Phones, emails, and websites pulled fresh and validated. No paid contact lists, no recycled garbage.",
    tone: "amber",
  },
  {
    icon: Filter,
    title: "CRM-ready filtering",
    body: "Sort by rating, filter by website/email/phone presence, multi-select rows, search the entire corpus.",
    tone: "success",
  },
  {
    icon: Download,
    title: "One-click CSV export",
    body: "Selected, filtered, or all leads — export to your CRM, outreach tool, or spreadsheet in seconds.",
    tone: "brand",
  },
  {
    icon: Zap,
    title: "Built for speed",
    body: "Generate hundreds of leads in minutes. Track progress live. Move from prospecting to outbound the same day.",
    tone: "amber",
  },
  {
    icon: Shield,
    title: "Your data, your rules",
    body: "Per-account isolation, row-level security, and full ownership of every lead you generate.",
    tone: "success",
  },
];

export function HomeFeatures() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            Why Lead Machine
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
            Replace four tools with one feed.
          </h2>
          <p className="mt-3 text-sm text-[var(--ink-muted)] md:text-base">
            Lead discovery, contact enrichment, deduping, and exports — built into a
            single workflow your team will actually use.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = f.icon;
            const toneMap = {
              brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
              amber: "bg-[var(--accent-50)] text-[var(--accent-700)]",
              success: "bg-[var(--success-50)] text-[var(--success-700)]",
            } as const;
            return (
              <motion.article
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  delay: (i % 3) * 0.06,
                  duration: 0.36,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="surface-card p-6 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneMap[f.tone as keyof typeof toneMap]}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-[var(--ink-strong)]">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {f.body}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
