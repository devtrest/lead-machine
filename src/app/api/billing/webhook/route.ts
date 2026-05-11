import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  getStripe,
  isStripeConfigured,
  PLAN_CREDIT_GRANT,
} from "@/lib/stripe";
import { sendPlanActivatedEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook handler. Stripe → POST raw bytes → we verify the signature
 * with STRIPE_WEBHOOK_SECRET, then update the user's plan + grant credits +
 * send a confirmation email.
 *
 * To wire this up:
 *   1. In Stripe dashboard: Add endpoint pointing to /api/billing/webhook
 *   2. Set STRIPE_WEBHOOK_SECRET to the signing secret Stripe gives you
 *   3. Set SUPABASE_SERVICE_ROLE_KEY (for admin profile updates that bypass RLS)
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 501 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing webhook signature or STRIPE_WEBHOOK_SECRET" },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      // Lifetime plans = one-time payment. checkout.session.completed is the
      // only signal we need to grant credits + activate the plan.
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      default:
        // Ignore other events.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Webhook needs SUPABASE_SERVICE_ROLE_KEY to update profiles bypassing RLS."
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId =
    (session.metadata?.user_id as string | undefined) ??
    (session.client_reference_id as string | undefined);
  const plan =
    (session.metadata?.plan as string | undefined)?.toLowerCase() ?? null;

  if (!userId || !plan) return;
  await activatePlan({
    userId,
    plan,
    email: session.customer_details?.email ?? session.customer_email ?? null,
  });
}

async function activatePlan({
  userId,
  plan,
  email,
}: {
  userId: string;
  plan: string;
  email: string | null;
}) {
  const supabase = adminClient();
  const credits = PLAN_CREDIT_GRANT[plan] ?? 0;

  const { data: existing } = await supabase
    .from("profiles")
    .select("email,full_name,credits")
    .eq("id", userId)
    .single();

  const nextCredits = (existing?.credits ?? 0) + credits;

  await supabase
    .from("profiles")
    .update({
      plan,
      credits: nextCredits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  const recipient = email ?? existing?.email ?? null;
  if (recipient) {
    await sendPlanActivatedEmail({
      to: recipient,
      fullName: existing?.full_name ?? null,
      plan,
      credits,
    }).catch((err) => console.error("[stripe-webhook] mailer error", err));
  }
}
