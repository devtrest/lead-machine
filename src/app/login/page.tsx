import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowLeft,
  Sparkles,
  Check,
  Zap,
  Globe,
  Shield,
} from "lucide-react";
import { LoginForm } from "./login-form";

const highlights = [
  {
    icon: Zap,
    title: "Live in 60 seconds",
    body: "Pick up your last campaign, jump back into outreach, export today's leads.",
  },
  {
    icon: Globe,
    title: "Your data, your tab",
    body: "Lead pipelines, sequences, and inbox replies are all where you left them.",
  },
  {
    icon: Shield,
    title: "Row-level isolated",
    body: "Nobody else's account ever touches your leads — Postgres RLS guarantees it.",
  },
];

export default function LoginPage() {
  return (
    <div className="app-shell relative min-h-screen overflow-hidden">
      <div
        className="absolute -left-40 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-55 blur-3xl animate-float-soft"
        aria-hidden
      />
      <div
        className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-gradient-to-br from-[var(--sky-200)] to-[var(--brand-200)] opacity-50 blur-3xl animate-float-soft"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" aria-hidden className="h-8 w-8" />
          <span className="text-sm font-semibold tracking-tight text-[var(--ink-strong)]">
            Lead Machine
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--ink-muted)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back home
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid max-w-5xl gap-10 px-5 pb-20 pt-10 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:pt-16">
        {/* Left column — brand pitch */}
        <div className="hidden flex-col justify-center md:flex">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            <Sparkles className="h-3 w-3" />
            Welcome back
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--ink-strong)]">
            Pick up where you{" "}
            <span className="brand-text-gradient">left off.</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-[var(--ink-muted)]">
            Your campaigns, lead lists, outreach sequences, and inbox replies
            are all waiting. One sign in and you&apos;re back in business.
          </p>

          <ul className="mt-8 space-y-4">
            {highlights.map((h) => (
              <li key={h.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-100)]">
                  <h.icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-[var(--ink-strong)]">
                    {h.title}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                    {h.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="surface-card mt-10 flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--success-50)] text-[var(--success-700)]">
              <Check className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--ink-strong)]">
                Trusted by founders, agencies, and SDRs
              </div>
              <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                Powering lead generation in 40+ countries.
              </p>
            </div>
          </div>
        </div>

        {/* Right column — form */}
        <div className="space-y-4">
          <div className="text-center md:hidden">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
              Login to{" "}
              <span className="brand-text-gradient">Lead Machine</span>
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Pick up where you left off.
            </p>
          </div>
          <h2 className="hidden text-xl font-semibold text-[var(--ink-strong)] md:block">
            Login to your account
          </h2>

          <Suspense
            fallback={
              <div className="surface-card-elev p-8 text-center text-sm text-[var(--ink-subtle)]">
                Loading…
              </div>
            }
          >
            <LoginForm />
          </Suspense>

          <p className="text-center text-sm text-[var(--ink-muted)]">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-800)]"
            >
              Create one →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
