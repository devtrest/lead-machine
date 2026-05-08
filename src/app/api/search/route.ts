import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocodeLocation, searchPlaces } from "@/lib/osm";

function limitForPlan(plan: string | null | undefined) {
  switch (plan) {
    case "premium":
      return 20;
    case "pro":
      return 35;
    case "enterprise":
      return 80;
    default:
      return 8;
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const keyword =
    typeof body?.keyword === "string" ? body.keyword.trim() : "";
  const location =
    typeof body?.location === "string" ? body.location.trim() : "";

  if (keyword.length < 2 || location.length < 2) {
    return NextResponse.json(
      { error: "Keyword and location required" },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan,credits")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Profile unavailable — finish Supabase setup." },
      { status: 400 }
    );
  }

  const plan = profile.plan as string;
  const limit = limitForPlan(plan);

  if (plan !== "enterprise") {
    const { data: consumed, error: rpcError } = await supabase.rpc(
      "consume_search_credit"
    );

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }
    if (!consumed) {
      return NextResponse.json(
        { error: "Credits depleted · upgrade or buy refill." },
        { status: 402 }
      );
    }
  }

  const geo = await geocodeLocation(location);
  if (!geo) {
    return NextResponse.json(
      { error: "Unable to anchor that location yet." },
      { status: 404 }
    );
  }

  const results = await searchPlaces(keyword, geo.lat, geo.lon, limit);

  return NextResponse.json({
    anchor: geo.displayName,
    lat: geo.lat,
    lon: geo.lon,
    limit,
    results,
  });
}
