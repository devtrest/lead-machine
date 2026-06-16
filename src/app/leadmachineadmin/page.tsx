import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";
import { AdminLoginForm } from "./admin-login-form";

// Separate URL for admin sign-in so:
//   - It stays unindexed (robots.txt + noindex meta)
//   - User and admin accounts can't share credentials by mistake
//   - The blast radius of a compromised user login is bounded to /user
export const metadata = {
  title: "Admin · Lead Machine",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminLoginPage() {
  return (
    <div className="app-shell relative min-h-screen overflow-hidden">
      <div
        className="absolute -left-40 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-slate-300 to-slate-200 opacity-40 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-slate-200 opacity-30 blur-3xl"
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

      <main className="relative z-10 mx-auto flex max-w-md flex-col gap-6 px-5 pb-20 pt-10 md:pt-16">
        <div className="text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_8px_24px_rgba(15,23,42,0.25)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
            <Lock className="h-3 w-3" />
            Admin access only
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
            Admin console
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Sign in with your administrator credentials. User accounts cannot
            access this surface.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="surface-card-elev p-8 text-center text-sm text-[var(--ink-subtle)]">
              Loading…
            </div>
          }
        >
          <AdminLoginForm />
        </Suspense>

        <p className="text-center text-xs text-[var(--ink-subtle)]">
          Not an admin?{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-800)]"
          >
            User sign in →
          </Link>
        </p>
      </main>
    </div>
  );
}
