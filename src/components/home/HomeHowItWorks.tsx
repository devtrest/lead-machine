"use client";

import { motion } from "framer-motion";
import { Target, Sparkles, Users, Send } from "lucide-react";

const steps = [
  {
    icon: Target,
    title: "Describe your ideal customer",
    body: "Type a niche, pick a city, set how many leads you want. That's the entire input.",
  },
  {
    icon: Sparkles,
    title: "AI does the heavy lifting",
    body: "Niche expansion, multi-source discovery, contact enrichment, dedupe and ranking — all in one pass.",
  },
  {
    icon: Users,
    title: "Review in your CRM",
    body: "Open Leads, sort and filter, click any row for full detail. Phones and emails are tappable.",
  },
  {
    icon: Send,
    title: "Export and contact",
    body: "Export selected or filtered leads to CSV. Push into your outreach tool. Close more deals.",
  },
];

export function HomeHowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 bg-[var(--surface-elev)] py-20">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-100)] bg-[var(--accent-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-700)]">
            How it works
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
            From niche to <span className="brand-text-gradient">closed deal</span>{" "}
            in four steps.
          </h2>
        </div>

        <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  delay: i * 0.08,
                  duration: 0.36,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-700)] to-[var(--sky-500)] text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-3xl font-semibold tracking-tight text-[var(--ink-subtle)]/40">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-[var(--ink-strong)]">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {s.body}
                </p>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
