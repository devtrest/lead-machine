// Re-enrichment job — re-runs the email-harvest pipeline against an existing
// set of leads without re-scraping Google Places. Used when the user's
// original scrape captured fewer emails than the current enrichment code is
// capable of finding (e.g. they ran under an older code version, or the
// worker was overloaded the first time around).
//
// Behavior:
//   - Loads every lead for a given scan_run_id that has a website_url.
//   - Skips leads that already have at least one email row in lead_contacts
//     (no point burning fetches if we already got one — the user wants the
//     NO-email leads filled in).
//   - Runs the same enrichFromWebsite pipeline scrape-job uses, with the
//     same HARVEST_CONCURRENCY + per-lead deadline.
//   - Inserts any new emails into lead_contacts. Phones are re-harvested
//     too but inserted only when a row doesn't already cover them
//     (lead_contacts has no unique constraint, so we de-dupe in code).
//   - Does NOT charge credits — the lead was already paid for at scrape
//     time.

import { supabase } from "./db.js";
import { enrichFromWebsite } from "./enrichment.js";

export type ReenrichResult = {
  attempted: number;
  newEmails: number;
  newPhones: number;
  skipped: number; // already had an email
};

const HARVEST_CONCURRENCY = 20;
const PER_LEAD_BUDGET_MS = 8_000;

export async function runReenrich(
  scanRunId: string,
  userId: string
): Promise<ReenrichResult> {
  // Load every lead in the run + its existing contacts so we can decide
  // which ones to re-harvest.
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id,website_url,lead_contacts(email,phone)")
    .eq("scan_run_id", scanRunId)
    .eq("user_id", userId);

  if (error) {
    console.error("[reenrich] fetch leads failed:", error);
    return { attempted: 0, newEmails: 0, newPhones: 0, skipped: 0 };
  }

  type Row = {
    id: string;
    website_url: string | null;
    lead_contacts: { email: string | null; phone: string | null }[];
  };
  const candidates = ((leads ?? []) as Row[]).filter(
    (l) => Boolean(l.website_url)
  );

  let newEmails = 0;
  let newPhones = 0;
  let attempted = 0;
  let skipped = 0;

  // De-dupe: skip leads that already have ANY email row (the goal is to
  // fill in the no-email leads, not to re-spam DB with duplicates).
  const targets = candidates.filter((l) => {
    const hasEmail = (l.lead_contacts ?? []).some((c) => Boolean(c.email));
    if (hasEmail) {
      skipped += 1;
      return false;
    }
    return true;
  });

  if (targets.length === 0) {
    return { attempted: 0, newEmails: 0, newPhones: 0, skipped };
  }

  console.log(
    `[reenrich] scan_run=${scanRunId} re-harvesting ${targets.length} leads (${skipped} already had emails)`
  );

  let cursor = 0;
  await Promise.all(
    Array.from({ length: HARVEST_CONCURRENCY }).map(async () => {
      while (true) {
        const i = cursor++;
        if (i >= targets.length) break;
        const lead = targets[i];
        const websiteUrl = lead.website_url as string;
        attempted += 1;

        try {
          const enriched = await Promise.race([
            enrichFromWebsite(websiteUrl, 3),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("re-enrich deadline")),
                PER_LEAD_BUDGET_MS
              )
            ),
          ]);

          const sourceUrl = enriched.sourceUrls[0] ?? websiteUrl;
          const existingPhones = new Set(
            (lead.lead_contacts ?? [])
              .map((c) => c.phone)
              .filter((v): v is string => Boolean(v))
          );

          const newRows: Array<{
            lead_id: string;
            phone: string | null;
            email: string | null;
            website_url: string | null;
            source_url: string | null;
          }> = [];

          for (const email of enriched.emails) {
            newRows.push({
              lead_id: lead.id,
              phone: null,
              email,
              website_url: websiteUrl,
              source_url: sourceUrl,
            });
            newEmails += 1;
          }

          for (const phone of enriched.phones) {
            if (existingPhones.has(phone)) continue;
            newRows.push({
              lead_id: lead.id,
              phone,
              email: null,
              website_url: websiteUrl,
              source_url: sourceUrl,
            });
            newPhones += 1;
          }

          if (newRows.length > 0) {
            const { error: insErr } = await supabase
              .from("lead_contacts")
              .insert(newRows);
            if (insErr) {
              console.warn(
                `[reenrich] insert failed for ${lead.id}:`,
                insErr.message
              );
            }
          }
        } catch {
          /* per-lead deadline / network error — silent, move on */
        }
      }
    })
  );

  console.log(
    `[reenrich] scan_run=${scanRunId} done — attempted:${attempted} +${newEmails} emails +${newPhones} phones (skipped:${skipped})`
  );

  return { attempted, newEmails, newPhones, skipped };
}
