"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Menu, X } from "lucide-react";

type Props = {
  signedIn?: boolean;
  isAdmin?: boolean;
  /** Kept for backwards-compat; ignored — header is now unified light. */
  variant?: "editorial" | "dark";
};

export function SiteHeader({ signedIn, isAdmin }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition ${
        scrolled
          ? "border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-3.5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" aria-hidden className="h-8 w-8" />
          <span className="text-sm font-semibold tracking-tight text-[var(--ink-strong)]">
            Lead Machine
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-[var(--ink-muted)] md:flex">
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
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <>
              <Link
                href={isAdmin ? "/admin" : "/user"}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition hover:bg-[var(--brand-700)]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isAdmin ? "Open admin console" : "Open dashboard"}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--ink-muted)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition hover:bg-[var(--brand-700)]"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] p-2 text-[var(--ink-muted)] transition hover:bg-[var(--surface-sunken)] md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 z-50 h-screen w-72 border-l border-[var(--border)] bg-[var(--surface-elev)] p-6 md:hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--ink-strong)]">
                  Menu
                </span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-6 space-y-1">
                {[
                  ["How it works", "/how-it-works"],
                  ["Pricing", "/pricing"],
                  ["FAQ", "/faq"],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-[var(--ink-muted)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="mt-6 space-y-2 border-t border-[var(--border)] pt-6">
                {signedIn ? (
                  <Link
                    href={isAdmin ? "/admin" : "/user"}
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    <Sparkles className="h-3.5 w-3.5" />{" "}
                    {isAdmin ? "Open admin" : "Open dashboard"}
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--ink-strong)]"
                    >
                      Login
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setMobileOpen(false)}
                      className="flex w-full items-center justify-center rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Get started
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
