"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  CheckCheck,
  ExternalLink,
  ShieldCheck,
  Reply as ReplyIcon,
} from "lucide-react";

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
};

export function UniboxList({ replies }: { replies: UniboxReply[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<UniboxReply | null>(
    replies[0] ?? null
  );

  async function markRead(id: string) {
    await fetch(`/api/outreach/replies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
      {/* Left: thread list */}
      <div className="surface-card max-h-[640px] overflow-y-auto p-0">
        <ul className="divide-y divide-[var(--border)]">
          {replies.map((r) => {
            const isUnread = !r.readAt;
            const isActive = selected?.id === r.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(r);
                    if (isUnread) markRead(r.id);
                  }}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                    isActive
                      ? "bg-[var(--brand-50)]/60"
                      : "hover:bg-[var(--surface-sunken)]/40"
                  }`}
                >
                  <span
                    className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                      isUnread
                        ? "bg-[var(--brand-600)]"
                        : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm ${
                          isUnread
                            ? "font-semibold text-[var(--ink-strong)]"
                            : "font-medium text-[var(--ink-muted)]"
                        }`}
                      >
                        {r.fromName || r.fromEmail}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--ink-subtle)]">
                        {timeAgo(r.receivedAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                      {r.subject ?? "(no subject)"}
                    </div>
                    {r.campaignName ? (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--brand-50)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
                        {r.campaignName}
                      </div>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
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
            className="surface-card space-y-4 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-100)] to-[var(--sky-100)] text-[var(--brand-700)]">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--ink-strong)]">
                      {selected.fromName || selected.fromEmail}
                    </div>
                    {selected.fromName ? (
                      <div className="text-xs text-[var(--ink-muted)]">
                        {selected.fromEmail}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
                  {selected.subject ?? "(no subject)"}
                </div>
                <div className="mt-1 text-[11px] text-[var(--ink-subtle)]">
                  {new Date(selected.receivedAt).toLocaleString()}
                  {selected.campaignName ? (
                    <>
                      {" · campaign "}
                      <Link
                        href={`/user/outreach/${selected.campaignId}`}
                        className="font-semibold text-[var(--brand-700)] underline-offset-2 hover:underline"
                      >
                        {selected.campaignName}
                      </Link>
                    </>
                  ) : null}
                  {selected.leadName ? (
                    <>
                      {" · lead "}
                      <span className="font-medium text-[var(--ink-muted)]">
                        {selected.leadName}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selected.readAt ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--success-700)]">
                    <CheckCheck className="h-3 w-3" /> Read
                  </span>
                ) : null}
                <a
                  href={`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(selected.fromEmail)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(79,70,229,0.20)] transition hover:bg-[var(--brand-700)]"
                >
                  <ReplyIcon className="h-3.5 w-3.5" />
                  Reply in Gmail
                  <ExternalLink className="h-3 w-3 opacity-75" />
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)]/40 p-4 text-sm leading-relaxed text-[var(--ink-strong)]">
              {selected.snippet ?? (
                <span className="text-[var(--ink-muted)]">
                  Snippet unavailable. Open in Gmail for the full message.
                </span>
              )}
            </div>

            {selected.campaignId ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--success-100)] bg-[var(--success-50)] px-3.5 py-2.5 text-xs text-[var(--success-700)]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">
                    Campaign stopped for this contact
                  </div>
                  <div className="mt-0.5 leading-relaxed">
                    Lead Machine will not send any more campaign emails to
                    this address. Take the conversation over from Gmail —
                    your replies thread naturally because the campaign send
                    used your own Gmail account.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--brand-100)] bg-[var(--brand-50)] px-3.5 py-2.5 text-xs text-[var(--brand-700)]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">Reply detected</div>
                  <div className="mt-0.5 leading-relaxed">
                    This reply doesn&apos;t link to a specific campaign
                    prospect (likely a test send or one-off). Reply directly
                    from Gmail to continue the conversation.
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
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
