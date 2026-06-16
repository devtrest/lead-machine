import Link from "next/link";
import {
  Sparkles,
  Users,
  Layers,
  ArrowRight,
  TrendingUp,
  Activity,
  Zap,
  Database,
  Send,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardKpis } from "@/components/dashboard/DashboardKpis";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { QualityBars } from "@/components/dashboard/QualityBars";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const [
    { data: profile },
    leadsCountRes,
    campaignsRes,
    contactsRes,
    recentRunsRes,
    leadsForChartRes,
    leadsForQualityRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name,credits,plan,trial_status,trial_ends_at,trial_target_plan,trial_last_error"
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("scan_runs")
      .select("id,status", { count: "exact" })
      .eq("user_id", userId),
    supabase
      .from("lead_contacts")
      .select("id,phone,email,leads!inner(user_id)")
      .eq("leads.user_id", userId)
      .limit(2000),
    supabase
      .from("scan_runs")
      .select("id,keyword,location,status,result_count,started_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5),
    supabase
      .from("leads")
      .select("created_at")
      .eq("user_id", userId)
      .gte(
        "created_at",
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      )
      .limit(2000),
    supabase
      .from("leads")
      .select(
        "id,address,website_url,lead_contacts(phone,email)"
      )
      .eq("user_id", userId)
      .limit(2000),
  ]);

  const totalLeads = leadsCountRes.count ?? 0;
  const totalCampaigns = campaignsRes.count ?? 0;
  const completedCampaigns = (campaignsRes.data ?? []).filter(
    (r) => r.status === "completed"
  ).length;
  const contacts = contactsRes.data ?? [];
  const totalPhones = contacts.filter((c) => c.phone).length;
  const totalEmails = contacts.filter((c) => c.email).length;
  const recentRuns = recentRunsRes.data ?? [];

  const series = buildDailySeries(leadsForChartRes.data ?? [], 14);
  const qualityLeads = leadsForQualityRes.data ?? [];
  const withWebsite = qualityLeads.filter((l) => l.website_url).length;
  const withEmail = qualityLeads.filter((l) =>
    (l.lead_contacts ?? []).some((c) => c.email)
  ).length;
  const withPhone = qualityLeads.filter((l) =>
    (l.lead_contacts ?? []).some((c) => c.phone)
  ).length;
  const withAddress = qualityLeads.filter((l) => Boolean(l.address)).length;

  const firstName = (profile?.full_name ?? user?.email ?? "")
    .split(/[\s@]/)
    .filter(Boolean)[0];

  const last7 = series.slice(-7).reduce((a, b) => a + b.value, 0);
  const prev7 = series.slice(-14, -7).reduce((a, b) => a + b.value, 0);
  const trendPct =
    prev7 === 0
      ? last7 > 0
        ? 100
        : 0
      : Math.round(((last7 - prev7) / prev7) * 100);

  const trial = profile?.trial_status
    ? {
        status: profile.trial_status as string,
        endsAt: profile.trial_ends_at as string | null,
        targetPlan: profile.trial_target_plan as string | null,
        lastError: profile.trial_last_error as string | null,
      }
    : null;

  // First-time-user gate: no credits, no plan activity, no active trial.
  // Surface a hard-to-miss "Pick a plan to get started" banner that points
  // straight at /user/billing. New users land at /user/billing on signup
  // anyway, but this catches the case where they bounced back to the
  // dashboard without picking anything.
  const showOnboardingBanner =
    (profile?.credits ?? 0) === 0 && !trial;

  return (
    <div className="space-y-8">
      {showOnboardingBanner ? <OnboardingBanner /> : null}
      {trial && trial.status === "active" && trial.endsAt ? (
        <TrialBanner endsAt={trial.endsAt} targetPlan={trial.targetPlan ?? "starter"} />
      ) : null}
      {trial && trial.status === "failed" ? (
        <TrialFailedBanner error={trial.lastError} />
      ) : null}

      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elev)] px-6 py-8 shadow-[var(--shadow-xs)] md:px-10 md:py-10">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-[var(--brand-100)] to-[var(--sky-100)] opacity-50 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)] backdrop-blur">
              <Sparkles className="h-3 w-3" />
              AI lead engine
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-[40px] md:leading-tight">
              {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-[var(--ink-muted)] md:text-base">
              Tell us your niche, we&apos;ll surface ready-to-contact leads. No
              spreadsheets, no scraping setup, no scrubbing duplicates.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/user/jobs"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)] transition hover:bg-[var(--brand-700)] hover:shadow-[0_12px_28px_rgba(79,70,229,0.35)]"
              >
                <Sparkles className="h-4 w-4" />
                Generate leads
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/user/leads"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white/80 px-5 py-3 text-sm font-medium text-[var(--ink-strong)] backdrop-blur transition hover:bg-white"
              >
                <Users className="h-4 w-4" />
                View leads
              </Link>
            </div>
          </div>

          {/* Quick action cards */}
          <div className="grid grid-cols-3 gap-3">
            <QuickAction
              icon={<Zap className="h-4 w-4" />}
              label="New scrape"
              href="/user/jobs"
            />
            <QuickAction
              icon={<Send className="h-4 w-4" />}
              label="Outreach"
              href="/user/outreach"
            />
            <QuickAction
              icon={<Database className="h-4 w-4" />}
              label="Leads"
              href="/user/leads"
            />
          </div>
        </div>
      </section>

      <DashboardKpis
        totalLeads={totalLeads}
        totalCampaigns={totalCampaigns}
        completedCampaigns={completedCampaigns}
        totalPhones={totalPhones}
        totalEmails={totalEmails}
        credits={profile?.credits ?? 0}
      />

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="surface-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
                <Activity className="h-3.5 w-3.5" />
                Last 14 days
              </div>
              <h2 className="mt-1 text-base font-semibold text-[var(--ink-strong)]">
                Lead growth
              </h2>
              <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                {last7.toLocaleString()} leads added in the last 7 days
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                trendPct >= 0
                  ? "bg-[var(--success-50)] text-[var(--success-700)]"
                  : "bg-[var(--danger-50)] text-[var(--danger-700)]"
              }`}
            >
              <TrendingUp
                className={`h-3 w-3 ${trendPct < 0 ? "rotate-180" : ""}`}
              />
              {trendPct >= 0 ? "+" : ""}
              {trendPct}%
            </span>
          </div>
          <div className="mt-5">
            <Sparkline data={series} />
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
            Lead quality
          </div>
          <h2 className="mt-1 text-base font-semibold text-[var(--ink-strong)]">
            Coverage breakdown
          </h2>
          <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
            Across {qualityLeads.length.toLocaleString()} stored leads.
          </p>
          <div className="mt-5">
            <QualityBars
              total={qualityLeads.length}
              withWebsite={withWebsite}
              withEmail={withEmail}
              withPhone={withPhone}
              withAddress={withAddress}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[var(--ink-strong)]">
                Recent campaigns
              </h2>
              <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                Your last 5 lead generation runs.
              </p>
            </div>
            <Link
              href="/user/jobs"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-800)]"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentRuns.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-sunken)]/50 px-5 py-10 text-center">
              <Layers className="mx-auto h-8 w-8 text-[var(--ink-subtle)]" />
              <p className="mt-2 text-sm font-medium text-[var(--ink-strong)]">
                No campaigns yet.
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Run your first generation to populate this list.
              </p>
              <Link
                href="/user/jobs"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-700)]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Start a campaign
              </Link>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-[var(--border)]">
              {recentRuns.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-center gap-3 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--ink-strong)]">
                      {run.keyword}
                      <span className="text-[var(--ink-subtle)]"> · {run.location}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--ink-subtle)]">
                      {new Date(run.started_at).toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                      run.status === "completed"
                        ? "bg-[var(--success-50)] text-[var(--success-700)]"
                        : run.status === "failed"
                          ? "bg-[var(--danger-50)] text-[var(--danger-700)]"
                          : "bg-[var(--warning-50)] text-[var(--warning-700)]"
                    }`}
                  >
                    {run.status}
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-[var(--ink-strong)]">
                      {run.result_count}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--ink-subtle)]">
                      leads
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[var(--brand-100)] bg-gradient-to-br from-[var(--brand-50)] to-[var(--sky-100)] p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            Pro tip
          </div>
          <p className="mt-2 text-sm font-medium text-[var(--ink-strong)]">
            Need 500 leads but only 60 in your city?
          </p>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
            Our AI expands your niche into adjacent keywords automatically — so
            your lead volume keeps growing without changing locations.
          </p>
          <Link
            href="/user/jobs"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-800)]"
          >
            Try it now <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function OnboardingBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--brand-200)] bg-gradient-to-br from-[var(--brand-50)] via-white to-[var(--sky-50)] px-6 py-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-[var(--brand-300)]/30 to-transparent blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-600)] text-white shadow-[0_4px_14px_rgba(79,70,229,0.30)] ring-4 ring-[var(--brand-100)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-200)] bg-white/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--brand-700)] backdrop-blur">
              Welcome
            </div>
            <h3 className="mt-1 text-base font-semibold text-[var(--ink-strong)]">
              Pick a plan to start generating leads
            </h3>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              Try Lead Machine for $1 / 7 days — 100 credits up front, auto-upgrades to your chosen plan after the trial.
            </p>
          </div>
        </div>
        <Link
          href="/user/billing"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition hover:bg-[var(--brand-700)]"
        >
          <Sparkles className="h-3 w-3" />
          Start for $1
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}

