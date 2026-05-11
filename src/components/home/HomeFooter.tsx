"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

export function HomeFooter({
  signedIn,
  isAdmin = false,
}: {
  signedIn: boolean;
  isAdmin?: boolean;
}) {
  const ctaHref = signedIn ? (isAdmin ? "/admin" : "/user") : "/signup";
  const ctaLabel = signedIn
    ? isAdmin
      ? "Open admin console"
      : "Open dashboard"
    : "Start free";

  return (
    <>
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-3xl border border-[var(--brand-200)] bg-gradient-to-br from-[var(--brand-50)] via-[var(--surface-elev)] to-[var(--sky-100)] px-8 py-12 text-center md:px-12 md:py-16"
          >
            <div
              className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--brand-200)] opacity-30 blur-3xl"
              aria-hidden
            />
            <div
              className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[var(--sky-200)] opacity-50 blur-3xl"
              aria-hidden
            />
            <div className="relative">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
                <Sparkles className="h-3 w-3" />
                Try Lead Machine free
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
                Your next 100 leads are{" "}
                <span className="brand-text-gradient">one prompt away</span>.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--ink-muted)] md:text-base">
                10 starter credits, no credit card. Generate, filter, export.
              </p>
              <Link
                href={ctaHref}
                className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)] transition hover:bg-[var(--brand-700)]"
              >
                <Sparkles className="h-4 w-4" />
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-[var(--surface-elev)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 md:flex-row md:px-8">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" aria-hidden className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight text-[var(--ink-strong)]">
              Lead Machine
            </span>
            <span className="text-xs text-[var(--ink-subtle)]">
              · AI lead generation
            </span>
          </div>
          <div className="flex items-center gap-5 text-xs text-[var(--ink-muted)]">
            <Link
              href="/how-it-works"
              className="transition hover:text-[var(--ink-strong)]"
            >
              How it works
            </Link>
            <Link
              href="/pricing"
              className="transition hover:text-[var(--ink-strong)]"
            >
              Pricing
            </Link>
            <Link
              href="/faq"
              className="transition hover:text-[var(--ink-strong)]"
            >
              FAQ
            </Link>
            <Link
              href="/login"
              className="transition hover:text-[var(--ink-strong)]"
            >
              Sign in
            </Link>
          </div>
          <p className="text-xs text-[var(--ink-subtle)]">
            © {new Date().getFullYear()} Lead Machine
          </p>
        </div>
      </footer>
    </>
  );
}
