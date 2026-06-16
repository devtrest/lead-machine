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

/** Map our plan slugs to Stripe Price IDs (set via env). */
export const PLAN_TO_STRIPE_PRICE: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  premium: process.env.STRIPE_PRICE_PREMIUM,
  pro: process.env.STRIPE_PRICE_PRO,
};

/** Reverse lookup — given a Stripe Price ID from a webhook, find our plan slug. */
export function planForPriceId(priceId: string): string | null {
  for (const [plan, id] of Object.entries(PLAN_TO_STRIPE_PRICE)) {
    if (id && id === priceId) return plan;
  }
  return null;
}

/** How many credits each lifetime plan grants on purchase.
 *  1 credit = 1 scraped lead OR 1 initial outreach email (follow-ups free). */
export const PLAN_CREDIT_GRANT: Record<string, number> = {
  starter: 3_000,
  premium: 15_000,
  pro: 100_000,
  enterprise: 0, // unmetered
};

/** Display price for each plan — used for client-side display and as a
 *  source of truth so we don't have to keep two files in sync. */
export const PLAN_PRICE_USD: Record<string, string> = {
  starter: "$49",
  premium: "$149",
  pro: "$499",
  enterprise: "Custom",
};

/** Plan price in CENTS — used by the worker's trial-charge job when it
 *  creates an off-session PaymentIntent against the saved card. */
export const PLAN_PRICE_CENTS: Record<string, number> = {
  starter: 4_900,
  premium: 14_900,
  pro: 49_900,
};

/** Trial constants. The trial charges $7 immediately, grants 100 credits,
 *  and converts (auto-charges the full plan) after this many days. There are
 *  NO free credits at signup — users land at 0 credits and must either start
 *  the $7 trial or buy a plan outright to use the product. */
export const TRIAL_PRICE_CENTS = 700;
export const TRIAL_PRICE_USD = "$7";
export const TRIAL_CREDIT_GRANT = 100;
export const TRIAL_DURATION_DAYS = 7;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
