import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";

// Always re-fetch the profile (credits, plan, etc.) on every navigation so
// the topbar credit balance updates the instant a scrape reserves credits
// or an outreach campaign starts. Without this, Next.js's RSC cache can hold
// the layout result and display a stale balance until the user hard-refreshes.
export const dynamic = "force-dynamic";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/user");
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("credits,plan,role,full_name,suspended")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const meta = user.user_metadata as { full_name?: string } | undefined;
    await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
      full_name: meta?.full_name ?? "",
    });
    const refetch = await supabase
      .from("profiles")
      .select("credits,plan,role,full_name,suspended")
      .eq("id", user.id)
      .maybeSingle();
    profile = refetch.data;
  }

  // Hard role separation — admin accounts belong on /admin only and cannot
  // navigate into the user dashboard. Keeps the blast radius of either
  // surface bounded to its own role.
  if (profile && (profile as { role?: string }).role === "admin") {
    redirect("/admin");
  }

  if (profile && (profile as { suspended?: boolean }).suspended === true) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="surface-card-elev max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold text-[var(--ink-strong)]">
            Account suspended
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Your Lead Machine account is temporarily suspended. Please contact
            support to restore access.
          </p>
          <a
            href="mailto:support@leadmachine.app"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
          >
            Contact support
          </a>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="surface-card-elev max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold text-[var(--ink-strong)]">
            Profile setup incomplete
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Run <code className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-xs">supabase/schema.sql</code> in your Supabase SQL editor, then refresh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      email={user.email ?? null}
      fullName={profile.full_name ?? null}
      credits={profile.credits}
      plan={profile.plan}
      role={profile.role}
    >
      {children}
    </AppShell>
  );
}
