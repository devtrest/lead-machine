import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichFromWebsite } from "@/lib/lead-enrichment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type Params = Promise<{ id: string }>;

// POST /api/scan/runs/[id]/reenrich
//
// Asks the email-harvest pipeline to re-run against every lead in this
// scan_run that doesn't already have an email. The user pays NO credits —
// the lead was charged at scrape time, this is just retrying the enrichment
// with the current code. Useful when the campaign was scraped under an
// older / slower enrichment version and the email coverage was low.
//
// Two execution paths, mirroring /api/google-maps-search:
//   - Worker set (production): POST to /scrape/reenrich and wait. The worker
//     harvests with a ~25s budget and returns how many new emails it found,
//     plus a `remaining` count if the list was too big to finish in one go.
//   - No worker (local dev): run the harvest in-process and return counts.
// Either way the response carries the real counts so the UI can tell the
// user exactly what happened instead of leaving them guessing.
export async function POST(_req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the user owns this run before doing any work — keeps the endpoint
  // from being abused as a re-enrich oracle on someone else's scan_run by
  // guessing UUIDs.
  const { data: run } = await supabase
    .from("scan_runs")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const workerUrl = process.env.WORKER_URL?.trim();
  const workerToken = process.env.WORKER_TOKEN?.trim();

  // Production path — hand off to the Railway worker (cleaner IPs, no Vercel
  // function-duration ceiling, dedicated concurrency budget).
  if (workerUrl && workerToken) {
    try {
      const res = await fetch(
        `${workerUrl.replace(/\/$/, "")}/scrape/reenrich`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${workerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scanRunId: id, userId: user.id }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        attempted?: number;
        newEmails?: number;
        newPhones?: number;
        skipped?: number;
        remaining?: number;
      };
      if (!res.ok || !json.ok) {
        return NextResponse.json(
          { error: json.error ?? `Worker returned ${res.status}` },
          { status: 502 }
        );
      }
      // The worker now runs synchronously and returns counts — pass them
      // straight through so the UI can report exactly what was found.
      return NextResponse.json({
        ok: true,
        queued: false,
        attempted: json.attempted ?? 0,
        newEmails: json.newEmails ?? 0,
        newPhones: json.newPhones ?? 0,
        skipped: json.skipped ?? 0,
        remaining: json.remaining ?? 0,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Couldn't reach the re-enrich worker",
        },
        { status: 502 }
      );
    }
  }

  // Dev / no-worker path — harvest in-process and return the counts.
  try {
    const result = await runInProcessReenrich(supabase, id, user.id);
    return NextResponse.json({ ok: true, queued: false, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Re-enrichment failed",
      },
      { status: 500 }
    );
  }
}

type ReenrichResult = {
  attempted: number;
  newEmails: number;
  newPhones: number;
  skipped: number;
  remaining: number;
};

// In-process mirror of the worker's runReenrich (worker/src/reenrich-job.ts):
// load every lead in the run with a website, skip the ones that already have
// an email, and re-run enrichFromWebsite over the rest — inserting any new
// emails/phones into lead_contacts. No credits are charged.
async function runInProcessReenrich(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scanRunId: string,
  userId: string
): Promise<ReenrichResult> {
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
  let attempted = 0;

  if (targets.length === 0) {
    return { attempted, newEmails, newPhones, skipped, remaining: 0 };
  }

  // Bounded concurrency so a big run doesn't open hundreds of sockets at once.
  const HARVEST_CONCURRENCY = 10;
  // 18s so the Apollo Layer-2 fallback (which runs only after the 7-page walk
  // fails) actually gets reached on slow sites — see worker/src/reenrich-job.ts.
  const PER_LEAD_BUDGET_MS = 18_000;
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
        }
      }
    })
  );

  return { attempted, newEmails, newPhones, skipped, remaining: 0 };
}
