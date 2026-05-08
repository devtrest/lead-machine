"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, User, AlertTriangle, Check, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);
    const supabase = createClient();
    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/user`,
      },
    });
    setLoading(false);
    if (signErr) {
      setError(signErr.message);
      return;
    }
    if (data.session) {
      router.replace("/user");
      router.refresh();
      return;
    }
    setMsg(
      "Check your inbox — confirm your email, then sign in to access your dashboard."
    );
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
          label="Full name"
          autoComplete="name"
          required
          iconLeft={<User className="h-4 w-4" />}
          placeholder="Jane Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          label="Work email"
          type="email"
          autoComplete="email"
          required
          iconLeft={<Mail className="h-4 w-4" />}
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          iconLeft={<Lock className="h-4 w-4" />}
          placeholder="Minimum 8 characters"
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

        {msg ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 rounded-xl border border-[var(--success-100)] bg-[var(--success-50)] px-3.5 py-2.5 text-sm text-[var(--success-700)]"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{msg}</span>
          </motion.div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="w-full"
          iconRight={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
        >
          {loading ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-center text-xs text-[var(--ink-subtle)]">
          By creating an account, you agree to our terms and privacy policy.
        </p>
      </form>
    </motion.div>
  );
}
