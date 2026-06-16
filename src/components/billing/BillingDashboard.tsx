"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  Check,
  CreditCard,
  Coins,
  CalendarClock,
  Receipt,
  ExternalLink,
  Zap,
  AlertTriangle,
  Building2,
  ShieldCheck,
} from "lucide-react";

export type Txn = {
  desc: string;
  date: string;
  amountCents: number;
  status: string;
};

type Props = {
  credits: number;
  plan: string;
  monthlyGrant: number;
  lifetimeTopup: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialStatus: string | null;
  trialEndsAt: string | null;
  hasCustomer: boolean;
  card: { brand: string; last4: string } | null;
  lifetimeSpentCents: number;
  transactions: Txn[];
};

type PlanCard = {
  id: string;
  name: string;
  price: string;
  credits: number;
  blurb: string;
  perks: readonly string[];
  popular?: boolean;
  enterprise?: boolean;
};

const PLANS: PlanCard[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$49",
    credits: 3_000,
    blurb: "For creators getting started",
    perks: ["3,000 credits / mo (roll over)", "All engines", "CSV + Excel export"],
  },
  {
    id: "growth",
    name: "Growth",
    price: "$99",
    credits: 15_000,
    blurb: "For weekly outbound",
    perks: ["15,000 credits / mo", "Email + phone enrichment", "Unibox + reply detection"],
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$149",
    credits: 100_000,
    blurb: "For teams & power users",
    perks: ["100,000 credits / mo", "Everything in Growth", "Priority extraction queue"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    credits: 0,
    blurb: "For brands who need more",
    perks: ["Custom credit volume", "Dedicated Slack channel", "1-on-1 strategy calls"],
    enterprise: true,
  },
];

type TopupCard = { id: string; credits: number; price: string; best?: boolean };

