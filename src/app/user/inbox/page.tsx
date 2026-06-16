import Link from "next/link";
import { Inbox, Reply } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UniboxList } from "@/components/outreach/UniboxList";
import { InboxCheckButton } from "@/components/outreach/InboxCheckButton";
import { ConnectedInboxesStrip } from "@/components/outreach/ConnectedInboxesStrip";

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

  const replies = ((repliesRaw ?? []) as (ReplyRow & { sender_id: string | null })[]).map((r) => {
    const campaign = Array.isArray(r.outreach_campaigns)
      ? r.outreach_campaigns[0] ?? null
      : r.outreach_campaigns;
    const lead = Array.isArray(r.leads) ? r.leads[0] ?? null : r.leads;
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
      starred: Boolean(r.starred),
      category: r.category,
      archivedAt: r.archived_at,
      notes: r.notes,
    };
  });

  const unreadCount = replies.filter((r) => !r.readAt).length;

  // Bucket reply counts per sender so the strip can show "3 replies" badges.
  const repliesBySender = new Map<string, number>();
  for (const r of replies) {
    if (!r.senderId) continue;
    repliesBySender.set(r.senderId, (repliesBySender.get(r.senderId) ?? 0) + 1);
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

      <ConnectedInboxesStrip senders={senders} />

      {replies.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[var(--ink-strong)]">
            No replies yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-muted)]">
            When a lead replies to one of your outreach emails, it lands
            here. The worker checks IMAP on each connected sender every 10
            minutes — or hit Check now above for an instant poll.
          </p>
          <Link
            href="/user/senders"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--brand-700)]"
          >
            Manage senders
          </Link>
        </div>
      ) : (
        <UniboxList replies={replies} />
      )}
    </div>
  );
}
