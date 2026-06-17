import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  getStripe,
  isStripeConfigured,
  PAID_PLANS,
  PLAN_TO_STRIPE_PRICE,
  PLAN_CREDIT_GRANT,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST /api/billing/switch   Body: { plan: 'starter' | 'premium' | 'pro' }
// Switches the active subscription to a different plan. Applies to the next
// charge (no immediate proration), matching the UI copy. The new tier's
// monthly credits land on the next invoice.paid.
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
  const plan = (body?.plan as string | undefined)?.toLowerCase();
  if (!plan || !(PAID_PLANS as readonly string[]).includes(plan)) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }
  const priceId = PLAN_TO_STRIPE_PRICE[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for "${plan}".` },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();
  const subId = (profile as { stripe_subscription_id?: string } | null)
    ?.stripe_subscription_id;
  if (!subId) {
    return NextResponse.json(
      { error: "No active subscription to switch." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subId);
    const itemId = sub.items?.data?.[0]?.id;
    if (!itemId) {
      return NextResponse.json({ error: "Subscription item not found." }, { status: 400 });
    }
    await stripe.subscriptions.update(subId, {
      items: [{ id: itemId, price: priceId }],
      // Apply at next renewal — don't prorate/charge mid-cycle.
      proration_behavior: "none",
      metadata: { ...(sub.metadata ?? {}), plan },
    });

    // Optimistically reflect the new plan (service role bypasses the
    // plan-lock trigger). Credits for the new tier arrive on the next invoice.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey) {
      const admin = createAdmin(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await admin
        .from("profiles")
        .update({
          plan,
          monthly_credit_grant: PLAN_CREDIT_GRANT[plan] ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Switch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
