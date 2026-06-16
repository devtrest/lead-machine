import type { User } from "@supabase/supabase-js";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHero } from "@/components/home/PageHero";
import { ContactForm } from "@/components/home/ContactForm";
import { HomeFooter } from "@/components/home/HomeFooter";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Contact — Lead Machine",
  description:
    "Questions about Lead Machine, billing, or enterprise volume? Get in touch — we reply within one business day.",
};

export default async function ContactPage() {
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
        eyebrow="Contact"
        title={
          <>
            Let&apos;s <span className="brand-text-gradient">talk</span>.
          </>
        }
        subtitle="Whether it's a product question, a billing issue, or custom enterprise volume — we're one message away and reply within a business day."
      />
      <ContactForm />
      <HomeFooter signedIn={signedIn} isAdmin={isAdmin} />
    </div>
  );
}
