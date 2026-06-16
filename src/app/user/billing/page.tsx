import { CreditCard, Sparkles, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BillingPanel } from "@/components/billing/BillingPanel";

export const dynamic = "force-dynamic";

const includedPerks = [
  "AI niche expansion across related keywords",
  "Email + phone enrichment from public sources",
  "CSV + Excel export, CRM-ready columns",
  "Unlimited outreach follow-ups (free after step 1)",
  "Per-campaign daily caps + send windows",
  "Multi-Gmail sender rotation + unified inbox",
];

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,credits,plan,trial_status,trial_ends_at")
    .eq("id", user!.id)
    .maybeSingle();

  const plan = (profile?.plan as string | null) ?? "starter";

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            Billing &amp; credits
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-3xl">
            Billing
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--ink-muted)]">
            1 credit = 1 lead. Credits never expire and roll forward across
            every campaign you run.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-muted)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/credits-icon.svg" alt="" aria-hidden className="h-4 w-4" />
            Current plan:{" "}
            <span className="capitalize text-[var(--brand-700)]">{plan}</span>
          </span>
          {profile?.trial_status === "active" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-100)] bg-[var(--accent-50)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-700)]">
              <Sparkles className="h-3 w-3" />
              Trial active
            </span>
          ) : null}
        </div>
      </div>

      {/* Credit balance + what every plan includes */}
      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <section className="surface-card flex flex-col justify-between p-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
              <CreditCard className="h-3.5 w-3.5" />
              Credit balance
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight tabular-nums text-[var(--ink-strong)]">
                {(profile?.credits ?? 0).toLocaleString()}
              </span>
              <span className="text-sm text-[var(--ink-muted)]">credits</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-[var(--ink-subtle)]">
            Roll forward across every campaign. Never expire.
          </p>
        </section>

        <section className="surface-card p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            Every plan includes
          </div>
          <ul className="mt-4 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            {includedPerks.map((p) => (
              <li
                key={p}
                className="flex items-start gap-2 text-[var(--ink-strong)]"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--success-100)] text-[var(--success-700)]">
                  <Check className="h-2.5 w-2.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <BillingPanel />
    </div>
  );
}
