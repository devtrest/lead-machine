"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  AlertTriangle,
  ArrowRight,
  User as UserIcon,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Mode = "user" | "admin";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitNext = searchParams.get("next");

  const initialMode: Mode = explicitNext?.startsWith("/admin")
    ? "admin"
    : "user";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: signResult, error: signErr } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signErr) {
      setLoading(false);
      setError(signErr.message);
      return;
    }

    const userId = signResult.user?.id;
    let role = "user";
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      role = profile?.role ?? "user";
    }

    // Selected Admin tab but the account isn't an admin → reject and sign out.
    if (mode === "admin" && role !== "admin") {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        "This account doesn't have admin access. Switch to the User tab to sign in."
      );
      return;
    }

    // Honor an explicit next param (e.g. coming from a guarded page).
    let target: string;
    if (explicitNext && explicitNext.startsWith("/")) {
      target = explicitNext;
    } else {
      target = mode === "admin" ? "/admin" : "/user";
    }

    setLoading(false);
    router.replace(target);
    router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="surface-card-elev p-7"
    >
      <ModeToggle mode={mode} onChange={setMode} />

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          iconLeft={<Mail className="h-4 w-4" />}
          placeholder={
            mode === "admin" ? "admin@yourcompany.com" : "you@company.com"
          }
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          iconLeft={<Lock className="h-4 w-4" />}
          iconRight={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="rounded p-0.5 text-[var(--ink-subtle)] transition hover:text-[var(--ink-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]/30"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 rounded-xl border border-[var(--danger-100)] bg-[var(--danger-50)] px-3.5 py-2.5 text-sm text-[var(--danger-700)]"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="w-full"
          iconRight={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
        >
          {loading
            ? "Signing in…"
            : mode === "admin"
              ? "Sign in to admin"
              : "Sign in"}
        </Button>
      </form>
    </motion.div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const options: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: "user", label: "User", icon: <UserIcon className="h-3.5 w-3.5" /> },
    {
      id: "admin",
      label: "Admin",
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
    },
  ];
  return (
    <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)]/60 p-1">
      {options.map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              active
                ? "text-[var(--brand-700)]"
                : "text-[var(--ink-muted)] hover:text-[var(--ink-strong)]"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="login-mode-active"
                className="absolute inset-0 rounded-lg bg-[var(--surface-elev)] shadow-[var(--shadow-xs)] ring-1 ring-[var(--brand-100)]"
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {opt.icon}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
