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
  sentCount: number;
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
  selectedId,
  onSelect,
  allSelected,
  onSelectAll,
}: {
  senders: ConnectedSender[];
  // When provided, the chips become clickable filters. selectedId highlights
  // the active mailbox; clicking calls onSelect (parent toggles).
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  // When provided, renders a leading "All mailboxes" chip that aggregates
  // every connected sender. allSelected highlights it.
  allSelected?: boolean;
  onSelectAll?: () => void;
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
          {onSelect ? (
            <span className="ml-2 normal-case tracking-normal text-[var(--ink-subtle)]">
              · click a mailbox to see its activity
            </span>
          ) : null}
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
        {onSelectAll ? (
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 4 },
              show: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={onSelectAll}
              className={`flex h-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition hover:shadow-[var(--shadow-sm)] ${
                allSelected
                  ? "border-[var(--brand-500)] bg-[var(--brand-50)] ring-2 ring-[var(--brand-500)] ring-offset-1"
                  : "border-[var(--border)] bg-[var(--surface-elev)] hover:border-[var(--brand-300)]"
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 text-[var(--brand-700)]">
                <AtSign className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--ink-strong)]">
                  All mailboxes
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--ink-subtle)]">
                  every connected sender
                </div>
              </div>
            </button>
          </motion.div>
        ) : null}
        {senders.map((s) => (
          <motion.div
            key={s.id}
            variants={{
              hidden: { opacity: 0, y: 4 },
              show: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SenderChip
              sender={s}
              selected={selectedId === s.id}
              onSelect={onSelect ? () => onSelect(s.id) : undefined}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function SenderChip({
  sender,
  selected,
  onSelect,
}: {
  sender: ConnectedSender;
  selected: boolean;
  onSelect?: () => void;
}) {
  const statusStyles =
    sender.status === "active" && !sender.lastError
      ? "border-[var(--success-100)] bg-[var(--success-50)]/60"
      : sender.status === "paused"
        ? "border-[var(--warning-100)] bg-[var(--warning-50)]/60"
        : "border-[var(--danger-100)] bg-[var(--danger-50)]/60";

  const selectable = Boolean(onSelect);
  const interactive = selectable
    ? `cursor-pointer transition hover:shadow-[var(--shadow-sm)] ${
        selected
          ? "ring-2 ring-[var(--brand-500)] ring-offset-1"
          : "hover:border-[var(--brand-300)]"
      }`
    : "";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!selectable}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left ${statusStyles} ${interactive} ${
        selectable ? "" : "cursor-default"
      }`}
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
            <span
              className="shrink-0 rounded-full bg-[var(--brand-600)] px-1.5 py-0.5 text-[9px] font-bold text-white"
              title={`${sender.replyCount} replies`}
            >
              {sender.replyCount}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--ink-subtle)]">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {sender.lastCheckedAt
              ? `polled ${timeAgo(sender.lastCheckedAt)}`
              : "not polled yet"}
          </span>
          <span className="font-semibold text-[var(--ink-muted)]">
            {sender.sentCount} sent
          </span>
        </div>
      </div>
    </button>
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
