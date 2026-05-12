import { supabase } from "./db.js";
import {
  scrapeGoogleMaps,
  type MapsPlace,
  type ProgressEvent as ScraperEvent,
} from "./scraper.js";
import { enrichFromWebsite } from "./enrichment.js";
import { expandKeyword } from "./keywords.js";

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

  // First sweep
  let results = await scrapeGoogleMaps({
    keyword,
    location,
    maxResults: target,
    onProgress: (e) => onEvent(e),
  });

  // Keyword expansion when underfilled
  if (results.length < target) {
    const expanded = await expandKeyword(keyword, 6);
    const seen = new Set(
      results.map(
        (r) => `${r.title.toLowerCase()}|${(r.placeUrl ?? "").toLowerCase()}`
      )
    );
    for (const altKeyword of expanded) {
      if (results.length >= target) break;
      const needed = target - results.length;
      const extra = await scrapeGoogleMaps({
        keyword: altKeyword,
        location,
        maxResults: Math.min(needed * 2, target),
        onProgress: (e) => {
          if (
            e.phase === "discovering" ||
            e.phase === "extracting" ||
            e.phase === "enriching"
          ) {
            onEvent({
              phase: e.phase,
              count: Math.min(target, results.length + e.count),
              target,
            });
          }
        },
      });
      for (const r of extra) {
        const key = `${r.title.toLowerCase()}|${(r.placeUrl ?? "").toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(r);
        if (results.length >= target) break;
      }
    }
    results = results.slice(0, target);
  }

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
    const HARVEST_CONCURRENCY = 5;
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
            const enriched = await enrichFromWebsite(websiteUrl, 3);
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
