import { supabase } from "./db.js";
import {
  scrapeGoogleMaps,
  type MapsPlace,
  type ProgressEvent as ScraperEvent,
} from "./scraper.js";
import { enrichFromWebsite, socialColumns } from "./enrichment.js";
import { browserScrape } from "./browser-scrape.js";
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
    // 20 concurrent harvests + 15 s per-lead budget. The simplified
    // enrichment pipeline tries up to 7 paths in order (home → contact-us
    // → contact → about-us → about → terms-and-conditions → terms) and
    // stops at the first one that yields a real email. Per-fetch timeout
    // is 5 s. Most leads land in 1-3 fetches (~5-10 s); only completely
    // dead sites that won't surface an email anyway hit the 15 s ceiling.
    //   Worst case for 250 leads: 250 × 15 / 20 = ~190 s = ~3 min
    //   Typical case for 250 leads: ~60-90 s
    const HARVEST_CONCURRENCY = 20;
    const PER_LEAD_BUDGET_MS = 15_000;
    // Leads that already yielded an email in the fast HTTP pass — skipped by
    // the browser phase below.
    const emailedLeadIds = new Set<string>();
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
              emailedLeadIds.add(lead.id as string);
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
            // Social profile URLs live on the lead row itself (one set per
            // business), so update there rather than in lead_contacts.
            const socials = socialColumns(enriched.socials);
            if (socials) {
              await supabase
                .from("leads")
                .update(socials)
                .eq("id", lead.id as string)
                .then(
                  () => {},
                  () => {}
                );
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

    // Phase B — bounded headless-browser pass for the leads the HTTP scrape
    // left without an email. JS-rendered sites (premium brands, SPAs) hide
    // their email behind JavaScript, invisible to the HTTP pass; rendering the
    // page surfaces it. TIME-BOXED so a big campaign can't stall generation —
    // whatever isn't reached here, the Email finder tops up later on demand.
    const browserTargets = harvestable.filter(
      ({ lead }) => !emailedLeadIds.has(lead.id as string)
    );
    if (browserTargets.length > 0) {
      const BROWSER_PHASE_BUDGET_MS =
        Number(process.env.SCRAPE_BROWSER_BUDGET_MS) || 120_000;
      const BROWSER_PHASE_CONCURRENCY = 4;
      const PER_LEAD_BROWSER_MS = 30_000;
      const phaseDeadline = Date.now() + BROWSER_PHASE_BUDGET_MS;
      let bCursor = 0;
      let bDone = 0;
      await Promise.all(
        Array.from({ length: BROWSER_PHASE_CONCURRENCY }).map(async () => {
          while (true) {
            if (Date.now() > phaseDeadline) break;
            const i = bCursor++;
            if (i >= browserTargets.length) break;
            const { lead } = browserTargets[i];
            const websiteUrl = lead.website_url as string;
            try {
              const b = await Promise.race([
                browserScrape(websiteUrl, 3),
                new Promise<never>((_, reject) =>
                  setTimeout(
                    () => reject(new Error("browser deadline")),
                    PER_LEAD_BROWSER_MS
                  )
                ),
              ]);
              const sourceUrl = b.sourceUrls[0] ?? websiteUrl;
              // Emails only — phase A already captured this lead's phones from
              // the HTTP pass; re-adding here would duplicate phone rows.
              for (const email of b.emails) {
                contactRows.push({
                  lead_id: lead.id as string,
                  phone: null,
                  email,
                  website_url: websiteUrl,
                  source_url: sourceUrl,
                });
              }
              const socials = socialColumns(b.socials);
              if (socials) {
                await supabase
                  .from("leads")
                  .update(socials)
                  .eq("id", lead.id as string)
                  .then(
                    () => {},
                    () => {}
                  );
              }
            } catch {}
            // Keep the stream alive + bar full while the slow phase runs.
            bDone += 1;
            if (bDone % 3 === 0) {
              onEvent({
                phase: "harvesting",
                count: harvestable.length,
                target: harvestable.length,
              });
            }
          }
        })
      );
    }
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
