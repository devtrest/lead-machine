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
        <div className="surface-card p-10 text-center">
          <Mail className="mx-auto h-10 w-10 text-[var(--ink-subtle)]" />
          <h3 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
            No senders connected
          </h3>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
            Connect at least one Gmail account before you can start any
            outreach campaign.
          </p>
        </div>
      ) : (
        <ul className="surface-card divide-y divide-[var(--border)] p-0">
          {initialSenders.map((s) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center gap-3 px-5 py-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-100)] to-[var(--sky-100)] text-[var(--brand-700)]">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-[var(--ink-strong)]">
                    {s.display_name ? `${s.display_name} ` : ""}
                    <span className="text-[var(--ink-muted)]">
                      &lt;{s.email}&gt;
                    </span>
                  </span>
                  <StatusDot status={s.status} />
                </div>
                <div className="mt-0.5 text-xs text-[var(--ink-muted)]">
                  {s.sends_today} / {s.daily_limit} today
                  {s.last_error ? (
                    <>
                      {" · "}
                      <span className="text-[var(--danger-700)]">
                        {s.last_error}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleStatus(s)}
                  disabled={busy === s.id}
                  title={s.status === "active" ? "Pause sender" : "Resume sender"}
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
            </motion.li>
          ))}
        </ul>
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
  const [dailyLimit, setDailyLimit] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/outreach/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        appPassword,
        displayName: displayName || undefined,
        dailyLimit,
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
        required
        placeholder="xxxx xxxx xxxx xxxx"
        value={appPassword}
        onChange={(e) => setAppPassword(e.target.value)}
        hint="16 characters from myaccount.google.com/apppasswords. Spaces are ignored."
      />
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input
          label="Daily send limit"
          type="number"
          min={1}
          max={500}
          value={dailyLimit}
          onChange={(e) =>
            setDailyLimit(Math.max(1, Math.min(500, Number(e.target.value) || 100)))
          }
          hint="Stay well under Gmail's ~500/day to avoid suspension."
        />
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Connect
        </Button>
      </div>
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      ) : null}
    </form>
  );
}
