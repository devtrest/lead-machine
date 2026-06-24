import type { createClient } from "@/lib/supabase/server";
import { enrichFromWebsite } from "@/lib/lead-enrichment";

// Shared in-process re-enrichment harvest (no worker). Used by both the JSON
// route (dev fallback) and the SSE stream route. Mirrors the worker's
// runReenrich: load every lead in the run with a website, skip the ones that
// already have an email, and re-run enrichFromWebsite over the rest —
// inserting any new emails/phones into lead_contacts. No credits charged.

export type ReenrichProgress = {
  done: number;
  total: number;
  newEmails: number;
  // The site that just finished crawling + the email it yielded (if any).
  // Absent on the initial frame.
  url?: string;
  email?: string | null;
};

export type ReenrichResult = {
  attempted: number;
  newEmails: number;
  newPhones: number;
  skipped: number;
  remaining: number;
};

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export async function harvestRunInProcess(
  supabase: SupabaseServer,
  scanRunId: string,
  userId: string,
  opts?: {
    concurrency?: number;
    perLeadBudgetMs?: number;
    onProgress?: (p: ReenrichProgress) => void;
  }
): Promise<ReenrichResult> {
  // 18s so the Apollo Layer-2 fallback (which runs only after the 7-page walk
  // fails) actually gets reached on slow sites — matches the worker.
  const PER_LEAD_BUDGET_MS = opts?.perLeadBudgetMs ?? 18_000;
  const HARVEST_CONCURRENCY = opts?.concurrency ?? 10;
  const onProgress = opts?.onProgress;

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id,website_url,lead_contacts(email,phone)")
    .eq("scan_run_id", scanRunId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    website_url: string | null;
    lead_contacts: { email: string | null; phone: string | null }[] | null;
  };

  let skipped = 0;
  const targets = ((leads ?? []) as Row[])
    .filter((l) => Boolean(l.website_url))
    .filter((l) => {
      const hasEmail = (l.lead_contacts ?? []).some((c) => Boolean(c.email));
      if (hasEmail) {
        skipped += 1;
        return false;
      }
      return true;
    });

  let newEmails = 0;
  let newPhones = 0;
  let completed = 0;

  // Emit an initial frame so the UI can size its progress bar immediately.
  onProgress?.({ done: 0, total: targets.length, newEmails: 0 });

  if (targets.length === 0) {
    return { attempted: 0, newEmails, newPhones, skipped, remaining: 0 };
  }

  let cursor = 0;
  await Promise.all(
    Array.from({ length: HARVEST_CONCURRENCY }).map(async () => {
      while (true) {
        const i = cursor++;
        if (i >= targets.length) break;
        const lead = targets[i];
        const websiteUrl = lead.website_url as string;
        let leadEmail: string | null = null;

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

          const rows: Array<{
            lead_id: string;
            phone: string | null;
            email: string | null;
            website_url: string | null;
            source_url: string | null;
          }> = [];

          for (const email of enriched.emails) {
            rows.push({
              lead_id: lead.id,
              phone: null,
              email,
              website_url: websiteUrl,
              source_url: sourceUrl,
            });
            newEmails += 1;
            if (!leadEmail) leadEmail = email;
          }
          for (const phone of enriched.phones) {
            if (existingPhones.has(phone)) continue;
            rows.push({
              lead_id: lead.id,
              phone,
              email: null,
              website_url: websiteUrl,
              source_url: sourceUrl,
            });
            newPhones += 1;
          }

          if (rows.length > 0) {
            await supabase.from("lead_contacts").insert(rows);
          }
        } catch {
          /* per-lead deadline / network error — best-effort, move on */
        } finally {
          completed += 1;
          onProgress?.({
            done: completed,
            total: targets.length,
            newEmails,
            url: websiteUrl,
            email: leadEmail,
          });
        }
      }
    })
  );

  return {
    attempted: completed,
    newEmails,
    newPhones,
    skipped,
    remaining: Math.max(0, targets.length - completed),
  };
}
