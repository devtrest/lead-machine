import { Zap, Globe2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { JobsList, type JobRun } from "@/components/jobs/JobsList";
import { GenerateForm } from "@/components/generate/GenerateForm";

export const dynamic = "force-dynamic";

const stats = [
  {
    icon: Zap,
    label: "Live results",
    body: "Every lead is fetched fresh — no recycled lists.",
  },
  {
    icon: Globe2,
    label: "40+ countries",
    body: "Any city, any niche, anywhere on the map.",
  },
  {
    icon: ShieldCheck,
    label: "Auto-deduped",
    body: "We collapse repeats before they hit your database.",
  },
];

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
      {/* Page header */}
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            AI lead engine
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-3xl">
            Lead campaigns
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--ink-muted)]">
            Describe the niche and the city. We&apos;ll surface verified leads
            with phones, emails, and websites — deduped and ready to contact.
            Every run appears below with live progress.
          </p>
        </div>
      </div>

      {/* New-campaign form + value props */}
      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div className="surface-card p-6">
          <GenerateForm />
        </div>

        <div className="surface-card p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            Why Lead Machine
          </div>
          <ul className="mt-4 space-y-4">
            {stats.map((s) => (
              <li key={s.label} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-100)]">
                  <s.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--ink-strong)]">
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-sm text-[var(--ink-muted)]">
                    {s.body}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Live campaigns list with realtime progress */}
      <JobsList initialRuns={initialRuns} />
    </div>
  );
}
