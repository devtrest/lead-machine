"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Sparkles,
  CreditCard,
  Database,
  Shield,
  HelpCircle,
  Mail,
} from "lucide-react";

type Faq = { q: string; a: string };
type Category = {
  id: string;
  title: string;
  icon: React.ReactNode;
  faqs: Faq[];
};

const categories: Category[] = [
  {
    id: "leads",
    title: "Leads & data quality",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    faqs: [
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
    ],
  },
  {
    id: "credits",
    title: "Credits & billing",
    icon: <CreditCard className="h-3.5 w-3.5" />,
    faqs: [
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
        a: "$1 for 3 days, 100 credits up front. After 72 hours we auto-charge the plan you picked at trial start. Cancel any time before then in Settings and we won't charge.",
      },
      {
        q: "Can I get a refund?",
        a: "Yes, within 14 days of purchase if you've used less than 25% of your credits. Email support and we'll process it within two business days.",
      },
    ],
  },
  {
    id: "outreach",
    title: "Outreach & sending",
    icon: <Mail className="h-3.5 w-3.5" />,
    faqs: [
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
    ],
  },
  {
    id: "export",
    title: "Exports & integrations",
    icon: <Database className="h-3.5 w-3.5" />,
    faqs: [
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
    ],
  },
  {
    id: "compliance",
    title: "Compliance & security",
    icon: <Shield className="h-3.5 w-3.5" />,
    faqs: [
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
    ],
  },
];

export function HomeFaq() {
  const [activeCategory, setActiveCategory] = useState<string>(categories[0].id);
  const currentCategory =
    categories.find((c) => c.id === activeCategory) ?? categories[0];

  return (
    <section id="faq" className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        {/* Header */}
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

        {/* Category tabs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {categories.map((cat) => {
            const active = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`relative inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)]"
                    : "border-[var(--border)] bg-[var(--surface-elev)] text-[var(--ink-muted)] hover:border-[var(--brand-200)] hover:text-[var(--brand-700)]"
                }`}
              >
                {cat.icon}
                {cat.title}
              </button>
            );
          })}
        </div>

        {/* FAQ list */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCategory.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-10 max-w-3xl space-y-3"
          >
            {currentCategory.faqs.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} delay={i * 0.04} />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Help card at the bottom — part of FAQ section itself, not a separate
            post-FAQ CTA. Gives users a way out when their question isn't here. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.32 }}
          className="surface-card mx-auto mt-10 max-w-3xl p-6 text-center"
        >
          <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-50)] text-[var(--brand-700)]">
            <Mail className="h-5 w-5" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
            Didn&apos;t find your answer?
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--ink-muted)]">
            Email us at{" "}
            <a
              href="mailto:hello@leadmachine.ai"
              className="font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-800)]"
            >
              hello@leadmachine.ai
            </a>{" "}
            — we reply within one business day.
          </p>
        </motion.div>
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
