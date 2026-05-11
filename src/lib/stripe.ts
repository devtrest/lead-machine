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

/** How many credits each lifetime plan grants on purchase. */
export const PLAN_CREDIT_GRANT: Record<string, number> = {
  starter: 250,
  premium: 1000,
  pro: 5000,
  enterprise: 0,
};

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
