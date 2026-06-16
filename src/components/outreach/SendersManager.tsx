"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Mail,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  Info,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export type Sender = {
  id: string;
  email: string;
  display_name: string | null;
  provider: string;
  daily_limit: number;
  sends_today: number;
  last_reset_at: string;
  status: string;
  last_error: string | null;
  created_at: string;
};

export function SendersManager({
  initialSenders,
}: {
  initialSenders: Sender[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleStatus(s: Sender) {
    setBusy(s.id);
    const newStatus = s.status === "active" ? "paused" : "active";
    const res = await fetch(`/api/outreach/senders/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusy(null);
    if (res.ok) {
      toast.success(newStatus === "active" ? "Resumed" : "Paused");
      router.refresh();
    } else {
      toast.error("Couldn't update sender");
    }
  }

  async function removeSender(s: Sender) {
    if (
      !confirm(
        `Disconnect ${s.email}? This removes the sender from all campaigns. App password is permanently deleted.`
      )
    ) {
      return;
    }
    setBusy(s.id);
    const res = await fetch(`/api/outreach/senders/${s.id}`, {
      method: "DELETE",
    });
    setBusy(null);
    if (res.ok) {
      toast.success("Sender disconnected");
      router.refresh();
    } else {
      toast.error("Couldn't remove sender");
    }
  }

  return (
    <div className="space-y-4">
      {/* Help banner */}
      <div className="flex items-start gap-3 rounded-xl border border-[var(--brand-100)] bg-[var(--brand-50)]/50 p-4 text-sm text-[var(--brand-800)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-700)]" />
        <div className="space-y-1">
          <p className="font-medium">How to connect a Gmail sender</p>
          <ol className="list-inside list-decimal space-y-0.5 text-xs text-[var(--brand-700)]">
            <li>
              Enable 2-Step Verification on the Google account (
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                myaccount.google.com/security
              </a>
              )
            </li>
            <li>
              Generate an App Password (
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                myaccount.google.com/apppasswords
              </a>
              ) — 16 characters, spaces don&apos;t matter
            </li>
            <li>Paste it below. We&apos;ll validate by attempting an SMTP login.</li>
          </ol>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--ink-strong)]">
          Connected senders ({initialSenders.length})
        </h2>
        <Button
          type="button"
          size="sm"
          onClick={() => setAddOpen((v) => !v)}
          iconLeft={<Plus className="h-3.5 w-3.5" />}
        >
          Connect Gmail
        </Button>
      </div>

      <AnimatePresence>
        {addOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
          >
            <AddSenderForm
              onClose={() => setAddOpen(false)}
              onAdded={() => {
                setAddOpen(false);
                router.refresh();
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {initialSenders.length === 0 ? (
        <div className="surface-card relative overflow-hidden p-12 text-center">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-30 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-100)]">
              <Mail className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[var(--ink-strong)]">
              No senders connected
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-muted)]">
              Connect at least one Gmail account before you can start any
              outreach campaign. We&apos;ll verify the app password with a
              real SMTP handshake — wrong creds get rejected instead of
              fake-saved.
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)] transition hover:bg-[var(--brand-700)]"
            >
              <Plus className="h-4 w-4" />
              Connect your first Gmail
            </button>
          </div>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
          }}
          className="grid gap-3 md:grid-cols-2"
        >
          {initialSenders.map((s) => (
            <motion.div
              key={s.id}
              variants={{
                hidden: { opacity: 0, y: 6 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="surface-card group relative overflow-hidden p-5 transition hover:shadow-[var(--shadow-md)]"
            >
              <div
                className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-25 blur-2xl transition group-hover:opacity-45 ${
                  s.status === "active"
                    ? "bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)]"
                    : s.status === "paused"
                      ? "bg-gradient-to-br from-[var(--warning-200)] to-[var(--accent-100)]"
                      : "bg-gradient-to-br from-[var(--danger-200)] to-[var(--danger-100)]"
                }`}
                aria-hidden
              />
              <div className="relative">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-600)] to-[var(--sky-500)] text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-[var(--ink-strong)]">
                        {s.display_name ?? s.email.split("@")[0]}
                      </span>
                      <StatusDot status={s.status} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                      {s.email}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleStatus(s)}
                      disabled={busy === s.id}
                      title={
                        s.status === "active" ? "Pause sender" : "Resume sender"
                      }
                      className="rounded-lg p-1.5 text-[var(--ink-subtle)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)] disabled:opacity-50"
                    >
                      {s.status === "active" ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSender(s)}
                      disabled={busy === s.id}
                      title="Disconnect"
                      className="rounded-lg p-1.5 text-[var(--ink-subtle)] transition hover:bg-[var(--danger-50)] hover:text-[var(--danger-700)] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Daily-quota progress */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-baseline justify-between text-[10px]">
                    <span className="font-bold uppercase tracking-wider text-[var(--ink-subtle)]">
                      Today&apos;s sends
                    </span>
                    <span className="font-semibold tabular-nums text-[var(--ink-strong)]">
                      {s.sends_today}
                      <span className="text-[var(--ink-subtle)]">
                        {" "}
                        / {s.daily_limit}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--sky-500)]"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(100, (s.sends_today / Math.max(1, s.daily_limit)) * 100)}%`,
                      }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>

                {s.last_error ? (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3 py-2 text-[11px] text-[var(--danger-700)]">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {s.last_error}
                  </div>
                ) : null}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const styles: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    active: {
      cls: "bg-[var(--success-50)] text-[var(--success-700)] border-[var(--success-100)]",
      label: "Active",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    paused: {
      cls: "bg-[var(--warning-50)] text-[var(--warning-700)] border-[var(--warning-100)]",
      label: "Paused",
      icon: <Pause className="h-3 w-3" />,
    },
    error: {
      cls: "bg-[var(--danger-50)] text-[var(--danger-700)] border-[var(--danger-100)]",
      label: "Error",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
  };
  const s = styles[status] ?? styles.active;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${s.cls}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

function AddSenderForm({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live count of password chars (ignoring spaces) — Gmail app passwords are
  // exactly 16. Lets the user spot a missing/extra char before submitting.
  const trimmedLen = appPassword.replace(/\s+/g, "").length;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (trimmedLen !== 16) {
      setError(
        `Gmail app passwords are exactly 16 characters. You entered ${trimmedLen}.`
      );
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/outreach/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        appPassword,
        displayName: displayName || undefined,
      }),
    });
    setSubmitting(false);
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Couldn't add sender");
      return;
    }
    toast.success("Sender connected", email);
    onAdded();
  }

  return (
    <form onSubmit={onSubmit} className="surface-card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Gmail address"
          type="email"
          required
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Display name (optional)"
          placeholder="Your Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <Input
        label="App password"
        type={showPassword ? "text" : "password"}
        required
        placeholder="xxxx xxxx xxxx xxxx"
        value={appPassword}
        onChange={(e) => setAppPassword(e.target.value)}
        hint={`16 characters from myaccount.google.com/apppasswords. Spaces are ignored. (${trimmedLen}/16)`}
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
      />

      {/* Verification disclosure — the API actually validates the credentials
          now by opening an SMTP connection. The submit button shows the
          extra latency that adds (~3s). */}
      <div className="flex items-start gap-2 rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)]/50 px-3 py-2 text-[11px] text-[var(--brand-700)]">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        We&apos;ll open a real SMTP connection to Gmail to verify these
        credentials. If the password is wrong, the sender will NOT be saved.
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting} disabled={submitting}>
          {submitting ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verifying with Gmail…
            </span>
          ) : (
            "Connect"
          )}
        </Button>
      </div>
      <p className="text-[11px] text-[var(--ink-subtle)]">
        Daily send pace is configured per campaign, not per sender. Gmail&apos;s
        ~500/day account ceiling is enforced automatically.
      </p>
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      ) : null}
    </form>
  );
}
