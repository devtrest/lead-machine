import Link from "next/link";
import { ArrowLeft, Sparkles, Check } from "lucide-react";
import { SignupForm } from "./signup-form";

const perks = [
  "Start your 7-day trial for $1",
  "100 credits — generate 100 leads",
  "CSV export and CRM-ready data",
];

export default function SignupPage() {
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

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
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
        <div className="hidden flex-col justify-center md:flex">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            <Sparkles className="h-3 w-3" />
            $1 · 7-day trial
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--ink-strong)]">
            Stop hunting leads. <br />
            Start <span className="brand-text-gradient">closing them.</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-[var(--ink-muted)]">
            Tell Lead Machine your niche and city. We surface verified businesses
            with phones, emails, and websites — clean and CRM-ready.
          </p>
          <ul className="mt-6 space-y-3">
            {perks.map((p) => (
              <li
                key={p}
                className="flex items-center gap-2.5 text-sm text-[var(--ink-strong)]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success-100)] text-[var(--success-700)]">
                  <Check className="h-3 w-3" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="text-center md:hidden">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
              Create your <span className="brand-text-gradient">Lead Machine</span>{" "}
              account
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Start your trial for just $1.
            </p>
          </div>
          <h2 className="hidden text-xl font-semibold text-[var(--ink-strong)] md:block">
            Create your account
          </h2>
          <SignupForm />
          <p className="text-center text-sm text-[var(--ink-muted)]">
            Already have one?{" "}
            <Link
              href="/login"
              className="font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-800)]"
            >
              Login →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
