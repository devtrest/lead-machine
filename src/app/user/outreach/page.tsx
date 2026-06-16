import Link from "next/link";
import { Mail, Sparkles, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OutreachDashboard } from "@/components/outreach/OutreachDashboard";

export const dynamic = "force-dynamic";

type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  scan_run_id: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  niche: { keyword: string; location: string } | null;
  prospects: number;
  contacted: number;
  replied: number;
  bounced: number;
  opens: number;
  contactedSends: number;
  sentLast7Days: number[];
};

export default async function OutreachListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Campaigns
  const { data: campaignsRaw } = await supabase
    .from("outreach_campaigns")
    .select(
      "id,name,status,scan_run_id,created_at,started_at,finished_at,scan_runs(keyword,location)"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const campaignIds = (campaignsRaw ?? []).map((c) => c.id);

  // 2. Prospect counts (single batched query)
  const prospectStats = new Map<
    string,
    { total: number; contacted: number; replied: number; bounced: number }
  >();
  if (campaignIds.length > 0) {
    const { data: prospects } = await supabase
      .from("outreach_prospects")
      .select("campaign_id,status,current_step")
      .in("campaign_id", campaignIds);
    for (const p of prospects ?? []) {
      const cid = p.campaign_id as string;
      const entry = prospectStats.get(cid) ?? {
        total: 0,
        contacted: 0,
        replied: 0,
        bounced: 0,
      };
      entry.total += 1;
      if ((p.current_step as number) > 0) entry.contacted += 1;
      if (p.status === "replied") entry.replied += 1;
      if (p.status === "bounced") entry.bounced += 1;
      prospectStats.set(cid, entry);
    }
  }

  // 3. Per-campaign send activity (last 7 days) + per-campaign open counts.
  //    One pull of email_sends does both: bucket sends by day for sparkline,
  //    count rows whose first_opened_at is non-null for the open metric.
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const sendBuckets = new Map<string, number[]>(); // campaign_id -> 7-day buckets
  const opensByCampaign = new Map<string, number>(); // campaign_id -> opens
  const contactedByCampaign = new Map<string, number>(); // campaign_id -> sends
  if (campaignIds.length > 0) {
    const { data: sends } = await supabase
      .from("email_sends")
      .select("campaign_id,sent_at,status,first_opened_at")
      .in("campaign_id", campaignIds)
      .eq("status", "sent");

    for (const cid of campaignIds) {
      sendBuckets.set(cid, new Array(7).fill(0));
    }
    const startMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const sevenAgoMs = new Date(sevenDaysAgo).getTime();
    for (const s of sends ?? []) {
      const cid = s.campaign_id as string;
      contactedByCampaign.set(
        cid,
        (contactedByCampaign.get(cid) ?? 0) + 1
      );
      if (s.first_opened_at) {
        opensByCampaign.set(cid, (opensByCampaign.get(cid) ?? 0) + 1);
      }
      if (s.sent_at) {
        const sentMs = new Date(s.sent_at as string).getTime();
        if (sentMs >= sevenAgoMs) {
          const dayIdx = Math.min(
            6,
            Math.max(
              0,
              Math.floor((sentMs - startMs) / (24 * 60 * 60 * 1000))
            )
          );
          const bucket = sendBuckets.get(cid);
          if (bucket) bucket[dayIdx] += 1;
        }
      }
    }
  }

  const campaigns: CampaignSummary[] = (campaignsRaw ?? []).map((c) => {
    const niche = Array.isArray(c.scan_runs) ? c.scan_runs[0] : c.scan_runs;
    const stats = prospectStats.get(c.id) ?? {
      total: 0,
      contacted: 0,
      replied: 0,
      bounced: 0,
    };
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      scan_run_id: c.scan_run_id,
      created_at: c.created_at,
      started_at: c.started_at,
      finished_at: c.finished_at,
      niche: niche
        ? { keyword: niche.keyword, location: niche.location }
        : null,
      prospects: stats.total,
      contacted: stats.contacted,
      replied: stats.replied,
      bounced: stats.bounced,
      opens: opensByCampaign.get(c.id) ?? 0,
      contactedSends: contactedByCampaign.get(c.id) ?? 0,
      sentLast7Days: sendBuckets.get(c.id) ?? new Array(7).fill(0),
    };
  });

  // 4. Hero stats
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const totalProspects = campaigns.reduce((s, c) => s + c.prospects, 0);
  const totalContacted = campaigns.reduce((s, c) => s + c.contacted, 0);
  const totalReplied = campaigns.reduce((s, c) => s + c.replied, 0);
  const totalOpens = campaigns.reduce((s, c) => s + c.opens, 0);
  const totalContactedSends = campaigns.reduce(
    (s, c) => s + c.contactedSends,
    0
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: sentToday } = await supabase
    .from("email_sends")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("status", "sent")
    .gte("sent_at", today.toISOString());

  const replyRate =
    totalContacted > 0
      ? Math.round((totalReplied / totalContacted) * 100)
      : 0;
  const openRate =
    totalContactedSends > 0
      ? Math.round((totalOpens / totalContactedSends) * 100)
      : 0;

  const heroStats = [
    {
      label: "Active campaigns",
      value: activeCount,
      iconKey: "activity" as const,
      accent: "var(--success-700)",
      bg: "var(--success-50)",
    },
    {
      label: "Sent today",
      value: sentToday ?? 0,
      iconKey: "send" as const,
      accent: "var(--brand-700)",
      bg: "var(--brand-50)",
    },
    {
      label: "Total prospects",
      value: totalProspects,
      iconKey: "users" as const,
      accent: "var(--ink-strong)",
      bg: "var(--surface-sunken)",
    },
    {
      label: "Open rate",
      value: `${openRate}%`,
      iconKey: "eye" as const,
      accent: "var(--sky-700)",
      bg: "var(--sky-50)",
    },
    {
      label: "Reply rate",
      value: `${replyRate}%`,
      iconKey: "trending-up" as const,
      accent: "var(--warning-700)",
      bg: "var(--warning-50)",
    },
  ];

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
              <Mail className="h-3 w-3" />
              Email outreach
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-[40px] md:leading-tight">
              Multi-step sequences on{" "}
              <span className="brand-text-gradient">autopilot</span>
            </h1>
            <p className="mt-2 text-sm text-[var(--ink-muted)] md:text-base">
              Pull leads from a campaign, build a sequence, hit start. The
              worker rotates senders, respects send windows, and stops when
              replies come in.
            </p>
          </div>
          <Link
            href="/user/outreach/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)] transition hover:bg-[var(--brand-700)]"
          >
            <Sparkles className="h-4 w-4" />
            New email campaign
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <OutreachDashboard heroStats={heroStats} campaigns={campaigns} />
    </div>
  );
}
