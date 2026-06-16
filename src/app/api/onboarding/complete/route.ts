import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/onboarding/complete  Body: { answers: Record<string, string> }
// Saves the onboarding questionnaire answers and flips the gate so the user
// can reach the dashboard. `onboarded`/`onboarding_answers` are not locked by
// the profile column-lock trigger, so the user can update them directly.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const answers =
    body && typeof body.answers === "object" ? body.answers : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_answers: answers,
      onboarded: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
