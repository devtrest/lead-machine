import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Action =
  | { kind: "credits"; userId: string; delta: number }
  | { kind: "suspend"; userId: string; suspended: boolean }
  | { kind: "delete"; userId: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return error("Unauthorized", 401);

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") return error("Forbidden", 403);

  const body = (await req.json().catch(() => null)) as Partial<Action> | null;
  if (!body || typeof body.userId !== "string" || !body.userId) {
    return error("Invalid payload", 400);
  }

  if (body.userId === user.id && (body.kind === "delete" || body.kind === "suspend")) {
    return error("Cannot suspend or delete yourself", 400);
  }

  if (body.kind === "credits") {
    const delta = Number(body.delta);
    if (!Number.isFinite(delta) || delta === 0) return error("Invalid delta", 400);

    const { data: row, error: readErr } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", body.userId)
      .single();
    if (readErr || !row) return error("User not found", 404);

    const next = Math.max(0, (row.credits ?? 0) + Math.trunc(delta));
    const { error: writeErr } = await supabase
      .from("profiles")
      .update({ credits: next, updated_at: new Date().toISOString() })
      .eq("id", body.userId);
    if (writeErr) return error(writeErr.message, 400);

    return NextResponse.json({ ok: true, credits: next });
  }

  if (body.kind === "suspend") {
    const suspended = Boolean(body.suspended);
    const { error: writeErr } = await supabase
      .from("profiles")
      .update({ suspended, updated_at: new Date().toISOString() })
      .eq("id", body.userId);
    if (writeErr) {
      const msg = writeErr.message.includes("suspended")
        ? "Run supabase/admin_user_actions.sql first to add the suspended column."
        : writeErr.message;
      return error(msg, 400);
    }
    return NextResponse.json({ ok: true, suspended });
  }

  if (body.kind === "delete") {
    const { error: writeErr } = await supabase
      .from("profiles")
      .delete()
      .eq("id", body.userId);
    if (writeErr) {
      const msg = writeErr.message.includes("policy")
        ? "Run supabase/admin_user_actions.sql first to enable admin delete."
        : writeErr.message;
      return error(msg, 400);
    }
    return NextResponse.json({ ok: true });
  }

  return error("Unknown action", 400);
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
