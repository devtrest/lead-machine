import type { User } from "@supabase/supabase-js";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHero } from "@/components/home/PageHero";
import { LegalDoc, type LegalSection } from "@/components/home/LegalDoc";
import { HomeFooter } from "@/components/home/HomeFooter";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Cookie Policy — Lead Machine",
  description:
    "How Lead Machine uses cookies and similar technologies, and how you can control them.",
};

const LAST_UPDATED = "June 16, 2026";

const intro =
  "This policy explains how Lead Machine uses cookies and similar technologies on our website and app, and how you can manage them.";

const sections: LegalSection[] = [
  {
    heading: "What cookies are",
    body: [
      "Cookies are small text files stored on your device that help a website function and remember information about your visit. We use a small, focused set of them.",
    ],
  },
  {
    heading: "How we use cookies",
    bullets: [
      "Essential: keep you signed in and maintain your session securely. The app cannot function without these.",
      "Preferences: remember choices you make so the experience is consistent across visits.",
      "Analytics (if enabled): aggregate, privacy-respecting usage data that helps us understand what to improve.",
    ],
  },
  {
    heading: "Email open tracking",
    body: [
      "Separately from website cookies, outreach emails you send may include a tracking pixel so you can see when a message was opened. This is a feature of the outreach product, not a cookie set on your own device. Recipients’ mail clients may proxy or block these pixels, so open data is approximate.",
    ],
  },
  {
    heading: "Managing cookies",
    body: [
      "You can control or delete cookies through your browser settings. Blocking essential cookies may prevent you from signing in or using parts of the app.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about this policy? Email hello@leadmachine.ai.",
    ],
  },
];

export default async function CookiesPage() {
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
        eyebrow="Legal"
        title={
          <>
            Cookie <span className="brand-text-gradient">Policy</span>
          </>
        }
        subtitle="The cookies we use and how to control them."
      />
      <LegalDoc lastUpdated={LAST_UPDATED} intro={intro} sections={sections} />
      <HomeFooter signedIn={signedIn} isAdmin={isAdmin} />
    </div>
  );
}
