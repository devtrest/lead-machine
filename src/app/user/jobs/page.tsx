import { Zap, Globe2, ShieldCheck, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { JobsList, type JobRun } from "@/components/jobs/JobsList";
import { GenerateForm } from "@/components/generate/GenerateForm";
import { ScrollToHash } from "@/components/jobs/ScrollToHash";

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
      {/* Smooth-scrolls to ?hash on hydration. Lets links like
          /user/jobs#generate from the Dashboard land directly on the form
          instead of at the page header. No-op if the URL has no hash. */}
      <ScrollToHash />

      {/* Page header — gradient hero strip */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--brand-50)] via-[var(--surface-elev)] to-[var(--sky-100)]/40 p-6 md:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-40 blur-3xl"
          aria-hidden
        />
        <div className="relative flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-600)] text-white shadow-[0_6px_20px_rgba(79,70,229,0.30)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">
              AI lead engine
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-3xl">
              Lead campaigns
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[var(--ink-muted)]">
              Describe the niche and the city. We&apos;ll surface verified leads
              with phones, emails, and websites — deduped and ready to contact.
              Every run appears below with live progress.
            </p>
          </div>
        </div>
      </div>

      {/* New-campaign form + value props.
          id="generate" lets the topbar 'New campaign' button (and the
          dashboard hero) jump straight to this section. scroll-mt-24 leaves
          room for the sticky topbar so the form isn't clipped. The form
          carries its own elevated card, so it is NOT wrapped in another one
          (that was a card-in-a-card with doubled padding/borders). */}
      <section
        id="generate"
        className="grid scroll-mt-24 gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-stretch"
      >
        <GenerateForm />

        <div className="surface-card flex flex-col p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            Why Lead Machine
          </div>
          <ul className="mt-5 space-y-5">
            {stats.map((s) => (
              <li key={s.label} className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
                  <s.icon className="h-5 w-5" />
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
          <div className="mt-auto pt-5">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)]/40 px-3.5 py-3 text-xs text-[var(--ink-muted)]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--success-600)]" />
              <span>
                1 credit per delivered lead — unused credits are refunded
                automatically when a run finishes.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Live campaigns list with realtime progress */}
      <JobsList initialRuns={initialRuns} />
    </div>
  );
}
