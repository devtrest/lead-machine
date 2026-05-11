"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "How fresh are the leads?",
    a: "Every lead is generated on-demand from live sources. No stale paid lists, no recycled data — what you see is what's currently online.",
  },
  {
    q: "What if my city only has 50 results but I need 500?",
    a: "Our AI clusters related niches automatically — e.g. 'dentist' expands to 'orthodontist', 'oral surgeon', 'dental clinic' — and merges results, removing duplicates.",
  },
  {
    q: "Do credits roll over?",
    a: "Unused credits roll over for one billing cycle. Plans can be upgraded or downgraded at any time.",
  },
  {
    q: "Can I export to my CRM?",
    a: "Yes — every lead is CSV-exportable today, and direct CRM connectors (HubSpot, Salesforce) are on the roadmap.",
  },
  {
    q: "Is this compliant?",
    a: "Lead Machine surfaces publicly available business contact data. We don't sell personal/private records, and you control your data with full row-level isolation.",
  },
];

export function HomeFaq() {
  return (
    <section id="faq" className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            FAQ
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
            Common questions.
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {faqs.map((f, i) => (
            <FaqItem key={f.q} q={f.q} a={f.a} delay={i * 0.04} />
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
            <p className="px-5 pb-4 text-sm text-[var(--ink-muted)]">{a}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
