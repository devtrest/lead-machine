import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// PATCH /api/outreach/senders/[id] — pause/resume, update daily_limit, rename.
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
    status?: "active" | "paused";
    daily_limit?: number;
    display_name?: string;
  };

  const patch: Record<string, unknown> = {};
  if (body.status && ["active", "paused"].includes(body.status)) {
    patch.status = body.status;
  }
  if (typeof body.daily_limit === "number") {
    patch.daily_limit = Math.max(1, Math.min(500, Math.floor(body.daily_limit)));
  }
  if (typeof body.display_name === "string") {
    patch.display_name = body.display_name.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("outreach_senders")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/outreach/senders/[id] — disconnect sender. Cascades to remove
// it from campaign sender lists; campaigns with no remaining senders will
// log a warning on next tick but won't crash.
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
    .from("outreach_senders")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
