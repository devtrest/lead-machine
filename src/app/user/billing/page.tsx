import { CreditCard, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BillingPanel } from "@/components/billing/BillingPanel";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,credits,plan")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
          <CreditCard className="h-3.5 w-3.5" />
          Billing
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
          Plans & credits
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          One-time payment. Credits never expire. 1 credit = 1 lead.
        </p>
      </div>

      <section className="surface-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)]">
              <Coins className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--ink-subtle)]">
                Current balance
              </div>
              <div className="mt-0.5 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
                {(profile?.credits ?? 0).toLocaleString()}{" "}
                <span className="text-base font-medium text-[var(--ink-muted)]">
                  credits
                </span>
              </div>
              <div className="mt-1 text-xs text-[var(--ink-subtle)]">
                Plan:{" "}
                <span className="font-semibold capitalize text-[var(--brand-700)]">
                  {profile?.plan ?? "starter"}
                </span>{" "}
                · Each lead generated uses 1 credit.
              </div>
            </div>
          </div>
        </div>
      </section>

      <BillingPanel />
    </div>
  );
}
