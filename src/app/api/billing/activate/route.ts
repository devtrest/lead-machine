import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST /api/billing/activate
// Ends the 3-day trial immediately. Stripe invoices + charges the plan now;
// the invoice.paid webhook grants the monthly credits and flips status to
// active. Used by the "Activate now" button (e.g. once trial credits run out).
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 501 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id,subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  const subId = (profile as { stripe_subscription_id?: string } | null)
    ?.stripe_subscription_id;
  if (!subId) {
    return NextResponse.json(
      { error: "No active trial subscription to activate." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    // Ending the trial now triggers an immediate invoice + charge.
    await stripe.subscriptions.update(subId, { trial_end: "now" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Activation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
