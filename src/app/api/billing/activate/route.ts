import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  getStripe,
  isStripeConfigured,
  PLAN_CREDIT_GRANT,
  planForPriceId,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST /api/billing/activate
// Ends the 3-day trial immediately. Stripe finalizes + charges the plan now.
// We then grant the monthly credits + flip the plan to Active SYNCHRONOUSLY
// (service role), deduped by Stripe invoice id so the invoice.paid webhook can't
// double-grant. This makes "Activate now" reliable even if webhooks aren't set up.
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
    .select("stripe_subscription_id,credits")
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

  let sub: Stripe.Subscription;
  try {
    const stripe = getStripe();
    // Ending the trial now triggers an immediate invoice + charge.
    sub = await stripe.subscriptions.update(subId, {
      trial_end: "now",
      expand: ["latest_invoice"],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Activation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Resolve plan + the invoice we'd grant against.
  const plan =
    (sub.metadata?.plan as string | undefined)?.toLowerCase() ||
    (sub.items?.data?.[0]?.price?.id
      ? planForPriceId(sub.items.data[0].price.id)
      : null);
  const amount = plan ? (PLAN_CREDIT_GRANT[plan] ?? 0) : 0;

  const inv = sub.latest_invoice as unknown as
    | { id?: string; status?: string; amount_paid?: number }
    | string
    | null;
  const invoiceObj = typeof inv === "object" && inv !== null ? inv : null;
  const invoiceId = invoiceObj?.id ?? null;
  const invoicePaid =
    invoiceObj?.status === "paid" || (invoiceObj?.amount_paid ?? 0) > 0;

  const periodEnd = subPeriodEnd(sub);

  // Service-role client (bypasses the credit-lock trigger + RLS).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Can't grant without service role; the webhook will handle it if configured.
    return NextResponse.json({ ok: true, granted: false, pending: true });
  }
  const admin = createAdmin(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Always reflect the activation in the profile.
  const baseProfile: Record<string, unknown> = {
    subscription_status: "active",
    trial_status: "converted",
    cancel_at_period_end: false,
    updated_at: new Date().toISOString(),
  };
  if (plan) {
    baseProfile.plan = plan;
    baseProfile.monthly_credit_grant = amount;
  }
  if (periodEnd) baseProfile.current_period_end = periodEnd;

  let granted = false;
  if (invoicePaid && invoiceId && amount > 0) {
    // Insert the ledger row FIRST — the unique(stripe_invoice_id) constraint
    // makes the grant idempotent vs the webhook (whoever inserts first wins).
    const { error: ledgerErr } = await admin.from("credit_grants").insert({
      user_id: user.id,
      amount,
      kind: "subscription",
      stripe_invoice_id: invoiceId,
      note: `${cap(plan!)} subscription`,
    });
    if (!ledgerErr) {
      const current = (profile as { credits?: number } | null)?.credits ?? 0;
      baseProfile.credits = current + amount;
      granted = true;
    }
    // ledgerErr (likely unique violation) => webhook already granted; just sync.
  }

  await admin.from("profiles").update(baseProfile).eq("id", user.id);

  return NextResponse.json({
    ok: true,
    granted,
    pending: !granted && invoicePaid === false,
    plan: plan ?? null,
    creditsAdded: granted ? amount : 0,
  });
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function subPeriodEnd(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as { current_period_end?: number };
  const fromSub = s.current_period_end;
  const fromItem = (
    sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
  )?.current_period_end;
  const unix = fromSub ?? fromItem ?? null;
  return unix ? new Date(unix * 1000).toISOString() : null;
}
