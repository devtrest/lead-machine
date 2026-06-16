"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  MapPin,
  Globe,
  Mail,
  Phone,
  Star,
} from "lucide-react";
import { LogoMarquee } from "@/components/home/LogoMarquee";

export function HomeHero({
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
    : "Get started";

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-55 blur-[120px] animate-float-soft"
        aria-hidden
      />
      <div
        className="absolute -right-40 top-20 h-[26rem] w-[26rem] rounded-full bg-gradient-to-br from-[var(--sky-200)] to-[var(--brand-200)] opacity-50 blur-[120px] animate-float-soft"
        aria-hidden
      />
      <div className="dot-grid absolute inset-0 opacity-40" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-12 md:px-8 md:pb-24 md:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-5xl text-center"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            <Sparkles className="h-3 w-3" />
            AI-powered lead generation
          </div>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-6xl md:leading-[1.08]">
            Find leads and close clients{" "}
            <br className="hidden md:block" />
            <span className="brand-text-gradient">while you sleep</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-[var(--ink-muted)] md:text-lg">
            Tell Lead Machine a niche and a city. We surface verified businesses
            with phones and emails, then run your cold-email outreach on
            autopilot — so interested replies land in one inbox while
            you&apos;re offline.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)] transition hover:bg-[var(--brand-700)]"
            >
              <Sparkles className="h-4 w-4" />
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] px-5 py-3 text-sm font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
            >
              See how it works
            </Link>
          </div>
          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[var(--ink-subtle)]">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success-500)]" />
            Start for $1 · 100 credits, 7-day trial
          </div>
        </motion.div>

        <LogoMarquee />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-14 max-w-5xl"
        >
          <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface-elev)] shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
            <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger-500)]/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--warning-500)]/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--success-500)]/40" />
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-[0.95fr_1.05fr] md:p-7">
              <div className="surface-sunken p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
                  AI lead engine
                </div>
                <p className="mt-2 text-sm font-medium text-[var(--ink-strong)]">
                  Niche
                </p>
                <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-2 text-sm text-[var(--ink-strong)]">
                  rooftop cafes
                </div>
                <p className="mt-3 text-sm font-medium text-[var(--ink-strong)]">
                  Location
                </p>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-2 text-sm text-[var(--ink-strong)]">
                  <MapPin className="h-3.5 w-3.5 text-[var(--ink-subtle)]" />
                  Lisbon, Portugal
                </div>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-3.5 py-2 text-xs font-semibold text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate 100 leads
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--ink-muted)]">Progress</span>
                    <span className="font-semibold text-[var(--brand-700)]">
                      72%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                    <motion.div
                      initial={{ width: "0%" }}
                      animate={{ width: "72%" }}
                      transition={{ duration: 1.2, delay: 0.6 }}
                      className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--sky-500)]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {previewRows.map((r, i) => (
                  <motion.div
                    key={r.name}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.08 }}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--ink-strong)]">
                        {r.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--ink-subtle)]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {r.address}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.website ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-50)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-700)]">
                            <Globe className="h-2.5 w-2.5" /> Website
                          </span>
                        ) : null}
                        {r.email ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-50)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-700)]">
                            <Mail className="h-2.5 w-2.5" /> Email
                          </span>
                        ) : null}
                        {r.phone ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-50)] px-2 py-0.5 text-[10px] font-medium text-[var(--success-700)]">
                            <Phone className="h-2.5 w-2.5" /> Phone
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--accent-700)]">
                      <Star className="h-3 w-3 fill-current" />
                      {r.rating}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const previewRows = [
  {
    name: "Park Bar Lisboa",
    address: "Calçada do Combro 58 · Lisbon",
    website: true,
    email: true,
    phone: true,
    rating: 4.5,
  },
  {
    name: "Topo Chiado",
    address: "Rua Garrett 7 · Lisbon",
    website: true,
    email: false,
    phone: true,
    rating: 4.4,
  },
  {
    name: "Sky Bar Tivoli",
    address: "Av. da Liberdade 185 · Lisbon",
    website: true,
    email: true,
    phone: true,
    rating: 4.3,
  },
];
