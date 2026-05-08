import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const target = body?.userId as string | undefined;
  const delta = Number(body?.delta);

  if (!target || !Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: row, error: readErr } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", target)
    .single();

  if (readErr || row == null) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const nextCredits = Math.max(0, (row.credits ?? 0) + Math.trunc(delta));

  const { error: writeErr } = await supabase
    .from("profiles")
    .update({ credits: nextCredits, updated_at: new Date().toISOString() })
    .eq("id", target);

  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, credits: nextCredits });
}
