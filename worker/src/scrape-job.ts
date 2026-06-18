import { supabase } from "./db.js";
import {
  scrapeGoogleMaps,
  type MapsPlace,
  type ProgressEvent as ScraperEvent,
} from "./scraper.js";
import { enrichFromWebsite } from "./enrichment.js";
import { expandKeyword, expandLocation } from "./keywords.js";

export type JobEvent =
  | ScraperEvent
  | { phase: "harvesting"; count: number; target: number }
  | { phase: "saving" }
  | { phase: "saved"; total: number; runId: string };

export type JobInput = {
  scanRunId: string;
  userId: string;
  keyword: string;
  location: string;
  target: number;
  onEvent: (event: JobEvent) => void;
};

/**
 * Full end-to-end scrape job: feed scrape → detail enrichment → keyword
 * expansion if under target → website email harvesting → DB writes →
 * mark scan_run completed. Worker holds the service-role Supabase key
 * so it can insert under any user_id.
 */
export async function runScrapeJob(input: JobInput): Promise<number> {
  const { scanRunId, userId, keyword, location, target, onEvent } = input;

  // Build a query grid. Places Text Search caps at ~60 results per query, so
  // to reach large targets we vary the LOCATION (geographic spread — the
  // biggest source of new, non-overlapping leads) and the KEYWORD (related
  // niches), dedup, and keep querying until we hit the target.
  const seen = new Set<string>();
  const collected: MapsPlace[] = [];
  const keyOf = (r: MapsPlace) =>
    `${r.title.toLowerCase()}|${(r.placeUrl ?? r.websiteUrl ?? "").toLowerCase()}`;

  const reportProgress = async () => {
    const n = Math.min(target, collected.length);
    onEvent({ phase: "discovering", count: n, target });
    // Live count in the campaign card while discovery runs.
    await supabase
      .from("scan_runs")
      .update({ result_count: n })
      .eq("id", scanRunId)
      .then(
        () => {},
        () => {}
      );
  };

  const runQuery = async (kw: string, loc: string) => {
    if (collected.length >= target) return;
    const found = await scrapeGoogleMaps({
      keyword: kw,
      location: loc,
      maxResults: 60,
      onProgress: () => {},
    });
    for (const r of found) {
      if (collected.length >= target) break;
      const k = keyOf(r);
      if (seen.has(k)) continue;
      seen.add(k);
      collected.push(r);
    }
    await reportProgress();
  };

  const locations = [location, ...expandLocation(location)];

  // Pass 1 — base keyword across every location variant.
  for (const loc of locations) {
    if (collected.length >= target) break;
    await runQuery(keyword, loc);
  }

  // Pass 2 — related keywords across the same locations, until the target.
  if (collected.length < target) {
    const altKeywords = await expandKeyword(keyword, 14);
    for (const kw of altKeywords) {
      if (collected.length >= target) break;
      for (const loc of locations) {
        if (collected.length >= target) break;
        await runQuery(kw, loc);
      }
    }
  }

  const results = collected.slice(0, target);

  onEvent({ phase: "saving" });

  if (results.length === 0) {
    await supabase
      .from("scan_runs")
      .update({
        status: "completed",
        result_count: 0,
        finished_at: new Date().toISOString(),
      })
      .eq("id", scanRunId);
    onEvent({ phase: "saved", total: 0, runId: scanRunId });
    return 0;
  }

  const leadRows = results.map((lead) => {
    const normalizedWebsite = lead.websiteUrl?.trim() || null;
    const dedupeKey = [
      lead.title.trim().toLowerCase(),
      (normalizedWebsite ?? lead.placeUrl ?? "").toLowerCase(),
    ].join("|");
    return {
      user_id: userId,
      scan_run_id: scanRunId,
      source: "google_maps",
      name: lead.title,
      category: lead.category ?? null,
      address: lead.address ?? null,
      rating: lead.rating ? Number(lead.rating) : null,
      review_count: lead.reviews
        ? Number(lead.reviews.replace(/[^\d]/g, "")) || null
        : null,
      maps_url: lead.placeUrl ?? null,
      website_url: normalizedWebsite,
      dedupe_key: dedupeKey,
    };
  });

  const { data: insertedLeads, error: leadsError } = await supabase
    .from("leads")
    .insert(leadRows)
    .select("id,website_url,name,maps_url");

  if (leadsError) throw leadsError;

  // Surface the lead count live (JobsList polls result_count) while the slower
  // email-harvest phase runs — instead of jumping 0 → N only at the very end.
  await supabase
    .from("scan_runs")
    .update({ result_count: results.length })
    .eq("id", scanRunId);

  const contactRows: Array<{
    lead_id: string;
    phone: string | null;
    email: string | null;
    website_url: string | null;
    source_url: string | null;
  }> = [];

  // Phones from detail page (cheap, in-memory)
  for (const [idx, lead] of (insertedLeads ?? []).entries()) {
    const phone = results[idx]?.phone;
    if (phone) {
      contactRows.push({
        lead_id: lead.id as string,
        phone,
        email: null,
        website_url: (lead.website_url as string | null) ?? null,
        source_url: (lead.maps_url as string | null) ?? null,
      });
    }
  }

  // Website email harvesting
  const harvestable = (insertedLeads ?? [])
    .map((lead, idx) => ({ lead, idx }))
    .filter(({ lead }) => Boolean(lead.website_url));

  if (harvestable.length > 0) {
    onEvent({ phase: "harvesting", count: 0, target: harvestable.length });
    const HARVEST_CONCURRENCY = 10;
    // Hard per-lead deadline. With the path expansion + booking-platform
    // fallback, a no-email site can otherwise burn many fetches blocking a
    // queue slot. 18 s caps the worst case while still letting the homepage
    // get its 8 s grace (Squarespace/Wix render slow) plus one or two
    // fallback paths inside the budget.
    const PER_LEAD_BUDGET_MS = 18_000;
    let cursor = 0;
    let done = 0;
    await Promise.all(
      Array.from({ length: HARVEST_CONCURRENCY }).map(async () => {
        while (true) {
          const i = cursor++;
          if (i >= harvestable.length) break;
          const { lead } = harvestable[i];
          const websiteUrl = lead.website_url as string;
          try {
            const enriched = await Promise.race([
              enrichFromWebsite(websiteUrl, 3),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error("enrichment deadline")),
                  PER_LEAD_BUDGET_MS
                )
              ),
            ]);
            const sourceUrl = enriched.sourceUrls[0] ?? websiteUrl;
            for (const email of enriched.emails) {
              contactRows.push({
                lead_id: lead.id as string,
                phone: null,
                email,
                website_url: websiteUrl,
                source_url: sourceUrl,
              });
            }
            for (const phone of enriched.phones) {
              contactRows.push({
                lead_id: lead.id as string,
                phone,
                email: null,
                website_url: websiteUrl,
                source_url: sourceUrl,
              });
            }
          } catch {}
          done += 1;
          onEvent({
            phase: "harvesting",
            count: done,
            target: harvestable.length,
          });
        }
      })
    );
  }

  if (contactRows.length > 0) {
    const { error } = await supabase.from("lead_contacts").insert(contactRows);
    if (error) {
      console.error("[scrape-job] contact insert warning", error);
    }
  }

  await supabase
    .from("scan_runs")
    .update({
      status: "completed",
      result_count: results.length,
      finished_at: new Date().toISOString(),
    })
    .eq("id", scanRunId);

  onEvent({ phase: "saved", total: results.length, runId: scanRunId });
  return results.length;
}

// Re-export for type sharing if needed.
export type { MapsPlace };
