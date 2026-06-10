import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getStripe,
  isStripeConfigured,
  TRIAL_PRICE_CENTS,
  TRIAL_DURATION_DAYS,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST /api/billing/trial
// Body: { targetPlan: 'starter' | 'premium' | 'pro' }
//
// Starts a $1 / 3-day trial that grants 100 credits immediately and saves
// the card off-session. After 3 days the worker's trial-charge job creates
// a PaymentIntent against the saved card for the selected target plan, and
// the regular payment_intent.succeeded webhook grants the full credits.
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 501 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const targetPlan = (body?.targetPlan as string | undefined)?.toLowerCase();
  if (!targetPlan || !["starter", "premium", "pro"].includes(targetPlan)) {
    return NextResponse.json(
      { error: "Pick a plan to upgrade to after the trial" },
      { status: 400 }
    );
  }

  // One trial per user. If they've already activated/converted/failed a
  // trial, the front-end shouldn't show the option, but defend the API too.
  const { data: profile } = await supabase
    .from("profiles")
    .select("trial_status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.trial_status === "active") {
    return NextResponse.json(
      { error: "You already have an active trial" },
      { status: 409 }
    );
  }
  if (profile?.trial_status === "converted") {
    return NextResponse.json(
      { error: "Your trial has already been converted to a paid plan" },
      { status: 409 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    req.headers.get("origin") ||
    "http://localhost:3001";

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Inline price so we don't need a Stripe Product for the $1 charge.
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: TRIAL_PRICE_CENTS,
            product_data: {
              name: "Lead Machine — 3-day trial",
              description: `100 credits for 3 days. Auto-upgrades to your ${capitalize(
                targetPlan
              )} plan after the trial unless cancelled.`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: user.email ?? undefined,
      // Always create a Customer object so we can later charge them
      // off-session for the plan conversion.
      customer_creation: "always",
      // The payment_intent_data.setup_future_usage saves the card to the
      // Customer for later off-session use — without it we can't auto-charge.
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: {
          user_id: user.id,
          is_trial: "true",
          trial_target_plan: targetPlan,
          trial_duration_days: String(TRIAL_DURATION_DAYS),
        },
      },
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        is_trial: "true",
        trial_target_plan: targetPlan,
        trial_duration_days: String(TRIAL_DURATION_DAYS),
      },
      success_url: `${origin}/user?trial=started`,
      cancel_url: `${origin}/user/billing?cancelled=1`,
      allow_promotion_codes: false,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
