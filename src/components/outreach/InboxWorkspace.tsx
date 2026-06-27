"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox as InboxIcon,
  X,
  Mail,
  Eye,
  Reply as ReplyIcon,
  CheckCircle2,
} from "lucide-react";
import {
  ConnectedInboxesStrip,
  type ConnectedSender,
} from "@/components/outreach/ConnectedInboxesStrip";
import { UniboxList, type UniboxReply } from "@/components/outreach/UniboxList";

// One contact (prospect) a given sender corresponded with: how many emails
// that mailbox sent them, opens, and whether they replied.
export type SenderContact = {
  email: string;
  name: string | null;
  sent: number;
  opened: number;
  replied: boolean;
};

// Wraps the connected-inboxes strip + the reply list so a clicked mailbox can
// drive both: it filters the replies to that sender AND shows a per-prospect
// activity table (sent / opened / replied) for that mailbox.
export function InboxWorkspace({
  replies,
  senders,
  activityBySender,
}: {
  replies: UniboxReply[];
  senders: ConnectedSender[];
  activityBySender: Record<string, SenderContact[]>;
}) {
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);

  const selectedSender = useMemo(
    () => senders.find((s) => s.id === selectedSenderId) ?? null,
    [senders, selectedSenderId]
  );

  const filteredReplies = useMemo(
    () =>
      selectedSenderId
        ? replies.filter((r) => r.senderId === selectedSenderId)
        : replies,
    [replies, selectedSenderId]
  );

  return (
    <div className="space-y-6">
      <ConnectedInboxesStrip
        senders={senders}
        selectedId={selectedSenderId}
        onSelect={(id) =>
          setSelectedSenderId((prev) => (prev === id ? null : id))
        }
      />

      <AnimatePresence initial={false}>
        {selectedSender ? (
          <motion.div
            key={selectedSender.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <SenderActivityPanel
              sender={selectedSender}
              contacts={activityBySender[selectedSender.id] ?? []}
              onClear={() => setSelectedSenderId(null)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {replies.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
            <InboxIcon className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[var(--ink-strong)]">
            No replies yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-muted)]">
            When a lead replies to one of your outreach emails, it lands here.
            The worker checks IMAP on each connected sender every 10 minutes —
            or hit Check now above for an instant poll.
          </p>
          <Link
            href="/user/senders"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--brand-700)]"
          >
            Manage senders
          </Link>
        </div>
      ) : selectedSenderId && filteredReplies.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-[var(--ink-muted)]">
          <InboxIcon className="mx-auto mb-2 h-7 w-7 text-[var(--ink-subtle)]" />
          No replies to{" "}
          <span className="font-semibold text-[var(--ink-strong)]">
            {selectedSender?.displayName || selectedSender?.email}
          </span>{" "}
          yet — the activity above shows everyone this mailbox has emailed.
        </div>
      ) : (
        <UniboxList replies={filteredReplies} />
      )}
    </div>
  );
}

function SenderActivityPanel({
  sender,
  contacts,
  onClear,
}: {
  sender: ConnectedSender;
  contacts: SenderContact[];
  onClear: () => void;
}) {
  const totals = contacts.reduce(
    (acc, c) => ({
      sent: acc.sent + c.sent,
      opened: acc.opened + c.opened,
      replied: acc.replied + (c.replied ? 1 : 0),
    }),
    { sent: 0, opened: 0, replied: 0 }
  );

  return (
    <div className="surface-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
            <Mail className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--ink-strong)]">
              {sender.displayName || sender.email.split("@")[0]}
              <span className="ml-1.5 text-xs font-normal text-[var(--ink-muted)]">
                &lt;{sender.email}&gt;
              </span>
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {totals.sent} sent · {totals.opened} opened · {totals.replied}{" "}
              replied across {contacts.length} prospect
              {contacts.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-muted)] transition hover:border-[var(--brand-300)] hover:text-[var(--ink-strong)]"
        >
          <X className="h-3.5 w-3.5" />
          Clear filter
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]/40 px-3 py-4 text-center text-xs text-[var(--ink-muted)]">
          This mailbox hasn&apos;t sent any tracked emails yet. (Emails sent
          before per-sender tracking won&apos;t appear here.)
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          {/* header row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-sunken)]/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-subtle)]">
            <span>Prospect</span>
            <span className="text-right">Sent</span>
            <span className="text-right">Opened</span>
            <span className="text-right">Replied</span>
          </div>
          <ul className="divide-y divide-[var(--border)]/70">
            {contacts.map((c) => (
              <li
                key={c.email}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-[var(--ink-strong)]">
                    {c.name || c.email.split("@")[0]}
                  </div>
                  <div className="truncate text-xs text-[var(--ink-muted)]">
                    {c.email}
                  </div>
                </div>
                <span className="inline-flex items-center justify-end gap-1 tabular-nums text-[var(--ink-strong)]">
                  <Mail className="h-3.5 w-3.5 text-[var(--ink-subtle)]" />
                  {c.sent}
                </span>
                <span className="inline-flex items-center justify-end gap-1 tabular-nums text-[var(--ink-strong)]">
                  <Eye className="h-3.5 w-3.5 text-[var(--ink-subtle)]" />
                  {c.opened}
                </span>
                <span className="flex items-center justify-end">
                  {c.replied ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-50)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success-700)]">
                      <CheckCircle2 className="h-3 w-3" />
                      Replied
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-subtle)]">
                      <ReplyIcon className="h-3 w-3" />
                      —
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
