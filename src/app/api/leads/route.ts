import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  const limit = Math.min(80, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));

  let query = supabase
    .from("leads")
    .select(
      "id,name,category,address,rating,review_count,maps_url,website_url,created_at,scan_run_id,lead_contacts(phone,email,source_url)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (runId) {
    query = query.eq("scan_run_id", runId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ leads: data ?? [] });
}
