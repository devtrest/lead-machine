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

  type LeadRow = {
    id: string;
    scan_run_id: string;
    website_url: string | null;
    lead_contacts: { email: string | null }[] | null;
  };

  // Page through EVERY lead + contact (a single .limit(5000) silently dropped
  // the newest campaigns once an account grew past 5k leads — they showed
  // "0 websites" and a disabled button). Bucket by scan_run_id in JS to avoid
  // an N+1 query per campaign. PAGE_SIZE rows per round-trip, ordered so paging
  // is stable; cap the loop as a runaway guard.
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 60; // up to 60k leads
  const bucketByRun = new Map<string, { websites: number; withEmail: number }>();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("leads")
      .select("id,scan_run_id,website_url,lead_contacts(email)")
      .eq("user_id", user!.id)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    for (const lead of data as LeadRow[]) {
      const b = bucketByRun.get(lead.scan_run_id) ?? {
        websites: 0,
        withEmail: 0,
      };
      if (lead.website_url) b.websites += 1;
      if ((lead.lead_contacts ?? []).some((c) => c.email)) b.withEmail += 1;
      bucketByRun.set(lead.scan_run_id, b);
    }
    if (data.length < PAGE_SIZE) break;
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
