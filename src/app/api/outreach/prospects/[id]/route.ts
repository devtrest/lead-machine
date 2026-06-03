import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// PATCH /api/outreach/prospects/[id]
// Body: { status: "replied" | "bounced" }
// Manual override — user marks a prospect as replied/bounced so the tick
// stops sending follow-ups. Automatic reply detection comes in a later
// phase (requires Gmail OAuth + Pub/Sub).
export async function PATCH(req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    status?: "replied" | "bounced" | "pending";
  };
  if (!body.status || !["replied", "bounced", "pending"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // RLS on outreach_prospects scopes via the parent campaign's user_id,
  // so we don't need to manually verify ownership here.
  const patch: Record<string, unknown> = { status: body.status };
  // Resuming → re-schedule for immediate next send.
  if (body.status === "pending") {
    patch.next_send_at = new Date().toISOString();
  } else {
    patch.next_send_at = null;
  }

  const { error } = await supabase
    .from("outreach_prospects")
    .update(patch)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove a prospect from a campaign.
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
    .from("outreach_prospects")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
