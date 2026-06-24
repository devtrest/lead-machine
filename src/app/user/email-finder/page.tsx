import { createClient } from "@/lib/supabase/server";
import {
  EmailFinderPanel,
  type FinderList,
} from "@/components/email-finder/EmailFinderPanel";

export const dynamic = "force-dynamic";

// /user/email-finder — bulk email scraper.
//
// Operates on leads the user ALREADY has (scraped from Google Places). For
// every prospect list it counts the leads that have a website but no email
// yet, and lets the user re-run the email harvester over just those — no
// credits charged. Backed by /api/scan/runs/[id]/reenrich (worker in prod,
// in-process in dev).
export default async function EmailFinderPage() {
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

  // Pull every lead + contact once, then bucket by scan_run_id in JS (avoids
  // an N+1 query per campaign) — same approach as the Prospect lists page.
  const { data: leadsWithContacts } = await supabase
    .from("leads")
    .select("id,scan_run_id,website_url,lead_contacts(email)")
    .eq("user_id", user!.id)
    .limit(5000);

  type LeadRow = {
    id: string;
    scan_run_id: string;
    website_url: string | null;
    lead_contacts: { email: string | null }[] | null;
  };

  type Bucket = { websites: number; withEmail: number };
  const bucketByRun = new Map<string, Bucket>();
  for (const lead of (leadsWithContacts ?? []) as LeadRow[]) {
    const b = bucketByRun.get(lead.scan_run_id) ?? {
      websites: 0,
      withEmail: 0,
    };
    const hasWebsite = Boolean(lead.website_url);
    const hasEmail = (lead.lead_contacts ?? []).some((c) => c.email);
    if (hasWebsite) b.websites += 1;
    if (hasEmail) b.withEmail += 1;
    bucketByRun.set(lead.scan_run_id, b);
  }

  const lists: FinderList[] = ((runs ?? []) as Array<{
    id: string;
    keyword: string;
    location: string;
    status: string;
    result_count: number;
    started_at: string;
  }>).map((r) => {
    const b = bucketByRun.get(r.id) ?? { websites: 0, withEmail: 0 };
    // "Missing" = leads with a website we can still crawl but no email yet.
    // We can only ever harvest an email off a site, so leads with no website
    // are excluded from the actionable count.
    const missing = Math.max(0, b.websites - b.withEmail);
    return {
      id: r.id,
      keyword: r.keyword,
      location: r.location,
      status: r.status,
      result_count: r.result_count ?? 0,
      started_at: r.started_at,
      websites: b.websites,
      withEmail: b.withEmail,
      missing,
    };
  });

  return <EmailFinderPanel lists={lists} />;
}
