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
      {/* Filter + search bar */}
      <div className="surface-card space-y-3 p-4">
        <div className="flex items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-50)] text-[var(--brand-700)]">
            <Filter className="h-3.5 w-3.5" />
          </span>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_TABS.map((t) => {
              const isActive = filter === t.id;
              const count = tabCounts[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilter(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                    isActive
                      ? "bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-500)] text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)]"
                      : "border border-[var(--border)] bg-[var(--surface-elev)] text-[var(--ink-muted)] hover:border-[var(--brand-200)] hover:text-[var(--brand-700)]"
                  }`}
                >
                  {t.label}
                  {count > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${
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
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-subtle)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by sender, subject, or message text…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)]/40 py-2.5 pl-10 pr-3.5 text-sm text-[var(--ink-strong)] placeholder:text-[var(--ink-subtle)] outline-none transition focus:border-[var(--brand-500)] focus:bg-[var(--surface-elev)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[24rem_1fr]">
        {/* Left: thread list */}
        <div className="surface-card max-h-[760px] overflow-y-auto p-2">
          {visible.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--ink-muted)]">
              <InboxIcon className="mx-auto mb-2 h-8 w-8 text-[var(--ink-subtle)]" />
              No replies match this filter.
            </div>
          ) : (
            <ul className="space-y-1.5">
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
  const initials = initialsFromAddress(reply.fromName, reply.fromEmail);
  const avatarGradient = avatarHueFor(reply.fromEmail);

  return (
    <li>
      <div
        className={`group relative flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
          active
            ? "bg-gradient-to-br from-[var(--brand-50)] to-[var(--sky-50)] ring-1 ring-[var(--brand-200)]"
            : "hover:bg-[var(--surface-sunken)]/50"
        }`}
      >
        {/* Active accent stripe */}
        {active ? (
          <span
            className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[var(--brand-600)] to-[var(--sky-500)]"
            aria-hidden
          />
        ) : null}

        {/* Avatar with initials */}
        <button
          type="button"
          onClick={onSelect}
          className="shrink-0"
          aria-label="Open reply"
        >
          <span
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(15,23,42,0.10)] ${avatarGradient}`}
          >
            {initials}
            {isUnread ? (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--brand-600)]" />
            ) : null}
          </span>
        </button>

        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`truncate text-sm ${
                isUnread
                  ? "font-bold text-[var(--ink-strong)]"
                  : "font-medium text-[var(--ink-muted)]"
              }`}
            >
              {reply.fromName || reply.fromEmail.split("@")[0]}
            </span>
            <span className="shrink-0 text-[10px] font-medium text-[var(--ink-subtle)]">
              {timeAgo(reply.receivedAt)}
            </span>
          </div>
          <div
            className={`mt-0.5 truncate text-xs ${
              isUnread
                ? "font-semibold text-[var(--ink-strong)]"
                : "text-[var(--ink-muted)]"
            }`}
          >
            {reply.subject ?? "(no subject)"}
          </div>
          {reply.snippet ? (
            <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--ink-subtle)]">
              {reply.snippet}
            </div>
          ) : null}
          {(catMeta || reply.campaignName) ? (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {catMeta ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${catMeta.chipClass}`}
                >
                  <span>{catMeta.emoji}</span> {catMeta.label}
                </span>
              ) : null}
              {reply.campaignName ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-50)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--brand-700)]">
                  {reply.campaignName}
                </span>
              ) : null}
            </div>
          ) : null}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStar();
          }}
          className="shrink-0 rounded-lg p-1.5 transition hover:bg-[var(--warning-50)]"
          aria-label={reply.starred ? "Unstar" : "Star"}
        >
          <Star
            className={`h-3.5 w-3.5 ${reply.starred ? "fill-[var(--warning-500)] text-[var(--warning-500)]" : "text-[var(--ink-subtle)]"}`}
          />
        </button>
      </div>
    </li>
  );
}

// Stable rainbow assignment per email — same address always lights up with the
// same gradient so a person feels visually consistent across the inbox.
const AVATAR_GRADIENTS = [
  "bg-gradient-to-br from-[var(--brand-600)] to-[var(--sky-500)]",
  "bg-gradient-to-br from-pink-500 to-rose-500",
  "bg-gradient-to-br from-amber-500 to-orange-500",
  "bg-gradient-to-br from-emerald-500 to-teal-500",
  "bg-gradient-to-br from-violet-500 to-fuchsia-500",
  "bg-gradient-to-br from-cyan-500 to-blue-500",
];

function avatarHueFor(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

function initialsFromAddress(
  name: string | null,
  email: string
): string {
  const src = (name?.trim() || email.split("@")[0]).replace(/[^a-z0-9 ]/gi, " ");
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

  const initials = initialsFromAddress(reply.fromName, reply.fromEmail);
  const avatarGradient = avatarHueFor(reply.fromEmail);

  return (
    <div className="surface-card relative space-y-5 overflow-hidden p-0">
      {/* Gradient header strip */}
      <div className="relative overflow-hidden border-b border-[var(--border)] bg-gradient-to-br from-[var(--brand-50)] via-white to-[var(--sky-50)] p-5">
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-40 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-[0_8px_24px_rgba(15,23,42,0.15)] ${avatarGradient}`}
            >
              {initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-[var(--ink-strong)]">
                {reply.fromName || reply.fromEmail.split("@")[0]}
              </div>
              <div className="truncate text-xs text-[var(--ink-muted)]">
                {reply.fromEmail}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="font-semibold text-[var(--ink-subtle)]">
                  {new Date(reply.receivedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                {reply.campaignName ? (
                  <Link
                    href={`/user/outreach/${reply.campaignId}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-50)] px-1.5 py-0.5 font-bold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
                  >
                    {reply.campaignName}
                  </Link>
                ) : null}
                {reply.leadName ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] px-1.5 py-0.5 font-semibold text-[var(--ink-muted)]">
                    {reply.leadName}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPatch({ starred: !reply.starred })}
              title={reply.starred ? "Unstar" : "Star"}
              className="rounded-lg border border-[var(--border)] bg-white p-2 text-[var(--ink-subtle)] shadow-[var(--shadow-xs)] transition hover:border-[var(--warning-300)] hover:text-[var(--warning-700)]"
            >
              <Star
                className={`h-3.5 w-3.5 ${reply.starred ? "fill-[var(--warning-500)] text-[var(--warning-500)]" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={() => onPatch({ archived: !reply.archivedAt })}
              title={reply.archivedAt ? "Unarchive" : "Archive"}
              className="rounded-lg border border-[var(--border)] bg-white p-2 text-[var(--ink-subtle)] shadow-[var(--shadow-xs)] transition hover:border-[var(--brand-300)] hover:text-[var(--brand-700)]"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
            <a
              href={`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(reply.fromEmail)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--ink-strong)] shadow-[var(--shadow-xs)] transition hover:border-[var(--brand-200)] hover:bg-[var(--brand-50)]/40 hover:text-[var(--brand-700)]"
            >
              <ExternalLink className="h-3 w-3" />
              Gmail
            </a>
          </div>
        </div>

        <div className="relative mt-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            Subject
          </div>
          <div className="mt-1 text-lg font-bold tracking-tight text-[var(--ink-strong)]">
            {reply.subject ?? "(no subject)"}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 pb-5">
        {/* Category selector */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
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
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                    isActive
                      ? meta.chipClass + " shadow-[var(--shadow-xs)]"
                      : "border-[var(--border)] bg-[var(--surface-elev)] text-[var(--ink-muted)] hover:border-[var(--brand-200)] hover:text-[var(--brand-700)]"
                  }`}
                >
                  <span>{meta.emoji}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Snippet */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            Message
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)]/30 p-4 text-sm leading-relaxed text-[var(--ink-strong)]">
            {reply.snippet ?? (
              <span className="text-[var(--ink-muted)]">
                Snippet unavailable. Open in Gmail for the full message.
              </span>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)] transition hover:text-[var(--brand-700)]"
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

        {/* Banner */}
        {reply.campaignId ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-[var(--success-100)] bg-[var(--success-50)] px-3.5 py-2.5 text-xs text-[var(--success-700)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-bold">Campaign stopped for this contact</div>
              <div className="mt-0.5 leading-relaxed">
                No more campaign emails will go to this address. Reply below to
                continue the conversation — it threads naturally in their Gmail.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReplyComposer({
  replyId,
  senderConnected,
  onSent,
}: {
  replyId: string;
  senderConnected: boolean;
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
    <div className="surface-card relative overflow-hidden p-0">
      <div className="border-b border-[var(--border)] bg-gradient-to-r from-[var(--brand-50)]/40 to-transparent px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ink-strong)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-600)] text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)]">
              <ReplyIcon className="h-3.5 w-3.5" />
            </span>
            Reply from Lead Machine
          </h3>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
            Sends from the same Gmail
          </span>
        </div>
      </div>

      <div className="space-y-3 p-5">
        {!senderConnected ? (
          <div className="flex items-start gap-2 rounded-xl border border-[var(--warning-100)] bg-[var(--warning-50)] px-3 py-2.5 text-xs text-[var(--warning-700)]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The sender that received this reply has been disconnected. Reply
            from Gmail instead.
          </div>
        ) : (
          <>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your reply…"
              rows={6}
              className="text-sm"
              disabled={sending}
            />
            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-[var(--ink-subtle)]">
                Threads naturally — your prospect sees a normal Gmail reply.
              </span>
              <Button
                type="button"
                onClick={send}
                loading={sending}
                disabled={sending || !body.trim()}
                iconRight={!sending ? <Send className="h-3.5 w-3.5" /> : undefined}
              >
                Send reply
              </Button>
            </div>
          </>
        )}
      </div>
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
