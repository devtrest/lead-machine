import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment."
    );
  }
  cached = new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });
  return cached;
}

/** The paid subscription tiers (monthly). `premium` is kept only for
 *  backward-compat with old rows; the live tiers are starter/growth/pro. */
export const PAID_PLANS = ["starter", "growth", "pro"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

/** Map our plan slugs to Stripe RECURRING (monthly) Price IDs (set via env).
 *  These MUST be recurring/month prices in your Stripe dashboard. */
export const PLAN_TO_STRIPE_PRICE: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  pro: process.env.STRIPE_PRICE_PRO,
  // legacy alias so old env still resolves
  premium: process.env.STRIPE_PRICE_PREMIUM ?? process.env.STRIPE_PRICE_GROWTH,
};

/** Reverse lookup — given a Stripe Price ID from a webhook, find our plan slug. */
export function planForPriceId(priceId: string): string | null {
  for (const plan of PAID_PLANS) {
    if (PLAN_TO_STRIPE_PRICE[plan] === priceId) return plan;
  }
  return null;
}

/** Credits granted PER MONTH on each paid invoice. Credits never expire and
 *  roll over (we ADD to the balance, never reset).
 *  1 credit = 1 scraped lead OR 1 initial outreach email (follow-ups free). */
export const PLAN_CREDIT_GRANT: Record<string, number> = {
  starter: 3_000,
  growth: 15_000,
  premium: 15_000, // legacy alias
  pro: 100_000,
  enterprise: 0, // unmetered
};

/** Display price per plan (monthly). */
export const PLAN_PRICE_USD: Record<string, string> = {
  starter: "$49",
  growth: "$99",
  premium: "$99",
  pro: "$149",
  enterprise: "Custom",
};

/** Monthly plan price in CENTS. */
export const PLAN_PRICE_CENTS: Record<string, number> = {
  starter: 4_900,
  growth: 9_900,
  premium: 9_900,
  pro: 14_900,
};

/** Approx. standard videos / leads framing for marketing copy. */
export const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  premium: "Growth",
  pro: "Pro",
  enterprise: "Enterprise",
};

/** Trial: $1 unlocks a 3-day trial with a small credit allotment. At trial
 *  end Stripe auto-charges the chosen monthly plan; the user can also activate
 *  early (e.g. once the trial allotment is spent). */
export const TRIAL_PRICE_CENTS = 100;
export const TRIAL_PRICE_USD = "$1";
export const TRIAL_CREDIT_GRANT = 100;
export const TRIAL_DURATION_DAYS = 3;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
