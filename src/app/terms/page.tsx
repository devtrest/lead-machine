import type { User } from "@supabase/supabase-js";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHero } from "@/components/home/PageHero";
import { LegalDoc, type LegalSection } from "@/components/home/LegalDoc";
import { HomeFooter } from "@/components/home/HomeFooter";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Terms of Service — Lead Machine",
  description:
    "The terms that govern your use of Lead Machine, including acceptable use, billing, credits, and your responsibilities when sending outreach.",
};

const LAST_UPDATED = "June 16, 2026";

const intro =
  "By creating an account or using Lead Machine, you agree to these terms. Please read them carefully — they cover billing, acceptable use, and your responsibilities when sending email through the platform.";

const sections: LegalSection[] = [
  {
    heading: "The service",
    body: [
      "Lead Machine helps you discover business leads from public sources, enrich them with contact information, and run automated multi-step email outreach across mailboxes you connect. We may update, improve, or change features over time.",
    ],
  },
  {
    heading: "Your account",
    body: [
      "You are responsible for the activity under your account and for keeping your credentials secure. You must provide accurate information and be at least the age of majority in your jurisdiction.",
    ],
  },
  {
    heading: "Billing, trials, and credits",
    bullets: [
      "Trials: the trial charges a one-time fee, grants credits immediately, and — unless you cancel before it ends — automatically converts to the plan you selected, charged to your saved payment method.",
      "Plans: paid plans are one-time purchases that grant a fixed number of lifetime credits. Credits do not expire.",
      "Credit usage: one credit is consumed per lead generated; outreach follow-up steps after the first contact do not consume additional credits, except as described in the app.",
      "Refunds: because credits are delivered immediately, purchases are generally non-refundable except where required by law.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "You agree to use Lead Machine lawfully. You are solely responsible for the content of your outreach and for complying with all applicable laws and your email provider’s terms.",
    ],
    bullets: [
      "Do not send unlawful, deceptive, harassing, or abusive messages.",
      "Honor unsubscribe and opt-out requests promptly.",
      "Do not use the service to target individuals in violation of anti-spam or privacy laws.",
      "Do not attempt to disrupt, reverse-engineer, or abuse the platform or its rate limits.",
    ],
  },
  {
    heading: "Email sending and deliverability",
    body: [
      "Lead Machine sends through mailboxes you connect and applies sending limits and delays to protect deliverability. However, we do not guarantee inbox placement, reply rates, or that any provider will not restrict your account. You remain responsible for your sender reputation.",
    ],
  },
  {
    heading: "Data ownership",
    body: [
      "You own the leads and data you generate. We claim no ownership over your content. You grant us the limited rights needed to operate the service on your behalf.",
    ],
  },
  {
    heading: "Disclaimers & limitation of liability",
    body: [
      "The service is provided “as is” without warranties of any kind. To the maximum extent permitted by law, Lead Machine is not liable for indirect, incidental, or consequential damages, and our total liability is limited to the amount you paid in the twelve months preceding the claim.",
    ],
  },
  {
    heading: "Termination",
    body: [
      "You may stop using the service at any time. We may suspend or terminate accounts that violate these terms or that pose a risk to the platform or other users.",
    ],
  },
  {
    heading: "Changes to these terms",
    body: [
      "We may update these terms from time to time. Material changes will be communicated through the app or by email. Continued use after changes take effect constitutes acceptance.",
    ],
  },
  {
    heading: "Contact",
    body: ["Questions about these terms? Email hello@leadmachine.ai."],
  },
];

export default async function TermsPage() {
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
            Terms of <span className="brand-text-gradient">Service</span>
          </>
        }
        subtitle="The agreement between you and Lead Machine."
      />
      <LegalDoc lastUpdated={LAST_UPDATED} intro={intro} sections={sections} />
      <HomeFooter signedIn={signedIn} isAdmin={isAdmin} />
    </div>
  );
}
