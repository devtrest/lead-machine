import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured, TRIAL_PRICE_CENTS } from "@/lib/stripe";
import { BillingDashboard, type Txn } from "@/components/billing/BillingDashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Billing — Lead Machine" };

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "credits,plan,monthly_credit_grant,subscription_status,current_period_end,cancel_at_period_end,trial_status,trial_ends_at,stripe_customer_id"
    )
    .eq("id", userId)
    .maybeSingle();

  const p = (profile ?? {}) as Record<string, unknown>;

  const { data: topupGrants } = await supabase
    .from("credit_grants")
    .select("amount")
    .eq("user_id", userId)
    .eq("kind", "topup");
  const lifetimeTopup = (topupGrants ?? []).reduce(
    (a, g) => a + ((g as { amount?: number }).amount ?? 0),
    0
  );

  // Stripe-backed data (charges = unified $ ledger; card on file). Best-effort.
  let transactions: Txn[] = [];
  let lifetimeSpentCents = 0;
  let card: { brand: string; last4: string } | null = null;
  const customerId = p.stripe_customer_id as string | undefined;
  if (isStripeConfigured() && customerId) {
    try {
      const stripe = getStripe();
      const charges = await stripe.charges.list({ customer: customerId, limit: 24 });
      const planName = ((p.plan as string) ?? "plan").replace(/^\w/, (c) => c.toUpperCase());
      transactions = charges.data.map((c) => {
        // Give every row a clear name: the $1 charge is the trial; generic
        // Stripe "Subscription creation/update" lines become "{Plan} subscription";
        // our own descriptions (top-ups, named subs) pass through.
        let desc = (c.description ?? "").trim();
        const lower = desc.toLowerCase();
        if (c.amount === TRIAL_PRICE_CENTS) {
          desc = "Trial charge";
        } else if (!desc || lower.startsWith("subscription")) {
          desc = `${planName} subscription`;
        }
        return {
          desc,
          date: new Date(c.created * 1000).toISOString(),
          amountCents: c.amount,
          status: c.status,
        };
      });
      lifetimeSpentCents = charges.data
        .filter((c) => c.paid && c.status === "succeeded")
        .reduce((a, c) => a + c.amount, 0);
      const pms = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 1,
      });
      const cd = pms.data[0]?.card;
      if (cd) card = { brand: cd.brand, last4: cd.last4 };
    } catch {
      /* show empty rather than error the page */
    }
  }

  return (
    <BillingDashboard
      credits={(p.credits as number) ?? 0}
      plan={(p.plan as string) ?? "starter"}
      monthlyGrant={(p.monthly_credit_grant as number) ?? 0}
      lifetimeTopup={lifetimeTopup}
      subscriptionStatus={(p.subscription_status as string) ?? null}
      currentPeriodEnd={(p.current_period_end as string) ?? null}
      cancelAtPeriodEnd={(p.cancel_at_period_end as boolean) ?? false}
      trialStatus={(p.trial_status as string) ?? null}
      trialEndsAt={(p.trial_ends_at as string) ?? null}
      hasCustomer={Boolean(customerId)}
      card={card}
      lifetimeSpentCents={lifetimeSpentCents}
      transactions={transactions}
    />
  );
}