const TOPUPS: TopupCard[] = [
  { id: "pack_1000", credits: 1_000, price: "$25" },
  { id: "pack_2000", credits: 2_000, price: "$49", best: true },
  { id: "pack_5000", credits: 5_000, price: "$99" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function BillingDashboard(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const isTrialing =
    props.trialStatus === "active" || props.subscriptionStatus === "trialing";
  const isActive = props.subscriptionStatus === "active";
  const hasSub = isTrialing || isActive || props.hasCustomer;

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Something went wrong");
    return json as { url?: string; ok?: boolean };
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const openPortal = () =>
    run("portal", async () => {
      const { url } = await post("/api/billing/portal");
      if (url) window.location.href = url;
    });
  const activateNow = () =>
    run("activate", async () => {
      await post("/api/billing/activate");
      router.refresh();
    });
  const setCancel = (resume: boolean) =>
    run("cancel", async () => {
      await post("/api/billing/cancel", { resume });
      router.refresh();
    });
  const startTrial = (planId: string) =>
    run(`plan-${planId}`, async () => {
      const { url } = await post("/api/billing/trial", { targetPlan: planId });
      if (url) window.location.href = url;
    });
  const topup = (packId: string) =>
    run(`topup-${packId}`, async () => {
      const { url } = await post("/api/billing/topup", { packId });
      if (url) window.location.href = url;
    });

  const filteredTxns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.transactions;
    return props.transactions.filter((t) => t.desc.toLowerCase().includes(q));
  }, [query, props.transactions]);

  const statusLabel = isTrialing
    ? "Trial"
    : isActive
      ? "Active"
      : props.subscriptionStatus
        ? props.subscriptionStatus
        : "—";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            Billing &amp; credits
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-3xl">
            Billing
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Your subscription, credits and invoices.
          </p>
        </div>
        {hasSub ? (
          <button
            type="button"
            onClick={openPortal}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink-strong)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy === "portal" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Manage subscription
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3.5 py-2.5 text-sm text-[var(--danger-700)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[var(--brand-600)] to-[var(--sky-500)] p-5 text-white shadow-[0_8px_24px_rgba(79,70,229,0.25)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
              Total credits
            </span>
            <Coins className="h-5 w-5 text-white/90" />
          </div>
          <div className="mt-3 text-[30px] font-semibold leading-none tabular-nums">
            {props.credits.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-white/80">Combined balance</div>
        </div>

        <StatCard
          label="Lifetime credits"
          value={props.lifetimeTopup.toLocaleString()}
          hint="Top-ups — never expire"
          icon={<Sparkles className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Monthly credits"
          value={props.monthlyGrant.toLocaleString()}
          hint="Roll over — never expire"
          icon={<CalendarClock className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Lifetime spent"
          value={`$${(props.lifetimeSpentCents / 100).toFixed(2)}`}
          hint={`${props.transactions.length} transactions`}
          icon={<Receipt className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      {/* Subscription + payment method */}
      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[var(--brand-700)] via-[var(--brand-600)] to-[var(--sky-600)] p-6 text-white shadow-[0_10px_30px_rgba(79,70,229,0.28)] md:p-8">
          <div className="flex items-start justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur">
              <Sparkles className="h-3 w-3" />
              {props.plan}
            </span>
            {hasSub ? (
              <button
                type="button"
                onClick={openPortal}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur transition hover:bg-white/25 disabled:opacity-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Manage
              </button>
            ) : null}
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            {isTrialing ? "Trial active" : isActive ? "Active subscription" : "No active plan"}
          </h2>
          <p className="mt-1 text-sm text-white/80">
            {props.cancelAtPeriodEnd
              ? "Cancellation scheduled — access ends at period end"
              : isTrialing
                ? "Your plan activates automatically when the trial ends"
                : isActive
                  ? "Renews automatically — credits roll over each month"
                  : "Start a plan to unlock the full engine"}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SubField label="Status" value={statusLabel} />
            <SubField
              label="Next charge"
              value={fmtDate(props.currentPeriodEnd ?? props.trialEndsAt)}
            />
            <SubField
              label="Auto-renew"
              value={props.cancelAtPeriodEnd || !hasSub ? "Off" : "On"}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {isTrialing ? (
              <button
                type="button"
                onClick={activateNow}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-700)] transition hover:bg-white/90 disabled:opacity-50"
              >
                {busy === "activate" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Activate now
              </button>
            ) : null}
            {hasSub ? (
              props.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={() => setCancel(true)}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25 disabled:opacity-50"
                >
                  Resume subscription
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCancel(false)}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white/90 backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
                >
                  {busy === "cancel" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Cancel
                </button>
              )
            ) : null}
          </div>
        </div>

        {/* Payment method */}
        <div className="surface-card flex flex-col p-6">
          <div className="text-sm font-semibold text-[var(--ink-strong)]">
            Payment method
          </div>
          <div className="mt-4 flex-1">
            <div className="relative overflow-hidden rounded-xl bg-[var(--ink-strong)] p-5 text-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                  Card on file
                </span>
                <ShieldCheck className="h-4 w-4 text-[var(--accent-500)]" />
              </div>
              <div className="mt-5 font-mono text-sm tracking-[0.3em] text-white/90">
                {props.card ? `•••• •••• •••• ${props.card.last4}` : "•••• •••• •••• ••••"}
              </div>
              <div className="mt-2 text-xs capitalize text-white/60">
                {props.card ? `${props.card.brand} · stored securely` : "Stored securely"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={openPortal}
            disabled={busy !== null || !hasSub}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] py-2.5 text-sm font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)] disabled:opacity-50"
          >
            <CreditCard className="h-4 w-4" />
            Update card
          </button>
        </div>
      </div>

      {/* Switch plan */}
      <section className="surface-card p-6 md:p-8">
        <div className="text-lg font-semibold text-[var(--ink-strong)]">Switch plan</div>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {isActive
            ? `You're on ${props.plan}. Upgrade or switch anytime — it applies to your next charge.`
            : "Pick a plan to start your $1 / 3-day trial. Credits roll over and never expire."}
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = hasSub && plan.id === props.plan;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border p-5 ${
                  isCurrent
                    ? "border-[var(--brand-500)] bg-[var(--brand-50)]/40 ring-2 ring-[var(--brand-500)]/30"
                    : plan.popular
                      ? "border-[var(--brand-200)] bg-[var(--surface-elev)]"
                      : "border-[var(--border)] bg-[var(--surface-elev)]"
                }`}
              >
                {isCurrent ? (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-[var(--brand-600)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                    Current plan
                  </span>
                ) : plan.popular ? (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-[var(--accent-500)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                    Most popular
                  </span>
                ) : null}
                <div className="text-sm font-semibold text-[var(--ink-strong)]">
                  {plan.name}
                </div>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{plan.blurb}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold tracking-tight tabular-nums text-[var(--ink-strong)]">
                    {plan.price}
                  </span>
                  {!plan.enterprise ? (
                    <span className="text-xs text-[var(--ink-subtle)]">/mo</span>
                  ) : null}
                </div>
                {!plan.enterprise ? (
                  <div className="mt-1 text-xs font-semibold tabular-nums text-[var(--brand-700)]">
                    {plan.credits.toLocaleString()} credits / mo
                  </div>
                ) : null}
                <ul className="mt-4 flex-1 space-y-2 text-xs text-[var(--ink-muted)]">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--success-700)]" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <PlanButton
                  enterprise={Boolean(plan.enterprise)}
                  isCurrent={isCurrent}
                  hasSub={hasSub}
                  busy={busy === `plan-${plan.id}`}
                  disabled={busy !== null}
                  label={plan.name}
                  onPortal={openPortal}
                  onTrial={() => startTrial(plan.id)}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Top up credits */}
      <section className="surface-card p-6 md:p-8">
        <div className="text-lg font-semibold text-[var(--ink-strong)]">Top up credits</div>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Out of credits before your plan renews? Buy a pack — these credits never
          expire and are used first.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {TOPUPS.map((pack) => (
            <div
              key={pack.id}
              className={`relative rounded-xl border p-5 ${
                pack.best
                  ? "border-[var(--brand-300)] ring-1 ring-[var(--brand-200)]"
                  : "border-[var(--border)]"
              } bg-[var(--surface-elev)]`}
            >
              {pack.best ? (
                <span className="absolute -top-2.5 right-4 rounded-full bg-[var(--brand-600)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                  Best value
                </span>
              ) : null}
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tabular-nums text-[var(--ink-strong)]">
                  {pack.credits.toLocaleString()}
                </span>
                <span className="text-xs text-[var(--ink-subtle)]">credits</span>
              </div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--ink-strong)]">
                {pack.price} <span className="text-xs font-normal text-[var(--ink-subtle)]">one-time</span>
              </div>
              <button
                type="button"
                onClick={() => topup(pack.id)}
                disabled={busy !== null}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--ink-strong)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy === `topup-${pack.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Buy
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Transactions */}
      <section className="surface-card overflow-hidden">
        <div className="border-b border-[var(--border)] p-4 md:p-5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions…"
            className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-3.5 py-2 text-sm text-[var(--ink-strong)] outline-none transition placeholder:text-[var(--ink-subtle)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
          />
        </div>
        {filteredTxns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-14 text-center">
            <Building2 className="h-8 w-8 text-[var(--ink-subtle)]" />
            <p className="text-sm font-medium text-[var(--ink-strong)]">
              No transactions yet
            </p>
            <p className="text-xs text-[var(--ink-muted)]">
              Charges appear here once your trial or plan is billed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredTxns.map((t, i) => (
                  <tr key={i} className="transition hover:bg-[var(--surface-sunken)]/50">
                    <td className="px-5 py-3.5 font-medium text-[var(--ink-strong)]">
                      {t.desc}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-[var(--ink-muted)]">
                      {fmtDate(t.date)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-[var(--ink-strong)]">
                      ${(t.amountCents / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          t.status === "succeeded"
                            ? "bg-[var(--success-50)] text-[var(--success-700)]"
                            : "bg-[var(--warning-50)] text-[var(--warning-700)]"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {t.status === "succeeded" ? "Paid" : t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-center text-xs text-[var(--ink-subtle)]">
        Payments are processed securely by Stripe. 1 credit = 1 scraped lead or 1
        initial outreach email — follow-ups are always free.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: "brand" | "success" | "amber";
}) {
  const toneMap = {
    brand:
      "bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]",
    success:
      "bg-gradient-to-br from-[var(--success-50)] to-[var(--success-100)] text-[var(--success-700)] ring-1 ring-inset ring-[var(--success-100)]",
    amber:
      "bg-gradient-to-br from-[var(--accent-50)] to-[var(--accent-100)] text-[var(--accent-700)] ring-1 ring-inset ring-[var(--accent-100)]",
  } as const;
  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">
          {label}
        </span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneMap[tone]}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-[28px] font-semibold leading-none tabular-nums text-[var(--ink-strong)]">
        {value}
      </div>
      <div className="mt-2 text-xs text-[var(--ink-muted)]">{hint}</div>
    </div>
  );
}

function SubField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-3 py-2.5 backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold capitalize">{value}</div>
    </div>
  );
}

function PlanButton({
  enterprise,
  isCurrent,
  hasSub,
  busy,
  disabled,
  label,
  onPortal,
  onTrial,
}: {
  enterprise: boolean;
  isCurrent: boolean;
  hasSub: boolean;
  busy: boolean;
  disabled: boolean;
  label: string;
  onPortal: () => void;
  onTrial: () => void;
}) {
  if (enterprise) {
    return (
      <a
        href="mailto:hello@leadmachine.ai?subject=Enterprise%20plan"
        className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] py-2.5 text-sm font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
      >
        Book a call
      </a>
    );
  }
  if (isCurrent) {
    return (
      <div className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] py-2.5 text-sm font-medium text-[var(--ink-muted)]">
        <Check className="h-4 w-4" /> Current plan
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={hasSub ? onPortal : onTrial}
      disabled={disabled}
      className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--ink-strong)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {hasSub ? `Switch to ${label}` : "Start for $1"}
    </button>
  );
}
