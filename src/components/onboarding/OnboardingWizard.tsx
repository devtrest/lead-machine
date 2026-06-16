"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  PartyPopper,
  Briefcase,
  Target,
  Gauge,
  Globe2,
} from "lucide-react";

type Question = {
  id: string;
  icon: React.ReactNode;
  title: string;
  options: string[];
};

const QUESTIONS: Question[] = [
  {
    id: "role",
    icon: <Briefcase className="h-4 w-4" />,
    title: "What best describes you?",
    options: ["Agency", "Founder / SaaS", "Freelancer", "Sales team", "Recruiter", "Other"],
  },
  {
    id: "use_case",
    icon: <Target className="h-4 w-4" />,
    title: "What will you use Lead Machine for?",
    options: ["Find B2B leads", "Cold email outreach", "Both", "CRM enrichment"],
  },
  {
    id: "volume",
    icon: <Gauge className="h-4 w-4" />,
    title: "How many leads per month do you need?",
    options: ["Under 500", "500 – 2,000", "2,000 – 10,000", "10,000+"],
  },
  {
    id: "region",
    icon: <Globe2 className="h-4 w-4" />,
    title: "Where do you sell?",
    options: ["North America", "Europe", "Asia-Pacific", "Global", "Other"],
  },
];

export function OnboardingWizard({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finishing, setFinishing] = useState(false);

  const total = QUESTIONS.length;
  const onWelcome = step >= total;

  function pick(qid: string, value: string) {
    setAnswers((a) => ({ ...a, [qid]: value }));
    // brief delay so the selection is visible before advancing
    setTimeout(() => setStep((s) => s + 1), 160);
  }

  async function finish() {
    setFinishing(true);
    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
    } catch {
      /* non-blocking — still let them in */
    }
    router.push("/user");
    router.refresh();
  }

  const pct = Math.round((Math.min(step, total) / total) * 100);

  return (
    <div className="mx-auto max-w-xl">
      {/* progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
          <span>{onWelcome ? "All set" : `Step ${step + 1} of ${total}`}</span>
          <span className="tabular-nums">{onWelcome ? 100 : pct}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)] ring-1 ring-inset ring-[var(--border)]">
          <motion.div
            className="h-full rounded-full bg-[var(--brand-600)]"
            initial={false}
            animate={{ width: `${onWelcome ? 100 : pct}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!onWelcome ? (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
                {QUESTIONS[step].icon}
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-2xl">
                {QUESTIONS[step].title}
              </h1>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {QUESTIONS[step].options.map((opt) => {
                const selected = answers[QUESTIONS[step].id] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => pick(QUESTIONS[step].id, opt)}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition ${
                      selected
                        ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)] ring-2 ring-[var(--brand-500)]/20"
                        : "border-[var(--border)] bg-[var(--surface-elev)] text-[var(--ink-strong)] hover:border-[var(--brand-300)] hover:bg-[var(--surface-sunken)]"
                    }`}
                  >
                    {opt}
                    {selected ? (
                      <Check className="h-4 w-4 text-[var(--brand-600)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink-strong)]"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="surface-card p-8 text-center md:p-10"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--sky-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
              <PartyPopper className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-3xl">
              {firstName ? `You're all set, ${firstName}!` : "You're all set!"}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-[var(--ink-muted)] md:text-base">
              Your 3-day trial is live. Generate your first leads, build a
              campaign, and let the autopilot do the outreach. Your plan
              activates automatically when the trial ends — credits roll over
              and never expire.
            </p>
            <button
              type="button"
              onClick={finish}
              disabled={finishing}
              className="mt-7 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition hover:bg-[var(--brand-700)] disabled:opacity-50"
            >
              {finishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Enter dashboard
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
