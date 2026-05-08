import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { LoginForm } from "./login-form";

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

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)]">
            N
          </span>
          <span className="text-sm font-semibold tracking-tight text-[var(--ink-strong)]">
            Nichely
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--ink-muted)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back home
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex max-w-md flex-col gap-6 px-5 pb-20 pt-10 md:pt-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            <Sparkles className="h-3 w-3" />
            Welcome back
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
            Sign in to <span className="brand-text-gradient">Nichely</span>
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Pick up where you left off. Generate leads, track campaigns, export
            anywhere.
          </p>
        </div>

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
      </main>
    </div>
  );
}
