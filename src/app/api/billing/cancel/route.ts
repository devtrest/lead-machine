import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST /api/billing/cancel   Body: { resume?: boolean }
// Schedules cancellation at the end of the current period (access stays until
// then), or resumes a previously-scheduled cancellation when resume=true.
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 501 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const resume = body?.resume === true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();
  const subId = (profile as { stripe_subscription_id?: string } | null)
    ?.stripe_subscription_id;
  if (!subId) {
    return NextResponse.json(
      { error: "No subscription to update." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    await stripe.subscriptions.update(subId, {
      cancel_at_period_end: !resume,
    });
    // Optimistic mirror — the subscription.updated webhook will reconcile.
    await supabase
      .from("profiles")
      .update({ cancel_at_period_end: !resume, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    return NextResponse.json({ ok: true, cancel_at_period_end: !resume });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
