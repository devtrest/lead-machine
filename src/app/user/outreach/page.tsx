import Link from "next/link";
import { Plus, Mail, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/outreach/StatusBadge";

export const dynamic = "force-dynamic";

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  scan_run_id: string;
  created_at: string;
  scan_runs: { keyword: string; location: string } | { keyword: string; location: string }[] | null;
};

export default async function OutreachListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: campaigns } = await supabase
    .from("outreach_campaigns")
    .select(
      "id,name,status,scan_run_id,created_at,scan_runs(keyword,location)"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  // Per-campaign prospect counts (single batched query).
  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const countsByCampaign = new Map<
    string,
    { total: number; pending: number; sent: number }
  >();
  if (campaignIds.length > 0) {
    const { data: prospects } = await supabase
      .from("outreach_prospects")
      .select("campaign_id,status,current_step")
      .in("campaign_id", campaignIds);
    for (const p of prospects ?? []) {
      const cid = p.campaign_id as string;
      const entry = countsByCampaign.get(cid) ?? {
        total: 0,
        pending: 0,
        sent: 0,
      };
      entry.total += 1;
      if (p.status === "pending") entry.pending += 1;
      if ((p.current_step as number) > 0) entry.sent += 1;
      countsByCampaign.set(cid, entry);
    }
  }

  const list = (campaigns ?? []) as CampaignRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
            Outreach
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Multi-step email campaigns that run on autopilot. Each campaign
            pulls leads from one of your existing niches.
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

      {list.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <Mail className="mx-auto h-10 w-10 text-[var(--ink-subtle)]" />
          <h3 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
            No outreach campaigns yet
          </h3>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
            Create a campaign, add a sequence of emails, pick leads from one of
            your generated niches, and let it run.
          </p>
          <Link
            href="/user/outreach/new"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
          >
            <Plus className="h-4 w-4" />
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((c) => {
            const niche = Array.isArray(c.scan_runs)
              ? c.scan_runs[0]
              : c.scan_runs;
            const counts = countsByCampaign.get(c.id) ?? {
              total: 0,
              pending: 0,
              sent: 0,
            };
            return (
              <Link
                key={c.id}
                href={`/user/outreach/${c.id}`}
                className="surface-card group block space-y-3 p-5 transition hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-[var(--ink-strong)]">
                      {c.name}
                    </div>
                    {niche ? (
                      <div className="mt-0.5 truncate text-sm text-[var(--ink-muted)]">
                        <span className="capitalize">{niche.keyword}</span> ·{" "}
                        {niche.location}
                      </div>
                    ) : null}
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="flex items-center gap-4 text-xs text-[var(--ink-muted)]">
                  <span>
                    <span className="font-semibold text-[var(--ink-strong)]">
                      {counts.total}
                    </span>{" "}
                    prospects
                  </span>
                  <span>
                    <span className="font-semibold text-[var(--ink-strong)]">
                      {counts.sent}
                    </span>{" "}
                    contacted
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[var(--brand-700)] transition group-hover:gap-1.5">
                    Open <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
