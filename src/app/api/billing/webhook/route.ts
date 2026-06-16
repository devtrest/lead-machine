import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getStripe,
  isStripeConfigured,
  PLAN_CREDIT_GRANT,
  PLAN_TO_STRIPE_PRICE,
  planForPriceId,
  TRIAL_CREDIT_GRANT,
  TRIAL_DURATION_DAYS,
} from "@/lib/stripe";
import { sendPlanActivatedEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook — the single source of truth for credits + subscription
 * state. Native subscription model:
 *   - $1 trial checkout (mode: payment, saves card)  -> we create a Stripe
 *     Subscription with a 3-day trial against the saved card.
 *   - Stripe auto-charges the plan when the trial ends, then monthly.
 *   - Each PAID invoice -> grant that plan's monthly credits (they roll over).
 *   - subscription.updated/deleted -> mirror status/period/cancel into profiles.
 *   - one-time "top up" checkouts -> add credits immediately.
 *
 * Wire-up: Stripe dashboard endpoint -> /api/billing/webhook, send at least
 * checkout.session.completed, invoice.paid, customer.subscription.updated,
 * customer.subscription.deleted. Set STRIPE_WEBHOOK_SECRET + SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
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
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      // Legacy: off-session trial-charge PaymentIntent from the worker.
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook]", event.type, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

function adminClient(): SupabaseClient {
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

/** Period end can live on the subscription or (newer API) on its items. */
function subPeriodEnd(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as { current_period_end?: number };
  const fromSub = s.current_period_end;
  const fromItem = (
    sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
  )?.current_period_end;
  const unix = fromSub ?? fromItem ?? null;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

function subPlanSlug(sub: Stripe.Subscription): string | null {
  const priceId = sub.items?.data?.[0]?.price?.id;
  return priceId ? planForPriceId(priceId) : null;
}

async function userByCustomer(
  supabase: SupabaseClient,
  customerId: string | null
): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId =
    (session.metadata?.user_id as string | undefined) ??
    (session.client_reference_id as string | undefined);
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  // 1) Trial → create the real subscription with a 3-day trial.
  if (session.metadata?.is_trial === "true") {
    const targetPlan =
      (session.metadata?.trial_target_plan as string | undefined)?.toLowerCase() ??
      null;
    if (!userId || !targetPlan || !customerId) return;
    await startTrialSubscription({ userId, targetPlan, customerId, email });
    return;
  }

  // 2) One-time top-up pack → add credits now.
  if (session.metadata?.is_topup === "true") {
    const credits = Number(session.metadata?.credits ?? 0);
    const pi =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    if (!userId || !credits) return;
    await grantCredits({
      userId,
      amount: credits,
      kind: "topup",
      stripePaymentIntentId: pi,
      note: `Top-up pack (${credits.toLocaleString()} credits)`,
    });
    return;
  }

  // 3) Legacy one-time plan purchase.
  const plan = (session.metadata?.plan as string | undefined)?.toLowerCase() ?? null;
  if (!userId || !plan) return;
  await grantCredits({
    userId,
    amount: PLAN_CREDIT_GRANT[plan] ?? 0,
    kind: "manual",
    note: `One-time ${plan} purchase`,
    setPlan: plan,
    email,
  });
}

async function startTrialSubscription({
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
  const stripe = getStripe();

  const startedAt = new Date();
  const endsAt = new Date(
    startedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
  );

  // Grant the small trial allotment immediately + record it.
  await grantCredits({
    userId,
    amount: TRIAL_CREDIT_GRANT,
    kind: "trial",
    note: `${TRIAL_DURATION_DAYS}-day trial allotment`,
  });

  // Base trial state — set even if we can't create the sub (e.g. price not
  // configured yet) so the user still gets trial access.
  const baseUpdate: Record<string, unknown> = {
    stripe_customer_id: customerId,
    trial_started_at: startedAt.toISOString(),
    trial_ends_at: endsAt.toISOString(),
    trial_target_plan: targetPlan,
    trial_status: "active",
    subscription_status: "trialing",
    current_period_end: endsAt.toISOString(),
    cancel_at_period_end: false,
    monthly_credit_grant: PLAN_CREDIT_GRANT[targetPlan] ?? 0,
    trial_last_error: null,
    updated_at: startedAt.toISOString(),
  };

  const priceId = PLAN_TO_STRIPE_PRICE[targetPlan];
  if (priceId) {
    try {
      // Make the card saved during the $1 checkout the customer default.
      const pms = await stripe.paymentMethods.list({ customer: customerId, limit: 1 });
      const pm = pms.data[0]?.id;
      if (pm) {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: pm },
        });
      }
      const sub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_end: Math.floor(endsAt.getTime() / 1000),
        default_payment_method: pm,
        metadata: { user_id: userId, plan: targetPlan },
        // If the card later fails at trial end, cancel rather than dangle.
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      } as Stripe.SubscriptionCreateParams);
      baseUpdate.stripe_subscription_id = sub.id;
    } catch (err) {
      console.error("[stripe-webhook] subscription create failed:", err);
      baseUpdate.trial_last_error =
        err instanceof Error ? err.message : "Could not create subscription";
    }
  } else {
    baseUpdate.trial_last_error =
      `No Stripe price configured for plan "${targetPlan}" (set STRIPE_PRICE_${targetPlan.toUpperCase()}).`;
  }

  await supabase.from("profiles").update(baseUpdate).eq("id", userId);

  if (email) {
    await sendPlanActivatedEmail({
      to: email,
      fullName: null,
      plan: `Trial (auto-upgrades to ${targetPlan})`,
      credits: TRIAL_CREDIT_GRANT,
    }).catch((e) => console.error("[stripe-webhook] trial mailer", e));
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Only paid subscription invoices grant credits. Skip $0 (trial) invoices.
  if ((invoice.amount_paid ?? 0) <= 0) return;
  const inv = invoice as unknown as {
    subscription?: string | null;
    id?: string;
    customer?: string | null;
    lines?: { data?: Array<{ price?: { id?: string } | null }> };
  };
  const subscriptionId = inv.subscription ?? null;
  if (!subscriptionId) return; // not a subscription invoice

  const supabase = adminClient();
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : (inv.customer ?? null);
  const userId = await userByCustomer(supabase, customerId);
  if (!userId) return;

  const priceId = inv.lines?.data?.[0]?.price?.id ?? null;
  const plan = (priceId && planForPriceId(priceId)) || null;
  const amount = plan ? (PLAN_CREDIT_GRANT[plan] ?? 0) : 0;

  await grantCredits({
    userId,
    amount,
    kind: "subscription",
    stripeInvoiceId: inv.id ?? null,
    note: plan ? `${plan} monthly credits` : "Subscription credits",
    setPlan: plan ?? undefined,
    extra: {
      subscription_status: "active",
      trial_status: "converted",
      stripe_subscription_id: subscriptionId,
      monthly_credit_grant: amount,
    },
  });
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const supabase = adminClient();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = await userByCustomer(supabase, customerId);
  if (!userId) return;

  const plan = subPlanSlug(sub);
  const update: Record<string, unknown> = {
    subscription_status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    current_period_end: subPeriodEnd(sub),
    stripe_subscription_id: sub.id,
    updated_at: new Date().toISOString(),
  };
  if (plan) {
    update.plan = plan;
    update.monthly_credit_grant = PLAN_CREDIT_GRANT[plan] ?? 0;
  }
  if (sub.status === "canceled") {
    update.subscription_status = "canceled";
  }
  await supabase.from("profiles").update(update).eq("id", userId);
}

