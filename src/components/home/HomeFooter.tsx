"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, MapPin, ArrowUpRight } from "lucide-react";

// Inline social icons — Twitter/X and GitHub got renamed/removed across lucide
// releases, so we keep our own copies to avoid a moving target. Sized to match
// the lucide stroke width (1.5) and viewBox (24).
function TwitterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.111.82-.261.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

type FooterLink = { label: string; href: string; external?: boolean };
type FooterColumn = { title: string; links: FooterLink[] };

const columns: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Use cases",
    links: [
      { label: "Cold outreach", href: "/how-it-works" },
      { label: "Lead generation", href: "/how-it-works" },
      { label: "Local prospecting", href: "/how-it-works" },
      { label: "CRM enrichment", href: "/how-it-works" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/" },
      { label: "Contact", href: "mailto:hello@leadmachine.ai" },
      { label: "Status", href: "/" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "/" },
      { label: "Terms of service", href: "/" },
      { label: "Cookie policy", href: "/" },
      { label: "GDPR", href: "/" },
    ],
  },
];

const socials = [
  { label: "Twitter / X", href: "https://twitter.com", icon: TwitterIcon },
  { label: "LinkedIn", href: "https://linkedin.com", icon: LinkedinIcon },
  { label: "GitHub", href: "https://github.com", icon: GithubIcon },
];

export function HomeFooter({
  signedIn: _signedIn,
  isAdmin: _isAdmin = false,
}: {
  signedIn: boolean;
  isAdmin?: boolean;
}) {
  void _signedIn;
  void _isAdmin;

  return (
    <footer className="relative mt-12 border-t border-[var(--border)] bg-[var(--surface-elev)]">
      <div
        className="pointer-events-none absolute -left-32 top-0 h-64 w-64 rounded-full bg-[var(--brand-100)] opacity-40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 top-12 h-72 w-72 rounded-full bg-[var(--sky-100)] opacity-40 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-14 md:px-8 md:pt-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_2fr]">
          {/* Brand + newsletter */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.32 }}
          >
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.svg" alt="" aria-hidden className="h-9 w-9" />
              <span className="text-base font-semibold tracking-tight text-[var(--ink-strong)]">
                Lead Machine
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--ink-muted)]">
              AI-powered B2B lead generation. Find verified businesses with
              phones, emails, and websites — clean, deduped, CRM-ready in under
              two minutes per niche.
            </p>

            <div className="mt-6 flex items-center gap-3 text-xs text-[var(--ink-muted)]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--ink-subtle)]" />
              <span>Made remotely · serving 40+ countries</span>
            </div>

            <div className="mt-5 flex items-center gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] transition hover:border-[var(--brand-200)] hover:bg-[var(--brand-50)] hover:text-[var(--brand-700)]"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
              <a
                href="mailto:hello@leadmachine.ai"
                aria-label="Email"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] transition hover:border-[var(--brand-200)] hover:bg-[var(--brand-50)] hover:text-[var(--brand-700)]"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </motion.div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col, i) => (
              <motion.div
                key={col.title}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.32, delay: 0.04 * (i + 1) }}
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
                  {col.title}
                </div>
                <ul className="mt-3.5 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="group inline-flex items-center gap-1 text-sm text-[var(--ink-muted)] transition hover:text-[var(--ink-strong)]"
                      >
                        {link.label}
                        {link.external ? (
                          <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[var(--border)] pt-6 md:flex-row">
          <p className="text-xs text-[var(--ink-subtle)]">
            © {new Date().getFullYear()} Lead Machine. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--ink-muted)]">
            <Link href="/" className="transition hover:text-[var(--ink-strong)]">
              Privacy
            </Link>
            <Link href="/" className="transition hover:text-[var(--ink-strong)]">
              Terms
            </Link>
            <Link href="/" className="transition hover:text-[var(--ink-strong)]">
              Cookies
            </Link>
            <span className="text-[var(--ink-subtle)]">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success-500)] shadow-[0_0_8px_var(--success-500)]" />
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
