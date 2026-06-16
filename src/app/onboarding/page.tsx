import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanPicker } from "@/components/onboarding/PlanPicker";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Get started — Lead Machine",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,role,onboarded,trial_status,subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role === "admin") redirect("/admin");
  if ((profile as { onboarded?: boolean } | null)?.onboarded === true) {
    redirect("/user");
  }

  // Two phases: (1) start a trial/plan, then (2) answer the questions.
  const hasBilling =
    Boolean((profile as { trial_status?: string } | null)?.trial_status) ||
    Boolean((profile as { subscription_status?: string } | null)?.subscription_status);

  const firstName =
    (profile?.full_name ?? user.email ?? "")
      .split(/[\s@]/)
      .filter(Boolean)[0] ?? "";

  return (
    <div className="app-shell relative min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" aria-hidden className="h-8 w-8" />
          <span className="text-sm font-semibold tracking-tight text-[var(--ink-strong)]">
            Lead Machine
          </span>
        </Link>
        <span className="text-xs text-[var(--ink-subtle)]">{user.email}</span>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-6 md:px-8">
        {hasBilling ? (
          <OnboardingWizard firstName={firstName} />
        ) : (
          <PlanPicker />
        )}
      </main>
    </div>
  );
}