function QuickAction({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-start gap-2 rounded-2xl border border-[var(--border)] bg-white/80 p-3.5 backdrop-blur transition hover:-translate-y-0.5 hover:border-[var(--brand-200)] hover:bg-white hover:shadow-[var(--shadow-sm)]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)] transition group-hover:bg-[var(--brand-100)]">
        {icon}
      </span>
      <span className="text-xs font-semibold text-[var(--ink-strong)]">
        {label}
      </span>
    </Link>
  );
}

function TrialBanner({
  endsAt,
  targetPlan,
}: {
  endsAt: string;
  targetPlan: string;
}) {
  const end = new Date(endsAt);
  const hoursLeft = Math.max(
    0,
    Math.round((end.getTime() - Date.now()) / (60 * 60 * 1000))
  );
  const daysLeft = Math.floor(hoursLeft / 24);
  const remainingLabel =
    daysLeft >= 1
      ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} ${hoursLeft % 24}h`
      : `${hoursLeft}h`;
  const planLabel =
    targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--brand-200)] bg-gradient-to-br from-[var(--brand-50)] via-white to-[var(--sky-50)] px-6 py-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-[var(--brand-300)]/30 to-transparent blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-600)] text-white shadow-[0_4px_14px_rgba(79,70,229,0.30)] ring-4 ring-[var(--brand-100)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-200)] bg-white/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--brand-700)] backdrop-blur">
              Trial active
            </div>
            <h3 className="mt-1 text-base font-semibold text-[var(--ink-strong)]">
              {remainingLabel} remaining · auto-upgrades to{" "}
              <span className="text-[var(--brand-700)]">{planLabel}</span> on{" "}
              {end.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              Cancel before then in Settings and we won&apos;t charge your card.
            </p>
          </div>
        </div>
        <Link
          href="/user/settings"
          className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
        >
          Manage trial
        </Link>
      </div>
    </section>
  );
}

function TrialFailedBanner({ error }: { error: string | null }) {
  return (
    <section className="rounded-2xl border border-[var(--danger-100)] bg-[var(--danger-50)] px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--danger-500)] text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--danger-700)]">
            Trial conversion failed
          </div>
          <p className="mt-0.5 text-xs text-[var(--danger-700)]/80">
            {error ?? "We couldn't charge your saved card."} Visit Billing to
            buy credits manually.
          </p>
        </div>
        <Link
          href="/user/billing"
          className="ml-auto inline-flex items-center rounded-xl bg-[var(--danger-500)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--danger-700)]"
        >
          Go to Billing
        </Link>
      </div>
    </section>
  );
}

function buildDailySeries(
  rows: { created_at: string }[],
  days: number
): { date: string; value: number }[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const series: { date: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    series.push({ date: d.toISOString().slice(0, 10), value: 0 });
  }
  const idx = new Map(series.map((s, i) => [s.date, i]));
  for (const row of rows) {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    const i = idx.get(key);
    if (i !== undefined) series[i].value += 1;
  }
  return series;
}
