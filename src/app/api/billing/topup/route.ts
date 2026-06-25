import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured, TOPUP_PACKS } from "@/lib/stripe";
import { grantTopupCredits } from "@/lib/billing-grant";

export const dynamic = "force-dynamic";

// POST /api/billing/topup   Body: { packId: 'pack_1500' | 'pack_3000' | 'pack_7000' }
// One-time purchase of a credit pack. Credits never expire and are used first.
//
// Two paths:
//   - CARD ON FILE  -> charge the saved card off-session (PaymentIntent,
//     confirm: true) and grant credits immediately. Returns { granted, balance }
//     so the UI can just confirm in a popup — no redirect, no re-entering card.
//   - NO CARD / charge needs action -> fall back to a hosted Checkout Session
//     (the checkout.session.completed webhook then grants the credits).
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

  const stripe = getStripe();

  // --- Fast path: charge the card already on file, off-session. ---
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  const customerId = (profile as { stripe_customer_id?: string } | null)
    ?.stripe_customer_id;

  if (customerId) {
    try {
      // Prefer the customer's default payment method, else their newest card.
      const customer = (await stripe.customers.retrieve(
        customerId
      )) as Stripe.Customer;
      let pmId =
        (customer.invoice_settings?.default_payment_method as string | null) ??
        null;
      if (!pmId) {
        const pms = await stripe.paymentMethods.list({
          customer: customerId,
          type: "card",
          limit: 1,
        });
        pmId = pms.data[0]?.id ?? null;
      }

      if (pmId) {
        const pi = await stripe.paymentIntents.create({
          amount: pack.priceCents,
          currency: "usd",
          customer: customerId,
          payment_method: pmId,
          off_session: true,
          confirm: true,
          description: `Lead Machine — ${pack.credits.toLocaleString()} credit top-up`,
          metadata: {
            user_id: user.id,
            is_topup: "true",
            credits: String(pack.credits),
          },
        });

        if (pi.status === "succeeded") {
          const balance = await grantTopupCredits({
            userId: user.id,
            credits: pack.credits,
            paymentIntentId: pi.id,
            note: `Top-up pack (${pack.credits.toLocaleString()} credits)`,
          });
          return NextResponse.json({
            ok: true,
            granted: true,
            creditsAdded: pack.credits,
            balance,
          });
        }
        // requires_action / processing — fall through to hosted Checkout so the
        // user can complete 3-D Secure or update the card.
      }
    } catch (err) {
      // Card declined / authentication required / API error — don't hard-fail;
      // fall back to Checkout so the user can fix it there.
      console.warn(
        "[topup] off-session charge failed, falling back to Checkout:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // --- Fallback: hosted Checkout (no saved card, or off-session needs action). ---
  try {
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
      ...(customerId
        ? { customer: customerId }
        : { customer_email: user.email ?? undefined }),
      client_reference_id: user.id,
      payment_intent_data: {
        description: `Lead Machine — ${pack.credits.toLocaleString()} credit top-up`,
      },
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
