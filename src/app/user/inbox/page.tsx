import { Reply } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InboxCheckButton } from "@/components/outreach/InboxCheckButton";
import {
  InboxWorkspace,
  type SenderContact,
  type SentMessage,
} from "@/components/outreach/InboxWorkspace";

export const dynamic = "force-dynamic";

type ReplyRow = {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string;
  read_at: string | null;
  prospect_id: string | null;
  campaign_id: string | null;
  lead_id: string | null;
  starred: boolean | null;
  category: string | null;
  archived_at: string | null;
  notes: string | null;
  outreach_campaigns:
    | { name: string }
    | { name: string }[]
    | null;
  leads:
    | { name: string; category: string | null }
    | { name: string; category: string | null }[]
    | null;
};

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [repliesRes, sendersRes] = await Promise.all([
    supabase
      .from("outreach_replies")
      .select(
        "id,sender_id,from_email,from_name,subject,snippet,received_at,read_at,prospect_id,campaign_id,lead_id,starred,category,archived_at,notes,outreach_campaigns(name),leads(name,category)"
      )
      .eq("user_id", user!.id)
      .order("received_at", { ascending: false })
      .limit(500),
    supabase
      .from("outreach_senders")
      .select(
        "id,email,display_name,status,last_inbox_check_at,last_error"
      )
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true }),
  ]);
  const repliesRaw = repliesRes.data;
  const sendersRaw = sendersRes.data ?? [];

  // Map sender_id → which of the user's connected mailboxes it is, so each
  // reply can show "received by / reply as <that mailbox>". Essential with
  // round-robin: the user needs to know which inbox a conversation lives in.
  const senderMetaById = new Map(
    (sendersRaw as {
      id: string;
      email: string;
      display_name: string | null;
    }[]).map((s) => [
      s.id,
      { email: s.email, displayName: s.display_name },
    ])
  );

  const replies = ((repliesRaw ?? []) as (ReplyRow & { sender_id: string | null })[]).map((r) => {
    const campaign = Array.isArray(r.outreach_campaigns)
      ? r.outreach_campaigns[0] ?? null
      : r.outreach_campaigns;
    const lead = Array.isArray(r.leads) ? r.leads[0] ?? null : r.leads;
    const senderMeta = r.sender_id ? senderMetaById.get(r.sender_id) : null;
    return {
      id: r.id,
      fromEmail: r.from_email,
      fromName: r.from_name,
      subject: r.subject,
      snippet: r.snippet,
      receivedAt: r.received_at,
      readAt: r.read_at,
      prospectId: r.prospect_id,
      campaignId: r.campaign_id,
      campaignName: campaign?.name ?? null,
      leadName: lead?.name ?? null,
      leadCategory: lead?.category ?? null,
      senderId: r.sender_id ?? null,
      senderEmail: senderMeta?.email ?? null,
      senderName: senderMeta?.displayName ?? null,
      starred: Boolean(r.starred),
      category: r.category,
      archivedAt: r.archived_at,
      notes: r.notes,
    };
  });

  // Unread badge reflects the default inbox view, which hides replies from
  // disconnected senders — so only count unread from currently connected ones.
  const connectedSenderIds = new Set(
    (sendersRaw as { id: string }[]).map((s) => s.id)
  );
  const unreadCount = replies.filter(
    (r) => !r.readAt && r.senderId && connectedSenderIds.has(r.senderId)
  ).length;

  // Bucket reply counts per sender so the strip can show "3 replies" badges.
  const repliesBySender = new Map<string, number>();
  for (const r of replies) {
    if (!r.senderId) continue;
    repliesBySender.set(r.senderId, (repliesBySender.get(r.senderId) ?? 0) + 1);
  }

  // ---- Per-sender activity: which prospects each mailbox emailed, with sent
  // counts, opens, and whether they replied. Built from email_sends (sent +
  // opens) merged with the replies above. Wrapped defensively: if the
  // email_sends.sender_id migration isn't applied, the select errors and we
  // fall back to reply-only activity (sent counts show 0). -----------------
  const activityBySender: Record<string, SenderContact[]> = {};
  const sentBySender: Record<string, SentMessage[]> = {};
  {
    const sendsActivityRes = await supabase
      .from("email_sends")
      .select(
        "id,sender_id,recipient_email,status,first_opened_at,subject,body,sent_at,leads(name)"
      )
      .eq("user_id", user!.id)
      .order("sent_at", { ascending: false })
      .limit(5000);

    const bySender = new Map<string, Map<string, SenderContact>>();
    const ensure = (sid: string, email: string): SenderContact => {
      const key = email.toLowerCase();
      let m = bySender.get(sid);
      if (!m) {
        m = new Map();
        bySender.set(sid, m);
      }
      let c = m.get(key);
      if (!c) {
        c = { email, name: null, sent: 0, opened: 0, replied: false };
        m.set(key, c);
      }
      return c;
    };

    if (!sendsActivityRes.error) {
      for (const row of sendsActivityRes.data ?? []) {
        const sid = (row.sender_id as string | null) ?? null;
        if (!sid) continue;
        if (row.status !== "sent") continue;
        const rcpt = row.recipient_email as string | null;
        if (!rcpt) continue;
        const lead = Array.isArray(row.leads) ? row.leads[0] ?? null : row.leads;
        const leadName =
          lead && (lead as { name?: string }).name
            ? (lead as { name: string }).name
            : null;
        const c = ensure(sid, rcpt);
        c.sent += 1;
        if (row.first_opened_at) c.opened += 1;
        if (!c.name && leadName) c.name = leadName;

        // Sent-folder message (Gmail-style list).
        (sentBySender[sid] ??= []).push({
          id: row.id as string,
          to: rcpt,
          toName: leadName,
          subject: (row.subject as string | null) ?? "(no subject)",
          body: (row.body as string | null) ?? "",
          sentAt: (row.sent_at as string | null) ?? null,
          opened: Boolean(row.first_opened_at),
        });
      }
    }
    // Merge reply state in (also surfaces prospects whose only record is a reply).
    for (const r of replies) {
      if (!r.senderId) continue;
      const c = ensure(r.senderId, r.fromEmail);
      c.replied = true;
      if (!c.name && r.fromName) c.name = r.fromName;
    }

    for (const [sid, m] of bySender.entries()) {
      activityBySender[sid] = Array.from(m.values()).sort(
        (a, b) => b.sent - a.sent || (b.replied ? 1 : 0) - (a.replied ? 1 : 0)
      );
    }
  }

  const sentCountBySender = new Map<string, number>();
  for (const [sid, contacts] of Object.entries(activityBySender)) {
    sentCountBySender.set(
      sid,
      contacts.reduce((n, c) => n + c.sent, 0)
    );
  }

  type SenderRow = {
    id: string;
    email: string;
    display_name: string | null;
    status: string;
    last_inbox_check_at: string | null;
    last_error: string | null;
  };
  const senders = (sendersRaw as SenderRow[]).map((s) => ({
    id: s.id,
    email: s.email,
    displayName: s.display_name,
    status: s.status,
    lastCheckedAt: s.last_inbox_check_at,
    lastError: s.last_error,
    replyCount: repliesBySender.get(s.id) ?? 0,
    sentCount: sentCountBySender.get(s.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            <Reply className="h-3 w-3" />
            Unified inbox
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-3xl">
            Replies from every campaign
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Pulled from every connected Gmail account, deduped against your
            outreach campaigns. New replies stop the follow-up sequence
            automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1.5 text-xs font-bold text-[var(--brand-700)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-500)] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--brand-600)]" />
              </span>
              <span className="tabular-nums">{unreadCount}</span> unread
            </span>
          ) : null}
          <InboxCheckButton />
        </div>
      </section>

      <InboxWorkspace
        replies={replies}
        senders={senders}
        activityBySender={activityBySender}
        sentBySender={sentBySender}
      />
    </div>
  );
}
