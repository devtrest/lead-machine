"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

type Faq = { q: string; a: string };

const faqs: Faq[] = [
  {
    q: "How fresh are the leads?",
    a: "Every lead is generated on-demand from live sources at the moment you request it — no stale paid lists, no recycled CRM dumps. What you see is what's currently public online.",
  },
  {
    q: "What if my city only has 50 results but I need 500?",
    a: "Our AI clusters related niches automatically — e.g. 'dentist' expands to 'orthodontist', 'oral surgeon', 'dental clinic', 'cosmetic dentistry' — and merges the results across all of them. Duplicates are removed by name + address.",
  },
  {
    q: "Where does the email come from?",
    a: "We crawl each lead's website (up to 10 internal pages like /contact, /about, /team) looking for mailto links, JSON-LD schema, plain-text emails, and Cloudflare-protected emails. When no email is exposed, we fall back to DNS-validated pattern guessing.",
  },
  {
    q: "Why do some leads not have phone numbers?",
    a: "Not every business publishes a number — service-area businesses, sole proprietors, and some clinics intentionally hide phones. We surface what's public; we never make up numbers.",
  },
  {
    q: "How does the credit system work?",
    a: "1 credit = 1 lead delivered to your database. Credits are reserved when you start a campaign and any unused portion is refunded automatically when the run finishes (e.g. you ask for 500 but only 312 exist, you get 188 back).",
  },
  {
    q: "Do credits expire?",
    a: "No — every plan is a one-time purchase. Your credits sit in your account until you use them. No monthly resets, no 'use it or lose it'.",
  },
  {
    q: "What's the trial?",
    a: "$1 for 7 days, 100 credits up front. After the trial period we auto-charge the plan you picked at trial start. Cancel any time before then in Settings and we won't charge.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes, within 14 days of purchase if you've used less than 25% of your credits. Email support and we'll process it within two business days.",
  },
  {
    q: "Can I send emails directly from Lead Machine?",
    a: "Yes. Connect a Gmail account via app-password (no domain or SMTP server needed). The outreach autopilot sends multi-step sequences with humanized delays, send windows, and daily caps so you don't get throttled.",
  },
  {
    q: "How many emails per day per Gmail account?",
    a: "Free Gmail tops out around 500 sends/day; Google Workspace around 2,000. The campaign builder lets you cap below that and rotate across multiple connected accounts to scale further.",
  },
  {
    q: "Will my replies land in my inbox?",
    a: "Yes — every send sets the Reply-To header to your verified inbox, so prospect replies route straight back to you. Our unified inbox view also surfaces them inside the app.",
  },
  {
    q: "Can I export to my CRM?",
    a: "Every lead is CSV and Excel exportable today, with the exact column shape HubSpot, Pipedrive, and Salesforce accept. Direct CRM connectors are on the roadmap for Q3.",
  },
  {
    q: "Can I import the leads into a cold-email tool?",
    a: "Yes — the CSV export matches the import schema for Instantly, Smartlead, Apollo, Lemlist and Mailshake. You can also use our built-in outreach module to skip the export entirely.",
  },
  {
    q: "Is there an API?",
    a: "A REST API for programmatic lead generation is in private beta. Email us if you'd like access.",
  },
  {
    q: "Is this compliant with GDPR / CCPA?",
    a: "Lead Machine surfaces publicly available business contact data — the same data you'd find by searching Google yourself. We don't sell personal/private records, and businesses can request removal at any time.",
  },
  {
    q: "How is my data stored?",
    a: "Every campaign and lead is isolated to your account with Postgres row-level security. Service-role keys are held only by the backend worker. We never share data between accounts.",
  },
  {
    q: "Do you train AI on my campaigns?",
    a: "No. Your lead data, contact lists, and outreach sequences are never used to train any model.",
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
