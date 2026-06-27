"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox as InboxIcon,
  Mail,
  Eye,
  Send,
  Reply as ReplyIcon,
  CheckCircle2,
  Users,
} from "lucide-react";
import {
  ConnectedInboxesStrip,
  type ConnectedSender,
} from "@/components/outreach/ConnectedInboxesStrip";
import { UniboxList, type UniboxReply } from "@/components/outreach/UniboxList";

// One contact (prospect) a given sender corresponded with.
export type SenderContact = {
  email: string;
  name: string | null;
  sent: number;
  opened: number;
  replied: boolean;
};

// One outgoing email shown in a mailbox's Sent folder.
export type SentMessage = {
  id: string;
  from: string;
  to: string;
  toName: string | null;
  subject: string;
  body: string;
  sentAt: string | null;
  opened: boolean;
};

type Folder = "inbox" | "sent" | "prospects";

// Gmail-style mailbox view: pick a connected sender from the strip, then browse
// that mailbox's Inbox (replies received), Sent (emails it sent), or Prospects
// (per-contact activity). Replies from disconnected senders simply have no
// mailbox to live under, so they don't appear.
export function InboxWorkspace({
  replies,
  senders,
  activityBySender,
  sentBySender,
}: {
  replies: UniboxReply[];
  senders: ConnectedSender[];
  activityBySender: Record<string, SenderContact[]>;
  sentBySender: Record<string, SentMessage[]>;
}) {
  // null = "All mailboxes" (default): aggregate across every connected sender.
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [folder, setFolder] = useState<Folder>("inbox");

  const selectedSender = useMemo(
    () => senders.find((s) => s.id === selectedSenderId) ?? null,
    [senders, selectedSenderId]
  );

  const knownSenderIds = useMemo(
    () => new Set(senders.map((s) => s.id)),
    [senders]
  );

  // Inbox: a specific mailbox → its replies; All → every reply from a
  // currently-connected mailbox (disconnected/test replies excluded).
  const inboxReplies = useMemo(() => {
    if (selectedSenderId) {
      return replies.filter((r) => r.senderId === selectedSenderId);
    }
    return replies.filter(
      (r) => r.senderId && knownSenderIds.has(r.senderId)
    );
  }, [replies, selectedSenderId, knownSenderIds]);

  // Sent: a specific mailbox → its sent mail; All → every mailbox's sent mail,
  // newest first.
  const sentMessages = useMemo(() => {
    if (selectedSenderId) return sentBySender[selectedSenderId] ?? [];
    const all = senders.flatMap((s) => sentBySender[s.id] ?? []);
    return all.sort((a, b) =>
      (b.sentAt ?? "").localeCompare(a.sentAt ?? "")
    );
  }, [sentBySender, selectedSenderId, senders]);

  // Prospects: a specific mailbox → its contacts; All → contacts merged by
  // email across mailboxes (sum sent/opened, OR replied).
  const contacts = useMemo(() => {
    if (selectedSenderId) return activityBySender[selectedSenderId] ?? [];
    const merged = new Map<string, SenderContact>();
    for (const s of senders) {
      for (const c of activityBySender[s.id] ?? []) {
        const key = c.email.toLowerCase();
        const existing = merged.get(key);
        if (existing) {
          existing.sent += c.sent;
          existing.opened += c.opened;
          existing.replied = existing.replied || c.replied;
          if (!existing.name && c.name) existing.name = c.name;
        } else {
          merged.set(key, { ...c });
        }
      }
    }
    return Array.from(merged.values()).sort(
      (a, b) => b.sent - a.sent || (b.replied ? 1 : 0) - (a.replied ? 1 : 0)
    );
  }, [activityBySender, selectedSenderId, senders]);

  if (senders.length === 0) {
    return (
      <div className="surface-card p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
          <InboxIcon className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[var(--ink-strong)]">
          No senders connected
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-muted)]">
          Connect a sending mailbox to start outreach — its inbox and sent mail
          show up here.
        </p>
        <Link
          href="/user/senders"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--brand-700)]"
        >
          Manage senders
        </Link>
      </div>
    );
  }

  const FOLDERS: { id: Folder; label: string; icon: ReactNode; count: number }[] = [
    {
      id: "inbox",
      label: "Inbox",
      icon: <InboxIcon className="h-3.5 w-3.5" />,
      count: inboxReplies.length,
    },
    {
      id: "sent",
      label: "Sent",
      icon: <Send className="h-3.5 w-3.5" />,
      count: sentMessages.length,
    },
    {
      id: "prospects",
      label: "Prospects",
      icon: <Users className="h-3.5 w-3.5" />,
      count: contacts.length,
    },
  ];

  return (
    <div className="space-y-6">
      <ConnectedInboxesStrip
        senders={senders}
        selectedId={selectedSenderId}
        onSelect={(id) => setSelectedSenderId(id)}
        allSelected={selectedSenderId === null}
        onSelectAll={() => setSelectedSenderId(null)}
      />

      {/* Mailbox header + folder tabs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
            <Mail className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--ink-strong)]">
              {selectedSender
                ? selectedSender.displayName || selectedSender.email.split("@")[0]
                : "All mailboxes"}
            </div>
            <div className="truncate text-xs text-[var(--ink-muted)]">
              {selectedSender
                ? selectedSender.email
                : `${senders.length} connected sender${senders.length === 1 ? "" : "s"} combined`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {FOLDERS.map((f) => {
            const active = folder === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolder(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  active
                    ? "bg-[var(--brand-600)] text-white"
                    : "text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
                }`}
              >
                {f.icon}
                {f.label}
                {f.count > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active
                        ? "bg-white/25 text-white"
                        : "bg-[var(--surface-sunken)] text-[var(--ink-strong)]"
                    }`}
                  >
                    {f.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${selectedSenderId}-${folder}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {folder === "inbox" ? (
            inboxReplies.length === 0 ? (
              <EmptyFolder
                label={`No replies in ${
                  selectedSender?.displayName ||
                  selectedSender?.email ||
                  "your mailboxes"
                } yet.`}
              />
            ) : (
              <UniboxList replies={inboxReplies} />
            )
          ) : folder === "sent" ? (
            <SentList
              messages={sentMessages}
              showFrom={selectedSenderId === null}
            />
          ) : (
            <ContactsTable contacts={contacts} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EmptyFolder({ label }: { label: string }) {
  return (
    <div className="surface-card p-10 text-center text-sm text-[var(--ink-muted)]">
      <InboxIcon className="mx-auto mb-2 h-7 w-7 text-[var(--ink-subtle)]" />
      {label}
    </div>
  );
}

// Gmail-style Sent folder: list of outgoing emails on the left, full message on
// the right. Read-only (these already went out).
function SentList({
  messages,
  showFrom,
}: {
  messages: SentMessage[];
  showFrom: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => messages[0]?.id ?? null
  );

  if (messages.length === 0) {
    return (
      <EmptyFolder label="No sent emails recorded for this mailbox yet. (Emails sent before per-sender tracking won’t appear here.)" />
    );
  }

  const selected = messages.find((m) => m.id === selectedId) ?? messages[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[24rem_1fr]">
      <div className="max-h-[760px] overflow-y-auto rounded-2xl bg-[var(--surface-elev)]/40">
        <ul className="divide-y divide-[var(--border)]/60">
          {messages.map((m) => {
            const active = selected?.id === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full px-4 py-3 text-left transition ${
                    active
                      ? "bg-[var(--brand-50)]"
                      : "hover:bg-[var(--surface-sunken)]/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--ink-strong)]">
                      To: {m.toName || m.to.split("@")[0]}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--ink-subtle)]">
                      {m.sentAt ? timeAgo(m.sentAt) : ""}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[13px] text-[var(--ink-strong)]">
                    {m.subject}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {showFrom && m.from ? (
                      <span className="shrink-0 truncate rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">
                        from {m.from.split("@")[0]}
                      </span>
                    ) : null}
                    <span className="truncate text-[11px] text-[var(--ink-muted)]">
                      {m.to}
                    </span>
                    {m.opened ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--success-50)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--success-700)]">
                        <Eye className="h-2.5 w-2.5" />
                        Opened
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selected ? (
        <div className="space-y-4 py-2">
          <div className="space-y-3 border-b border-[var(--border)]/60 pb-4">
            <h2 className="text-xl font-bold tracking-tight text-[var(--ink-strong)] md:text-2xl">
              {selected.subject}
            </h2>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
              <span className="text-[var(--ink-subtle)]">From</span>
              <span className="font-semibold text-[var(--ink-strong)]">
                {selected.from || "—"}
              </span>
              <span className="text-[var(--ink-subtle)]">→ To</span>
              <span className="font-semibold text-[var(--ink-strong)]">
                {selected.toName ? `${selected.toName} ` : ""}
                <span className="font-medium text-[var(--ink-muted)]">
                  &lt;{selected.to}&gt;
                </span>
              </span>
              {selected.sentAt ? (
                <span className="text-[var(--ink-subtle)]">
                  ·{" "}
                  {new Date(selected.sentAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
              {selected.opened ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-50)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success-700)]">
                  <Eye className="h-3 w-3" />
                  Opened
                </span>
              ) : null}
            </div>
          </div>
          <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink-strong)]">
            {selected.body || (
              <span className="text-[var(--ink-muted)]">(empty body)</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Per-prospect activity table for the selected mailbox.
function ContactsTable({ contacts }: { contacts: SenderContact[] }) {
  if (contacts.length === 0) {
    return (
      <EmptyFolder label="This mailbox hasn’t emailed any prospects yet. (Emails sent before per-sender tracking won’t appear here.)" />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
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
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
