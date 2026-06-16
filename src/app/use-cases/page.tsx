import type { User } from "@supabase/supabase-js";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHero } from "@/components/home/PageHero";
import { UseCases } from "@/components/home/UseCases";
import { HomeFooter } from "@/components/home/HomeFooter";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Use cases — Lead Machine",
  description:
    "Agencies, founders, freelancers, local businesses, sales teams, and recruiters use Lead Machine to scrape leads and auto-outreach them on autopilot — and wake up to booked conversations.",
};

export default async function UseCasesPage() {
  let user: User | null = null;
  let isAdmin = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      user = data.user;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.role === "admin";
    }
  } catch {}
  const signedIn = !!user;

  return (
    <div className="app-shell relative min-h-screen">
      <SiteHeader signedIn={signedIn} isAdmin={isAdmin} />
      <PageHero
        eyebrow="Use cases"
        title={
          <>
            One engine.{" "}
            <span className="brand-text-gradient">Every kind of pipeline.</span>
          </>
        }
        subtitle="Lead Machine scrapes verified leads and runs your cold-email follow-ups automatically — so the people who set it up close clients while everyone else is still building lists."
      />
      <UseCases signedIn={signedIn} />
      <HomeFooter signedIn={signedIn} isAdmin={isAdmin} />
    </div>
  );
}
