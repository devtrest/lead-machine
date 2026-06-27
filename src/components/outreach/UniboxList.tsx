"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  ExternalLink,
  ShieldCheck,
  Reply as ReplyIcon,
  Star,
  Archive,
  Search,
  Send,
  StickyNote,
  AlertTriangle,
  Inbox as InboxIcon,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export type UniboxReply = {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  snippet: string | null;
  receivedAt: string;
  readAt: string | null;
  prospectId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  leadName: string | null;
  leadCategory: string | null;
  senderId: string | null;
  senderEmail: string | null;
  senderName: string | null;
  starred: boolean;
  category: string | null;
  archivedAt: string | null;
  notes: string | null;
};

type FilterTab =
  | "all"
  | "unread"
  | "starred"
  | "interested"
  | "meeting_booked"
  | "not_interested"
  | "out_of_office"
  | "archived";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "starred", label: "Starred" },
  { id: "interested", label: "Interested" },
  { id: "meeting_booked", label: "Meeting booked" },
  { id: "not_interested", label: "Not interested" },
  { id: "out_of_office", label: "Out of office" },
  { id: "archived", label: "Archived" },
];

const CATEGORY_META: Record<
  string,
  { label: string; chipClass: string; emoji: string }
> = {
  interested: {
    label: "Interested",
    chipClass:
      "bg-[var(--success-50)] text-[var(--success-700)] border-[var(--success-100)]",
    emoji: "🟢",
  },
  meeting_booked: {
    label: "Meeting booked",
    chipClass:
      "bg-[var(--brand-50)] text-[var(--brand-700)] border-[var(--brand-100)]",
    emoji: "🎯",
  },
  not_interested: {
    label: "Not interested",
    chipClass:
      "bg-[var(--danger-50)] text-[var(--danger-700)] border-[var(--danger-100)]",
    emoji: "🔴",
  },
  out_of_office: {
    label: "Out of office",
    chipClass:
      "bg-[var(--warning-50)] text-[var(--warning-700)] border-[var(--warning-100)]",
    emoji: "🚪",
  },
  unsubscribe: {
    label: "Unsubscribe",
    chipClass:
      "bg-[var(--danger-50)] text-[var(--danger-700)] border-[var(--danger-100)]",
    emoji: "⛔",
  },
  wrong_person: {
    label: "Wrong person",
    chipClass:
      "bg-[var(--surface-sunken)] text-[var(--ink-muted)] border-[var(--border)]",
    emoji: "🤔",
  },
  other: {
    label: "Other",
    chipClass:
      "bg-[var(--surface-sunken)] text-[var(--ink-muted)] border-[var(--border)]",
    emoji: "📌",
  },
};

