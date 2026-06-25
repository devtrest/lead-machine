import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// profiles.credits is locked against the user's own JWT (lock_sensitive_profile
// cols trigger), so granting credits needs the service role. Vercel server
// routes hold SUPABASE_SERVICE_ROLE_KEY (same as the Stripe webhook).
function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to grant credits server-side."
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Grant one-time top-up credits after an off-session charge succeeds. Adds to
 * the balance (credits roll over / never expire) and records a credit_grants
 * row. IDEMPOTENT on the Stripe PaymentIntent id, so a retry — or the webhook
 * firing for the same charge — can't double-grant. Returns the new balance.
 */
export async function grantTopupCredits({
  userId,
  credits,
  paymentIntentId,
  note,
}: {
  userId: string;
  credits: number;
  paymentIntentId: string | null;
  note?: string;
}): Promise<number> {
  const supabase = adminClient();

  const currentBalance = async (): Promise<number> => {
    const { data } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();
    return ((data as { credits?: number } | null)?.credits ?? 0) as number;
  };

  // Already granted for this charge? Return the existing balance untouched.
  if (paymentIntentId) {
    const { data: dupe } = await supabase
      .from("credit_grants")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();
    if (dupe) return currentBalance();
  }

  const next = (await currentBalance()) + (credits || 0);
  await supabase
    .from("profiles")
    .update({ credits: next, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (credits > 0) {
    await supabase.from("credit_grants").insert({
      user_id: userId,
      amount: credits,
      kind: "topup",
      stripe_payment_intent_id: paymentIntentId,
      note: note ?? null,
    });
  }

  return next;
}
