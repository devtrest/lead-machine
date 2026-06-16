import type { User } from "@supabase/supabase-js";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHero } from "@/components/home/PageHero";
import { PricingSection } from "@/components/PricingSection";
import { HomeFaq } from "@/components/home/HomeFaq";
import { HomeFooter } from "@/components/home/HomeFooter";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Pricing — Lead Machine",
  description:
    "Simple plans, real leads. Starter through Enterprise — pay for credits, not seats.",
};

export default async function PricingPage() {
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
        eyebrow="Pricing"
        title={
          <>
            Simple plans. Real{" "}
            <span className="brand-text-gradient">leads</span>.
          </>
        }
        subtitle="One-time payment for lifetime access. Credits never expire. No subscriptions, no surprises."
      />
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <PricingSection signedIn={signedIn} hideHeader />
      </div>
      <HomeFaq />
      <HomeFooter signedIn={signedIn} isAdmin={isAdmin} />
    </div>
  );
}
