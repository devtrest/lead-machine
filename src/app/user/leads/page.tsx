import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LeadsCrm } from "@/components/leads/LeadsCrm";
import {
  ProspectListsOverview,
  type CampaignSummary,
} from "@/components/leads/ProspectListsOverview";
import { Skeleton } from "@/components/ui/Skeleton";

export const dynamic = "force-dynamic";

// /user/leads with ?campaign=<id> → existing CRM table scoped to that campaign.
// /user/leads with no query  → new ProspectListsOverview that lists every
//    lead campaign as a tile (counts of leads / emails / phones / websites).
//    Click a tile to drill into its prospects.
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const params = await searchParams;
  const campaignId = typeof params.campaign === "string" ? params.campaign : null;

  // Scoped CRM view — let the client component fetch via its existing API.
  if (campaignId) {
    return (
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <LeadsCrm />
      </Suspense>
    );
  }

  // Overview view — aggregate per-campaign counts server-side so the tiles
  // can show "X leads · Y emails · Z phones" up-front without each tile doing
  // its own fetch.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: runs } = await supabase
    .from("scan_runs")
    .select("id,keyword,location,status,result_count,started_at")
    .eq("user_id", user!.id)
    .order("started_at", { ascending: false })
    .limit(60);

  // Pull every lead+contact for this user once, then bucket by scan_run_id
  // in JS. Avoids running N+1 queries (one per campaign).
  const { data: leadsWithContacts } = await supabase
    .from("leads")
    .select(
      "id,scan_run_id,website_url,lead_contacts(email,phone)"
    )
    .eq("user_id", user!.id)
    .limit(5000);

  type LeadRow = {
    id: string;
    scan_run_id: string;
    website_url: string | null;
    lead_contacts: { email: string | null; phone: string | null }[] | null;
  };

  type Bucket = { emails: number; phones: number; websites: number };
  const bucketByRun = new Map<string, Bucket>();
  for (const lead of (leadsWithContacts ?? []) as LeadRow[]) {
    const b = bucketByRun.get(lead.scan_run_id) ?? {
      emails: 0,
      phones: 0,
      websites: 0,
    };
    if (lead.website_url) b.websites += 1;
    if ((lead.lead_contacts ?? []).some((c) => c.email)) b.emails += 1;
    if ((lead.lead_contacts ?? []).some((c) => c.phone)) b.phones += 1;
    bucketByRun.set(lead.scan_run_id, b);
  }

  const campaigns: CampaignSummary[] = ((runs ?? []) as Array<{
    id: string;
    keyword: string;
    location: string;
    status: string;
    result_count: number;
    started_at: string;
  }>).map((r) => {
    const b = bucketByRun.get(r.id) ?? { emails: 0, phones: 0, websites: 0 };
    return {
      id: r.id,
      keyword: r.keyword,
      location: r.location,
      status: r.status,
      result_count: r.result_count ?? 0,
      started_at: r.started_at,
      emails: b.emails,
      phones: b.phones,
      websites: b.websites,
    };
  });

  return <ProspectListsOverview campaigns={campaigns} />;
}