export function UniboxList({ replies }: { replies: UniboxReply[] }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => replies.find((r) => !r.archivedAt)?.id ?? null
  );

  // Apply filter + search to the prefetched list. Server returns up to 500
  // so client-side filtering is fine.
  const visible = useMemo(() => {
    let list = replies;
    if (filter === "archived") {
      list = list.filter((r) => r.archivedAt);
    } else {
      list = list.filter((r) => !r.archivedAt);
      if (filter === "unread") list = list.filter((r) => !r.readAt);
      else if (filter === "starred") list = list.filter((r) => r.starred);
      else if (filter !== "all")
        list = list.filter((r) => r.category === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.fromEmail.toLowerCase().includes(q) ||
          (r.fromName ?? "").toLowerCase().includes(q) ||
          (r.subject ?? "").toLowerCase().includes(q) ||
          (r.snippet ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [replies, filter, search]);

  const selected =
    visible.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: 0,
      unread: 0,
      starred: 0,
      interested: 0,
      meeting_booked: 0,
      not_interested: 0,
      out_of_office: 0,
      archived: 0,
    };
    for (const r of replies) {
      if (r.archivedAt) {
        counts.archived += 1;
        continue;
      }
      counts.all += 1;
      if (!r.readAt) counts.unread += 1;
      if (r.starred) counts.starred += 1;
      if (r.category === "interested") counts.interested += 1;
      if (r.category === "meeting_booked") counts.meeting_booked += 1;
      if (r.category === "not_interested") counts.not_interested += 1;
      if (r.category === "out_of_office") counts.out_of_office += 1;
    }
    return counts;
  }, [replies]);

  async function patch(replyId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/outreach/replies/${replyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) router.refresh();
    else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error("Couldn't update", j.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* Gmail-style search + filter strip — no card, just a search input and
          a row of pill filters underneath. */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-subtle)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by sender, subject, or message text…"
            className="w-full rounded-full bg-[var(--surface-sunken)]/60 py-3 pl-11 pr-4 text-sm text-[var(--ink-strong)] placeholder:text-[var(--ink-subtle)] outline-none transition focus:bg-[var(--surface-elev)] focus:ring-2 focus:ring-[var(--brand-500)]/30"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((t) => {
            const isActive = filter === t.id;
            const count = tabCounts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                  isActive
                    ? "bg-[var(--brand-600)] text-white"
                    : "text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
                }`}
              >
                {t.label}
                {count > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-[var(--surface-sunken)] text-[var(--ink-strong)]"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[24rem_1fr]">
        {/* Left: Gmail-style flat list — no card wrapper, no rings, no gradient
            avatars. Just hover + selected backgrounds and hairline dividers. */}
        <div className="max-h-[760px] overflow-y-auto rounded-2xl bg-[var(--surface-elev)]/40">
          {visible.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--ink-muted)]">
              <InboxIcon className="mx-auto mb-2 h-8 w-8 text-[var(--ink-subtle)]" />
              No replies match this filter.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]/60">
              {visible.map((r) => (
                <UniboxRow
                  key={r.id}
                  reply={r}
                  active={selected?.id === r.id}
                  onSelect={() => {
                    setSelectedId(r.id);
                    if (!r.readAt) patch(r.id, { read: true });
                  }}
                  onStar={() => patch(r.id, { starred: !r.starred })}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Right: detail */}
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-4"
            >
              <ReplyDetail
                reply={selected}
                onPatch={(body) => patch(selected.id, body)}
              />
              <ReplyComposer
                replyId={selected.id}
                senderConnected={Boolean(selected.senderId)}
                senderEmail={selected.senderEmail}
                senderName={selected.senderName}
                onSent={() => {
                  toast.success("Reply sent", `→ ${selected.fromEmail}`);
                  router.refresh();
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function UniboxRow({
  reply,
  active,
  onSelect,
  onStar,
}: {
  reply: UniboxReply;
  active: boolean;
  onSelect: () => void;
  onStar: () => void;
}) {
  const isUnread = !reply.readAt;
  const catMeta = reply.category ? CATEGORY_META[reply.category] : null;

  return (
    <li>
      <div
        className={`group relative flex w-full items-center gap-3 px-4 py-3 text-left transition cursor-pointer ${
          active
            ? "bg-[var(--brand-50)]"
            : "hover:bg-[var(--surface-sunken)]/50"
        }`}
        onClick={onSelect}
      >
        {/* Star — leftmost, Gmail-style */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStar();
          }}
          className="shrink-0 rounded p-0.5 transition hover:bg-[var(--warning-50)]"
          aria-label={reply.starred ? "Unstar" : "Star"}
        >
          <Star
            className={`h-4 w-4 ${
              reply.starred
                ? "fill-[var(--warning-500)] text-[var(--warning-500)]"
                : "text-[var(--ink-subtle)]"
            }`}
          />
        </button>

        <div className="min-w-0 flex-1">
          {/* From + time row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {isUnread ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand-600)]"
                  aria-hidden
                />
              ) : null}
              <span
                className={`truncate text-sm ${
                  isUnread
                    ? "font-bold text-[var(--ink-strong)]"
                    : "text-[var(--ink-strong)]"
                }`}
              >
                {reply.fromName || reply.fromEmail.split("@")[0]}
              </span>
            </div>
            <span className="shrink-0 text-[11px] text-[var(--ink-subtle)]">
              {timeAgo(reply.receivedAt)}
            </span>
          </div>

          {/* Subject + snippet on one line (Gmail style) */}
          <div className="mt-0.5 truncate text-[13px]">
            <span
              className={
                isUnread
                  ? "font-semibold text-[var(--ink-strong)]"
                  : "text-[var(--ink-strong)]"
              }
            >
              {reply.subject ?? "(no subject)"}
            </span>
            {reply.snippet ? (
              <span className="text-[var(--ink-muted)]">
                {" "}
                — {reply.snippet}
              </span>
            ) : null}
          </div>

          {/* Tag chips only if present */}
          {(catMeta || reply.campaignName || reply.senderEmail) ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {catMeta ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-strong)]">
                  <span>{catMeta.emoji}</span> {catMeta.label}
                </span>
              ) : null}
              {reply.campaignName ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-50)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-700)]">
                  {reply.campaignName}
                </span>
              ) : null}
              {reply.senderEmail ? (
                <span
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]"
                  title={`Received by ${reply.senderEmail}`}
                >
                  <InboxIcon className="h-2.5 w-2.5" />
                  {reply.senderName || reply.senderEmail.split("@")[0]}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ReplyDetail({
  reply,
  onPatch,
}: {
  reply: UniboxReply;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  const [notes, setNotes] = useState(reply.notes ?? "");
  const [showNotes, setShowNotes] = useState(Boolean(reply.notes));

  function saveNotes() {
    if (notes !== (reply.notes ?? "")) onPatch({ notes });
  }

  return (
    <div className="space-y-6 py-2">
      {/* Subject heading + tools row (Gmail-style — no container, just a
          thin bottom divider) */}
      <div className="space-y-3 border-b border-[var(--border)]/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-[var(--ink-strong)] md:text-2xl">
            {reply.subject ?? "(no subject)"}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPatch({ starred: !reply.starred })}
              title={reply.starred ? "Unstar" : "Star"}
              className="rounded-full p-2 text-[var(--ink-subtle)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--warning-700)]"
            >
              <Star
                className={`h-4 w-4 ${reply.starred ? "fill-[var(--warning-500)] text-[var(--warning-500)]" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={() => onPatch({ archived: !reply.archivedAt })}
              title={reply.archivedAt ? "Unarchive" : "Archive"}
              className="rounded-full p-2 text-[var(--ink-subtle)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
            >
              <Archive className="h-4 w-4" />
            </button>
            <a
              href={`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(reply.fromEmail)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--ink-muted)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--brand-700)]"
            >
              <ExternalLink className="h-3 w-3" />
              Gmail
            </a>
          </div>
        </div>

        {/* From / to / date row — minimal, like Gmail */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
          <span className="font-semibold text-[var(--ink-strong)]">
            {reply.fromName || reply.fromEmail.split("@")[0]}
          </span>
          <span className="text-[var(--ink-subtle)]">
            &lt;{reply.fromEmail}&gt;
          </span>
          <span className="text-[var(--ink-subtle)]">
            ·{" "}
            {new Date(reply.receivedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Which of the user's mailboxes received this — critical with
            round-robin so they know the conversation's home inbox. */}
        {reply.senderEmail ? (
          <div className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-muted)]">
            <InboxIcon className="h-3.5 w-3.5 text-[var(--ink-subtle)]" />
            Received by{" "}
            <span className="font-semibold text-[var(--ink-strong)]">
              {reply.senderName || reply.senderEmail.split("@")[0]}
            </span>
            <span className="text-[var(--ink-subtle)]">
              &lt;{reply.senderEmail}&gt;
            </span>
          </div>
        ) : null}

        {/* Campaign / lead pills row — only when present */}
        {(reply.campaignName || reply.leadName) ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {reply.campaignName ? (
              <Link
                href={`/user/outreach/${reply.campaignId}`}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-50)] px-1.5 py-0.5 font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
              >
                {reply.campaignName}
              </Link>
            ) : null}
            {reply.leadName ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-sunken)] px-1.5 py-0.5 font-medium text-[var(--ink-muted)]">
                {reply.leadName}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Message body — plain reading area, no boxes */}
      <div className="text-[14px] leading-relaxed text-[var(--ink-strong)] whitespace-pre-wrap">
        {reply.snippet ?? (
          <span className="text-[var(--ink-muted)]">
            Snippet unavailable. Open in Gmail for the full message.
          </span>
        )}
      </div>

      {/* Tag selector — collapsed-down chip row, no surrounding box */}
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
          Tag this reply
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const isActive = reply.category === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  onPatch({ category: isActive ? null : key })
                }
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                  isActive
                    ? meta.chipClass
                    : "bg-[var(--surface-sunken)]/60 text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
                }`}
              >
                <span>{meta.emoji}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowNotes((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)] transition hover:text-[var(--ink-strong)]"
        >
          <StickyNote className="h-3 w-3" />
          {showNotes ? "Hide notes" : reply.notes ? "Edit notes" : "Add notes"}
        </button>
        {showNotes ? (
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Private notes (only you see these)…"
            rows={3}
            className="text-xs"
          />
        ) : null}
      </div>

      {/* Campaign-stopped notice — small inline strip, no card */}
      {reply.campaignId ? (
        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--success-700)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Campaign auto-stopped for this contact.
        </div>
      ) : null}
    </div>
  );
}

function ReplyComposer({
  replyId,
  senderConnected,
  senderEmail,
  senderName,
  onSent,
}: {
  replyId: string;
  senderConnected: boolean;
  senderEmail: string | null;
  senderName: string | null;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    if (!body.trim()) {
      setError("Type a reply before sending.");
      return;
    }
    setSending(true);
    const res = await fetch(`/api/outreach/replies/${replyId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSending(false);
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(j.error ?? "Send failed.");
      return;
    }
    setBody("");
    onSent();
  }

  return (
    <div className="space-y-3 border-t border-[var(--border)]/60 pt-5">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-strong)]">
          <ReplyIcon className="h-3.5 w-3.5 text-[var(--brand-700)]" />
          Reply
        </h3>
        {senderConnected && senderEmail ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-subtle)]">
            Reply as{" "}
            <span className="font-semibold text-[var(--ink-strong)]">
              {senderName || senderEmail.split("@")[0]}
            </span>
            <span className="hidden sm:inline">&lt;{senderEmail}&gt;</span>
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-[var(--ink-subtle)]">
            Sends from the receiving mailbox
          </span>
        )}
      </div>

      {!senderConnected ? (
        <div className="inline-flex items-center gap-1.5 text-[12px] text-[var(--warning-700)]">
          <AlertTriangle className="h-3.5 w-3.5" />
          That sender has been disconnected. Reply from Gmail instead.
        </div>
      ) : (
        <>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your reply…"
            rows={5}
            className="text-sm"
            disabled={sending}
          />
          {error ? (
            <div className="inline-flex items-center gap-1.5 text-[12px] text-[var(--danger-700)]">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </div>
          ) : null}
          <div className="flex items-center justify-end">
            <Button
              type="button"
              onClick={send}
              loading={sending}
              disabled={sending || !body.trim()}
              iconRight={!sending ? <Send className="h-3.5 w-3.5" /> : undefined}
            >
              Send
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
