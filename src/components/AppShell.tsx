"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Sparkles,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  CreditCard,
  Mail,
  AtSign,
  Inbox,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { initialsFor } from "@/lib/avatar";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

// Grouped navigation. Each section is rendered with a small uppercase
// header so the sidebar reads like a navigation panel, not a flat list.
const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/user",
        label: "Dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Lead engine",
    items: [
      {
        href: "/user/jobs",
        label: "Lead campaigns",
        icon: <Sparkles className="h-4 w-4" />,
      },
      {
        href: "/user/leads",
        label: "Prospect lists",
        icon: <Users className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Outreach",
    items: [
      {
        href: "/user/outreach",
        label: "Email campaigns",
        icon: <Mail className="h-4 w-4" />,
      },
      {
        href: "/user/inbox",
        label: "Unified inbox",
        icon: <Inbox className="h-4 w-4" />,
      },
      {
        href: "/user/senders",
        label: "Sender accounts",
        icon: <AtSign className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        href: "/user/billing",
        label: "Billing & credits",
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        href: "/user/settings",
        label: "Settings",
        icon: <Settings className="h-4 w-4" />,
      },
    ],
  },
];

type Props = {
  email?: string | null;
  fullName?: string | null;
  credits: number;
  plan: string;
  role: string;
  children: React.ReactNode;
};

export function AppShell({ email, fullName, credits, plan, role, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Keep the credit balance live without a manual refresh. Adopt the server
  // value on navigation/refresh, poll every few seconds, and update instantly
  // when something charges/grants credits (dispatches "leadmachine:credits").
  const [liveCredits, setLiveCredits] = useState(credits);
  useEffect(() => setLiveCredits(credits), [credits]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/credits", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { credits?: number };
        if (alive && typeof json.credits === "number") setLiveCredits(json.credits);
      } catch {
        /* network blip — retry next tick */
      }
    };
    const onEvent = () => load();
    window.addEventListener("leadmachine:credits", onEvent);
    const timer = setInterval(load, 6000);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("leadmachine:credits", onEvent);
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const visibleSections = navSections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((n) => !n.adminOnly || role === "admin"),
    }))
    .filter((sec) => sec.items.length > 0);
  const initials = initialsFor(fullName ?? email);

  // Derive the current page title from the nav config so the topbar reads
  // like an app, not a bare bar.
  const currentItem = navSections
    .flatMap((s) => s.items)
    .find(
      (n) =>
        pathname === n.href ||
        (n.href !== "/user" && pathname.startsWith(n.href))
    );
  const pageTitle = currentItem?.label ?? "Dashboard";

  return (
    <div className="app-shell min-h-screen text-[var(--ink-strong)]">
      <div className="mx-auto flex max-w-[1500px]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-sunken)] lg:flex">
          <SidebarContent
            sections={visibleSections}
            pathname={pathname}
            email={email}
            credits={liveCredits}
            plan={plan}
            onSignOut={signOut}
          />
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[var(--border)] bg-[var(--surface-sunken)] lg:hidden"
              >
                <SidebarContent
                  sections={visibleSections}
                  pathname={pathname}
                  email={email}
                  credits={liveCredits}
                  plan={plan}
                  onSignOut={signOut}
                  onNavClick={() => setMobileOpen(false)}
                />
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>

        {/* Main */}
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/80 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg border border-[var(--border)] p-2 text-[var(--ink-muted)] transition hover:bg-[var(--surface-sunken)] lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-[var(--ink-strong)]">
                {pageTitle}
              </h1>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Link
                href="/user/jobs"
                className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-500)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition hover:opacity-95 sm:inline-flex"
              >
                <Sparkles className="h-3.5 w-3.5" />
                New campaign
              </Link>

              <Link
                href="/user/billing"
                className="hidden items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)] transition hover:border-[var(--brand-200)] hover:bg-[var(--brand-100)]/60 sm:flex"
                title="Buy more credits"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/credits-icon.svg"
                  alt=""
                  aria-hidden
                  className="h-4 w-4"
                />
                {liveCredits.toLocaleString()} credits
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-elev)] py-1 pl-1 pr-2.5 transition hover:bg-[var(--surface-sunken)]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-600)] to-[var(--sky-500)] text-[10px] font-bold text-white">
                    {initials}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                </button>
                <AnimatePresence>
                  {menuOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] shadow-lg"
                    >
                      <div className="border-b border-[var(--border)] px-4 py-3">
                        <div className="text-xs text-[var(--ink-subtle)]">Signed in as</div>
                        <div className="mt-0.5 truncate text-sm font-medium text-[var(--ink-strong)]">
                          {email ?? "anonymous"}
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                        <span className="text-[var(--ink-muted)]">Plan</span>
                        <span className="font-semibold capitalize text-[var(--brand-700)]">
                          {plan}
                        </span>
                      </div>
                      <Link
                        href="/user/settings"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                      </Link>
                      <button
                        type="button"
                        onClick={signOut}
                        className="flex w-full items-center gap-2 border-t border-[var(--border)] px-4 py-2.5 text-left text-sm text-[var(--danger-700)] transition hover:bg-[var(--danger-50)]"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </header>

          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="px-4 py-6 md:px-8 md:py-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  sections,
  pathname,
  email,
  credits,
  plan,
  onSignOut,
  onNavClick,
}: {
  sections: NavSection[];
  pathname: string;
  email?: string | null;
  credits: number;
  plan: string;
  onSignOut: () => void;
  onNavClick?: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <Link href="/user" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt=""
            aria-hidden
            className="h-8 w-8"
          />
          <span className="text-sm font-semibold tracking-tight text-[var(--ink-strong)]">
            Lead Machine
          </span>
        </Link>
        {onNavClick ? (
          <button
            type="button"
            onClick={onNavClick}
            aria-label="Close menu"
            className="rounded-lg p-1 text-[var(--ink-muted)] transition hover:bg-[var(--surface-sunken)] lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-1">
        {sections.map((sec) => (
          <div key={sec.label} className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
              {sec.label}
            </div>
            {sec.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/user" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavClick}
                  className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "nav-active"
                      : "text-[var(--ink-muted)] hover:bg-[var(--surface-elev)] hover:text-[var(--ink-strong)]"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active-pin"
                      className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--brand-600)]"
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    />
                  ) : null}
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                      active
                        ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "text-[var(--ink-muted)] group-hover:text-[var(--ink-strong)]"
                    }`}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] p-4">
        <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface-elev)] p-3 shadow-[var(--shadow-xs)]">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/credits-icon.svg"
              alt=""
              aria-hidden
              className="h-9 w-9 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
                {plan}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-[var(--ink-strong)]">
                {credits.toLocaleString()} credits
              </div>
            </div>
          </div>
          <Link
            href="/user/billing"
            className="rounded-lg bg-[var(--brand-600)] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white transition hover:bg-[var(--brand-700)]"
          >
            Upgrade
          </Link>
        </div>
        <div className="mt-3 truncate px-1 text-[11px] text-[var(--ink-subtle)]">
          {email ?? "anonymous"}
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--danger-500)]/40 hover:bg-[var(--danger-50)] hover:text-[var(--danger-700)]"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </>
  );
}
