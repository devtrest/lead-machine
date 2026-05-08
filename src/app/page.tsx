import type { User } from "@supabase/supabase-js";
import { PricingSection } from "@/components/PricingSection";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeFeatures } from "@/components/home/HomeFeatures";
import { HomeHowItWorks } from "@/components/home/HomeHowItWorks";
import { HomePreview } from "@/components/home/HomePreview";
import { HomeTestimonials } from "@/components/home/HomeTestimonials";
import { HomeFaq } from "@/components/home/HomeFaq";
import { HomeFooter } from "@/components/home/HomeFooter";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  let user: User | null = null;
  let isAdmin = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      user = data.user;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.role === "admin";
    }
  } catch {
    /* page still renders without user */
  }

  const signedIn = !!user;

  return (
    <div className="app-shell relative min-h-screen">
      <SiteHeader signedIn={signedIn} isAdmin={isAdmin} />

      <main className="relative">
        <HomeHero signedIn={signedIn} isAdmin={isAdmin} />
        <HomeFeatures />
        <HomeHowItWorks />
        <HomePreview />
        <HomeTestimonials />
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <PricingSection signedIn={signedIn} />
        </div>
        <HomeFaq />
        <HomeFooter signedIn={signedIn} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
