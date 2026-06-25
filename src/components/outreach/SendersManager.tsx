"use client";

import { useMemo, useState } from "react";
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
  Server,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  allPresets,
  presetForKey,
  type SenderPresetKey,
} from "@/lib/sender-providers";

// Real provider brand glyphs (lucide-react dropped its brand icons, so we ship
// our own). Single-path marks in each brand's color; rendered on a white chip.
function GmailGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
      />
    </svg>
  );
}
function OutlookGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#0078D4"
        d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.11-.87q.1-.43.34-.76.22-.33.59-.52.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.86zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.1.07.18.18.07.12.07.25zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.28.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.31-1.2.85-.5.54-.75 1.28-.25.73-.25 1.61 0 .85.24 1.56.25.72.72 1.24.47.52 1.15.82.68.3 1.56.3zM7.13 12L24 22.5V12z"
      />
    </svg>
  );
}
function TitanGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="3" fill="#0B5CD5" />
      <path
        d="M4 7.5l8 5 8-5"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Pick the right brand glyph for a provider key (custom → generic server icon).
function providerIcon(key: string, className = "h-3.5 w-3.5") {
  switch (key) {
    case "gmail":
      return <GmailGlyph className={className} />;
    case "outlook":
      return <OutlookGlyph className={className} />;
    case "titan":
      return <TitanGlyph className={className} />;
    default:
      return <Server className={className} />;
  }
}

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
          Connect a sender
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
        <div className="surface-card p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
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
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--brand-700)]"
          >
            <Plus className="h-4 w-4" />
            Connect your first Gmail
          </button>
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
              className="surface-card group p-5 transition hover:shadow-[var(--shadow-md)]"
            >
              <div>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--ink-muted)] ring-1 ring-inset ring-[var(--border)]">
                    {providerIcon(s.provider, "h-6 w-6")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-[var(--ink-strong)]">
                        {s.display_name ?? s.email.split("@")[0]}
                      </span>
                      <StatusDot status={s.status} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 truncate text-xs text-[var(--ink-muted)]">
                      <span className="truncate">{s.email}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--ink-strong)]">
                        {presetForKey(s.provider).label}
                      </span>
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
                      className="h-full rounded-full bg-[var(--brand-600)]"
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
  const [providerKey, setProviderKey] = useState<SenderPresetKey>("gmail");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Custom-provider fields. Only used when providerKey === 'custom'.
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false); // false = STARTTLS, true = implicit TLS
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapSecure, setImapSecure] = useState(true);

  const presets = useMemo(() => allPresets(), []);
  const preset = presetForKey(providerKey);
  const trimmedLen = appPassword.replace(/\s+/g, "").length;
  const isGmail = providerKey === "gmail";
  const isCustom = providerKey === "custom";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isGmail && trimmedLen !== 16) {
      setError(
        `Gmail app passwords are exactly 16 characters. You entered ${trimmedLen}.`
      );
      return;
    }
    if (!isGmail && appPassword.length < 4) {
      setError("Password is too short.");
      return;
    }
    if (isCustom && (!smtpHost.trim() || !imapHost.trim())) {
      setError("SMTP host and IMAP host are required for custom providers.");
      return;
    }

    setSubmitting(true);
    const payload: Record<string, unknown> = {
      provider: providerKey,
      email,
      appPassword,
      displayName: displayName || undefined,
    };
    if (isCustom) {
      payload.smtpHost = smtpHost.trim();
      payload.smtpPort = Number(smtpPort);
      payload.smtpSecure = smtpSecure;
      payload.imapHost = imapHost.trim();
      payload.imapPort = Number(imapPort);
      payload.imapSecure = imapSecure;
    }
    const res = await fetch("/api/outreach/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    <form onSubmit={onSubmit} className="surface-card space-y-4 p-4">
      {/* Provider tile picker — visual grid, click to select. */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
          Provider
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {presets.map((p) => {
            const active = p.key === providerKey;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setProviderKey(p.key)}
                className={`group flex items-start gap-2 rounded-xl border p-2.5 text-left transition ${
                  active
                    ? "border-[var(--brand-500)] bg-[var(--brand-50)] ring-2 ring-[var(--brand-500)]/20"
                    : "border-[var(--border)] bg-[var(--surface-elev)] hover:border-[var(--brand-200)] hover:bg-[var(--brand-50)]/40"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-white text-[var(--ink-muted)] ${
                    active
                      ? "border-[var(--brand-300)]"
                      : "border-[var(--border)]"
                  }`}
                >
                  {providerIcon(p.key)}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--ink-strong)]">
                    {p.label}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-[var(--ink-muted)]">
                    {p.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Email + display name */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={isGmail ? "Gmail address" : "Email address"}
          type="email"
          required
          placeholder={isGmail ? "you@gmail.com" : "you@yourdomain.com"}
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

      {/* Password */}
      <Input
        label={preset.passwordLengthHint}
        type={showPassword ? "text" : "password"}
        required
        placeholder={isGmail ? "xxxx xxxx xxxx xxxx" : "Your password"}
        value={appPassword}
        onChange={(e) => setAppPassword(e.target.value)}
        hint={
          isGmail
            ? `${preset.passwordHint} (${trimmedLen}/16)`
            : preset.passwordHint
        }
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

      {/* Custom-SMTP/IMAP fields — only when 'custom' is selected. */}
      {isCustom ? (
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)]/30 p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            Custom SMTP (outbound)
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_140px]">
            <Input
              label="SMTP host"
              placeholder="smtp.yourdomain.com"
              required
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
            />
            <Input
              label="Port"
              type="number"
              required
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
            />
            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)]">
                Encryption
              </label>
              <select
                value={smtpSecure ? "ssl" : "starttls"}
                onChange={(e) => setSmtpSecure(e.target.value === "ssl")}
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-2 text-sm text-[var(--ink-strong)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
              >
                <option value="starttls">STARTTLS (587)</option>
                <option value="ssl">SSL/TLS (465)</option>
              </select>
            </div>
          </div>

          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            Custom IMAP (inbox replies)
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_140px]">
            <Input
              label="IMAP host"
              placeholder="imap.yourdomain.com"
              required
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
            />
            <Input
              label="Port"
              type="number"
              required
              value={imapPort}
              onChange={(e) => setImapPort(e.target.value)}
            />
            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)]">
                Encryption
              </label>
              <select
                value={imapSecure ? "ssl" : "starttls"}
                onChange={(e) => setImapSecure(e.target.value === "ssl")}
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-2 text-sm text-[var(--ink-strong)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
              >
                <option value="ssl">SSL/TLS (993)</option>
                <option value="starttls">STARTTLS (143)</option>
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {/* Preset summary — shows the user what hosts we'll dial */}
      {!isCustom ? (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)]/40 px-3 py-2 text-[11px] text-[var(--brand-800)]">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-[var(--brand-700)]" />
          <div className="space-y-0.5">
            <div>
              SMTP <span className="font-mono">{preset.smtpHost}:{preset.smtpPort}</span>
              {" · "}
              IMAP <span className="font-mono">{preset.imapHost}:{preset.imapPort}</span>
            </div>
            {preset.helpUrl ? (
              <a
                href={preset.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline"
              >
                {preset.label} security settings
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Verification disclosure */}
      <div className="flex items-start gap-2 rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)]/50 px-3 py-2 text-[11px] text-[var(--brand-700)]">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        We&apos;ll open a real SMTP connection to verify these credentials.
        If the password is wrong, the sender will NOT be saved.
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting} disabled={submitting}>
          {submitting ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verifying with {preset.label}…
            </span>
          ) : (
            "Connect"
          )}
        </Button>
      </div>
      <p className="text-[11px] text-[var(--ink-subtle)]">
        Daily send pace is configured per campaign, not per sender. Each
        provider&apos;s typical account ceiling is applied automatically.
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
