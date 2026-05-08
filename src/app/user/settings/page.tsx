import { CreditCard, User } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,credits,plan,role")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Manage your profile and plan.
        </p>
      </div>

      <section className="surface-card p-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
          <User className="h-3.5 w-3.5" />
          Profile
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" value={profile?.full_name || "—"} />
          <Field label="Email" value={user?.email ?? "—"} />
          <Field label="Role" value={profile?.role ?? "user"} />
          <Field
            label="Member since"
            value={
              user?.created_at
                ? new Date(user.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"
            }
          />
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
          <CreditCard className="h-3.5 w-3.5" />
          Plan & credits
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs text-[var(--ink-subtle)]">Current plan</div>
            <div className="mt-0.5 text-2xl font-semibold capitalize text-[var(--ink-strong)]">
              {profile?.plan ?? "starter"}
            </div>
            <div className="mt-1 text-xs text-[var(--ink-muted)]">
              {profile?.credits ?? 0} credits remaining
            </div>
          </div>
          <Link
            href="/#plans"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
          >
            Upgrade plan
          </Link>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
        {label}
      </div>
      <div className="mt-1.5 truncate rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]/60 px-3 py-2 text-sm text-[var(--ink-strong)]">
        {value || "—"}
      </div>
    </div>
  );
}
