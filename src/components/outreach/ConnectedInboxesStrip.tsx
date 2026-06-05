"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AtSign,
  CheckCircle2,
  AlertTriangle,
  Pause,
  Clock,
} from "lucide-react";

export type ConnectedSender = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  replyCount: number;
};

// Visual strip at the top of the Inbox showing every connected Gmail account
// the worker is polling for replies. Each chip shows:
//   - sender address (with display name if set)
//   - status (active / paused / error)
//   - last-checked timestamp ("12s ago" or "never")
//   - reply count attributed to this sender
//
// Makes it obvious at a glance which inboxes are being monitored — and which
// aren't (paused, or last_error is populated).
export function ConnectedInboxesStrip({
  senders,
}: {
  senders: ConnectedSender[];
}) {
  if (senders.length === 0) {
    return (
      <div className="surface-card flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          <AtSign className="h-4 w-4" />
          No senders connected yet — the worker has nothing to poll.
        </div>
        <Link
          href="/user/senders"
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-600)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--brand-700)]"
        >
          Connect Gmail
        </Link>
      </div>
    );
  }

  return (
    <div className="surface-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
          Connected inboxes ({senders.length})
        </span>
        <Link
          href="/user/senders"
          className="text-[11px] font-semibold text-[var(--brand-700)] hover:text-[var(--brand-800)]"
        >
          Manage senders →
        </Link>
      </div>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.04 } },
        }}
        className="flex flex-wrap gap-2"
      >
        {senders.map((s) => (
          <motion.div
            key={s.id}
            variants={{
              hidden: { opacity: 0, y: 4 },
              show: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SenderChip sender={s} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function SenderChip({ sender }: { sender: ConnectedSender }) {
  const statusStyles =
    sender.status === "active" && !sender.lastError
      ? "border-[var(--success-100)] bg-[var(--success-50)]/60"
      : sender.status === "paused"
        ? "border-[var(--warning-100)] bg-[var(--warning-50)]/60"
        : "border-[var(--danger-100)] bg-[var(--danger-50)]/60";

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${statusStyles}`}
      title={sender.lastError ?? undefined}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80">
        <StatusIcon status={sender.status} hasError={Boolean(sender.lastError)} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-[var(--ink-strong)]">
            {sender.displayName ? `${sender.displayName} ` : ""}
            <span className="font-medium text-[var(--ink-muted)]">
              &lt;{sender.email}&gt;
            </span>
          </span>
          {sender.replyCount > 0 ? (
            <span className="shrink-0 rounded-full bg-[var(--brand-600)] px-1.5 py-0.5 text-[9px] font-bold text-white">
              {sender.replyCount}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[var(--ink-subtle)]">
          <Clock className="h-2.5 w-2.5" />
          {sender.lastCheckedAt
            ? `polled ${timeAgo(sender.lastCheckedAt)}`
            : "not polled yet"}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({
  status,
  hasError,
}: {
  status: string;
  hasError: boolean;
}) {
  if (hasError || status === "error")
    return <AlertTriangle className="h-3.5 w-3.5 text-[var(--danger-700)]" />;
  if (status === "paused")
    return <Pause className="h-3.5 w-3.5 text-[var(--warning-700)]" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success-700)]" />;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
