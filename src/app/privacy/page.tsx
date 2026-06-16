import type { User } from "@supabase/supabase-js";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHero } from "@/components/home/PageHero";
import { LegalDoc, type LegalSection } from "@/components/home/LegalDoc";
import { HomeFooter } from "@/components/home/HomeFooter";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Privacy Policy — Lead Machine",
  description:
    "How Lead Machine collects, uses, stores, and protects your data — including lead data, email sender credentials, and account information.",
};

const LAST_UPDATED = "June 16, 2026";

const sections: LegalSection[] = [
  {
    heading: "Who we are",
    body: [
      "Lead Machine (“we”, “us”) provides an AI-powered lead generation and cold-email outreach platform. This policy explains what data we handle when you use the website and the app, and the choices you have.",
    ],
  },
  {
    heading: "Information we collect",
    bullets: [
      "Account data: your name, email address, and authentication credentials managed through our auth provider.",
      "Billing data: handled by Stripe. We store a customer reference and plan/credit balance, not full card numbers.",
      "Lead data you generate: business names, addresses, public phone numbers, emails, and websites surfaced from public sources and your scans.",
      "Sender credentials: if you connect a mailbox, the app password / token is stored encrypted at rest and used only to send and read your outreach.",
      "Usage data: log and diagnostic information needed to operate and secure the service.",
    ],
  },
  {
    heading: "How we use your information",
    bullets: [
      "To operate the product: run scans, enrich leads, send your outreach sequences, and surface replies in your Unibox.",
      "To process payments and manage your credits and plan.",
      "To secure the service, prevent abuse, and provide support.",
      "To send you transactional emails (receipts, trial reminders, important account notices).",
    ],
  },
  {
    heading: "Email outreach and sender accounts",
    body: [
      "When you connect a mailbox, you authorize Lead Machine to send messages on your behalf and to read inbound messages for the purpose of detecting replies to your campaigns. You are responsible for ensuring your outreach complies with applicable anti-spam laws (such as CAN-SPAM and GDPR) and your email provider’s terms.",
    ],
  },
  {
    heading: "Data sharing",
    body: [
      "We do not sell your data. We share data only with the processors needed to run the service — for example our hosting, database/auth, and payment providers — each under their own contractual and security obligations.",
    ],
  },
  {
    heading: "Data retention",
    body: [
      "We retain your account and lead data for as long as your account is active. You can export or delete your leads at any time. When you close your account, we delete or anonymize your personal data within a reasonable period, except where we must retain records for legal or accounting reasons.",
    ],
  },
  {
    heading: "Security",
    body: [
      "We use per-account isolation and row-level security so each customer can only access their own data. Sender credentials are encrypted at rest. No system is perfectly secure, but we work to protect your information using industry-standard measures.",
    ],
  },
  {
    heading: "Your rights (incl. GDPR)",
    bullets: [
      "Access, correct, or delete your personal data.",
      "Export the leads and data you have generated.",
      "Object to or restrict certain processing.",
      "Withdraw mailbox access at any time by disconnecting a sender.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "For any privacy request or question, email hello@leadmachine.ai and we will respond within a reasonable timeframe.",
    ],
  },
];

export default async function PrivacyPage() {
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
            Privacy <span className="brand-text-gradient">Policy</span>
          </>
        }
        subtitle="What we collect, why, and the control you have over your data."
      />
      <LegalDoc lastUpdated={LAST_UPDATED} sections={sections} />
      <HomeFooter signedIn={signedIn} isAdmin={isAdmin} />
    </div>
  );
}
