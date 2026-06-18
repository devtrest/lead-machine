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
  // Previously this was Math.min(80, ...) which silently clipped every
  // request to 80 rows — even when the frontend asked for limit=2000 for
  // a 250-lead campaign view. That made the UI show "80 of 80 leads" for
  // a campaign that actually had 250 in the DB and looked like a bug to
  // every user. Cap is now 5,000 (Postgres can comfortably stream that
  // amount in one response; bigger campaigns paginate from the client).
  const limit = Math.min(
    5_000,
    Math.max(1, Number(url.searchParams.get("limit") ?? 20))
  );

  let query = supabase
    .from("leads")
    .select(
      "id,name,category,address,rating,review_count,maps_url,website_url,created_at,scan_run_id,lead_contacts(phone,email,source_url)",
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (runId) {
    query = query.eq("scan_run_id", runId);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Also return the true total so the UI can show "Showing X of Y" instead
  // of having to infer it from data.length (which is wrong as soon as the
  // request hits the cap).
  return NextResponse.json({ leads: data ?? [], total: count ?? data?.length ?? 0 });
}
