import { createClient } from "@/lib/supabase/server";
import { JobsList, type JobRun } from "@/components/jobs/JobsList";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("scan_runs")
    .select(
      "id,source,keyword,location,status,limit_count,result_count,started_at,finished_at,error"
    )
    .eq("user_id", user!.id)
    .order("started_at", { ascending: false })
    .limit(30);

  const initialRuns = (data ?? []) as JobRun[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
          Background jobs
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Lead generation runs in the background on our worker. You can close
          your browser, switch tabs, or lose connectivity — when you come back,
          the run is still going (or done) and this page shows the live state.
        </p>
      </div>

      <JobsList initialRuns={initialRuns} />
    </div>
  );
}
