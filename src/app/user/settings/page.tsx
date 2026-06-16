import {
  CreditCard,
  User as UserIcon,
  Mail,
  Calendar,
  Shield,
  ArrowRight,
  LogOut,
  AtSign,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name,credits,plan,role,created_at,trial_status,trial_ends_at,trial_target_plan"
    )
    .eq("id", user!.id)
    .maybeSingle();

  const fullName = (profile?.full_name as string | null) ?? null;
  const initial = (fullName ?? user?.email ?? "?")
    .trim()
    .charAt(0)
    .toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";
  const plan = (profile?.plan as string | null) ?? "starter";
  const credits = (profile?.credits as number | null) ?? 0;
  const trialStatus = profile?.trial_status as string | null;
  const trialEnds = profile?.trial_ends_at as string | null;
  const trialTarget = profile?.trial_target_plan as string | null;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="border-b border-[var(--border)] pb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
          Settings
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--brand-600)] text-xl font-semibold text-white shadow-[var(--shadow-sm)]">
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
              {fullName ?? "Your account"}
            </h1>
            <p className="mt-0.5 truncate text-sm text-[var(--ink-muted)]">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
        {/* Profile details */}
        <section className="surface-card p-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            <UserIcon className="h-3.5 w-3.5" />
            Profile
          </div>
          <div className="mt-5 space-y-3">
            <Field
              icon={<UserIcon className="h-3.5 w-3.5" />}
              label="Full name"
              value={fullName ?? "—"}
            />
            <Field
              icon={<Mail className="h-3.5 w-3.5" />}
              label="Email"
              value={user?.email ?? "—"}
            />
            <Field
              icon={<Shield className="h-3.5 w-3.5" />}
              label="Role"
              value={(profile?.role as string | null) ?? "user"}
              capitalize
            />
            <Field
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Member since"
              value={memberSince}
            />
          </div>
        </section>

        {/* Plan + Sender shortcut */}
        <div className="space-y-6">
          <section className="surface-card p-6">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
                <CreditCard className="h-3.5 w-3.5" />
                Plan &amp; credits
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/credits-icon.svg"
                  alt=""
                  aria-hidden
                  className="h-8 w-8"
                />
                <div className="text-3xl font-semibold tabular-nums text-[var(--ink-strong)]">
                  {credits.toLocaleString()}
                </div>
                <div className="text-sm text-[var(--ink-muted)]">credits</div>
              </div>
              <div className="mt-1 text-xs text-[var(--ink-subtle)]">
                Current plan:{" "}
                <span className="font-semibold capitalize text-[var(--brand-700)]">
                  {plan}
                </span>
              </div>
              {trialStatus === "active" && trialEnds ? (
                <div className="mt-3 rounded-lg border border-[var(--accent-100)] bg-[var(--accent-50)] px-3 py-2 text-xs text-[var(--accent-700)]">
                  Trial active — converts to{" "}
                  <span className="font-semibold capitalize">
                    {trialTarget ?? "starter"}
                  </span>{" "}
                  on{" "}
                  {new Date(trialEnds).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  .
                </div>
              ) : null}
              <Link
                href="/user/billing"
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
              >
                Manage billing
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
              <AtSign className="h-3.5 w-3.5" />
              Sender accounts
            </div>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              Connect Gmail accounts to send outreach emails. We rotate across
              senders and respect Gmail&apos;s daily caps.
            </p>
            <Link
              href="/user/senders"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-800)]"
            >
              Manage senders
              <ArrowRight className="h-3 w-3" />
            </Link>
          </section>
        </div>
      </div>

      {/* Danger zone */}
      <section className="rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] p-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--danger-700)]">
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </div>
        <p className="mt-2 max-w-xl text-sm text-[var(--ink-muted)]">
          Sign out of all browser sessions for this account. You can sign back
          in any time at /login.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--danger-100)] bg-[var(--surface-elev)] px-4 py-2 text-sm font-semibold text-[var(--danger-700)] transition hover:bg-[var(--danger-50)]"
        >
          Go to login
        </Link>
      </section>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  capitalize,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] px-3.5 py-2.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">
        <span className="text-[var(--ink-muted)]">{icon}</span>
        {label}
      </div>
      <div
        className={`truncate text-sm font-medium text-[var(--ink-strong)] ${capitalize ? "capitalize" : ""}`}
      >
        {value || "—"}
      </div>
    </div>
  );
}
