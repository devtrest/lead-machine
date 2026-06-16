"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitNext = searchParams.get("next");

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

    // Hard gate — only admin accounts can sign in here. Anything else gets
    // signed out and rejected. The error message is intentionally vague so
    // we don't leak whether the account exists at all.
    if (role !== "admin") {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        "These credentials are not valid for admin access."
      );
      return;
    }

    const target =
      explicitNext && explicitNext.startsWith("/admin")
        ? explicitNext
        : "/admin";

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
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input
          label="Admin email"
          type="email"
          autoComplete="email"
          required
          iconLeft={<Mail className="h-4 w-4" />}
          placeholder="admin@yourcompany.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          minLength={8}
          maxLength={16}
          iconLeft={<Lock className="h-4 w-4" />}
          iconRight={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="rounded p-0.5 text-[var(--ink-subtle)] transition hover:text-[var(--ink-strong)] focus:outline-none focus:ring-2 focus:ring-slate-700/30"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
          placeholder="8–16 characters"
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
          className="w-full bg-slate-900 hover:bg-slate-800"
          iconLeft={!loading ? <ShieldCheck className="h-4 w-4" /> : undefined}
          iconRight={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
        >
          {loading ? "Verifying…" : "Sign in to admin"}
        </Button>
      </form>
    </motion.div>
  );
}
