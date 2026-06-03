import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/outreach/campaigns — list user's campaigns
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("outreach_campaigns")
    .select(
      "id,name,status,scan_run_id,created_at,started_at,finished_at,scan_runs(keyword,location)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ campaigns: data ?? [] });
}

// POST /api/outreach/campaigns — create a new draft campaign
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    scanRunId?: string;
  };
  const name = body.name?.trim();
  const scanRunId = body.scanRunId?.trim();

  if (!name || !scanRunId) {
    return NextResponse.json(
      { error: "name and scanRunId are required" },
      { status: 400 }
    );
  }

  // Verify scan_run belongs to caller.
  const { data: run } = await supabase
    .from("scan_runs")
    .select("id")
    .eq("id", scanRunId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!run) {
    return NextResponse.json(
      { error: "Source campaign not found" },
      { status: 404 }
    );
  }

  const { data, error } = await supabase
    .from("outreach_campaigns")
    .insert({
      user_id: user.id,
      scan_run_id: scanRunId,
      name,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 400 }
    );
  }

  return NextResponse.json({ id: data.id });
}
