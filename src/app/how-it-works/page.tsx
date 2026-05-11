import type { User } from "@supabase/supabase-js";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHero } from "@/components/home/PageHero";
import { HomeHowItWorks } from "@/components/home/HomeHowItWorks";
import { HomeFeatures } from "@/components/home/HomeFeatures";
import { HomePreview } from "@/components/home/HomePreview";
import { HomeFooter } from "@/components/home/HomeFooter";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "How it works — Lead Machine",
  description:
    "From niche keyword to a CRM-ready lead list in four steps. See the AI lead engine end to end.",
};

export default async function HowItWorksPage() {
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
        eyebrow="How it works"
        title={
          <>
            From niche to{" "}
            <span className="brand-text-gradient">closed deal</span>, in four
            steps.
          </>
        }
        subtitle="Tell Lead Machine your niche and target city. Our AI handles discovery, contact enrichment, deduplication, and ranking — so you focus on outreach."
      />
      <HomeHowItWorks />
      <HomeFeatures />
      <HomePreview />
      <HomeFooter signedIn={signedIn} isAdmin={isAdmin} />
    </div>
  );
}
