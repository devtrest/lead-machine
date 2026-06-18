import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// PATCH /api/scan/runs/[id]
// Body: { action: 'cancel' }
//
// Soft-stops a running scrape by marking it failed with an explanatory error
// message. The worker checks scan_runs.status at the start of every Maps
// batch + before every DB insert; once it sees the row is no longer
// 'running' it bails out cleanly, keeping whatever leads it had already
// inserted. Used for the orange Stop button on the Jobs page.
export async function PATCH(req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "cancel") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { data: run } = await supabase
    .from("scan_runs")
    .select("id,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.status !== "running") {
    return NextResponse.json(
      { error: "Only running scrapes can be cancelled" },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("scan_runs")
    .update({
      status: "failed",
      error: "Cancelled by user",
      finished_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/scan/runs/[id]
//
// Hard-removes the scan_run row. Cascades through the FK chain
// (scan_runs → leads → lead_contacts) so the run AND its leads AND their
// contact rows all go in one shot. If the worker is still mid-write when
// the row disappears, its subsequent UPDATEs/INSERTs against this id
// become no-ops and the worker exits gracefully on the next tick.
export async function DELETE(_req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("scan_runs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
