import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { harvestRunInProcess } from "@/lib/reenrich-inprocess";

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
    const result = await harvestRunInProcess(supabase, id, user.id);
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
