import { Sparkles, Zap, Globe2, ShieldCheck } from "lucide-react";
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
    <div className="space-y-10">
      {/* Hero + new-campaign form */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--brand-50)] via-[var(--surface-elev)] to-[var(--sky-50)] px-6 py-9 md:px-10 md:py-12">
        <div
          className="absolute -right-32 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-60 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-24 -left-32 h-72 w-72 rounded-full bg-gradient-to-br from-[var(--sky-200)] to-[var(--brand-100)] opacity-50 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)] backdrop-blur">
              <Sparkles className="h-3 w-3" />
              AI lead engine
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-[40px] md:leading-tight">
              Create a new{" "}
              <span className="brand-text-gradient">lead campaign</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-[var(--ink-muted)] md:text-base">
              Describe the niche and the city. We&apos;ll surface verified
              leads with phones, emails, and websites — deduped and ready to
              contact. Every run appears in the campaigns list below with live
              progress.
            </p>
            <ul className="mt-5 space-y-2.5">
              {stats.map((s) => (
                <li
                  key={s.label}
                  className="flex items-start gap-3 text-sm text-[var(--ink-strong)]"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 text-[var(--brand-700)] ring-1 ring-[var(--brand-100)]">
                    <s.icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <span className="font-semibold">{s.label}</span>
                    <span className="text-[var(--ink-muted)]"> · {s.body}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <GenerateForm />
          </div>
        </div>
      </section>

      {/* Live campaigns list with realtime progress */}
      <JobsList initialRuns={initialRuns} />
    </div>
  );
}
