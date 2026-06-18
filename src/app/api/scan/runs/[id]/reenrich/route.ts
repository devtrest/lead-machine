import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// POST /api/scan/runs/[id]/reenrich
//
// Asks the worker to re-run the email-harvest pipeline against every lead
// in this scan_run that doesn't already have an email. The user pays NO
// credits — the lead was charged at scrape time, this is just retrying the
// enrichment with the current code. Useful when the campaign was scraped
// under an older / slower enrichment version and the email coverage was
// suspiciously low.
//
// Fire-and-forget — the worker acknowledges fast and runs the actual harvest
// in the background. The user refreshes the leads page after a minute or
// two to see new emails fill in.
export async function POST(_req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the user owns this run before sending the worker request — keeps
  // the worker endpoint from being abused as a re-enrich oracle on someone
  // else's scan_run by guessing UUIDs.
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
  if (!workerUrl || !workerToken) {
    return NextResponse.json(
      { error: "Worker is not configured for re-enrichment" },
      { status: 503 }
    );
  }

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
    };
    if (!res.ok || !json.ok) {
      return NextResponse.json(
        { error: json.error ?? `Worker returned ${res.status}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, queued: true });
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
