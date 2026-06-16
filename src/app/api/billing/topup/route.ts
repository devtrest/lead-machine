import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured, TOPUP_PACKS } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST /api/billing/topup   Body: { packId: 'pack_1000' | 'pack_2000' | 'pack_5000' }
// One-time purchase of a credit pack. Credits never expire and are used first.
// The checkout.session.completed webhook (is_topup) grants the credits.
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 501 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const packId = body?.packId as string | undefined;
  const pack = TOPUP_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return NextResponse.json({ error: "Unknown credit pack" }, { status: 400 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    req.headers.get("origin") ||
    "http://localhost:3001";

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: pack.priceCents,
            product_data: {
              name: `Lead Machine — ${pack.credits.toLocaleString()} credits`,
              description: "One-time top-up. Credits never expire.",
            },
          },
          quantity: 1,
        },
      ],
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        is_topup: "true",
        credits: String(pack.credits),
      },
      success_url: `${origin}/user/billing?topup=success`,
      cancel_url: `${origin}/user/billing?cancelled=1`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
