import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CampaignWizard } from "@/components/outreach/CampaignWizard";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Available prospect-list folders = completed scan_runs with leads.
  const { data: runs } = await supabase
    .from("scan_runs")
    .select("id,keyword,location,started_at,result_count,status")
    .eq("user_id", user!.id)
    .eq("status", "completed")
    .gt("result_count", 0)
    .order("started_at", { ascending: false })
    .limit(100);

  // Per-list emailable count.
  const runList = runs ?? [];
  const runIds = runList.map((r) => r.id);
  const emailCounts = new Map<string, number>();
  if (runIds.length > 0) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id,scan_run_id,lead_contacts(email)")
      .eq("user_id", user!.id)
      .in("scan_run_id", runIds);
    for (const lead of leads ?? []) {
      const contacts =
        (lead.lead_contacts as { email: string | null }[] | null) ?? [];
      const hasEmail = contacts.some(
        (c) => typeof c.email === "string" && c.email.length > 0
      );
      if (hasEmail) {
        const cid = lead.scan_run_id as string;
        emailCounts.set(cid, (emailCounts.get(cid) ?? 0) + 1);
      }
    }
  }

  const prospectLists = runList
    .map((r) => ({
      id: r.id,
      keyword: r.keyword,
      location: r.location,
      total: r.result_count,
      emailable: emailCounts.get(r.id) ?? 0,
    }))
    .filter((r) => r.emailable > 0);

  // User's connected senders.
  const { data: sendersRaw } = await supabase
    .from("outreach_senders")
    .select("id,email,display_name,daily_limit,sends_today,status")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const senders = sendersRaw ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/user/outreach"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] transition hover:text-[var(--brand-700)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All campaigns
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
          New outreach campaign
        </h1>
      </div>

      {prospectLists.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <Mail className="mx-auto h-10 w-10 text-[var(--ink-subtle)]" />
          <h3 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
            No prospect lists with emails yet
          </h3>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
            Generate a campaign first so we have leads with email addresses to
            outreach.
          </p>
          <Link
            href="/user/generate"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
          >
            Generate leads
          </Link>
        </div>
      ) : (
        <CampaignWizard prospectLists={prospectLists} senders={senders} />
      )}
    </div>
  );
}
