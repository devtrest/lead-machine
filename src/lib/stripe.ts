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

/** The paid subscription tiers (monthly) — the original/canonical lineup. */
export const PAID_PLANS = ["starter", "premium", "pro"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

/** Map our plan slugs to Stripe RECURRING (monthly) Price IDs (set via env).
 *  These MUST be recurring/month prices in your Stripe dashboard. */
export const PLAN_TO_STRIPE_PRICE: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  premium: process.env.STRIPE_PRICE_PREMIUM,
  pro: process.env.STRIPE_PRICE_PRO,
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
  premium: 15_000,
  pro: 100_000,
  enterprise: 0, // unmetered
};

/** Display price per plan (monthly). */
export const PLAN_PRICE_USD: Record<string, string> = {
  starter: "$49",
  premium: "$149",
  pro: "$499",
  enterprise: "Custom",
};

/** Monthly plan price in CENTS. */
export const PLAN_PRICE_CENTS: Record<string, number> = {
  starter: 4_900,
  premium: 14_900,
  pro: 49_900,
};

export const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  premium: "Premium",
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

/** One-time top-up credit packs. These credits never expire and are used
 *  first (before monthly plan credits). */
export const TOPUP_PACKS = [
  { id: "pack_1000", credits: 1_000, priceCents: 2_500, priceUsd: "$25" },
  { id: "pack_2000", credits: 2_000, priceCents: 4_900, priceUsd: "$49" },
  { id: "pack_5000", credits: 5_000, priceCents: 9_900, priceUsd: "$99" },
] as const;

export type TopupPackId = (typeof TOPUP_PACKS)[number]["id"];

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
