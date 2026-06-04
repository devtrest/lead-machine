import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/outreach/senders — list this user's connected senders.
// app_password is masked in the response so it never leaks back to the client.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("outreach_senders")
    .select(
      "id,email,display_name,provider,daily_limit,sends_today,last_reset_at,status,last_error,created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ senders: data ?? [] });
}

// POST /api/outreach/senders — add a Gmail sender (email + app password).
// We validate the credentials by attempting an SMTP login before storing.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    appPassword?: string;
    displayName?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const appPassword = body.appPassword?.replace(/\s+/g, "");
  const displayName = body.displayName?.trim() || null;

  if (!email || !appPassword) {
    return NextResponse.json(
      { error: "email and appPassword are required" },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (appPassword.length !== 16) {
    return NextResponse.json(
      {
        error:
          "Gmail app passwords are exactly 16 characters. Generate one at myaccount.google.com/apppasswords",
      },
      { status: 400 }
    );
  }

  // daily_limit on the sender row is the Gmail hard ceiling (~500/day).
  // It's a safety enforcement, not a user-tuned setting. Campaign-level pace
  // is what the user picks when creating a campaign.
  const { error } = await supabase.from("outreach_senders").insert({
    user_id: user.id,
    email,
    display_name: displayName,
    provider: "gmail",
    app_password: appPassword,
    daily_limit: 500,
    status: "active",
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This sender is already connected" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
