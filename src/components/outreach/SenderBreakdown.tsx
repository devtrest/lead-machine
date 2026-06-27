"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Eye,
  Reply,
  ChevronDown,
  Users,
  Inbox,
  Server,
} from "lucide-react";

export type SenderActivity = {
  senderId: string | null;
  label: string;
  email: string | null;
  sent: number;
  opened: number;
  replied: number;
  recipients: string[];
};

// Per-sender activity for a campaign: which mailbox sent how many emails, to
// whom, opens, and replies. Replies link out to the Unibox where the full
// thread + inline reply lives (this card is read-only attribution).
export function SenderBreakdown({
  activity,
}: {
  activity: SenderActivity[];
}) {
  if (activity.length === 0) return null;

  const totals = activity.reduce(
    (acc, a) => ({
      sent: acc.sent + a.sent,
      opened: acc.opened + a.opened,
      replied: acc.replied + a.replied,
    }),
    { sent: 0, opened: 0, replied: 0 }
  );

  return (
    <div className="surface-card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
          <Users className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[var(--ink-strong)]">
              Sender activity
            </h2>
            <Link
              href="/user/inbox"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-strong)] transition hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)]/40"
            >
              <Inbox className="h-3.5 w-3.5" />
              View replies in inbox
            </Link>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {totals.sent} sent · {totals.opened} opened · {totals.replied}{" "}
            replied across {activity.length} mailbox
            {activity.length === 1 ? "" : "es"}.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {activity.map((a) => (
          <SenderRow key={a.senderId ?? "__none__"} a={a} />
        ))}
      </div>
    </div>
  );
}

function SenderRow({ a }: { a: SenderActivity }) {
  const [open, setOpen] = useState(false);
  const openRate = a.sent > 0 ? Math.round((a.opened / a.sent) * 100) : 0;
  const isUnknown = a.senderId === null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elev)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-[var(--ink-muted)]">
          <Server className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--ink-strong)]">
            {a.label}
            {isUnknown ? (
              <span className="ml-1.5 text-[10px] font-normal text-[var(--ink-subtle)]">
                (sent before tracking)
              </span>
            ) : null}
          </div>
          {a.email && a.email !== a.label ? (
            <div className="truncate text-xs text-[var(--ink-muted)]">
              {a.email}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3 text-xs">
          <span
            className="inline-flex items-center gap-1 font-semibold text-[var(--ink-strong)]"
            title="Emails sent"
          >
            <Mail className="h-3.5 w-3.5 text-[var(--ink-subtle)]" />
            {a.sent}
          </span>
          <span
            className="inline-flex items-center gap-1 font-semibold text-[var(--ink-strong)]"
            title="Opened"
          >
            <Eye className="h-3.5 w-3.5 text-[var(--ink-subtle)]" />
            {a.opened}
            <span className="text-[var(--ink-subtle)]">({openRate}%)</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 font-semibold ${
              a.replied > 0
                ? "text-[var(--success-700)]"
                : "text-[var(--ink-strong)]"
            }`}
            title="Replied"
          >
            <Reply className="h-3.5 w-3.5 text-[var(--ink-subtle)]" />
            {a.replied}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-[var(--ink-subtle)] transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border)] px-4 py-3">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-subtle)]">
                Sent to {a.recipients.length} recipient
                {a.recipients.length === 1 ? "" : "s"}
              </div>
              {a.recipients.length === 0 ? (
                <p className="text-xs text-[var(--ink-muted)]">
                  No recipients recorded.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {a.recipients.map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] text-[var(--ink-strong)]"
                    >
                      <Mail className="h-2.5 w-2.5 text-[var(--ink-subtle)]" />
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
