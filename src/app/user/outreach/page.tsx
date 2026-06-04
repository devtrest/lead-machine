import Link from "next/link";
import { Plus } from "lucide-react";
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

  // 3. Per-campaign send activity (last 7 days). One query, bucket in JS.
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const sendBuckets = new Map<string, number[]>(); // campaign_id -> 7-day buckets
  if (campaignIds.length > 0) {
    const { data: sends } = await supabase
      .from("email_sends")
      .select("campaign_id,sent_at,status")
      .in("campaign_id", campaignIds)
      .eq("status", "sent")
      .gte("sent_at", sevenDaysAgo);

    for (const cid of campaignIds) {
      sendBuckets.set(cid, new Array(7).fill(0));
    }
    const startMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const s of sends ?? []) {
      if (!s.sent_at) continue;
      const cid = s.campaign_id as string;
      const dayIdx = Math.min(
        6,
        Math.max(
          0,
          Math.floor(
            (new Date(s.sent_at as string).getTime() - startMs) /
              (24 * 60 * 60 * 1000)
          )
        )
      );
      const bucket = sendBuckets.get(cid);
      if (bucket) bucket[dayIdx] += 1;
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
      sentLast7Days: sendBuckets.get(c.id) ?? new Array(7).fill(0),
    };
  });

  // 4. Hero stats
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const totalProspects = campaigns.reduce((s, c) => s + c.prospects, 0);
  const totalContacted = campaigns.reduce((s, c) => s + c.contacted, 0);
  const totalReplied = campaigns.reduce((s, c) => s + c.replied, 0);

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
      label: "Reply rate",
      value: `${replyRate}%`,
      iconKey: "trending-up" as const,
      accent: "var(--warning-700)",
      bg: "var(--warning-50)",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
            Outreach
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Multi-step email sequences on autopilot. Pull leads from your
            generated niches, build a sequence, and let the worker handle the
            rest.
          </p>
        </div>
        <Link
          href="/user/outreach/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_2px_10px_rgba(79,70,229,0.20)] transition hover:bg-[var(--brand-700)]"
        >
          <Plus className="h-3.5 w-3.5" />
          New campaign
        </Link>
      </div>

      <OutreachDashboard heroStats={heroStats} campaigns={campaigns} />
    </div>
  );
}
