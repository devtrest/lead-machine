"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

type Faq = { q: string; a: string };

const faqs: Faq[] = [
  {
    q: "How fresh are the leads?",
    a: "Every lead is generated on-demand from live sources the moment you request it — no stale paid lists, no recycled CRM dumps. What you see is what's currently public online.",
  },
  {
    q: "What if my city only has 50 results but I need 500?",
    a: "Our AI clusters related niches automatically — e.g. 'dentist' expands to 'orthodontist', 'oral surgeon', 'dental clinic' — and merges the results, removing duplicates by name + address.",
  },
  {
    q: "Can I send the outreach directly from Lead Machine?",
    a: "Yes. Connect your mailbox (Gmail, Outlook, and more) and the autopilot sends multi-step sequences with humanized delays, send windows, and daily caps. Replies route back to you and surface in a unified inbox.",
  },
  {
    q: "What's the trial?",
    a: "$1 for 7 days, 100 credits up front. After the trial we auto-charge the plan you picked at trial start. Cancel any time before then in Settings and we won't charge.",
  },
  {
    q: "Is this compliant with GDPR / CCPA?",
    a: "Lead Machine surfaces publicly available business contact data — the same data you'd find by searching yourself. We don't sell private records, and businesses can request removal at any time.",
  },
];

export function HomeFaq() {
  return (
    <section id="faq" className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            <HelpCircle className="h-3 w-3" />
            FAQ
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
            Everything you wanted to ask.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--ink-muted)] md:text-base">
            From lead quality to billing to compliance — straight answers, no
            marketing fluff.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {faqs.map((f, i) => (
            <FaqItem key={f.q} q={f.q} a={f.a} delay={i * 0.03} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay, duration: 0.32 }}
      className="surface-card overflow-hidden p-0"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-[var(--surface-sunken)]/40"
      >
        <span className="text-sm font-semibold text-[var(--ink-strong)]">{q}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--ink-muted)] transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm leading-relaxed text-[var(--ink-muted)]">
              {a}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
