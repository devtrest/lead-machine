"use client";

import { motion } from "framer-motion";

type Props = {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
};

export function PageHero({ eyebrow, title, subtitle }: Props) {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute -left-32 -top-32 h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-50 blur-[120px] animate-float-soft"
        aria-hidden
      />
      <div
        className="absolute -right-40 top-12 h-[22rem] w-[22rem] rounded-full bg-gradient-to-br from-[var(--sky-200)] to-[var(--brand-200)] opacity-40 blur-[120px] animate-float-soft"
        aria-hidden
      />
      <div className="dot-grid absolute inset-0 opacity-40" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-4xl px-5 pb-12 pt-12 text-center md:px-8 md:pb-16 md:pt-20"
      >
        {eyebrow ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-5xl md:leading-[1.1]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--ink-muted)] md:text-lg">
            {subtitle}
          </p>
        ) : null}
      </motion.div>
    </section>
  );
}
