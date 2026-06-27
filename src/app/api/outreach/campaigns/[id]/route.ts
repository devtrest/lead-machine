import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// PATCH — rename + status transitions (draft → active, active → paused, etc).
// Status transitions are validated server-side.
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
    name?: string;
    status?: "draft" | "active" | "paused";
    dailyLimit?: number;
    timezone?: string;
    sendDays?: string[];
    sendWindowStart?: string;
    sendWindowEnd?: string;
  };

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim();
  }
  if (body.status) {
    if (!["draft", "active", "paused"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
    if (body.status === "active") {
      patch.started_at = new Date().toISOString();
    }
  }

  // ---- Schedule edits (all optional; each validated independently) ----
  if (body.dailyLimit !== undefined) {
    patch.daily_limit = Math.max(
      1,
      Math.min(500, Math.floor(Number(body.dailyLimit) || 50))
    );
  }
  if (typeof body.timezone === "string" && body.timezone.trim()) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timezone });
      patch.timezone = body.timezone;
    } catch {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }
  }
  if (Array.isArray(body.sendDays)) {
    const VALID_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const days = VALID_DAYS.filter((d) => body.sendDays!.includes(d));
    if (days.length === 0) {
      return NextResponse.json(
        { error: "Pick at least one send day" },
        { status: 400 }
      );
    }
    patch.send_days = days;
  }
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (typeof body.sendWindowStart === "string") {
    if (!HHMM.test(body.sendWindowStart)) {
      return NextResponse.json(
        { error: "Invalid send window start time" },
        { status: 400 }
      );
    }
    patch.send_window_start = body.sendWindowStart;
  }
  if (typeof body.sendWindowEnd === "string") {
    if (!HHMM.test(body.sendWindowEnd)) {
      return NextResponse.json(
        { error: "Invalid send window end time" },
        { status: 400 }
      );
    }
    patch.send_window_end = body.sendWindowEnd;
  }
  // If both window bounds are being set, enforce start < end.
  if (
    typeof patch.send_window_start === "string" &&
    typeof patch.send_window_end === "string" &&
    (patch.send_window_start as string) >= (patch.send_window_end as string)
  ) {
    return NextResponse.json(
      { error: "Send window end must be after start" },
      { status: 400 }
    );
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("outreach_campaigns")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE — cascade removes steps + prospects via FK ON DELETE CASCADE.
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
    .from("outreach_campaigns")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
