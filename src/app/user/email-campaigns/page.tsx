import Link from "next/link";
import { Sparkles, Mail, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  scan_run_id: string;
  lead_contacts: { email: string | null }[] | null;
};

export default async function EmailCampaignsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: runs } = await supabase
    .from("scan_runs")
    .select("id,keyword,location,started_at,result_count,status")
    .eq("user_id", user!.id)
    .eq("status", "completed")
    .gt("result_count", 0)
    .order("started_at", { ascending: false })
    .limit(200);

  const runList = runs ?? [];

  // Count leads-with-email per scan_run. One round-trip; bucketing in JS
  // keeps the SQL simple and works fine up to ~thousands of leads per user.
  const emailCounts = new Map<string, number>();
  if (runList.length > 0) {
    const runIds = runList.map((r) => r.id);
    const { data: leads } = await supabase
      .from("leads")
      .select("id,scan_run_id,lead_contacts(email)")
      .eq("user_id", user!.id)
      .in("scan_run_id", runIds);

    for (const lead of (leads ?? []) as LeadRow[]) {
      const hasEmail = (lead.lead_contacts ?? []).some(
        (c) => typeof c.email === "string" && c.email.length > 0
      );
      if (hasEmail) {
        emailCounts.set(
          lead.scan_run_id,
          (emailCounts.get(lead.scan_run_id) ?? 0) + 1
        );
      }
    }
  }

  const emailable = runList
    .map((r) => ({ ...r, emailableLeads: emailCounts.get(r.id) ?? 0 }))
    .filter((r) => r.emailableLeads > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
            Email campaigns
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Send outreach emails to leads from any of your completed campaigns.
            Only leads with a discovered email address are shown.
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

      {emailable.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <Mail className="mx-auto h-10 w-10 text-[var(--ink-subtle)]" />
          <h3 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
            No emailable campaigns yet
          </h3>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
            Once a generated campaign has leads with email addresses, you can
            send outreach from here.
          </p>
          <Link
            href="/user/generate"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
          >
            <Sparkles className="h-4 w-4" />
            Generate leads
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {emailable.map((run) => (
            <Link
              key={run.id}
              href={`/user/email-campaigns/${run.id}`}
              className="surface-card group block p-5 transition hover:shadow-[var(--shadow-md)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold capitalize text-[var(--ink-strong)]">
                    {run.keyword}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-[var(--ink-muted)]">
                    {run.location}
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
                  <Mail className="h-3 w-3" />
                  {run.emailableLeads} with email
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-[var(--ink-subtle)]">
                <span>
                  {run.result_count} total leads ·{" "}
                  {new Date(run.started_at).toLocaleDateString()}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-[var(--brand-700)] transition group-hover:gap-1.5">
                  Compose <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
