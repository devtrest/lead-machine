"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Layers,
  Activity,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ArrowLeftRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { initialsFor } from "@/lib/avatar";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/campaigns", label: "Campaigns", icon: <Layers className="h-4 w-4" /> },
  { href: "/admin/activity", label: "Activity", icon: <Activity className="h-4 w-4" /> },
];

type Props = {
  email?: string | null;
  fullName?: string | null;
  children: React.ReactNode;
};

export function AdminShell({ email, fullName, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const initials = initialsFor(fullName ?? email);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--surface)] via-[#fafaf9] to-[#f4f0fe] text-[var(--ink-strong)]">
      <div className="mx-auto flex max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-elev)]/85 backdrop-blur-sm lg:flex">
          <SidebarContent
            pathname={pathname}
            email={email}
            onSignOut={signOut}
          />
        </aside>

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
                className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[var(--border)] bg-[var(--surface-elev)] lg:hidden"
              >
                <SidebarContent
                  pathname={pathname}
                  email={email}
                  onSignOut={signOut}
                  onNavClick={() => setMobileOpen(false)}
                />
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/85 px-4 py-3 backdrop-blur md:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-[var(--border)] p-2 text-[var(--ink-muted)] transition hover:bg-[var(--surface-sunken)] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex flex-1 items-center justify-end gap-2">
              <Link
                href="/user"
                className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-elev)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)] sm:inline-flex"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Switch to user app
              </Link>

              <div className="hidden items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)] sm:flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-elev)] py-1 pl-1 pr-2.5 transition hover:bg-[var(--surface-sunken)]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-700)] to-[var(--brand-500)] text-[10px] font-bold text-white">
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
                        <div className="text-xs text-[var(--ink-subtle)]">
                          Signed in as
                        </div>
                        <div className="mt-0.5 truncate text-sm font-medium text-[var(--ink-strong)]">
                          {email ?? "anonymous"}
                        </div>
                      </div>
                      <Link
                        href="/user"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        User app
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
  pathname,
  email,
  onSignOut,
  onNavClick,
}: {
  pathname: string;
  email?: string | null;
  onSignOut: () => void;
  onNavClick?: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand-700)] to-[var(--brand-500)] text-sm font-bold text-white shadow-[0_4px_14px_rgba(67,56,202,0.30)]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-[var(--ink-strong)]">
              Lead Machine
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">
              Admin Console
            </div>
          </div>
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

      <nav className="flex-1 space-y-1 px-3">
        {adminNav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "nav-active"
                  : "text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="admin-nav-active-pin"
                  className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--brand-600)]"
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : null}
              <span className={active ? "text-[var(--brand-600)]" : ""}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-4">
        <Link
          href="/user"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-2 text-xs font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
        >
          <ArrowLeftRight className="h-3 w-3" />
          Switch to user app
        </Link>
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
