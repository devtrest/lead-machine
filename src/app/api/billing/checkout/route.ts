import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getStripe,
  isStripeConfigured,
  PLAN_TO_STRIPE_PRICE,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured. Set STRIPE_SECRET_KEY (and STRIPE_PRICE_* env vars) to enable checkout.",
      },
      { status: 501 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const plan = (body?.plan as string | undefined)?.toLowerCase();
  if (!plan || !["starter", "premium", "pro"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = PLAN_TO_STRIPE_PRICE[plan];
  if (!priceId) {
    return NextResponse.json(
      {
        error: `No Stripe price configured for ${plan}. Set STRIPE_PRICE_${plan.toUpperCase()} in your env.`,
      },
      { status: 400 }
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
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan },
      payment_intent_data: {
        metadata: { user_id: user.id, plan },
      },
      success_url: `${origin}/user?upgraded=${plan}`,
      cancel_url: `${origin}/user/billing?cancelled=1`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
