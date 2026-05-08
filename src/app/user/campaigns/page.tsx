import Link from "next/link";
import { Sparkles, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("scan_runs")
    .select(
      "id,keyword,location,source,status,limit_count,result_count,started_at,finished_at,error"
    )
    .eq("user_id", user!.id)
    .order("started_at", { ascending: false })
    .limit(100);

  const runs = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            History of every lead generation run on your account.
          </p>
        </div>
        <Link
          href="/user/generate"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_2px_10px_rgba(79,70,229,0.20)] transition hover:bg-[var(--brand-700)]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          New campaign
        </Link>
      </div>

      {runs.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <Layers className="mx-auto h-10 w-10 text-[var(--ink-subtle)]" />
          <h3 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
            No campaigns yet
          </h3>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
            Each lead generation run shows up here as a campaign.
          </p>
          <Link
            href="/user/generate"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
          >
            <Sparkles className="h-4 w-4" />
            Run your first campaign
          </Link>
        </div>
      ) : (
        <CampaignsTable runs={runs} />
      )}
    </div>
  );
}
