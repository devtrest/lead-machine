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
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-elev)] px-6 py-8 md:px-10 md:py-10">
        <div
          className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-55 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-br from-[var(--sky-200)] to-[var(--brand-100)] opacity-45 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)] backdrop-blur">
              <Reply className="h-3 w-3" />
              Unified inbox
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-[40px] md:leading-tight">
              Replies from{" "}
              <span className="brand-text-gradient">every campaign</span>
            </h1>
            <p className="mt-2 text-sm text-[var(--ink-muted)] md:text-base">
              Pulled from every connected Gmail account, deduped against your
              outreach campaigns. New replies stop the follow-up sequence
              automatically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-[var(--brand-700)] ring-1 ring-[var(--brand-100)] backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-500)] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--brand-600)]" />
                </span>
                {unreadCount} unread
              </span>
            ) : null}
            <InboxCheckButton />
          </div>
        </div>
      </section>

      <ConnectedInboxesStrip senders={senders} />

      {replies.length === 0 ? (
        <div className="surface-card relative overflow-hidden p-12 text-center">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-30 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-100)]">
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
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)] transition hover:bg-[var(--brand-700)]"
            >
              Manage senders
            </Link>
          </div>
        </div>
      ) : (
        <UniboxList replies={replies} />
      )}
    </div>
  );
}
