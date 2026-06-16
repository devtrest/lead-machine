import Link from "next/link";
import { ArrowLeft, AtSign, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SendersManager } from "@/components/outreach/SendersManager";

export const dynamic = "force-dynamic";

export default async function SendersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: senders } = await supabase
    .from("outreach_senders")
    .select(
      "id,email,display_name,provider,daily_limit,sends_today,last_reset_at,status,last_error,created_at"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: true });

  const activeCount = (senders ?? []).filter((s) => s.status === "active").length;
  const sentToday = (senders ?? []).reduce(
    (n, s) => n + (s.sends_today as number),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/user/outreach"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] transition hover:text-[var(--brand-700)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Outreach
        </Link>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--brand-50)] via-[var(--surface-elev)] to-[var(--sky-50)] px-6 py-8 md:px-10 md:py-10">
        <div
          className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-55 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-br from-[var(--sky-200)] to-[var(--brand-100)] opacity-45 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)] backdrop-blur">
              <AtSign className="h-3 w-3" />
              Sender accounts
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-[40px] md:leading-tight">
              Connected{" "}
              <span className="brand-text-gradient">Gmail senders</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--ink-muted)] md:text-base">
              The worker rotates across enabled senders to respect Gmail&apos;s
              ~500/day account ceiling and reduce spam-flag risk. Wrong app
              passwords are rejected at connection time — no fake-connected
              state.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Connected" value={(senders ?? []).length} />
            <Stat label="Active" value={activeCount} accent />
            <Stat label="Sent today" value={sentToday} />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="surface-card flex items-start gap-3 p-4 text-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--success-50)] text-[var(--success-700)] ring-1 ring-[var(--success-100)]">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <div className="font-semibold text-[var(--ink-strong)]">
            App passwords stored encrypted at the database layer
          </div>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Verified live via SMTP handshake before save. Revoke any sender
            anytime from the list below — the app password is permanently
            deleted on disconnect.
          </p>
        </div>
      </div>

      <SendersManager initialSenders={senders ?? []} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white/80 p-3 text-center backdrop-blur ${
        accent
          ? "border-[var(--brand-200)] ring-1 ring-[var(--brand-100)]"
          : "border-[var(--border)]"
      }`}
    >
      <div
        className={`text-xl font-bold tabular-nums ${
          accent ? "text-[var(--brand-700)]" : "text-[var(--ink-strong)]"
        }`}
      >
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-subtle)]">
        {label}
      </div>
    </div>
  );
}
