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
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--brand-100)] bg-gradient-to-br from-[var(--brand-50)] via-[var(--surface-elev)] to-[var(--sky-50)] px-6 py-7 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-[var(--brand-200)]/40 to-transparent blur-3xl" />
        <div className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-gradient-to-tr from-[var(--sky-200)]/40 to-transparent blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand-700)] backdrop-blur">
            Lead engine
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
            Scraping campaigns
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--ink-muted)]">
            Every lead generation run shows up here with live progress.
            Scrapes execute on our worker infrastructure — close your laptop,
            switch tabs, lose Wi-Fi, it keeps running. This page reflects the
            true state of the engine.
          </p>
        </div>
      </div>

      <JobsList initialRuns={initialRuns} />
    </div>
  );
}