/** Legacy worker off-session trial conversion (only legacy trials w/o a sub). */
async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  if (pi.metadata?.is_trial_conversion !== "true") return;
  const userId = pi.metadata?.user_id as string | undefined;
  const plan = (pi.metadata?.plan as string | undefined)?.toLowerCase() ?? null;
  if (!userId || !plan) return;
  await grantCredits({
    userId,
    amount: PLAN_CREDIT_GRANT[plan] ?? 0,
    kind: "subscription",
    stripePaymentIntentId: pi.id,
    note: `${plan} (legacy trial conversion)`,
    setPlan: plan,
    extra: { trial_status: "converted", subscription_status: "active" },
  });
}

/**
 * The one place credits are added. Adds to the balance (never resets — credits
 * roll over and never expire), records a credit_grants row, and dedupes
 * subscription invoices by stripe_invoice_id.
 */
async function grantCredits({
  userId,
  amount,
  kind,
  stripeInvoiceId = null,
  stripePaymentIntentId = null,
  note,
  setPlan,
  email,
  extra,
}: {
  userId: string;
  amount: number;
  kind: "trial" | "subscription" | "topup" | "manual";
  stripeInvoiceId?: string | null;
  stripePaymentIntentId?: string | null;
  note?: string;
  setPlan?: string;
  email?: string | null;
  extra?: Record<string, unknown>;
}) {
  const supabase = adminClient();

  // Idempotency: a Stripe invoice grants credits exactly once.
  if (stripeInvoiceId) {
    const { data: dupe } = await supabase
      .from("credit_grants")
      .select("id")
      .eq("stripe_invoice_id", stripeInvoiceId)
      .maybeSingle();
    if (dupe) return;
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("email,full_name,credits")
    .eq("id", userId)
    .single();

  const nextCredits = ((existing?.credits as number | undefined) ?? 0) + (amount || 0);

  const update: Record<string, unknown> = {
    credits: nextCredits,
    updated_at: new Date().toISOString(),
    ...(setPlan ? { plan: setPlan } : {}),
    ...(extra ?? {}),
  };
  await supabase.from("profiles").update(update).eq("id", userId);

  if (amount > 0) {
    await supabase.from("credit_grants").insert({
      user_id: userId,
      amount,
      kind,
      stripe_invoice_id: stripeInvoiceId,
      stripe_payment_intent_id: stripePaymentIntentId,
      note: note ?? null,
    });
  }

  const recipient = email ?? (existing?.email as string | undefined) ?? null;
  if (recipient && setPlan && kind !== "trial") {
    await sendPlanActivatedEmail({
      to: recipient,
      fullName: (existing?.full_name as string | undefined) ?? null,
      plan: setPlan,
      credits: amount,
    }).catch((e) => console.error("[stripe-webhook] mailer", e));
  }
}
