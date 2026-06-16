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
      {/* Hero with credit balance */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--brand-50)] via-[var(--surface-elev)] to-[var(--sky-50)] px-6 py-9 md:px-10 md:py-12">
        <div
          className="absolute -right-32 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-60 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-24 -left-32 h-72 w-72 rounded-full bg-gradient-to-br from-[var(--sky-200)] to-[var(--brand-100)] opacity-50 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)] backdrop-blur">
              <CreditCard className="h-3 w-3" />
              Billing & credits
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-[40px] md:leading-tight">
              {(profile?.credits ?? 0).toLocaleString()}{" "}
              <span className="brand-text-gradient">credits</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[var(--ink-muted)] md:text-base">
              1 credit = 1 lead. Credits never expire and roll forward across
              every campaign you run.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)] backdrop-blur">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/credits-icon.svg" alt="" aria-hidden className="h-4 w-4" />
                Current plan: <span className="capitalize">{plan}</span>
              </span>
              {profile?.trial_status === "active" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-200)] bg-[var(--accent-50)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-700)]">
                  <Sparkles className="h-3 w-3" />
                  Trial active
                </span>
              ) : null}
            </div>
          </div>

          {/* What every plan includes */}
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-5 backdrop-blur">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
              Every plan includes
            </div>
            <ul className="mt-3 space-y-2 text-sm">
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
          </div>
        </div>
      </section>

      <BillingPanel />
    </div>
  );
}
