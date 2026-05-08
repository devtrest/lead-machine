import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Users as UsersIcon,
  Coins,
  ArrowRight,
} from "lucide-react";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { Counter } from "@/components/ui/Counter";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { data: roster },
    { data: runs },
    { data: leadRows },
    { count: totalLeadCount },
    { data: chartLeads },
    { count: enterpriseCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,credits", { count: "exact" })
      .limit(500),
    supabase
      .from("scan_runs")
      .select("id,status")
      .order("started_at", { ascending: false })
      .limit(60),
    supabase
      .from("leads")
      .select("id,lead_contacts(phone,email)")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase
      .from("leads")
      .select("created_at")
      .gte(
        "created_at",
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      )
      .limit(5000),
    supabase
      .from("enterprise_requests")
      .select("id", { count: "exact", head: true }),
  ]);

  const completedRuns = (runs ?? []).filter((r) => r.status === "completed").length;
  const failedRuns = (runs ?? []).filter((r) => r.status === "failed").length;
  const contactPoints = (leadRows ?? []).reduce(
    (acc, lead) =>
      acc + (lead.lead_contacts ?? []).filter((e) => e.phone || e.email).length,
    0
  );
  const totalUsers = roster?.length ?? 0;
  const totalCredits = (roster ?? []).reduce(
    (acc, p) => acc + (p.credits ?? 0),
    0
  );
  const series = buildDailySeries(chartLeads ?? [], 14);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elev)] px-6 py-7 md:px-10">
        <div
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-50 blur-3xl"
          aria-hidden
        />
        <div className="dot-grid absolute inset-0 opacity-50" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
              <ShieldCheck className="h-3 w-3" />
              Admin · Overview
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
              Operations command center
            </h1>
            <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
              Platform health at a glance. Drill into any section from the
              sidebar.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<UsersIcon className="h-4 w-4" />}
          label="Active users"
          value={totalUsers}
          tone="brand"
          hint="Across all plans"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Completed runs"
          value={completedRuns}
          tone="success"
          hint={`${failedRuns} failed need review`}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Contact points"
          value={contactPoints}
          tone="amber"
          hint="On recent leads"
        />
        <KpiCard
          icon={<Coins className="h-4 w-4" />}
          label="Credits in pool"
          value={totalCredits}
          tone="neutral"
          hint="Total user balance"
        />
      </section>

      <section className="surface-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
              <Activity className="h-3.5 w-3.5" />
              Last 14 days
            </div>
            <h2 className="mt-1 text-base font-semibold text-[var(--ink-strong)]">
              Platform-wide lead growth
            </h2>
            <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
              {(totalLeadCount ?? 0).toLocaleString()} leads stored across all
              accounts.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <Sparkline data={series} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <QuickLink
          href="/admin/users"
          icon={<UsersIcon className="h-5 w-5" />}
          title="Users"
          subtitle={`${totalUsers} accounts to manage`}
        />
        <QuickLink
          href="/admin/campaigns"
          icon={<Activity className="h-5 w-5" />}
          title="Campaigns"
          subtitle={`${completedRuns} completed · ${failedRuns} failed`}
        />
        <QuickLink
          href="/admin/activity"
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Activity"
          subtitle={`${enterpriseCount ?? 0} enterprise requests`}
        />
      </section>

      {failedRuns > 0 ? (
        <section className="rounded-2xl border border-[var(--danger-100)] bg-[var(--danger-50)] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--danger-100)] text-[var(--danger-700)]">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-[var(--danger-700)]">
                {failedRuns} failed campaign{failedRuns === 1 ? "" : "s"} in the
                last 60 runs
              </h3>
              <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                Open the Campaigns view to inspect the error message on each
                failed run.
              </p>
            </div>
            <Link
              href="/admin/campaigns"
              className="ml-auto self-center inline-flex items-center gap-1 rounded-lg bg-[var(--danger-500)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--danger-700)]"
            >
              Review <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>
      ) : null}
    </div>
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

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: "brand" | "success" | "amber" | "neutral";
}) {
  const toneMap = {
    brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
    success: "bg-[var(--success-50)] text-[var(--success-700)]",
    amber: "bg-[var(--accent-50)] text-[var(--accent-700)]",
    neutral: "bg-[var(--surface-sunken)] text-[var(--ink-strong)]",
  };
  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
          {label}
        </span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneMap[tone]}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
        <Counter value={value} />
      </div>
      <div className="mt-1 text-xs text-[var(--ink-subtle)]">{hint}</div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="surface-card flex items-center justify-between gap-3 p-5 transition hover:-translate-y-0.5 hover:border-[var(--brand-200)] hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)]">
          {icon}
        </span>
        <div>
          <div className="text-sm font-semibold text-[var(--ink-strong)]">
            {title}
          </div>
          <div className="text-xs text-[var(--ink-muted)]">{subtitle}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ink-subtle)]" />
    </Link>
  );
}
