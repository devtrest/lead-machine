import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/credits — current credit balance for the authed user. Used by the
// topbar/sidebar to keep the balance live (no manual refresh) as scrapes
// reserve credits and refund the unused portion.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ credits: 0 }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({ credits: (data?.credits as number | undefined) ?? 0 });
}
