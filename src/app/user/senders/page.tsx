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

      {/* Page header */}
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            <AtSign className="h-3 w-3" />
            Sender accounts
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-3xl">
            Connected Gmail senders
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
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
      className={`min-w-[5.5rem] rounded-lg border bg-[var(--surface-elev)] px-4 py-3 text-center shadow-[var(--shadow-xs)] ${
        accent
          ? "border-[var(--brand-200)] ring-1 ring-inset ring-[var(--brand-100)]"
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
