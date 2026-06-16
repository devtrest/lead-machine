import type { User } from "@supabase/supabase-js";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHero } from "@/components/home/PageHero";
import { AboutContent } from "@/components/home/AboutContent";
import { HomeFooter } from "@/components/home/HomeFooter";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "About — Lead Machine",
  description:
    "Why Lead Machine exists: prospecting should run itself. We scrape verified leads and automate cold-email follow-ups so you wake up to opportunities.",
};

export default async function AboutPage() {
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
        eyebrow="About"
        title={
          <>
            We turn prospecting into a{" "}
            <span className="brand-text-gradient">background process.</span>
          </>
        }
        subtitle="Lead Machine is an AI lead engine that finds verified businesses and runs your outreach on autopilot — built for people who'd rather close deals than build lists."
      />
      <AboutContent signedIn={signedIn} />
      <HomeFooter signedIn={signedIn} isAdmin={isAdmin} />
    </div>
  );
}
