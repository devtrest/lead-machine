// Trial conversion job. Runs every hour.
// Finds users whose trial has expired and creates an off-session
// PaymentIntent against the card we saved during the $1 trial checkout.
// The PaymentIntent webhook (handled in the Vercel /api/billing/webhook
// route, not here) does the actual credit grant + plan switch. Keeping the
// credit logic in one place avoids duplicating the rules.

import Stripe from "stripe";
import { supabase } from "./db.js";

// Mirror of src/lib/stripe.ts — same prices in cents. Worker is a separate
// npm package so it can't import the frontend lib directly.
const PLAN_PRICE_CENTS: Record<string, number> = {
  starter: 4_900,
  growth: 9_900,
  premium: 9_900,
  pro: 14_900,
};

type TrialRow = {
  id: string;
  email: string | null;
  stripe_customer_id: string;
  trial_target_plan: string;
  trial_ends_at: string;
};

export type TrialChargeResult = {
  due: number;
  charged: number;
  failed: number;
  skipped: number; // missing Stripe config etc.
};

let running = false;

export async function runTrialCharge(): Promise<TrialChargeResult> {
  if (running) {
    console.log("[trial-charge] previous run still active, skipping");
    return { due: 0, charged: 0, failed: 0, skipped: 0 };
  }
  running = true;
  const t0 = Date.now();
  try {
    const result = await charge();
    console.log(
      `[trial-charge] done in ${Date.now() - t0}ms — due:${result.due} charged:${result.charged} failed:${result.failed} skipped:${result.skipped}`
    );
    return result;
  } finally {
    running = false;
  }
}

async function charge(): Promise<TrialChargeResult> {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    return { due: 0, charged: 0, failed: 0, skipped: 1 };
  }
  const stripe = new Stripe(stripeKey);

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("profiles")
    .select(
      "id,email,stripe_customer_id,trial_target_plan,trial_ends_at"
    )
    .eq("trial_status", "active")
    .lte("trial_ends_at", nowIso)
    .not("stripe_customer_id", "is", null)
    .limit(50);

  if (error) {
    console.error("[trial-charge] fetch failed:", error);
    return { due: 0, charged: 0, failed: 1, skipped: 0 };
  }

  const rows = (due ?? []) as TrialRow[];
  if (rows.length === 0) {
    return { due: 0, charged: 0, failed: 0, skipped: 0 };
  }

  let charged = 0;
  let failed = 0;

  for (const row of rows) {
    const planCents = PLAN_PRICE_CENTS[row.trial_target_plan];
    if (!planCents) {
      await markFailed(row.id, `Unknown trial_target_plan: ${row.trial_target_plan}`);
      failed += 1;
      continue;
    }

    try {
      // Look up the default payment method on this customer. The $1
      // checkout had setup_future_usage='off_session' which sets it.
      const customer = await stripe.customers.retrieve(row.stripe_customer_id);
      if (customer.deleted) {
        await markFailed(row.id, "Stripe customer was deleted");
        failed += 1;
        continue;
      }
      const defaultPm =
        (customer.invoice_settings?.default_payment_method as string | null) ??
        null;

      // Fallback: list payment methods on the customer and grab the first.
      let paymentMethodId = defaultPm;
      if (!paymentMethodId) {
        const list = await stripe.paymentMethods.list({
          customer: row.stripe_customer_id,
          limit: 1,
        });
        paymentMethodId = list.data[0]?.id ?? null;
      }
      if (!paymentMethodId) {
        await markFailed(row.id, "No saved payment method on customer");
        failed += 1;
        continue;
      }

      // Off-session PaymentIntent. The user is not present, the card was
      // pre-authorized during trial checkout via setup_future_usage. If the
      // card requires SCA we'll get a 'requires_action' status and have to
      // ask the user to confirm — for now we surface that as a failed
      // conversion so the UI nudges them.
      await stripe.paymentIntents.create({
        amount: planCents,
        currency: "usd",
        customer: row.stripe_customer_id,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Lead Machine — ${capitalize(row.trial_target_plan)} (trial conversion)`,
        metadata: {
          user_id: row.id,
          plan: row.trial_target_plan,
          is_trial_conversion: "true",
        },
      });

      // We DO NOT update credits/plan here. The payment_intent.succeeded
      // webhook handler in Vercel does it — single source of truth.
      console.log(
        `[trial-charge] queued ${row.trial_target_plan} charge for user ${row.id}`
      );
      charged += 1;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Charge failed";
      console.warn(`[trial-charge] charge failed for ${row.id}: ${message}`);
      await markFailed(row.id, message);
      failed += 1;
    }
  }

  return { due: rows.length, charged, failed, skipped: 0 };
}

async function markFailed(userId: string, error: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({
      trial_status: "failed",
      trial_last_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
