import type { User } from "@supabase/supabase-js";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHero } from "@/components/home/PageHero";
import { HomeFaq } from "@/components/home/HomeFaq";
import { HomeFooter } from "@/components/home/HomeFooter";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "FAQ — Nichely",
  description:
    "Common questions about lead freshness, AI niche expansion, exports, and compliance.",
};

export default async function FaqPage() {
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
        eyebrow="FAQ"
        title={
          <>
            <span className="brand-text-gradient">Common questions</span>,
            answered.
          </>
        }
        subtitle="Everything we get asked about lead freshness, AI niche expansion, exports, and compliance."
      />
      <HomeFaq />
      <HomeFooter signedIn={signedIn} isAdmin={isAdmin} />
    </div>
  );
}
