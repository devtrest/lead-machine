import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  getStripe,
  isStripeConfigured,
  PLAN_CREDIT_GRANT,
  TRIAL_CREDIT_GRANT,
  TRIAL_DURATION_DAYS,
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
      // Lifetime plans = one-time payment OR trial activation.
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      // Auto-charge from the worker's trial-charge job lands here.
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;
      default:
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
  const email =
    session.customer_details?.email ?? session.customer_email ?? null;

  // Trial activation path. $1 charged immediately, 100 credits granted, card
  // stored on customer for the 7-day auto-charge.
  if (session.metadata?.is_trial === "true") {
    const targetPlan =
      (session.metadata?.trial_target_plan as string | undefined)?.toLowerCase() ??
      null;
    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : (session.customer?.id ?? null);
    if (!userId || !targetPlan || !customerId) return;
    await activateTrial({ userId, targetPlan, customerId, email });
    return;
  }

  // Standard one-time plan purchase.
  const plan =
    (session.metadata?.plan as string | undefined)?.toLowerCase() ?? null;
  if (!userId || !plan) return;
  await activatePlan({ userId, plan, email });
}

// Off-session PaymentIntent succeeded — this is the trial auto-conversion
// charge fired by the worker. Metadata carries user_id + plan so we can
// grant the right credits to the right account.
async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const isTrialConversion = pi.metadata?.is_trial_conversion === "true";
  if (!isTrialConversion) return;
  const userId = pi.metadata?.user_id as string | undefined;
  const plan = (pi.metadata?.plan as string | undefined)?.toLowerCase() ?? null;
  if (!userId || !plan) return;

  const supabase = adminClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("email,full_name,credits")
    .eq("id", userId)
    .single();

  const credits = PLAN_CREDIT_GRANT[plan] ?? 0;
  const nextCredits = (existing?.credits ?? 0) + credits;

  await supabase
    .from("profiles")
    .update({
      plan,
      credits: nextCredits,
      trial_status: "converted",
      trial_last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (existing?.email) {
    await sendPlanActivatedEmail({
      to: existing.email,
      fullName: existing.full_name ?? null,
      plan,
      credits,
    }).catch((err) => console.error("[stripe-webhook] mailer error", err));
  }
}

async function activateTrial({
  userId,
  targetPlan,
  customerId,
  email,
}: {
  userId: string;
  targetPlan: string;
  customerId: string;
  email: string | null;
}) {
  const supabase = adminClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  const nextCredits = (existing?.credits ?? 0) + TRIAL_CREDIT_GRANT;
  const startedAt = new Date();
  const endsAt = new Date(
    startedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
  );

  await supabase
    .from("profiles")
    .update({
      // Don't change `plan` yet — they're on a trial, not the full plan.
      // Set it on conversion.
      credits: nextCredits,
      stripe_customer_id: customerId,
      trial_started_at: startedAt.toISOString(),
      trial_ends_at: endsAt.toISOString(),
      trial_target_plan: targetPlan,
      trial_status: "active",
      trial_last_error: null,
      updated_at: startedAt.toISOString(),
    })
    .eq("id", userId);

  if (email) {
    // Reuse the activation mailer with a trial label — keeps email infra simple.
    await sendPlanActivatedEmail({
      to: email,
      fullName: null,
      plan: `Trial (auto-upgrades to ${targetPlan})`,
      credits: TRIAL_CREDIT_GRANT,
    }).catch((err) => console.error("[stripe-webhook] trial mailer error", err));
  }
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
