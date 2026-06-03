import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmailComposer } from "@/components/email-campaigns/EmailComposer";

export const dynamic = "force-dynamic";

type Params = Promise<{ runId: string }>;

type LeadRow = {
  id: string;
  name: string;
  category: string | null;
  website_url: string | null;
  lead_contacts: { email: string | null }[] | null;
};

export default async function ComposePage({ params }: { params: Params }) {
  const { runId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: run } = await supabase
    .from("scan_runs")
    .select("id,keyword,location,result_count,started_at")
    .eq("id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!run) notFound();

  const { data: leads } = await supabase
    .from("leads")
    .select("id,name,category,website_url,lead_contacts(email)")
    .eq("user_id", user.id)
    .eq("scan_run_id", runId)
    .order("created_at", { ascending: true });

  const emailable = ((leads ?? []) as LeadRow[])
    .map((lead) => {
      const emails = (lead.lead_contacts ?? [])
        .map((c) => c.email)
        .filter((e): e is string => Boolean(e && e.length > 0));
      const uniqueEmails = Array.from(new Set(emails.map((e) => e.toLowerCase())));
      return {
        id: lead.id,
        name: lead.name,
        category: lead.category,
        websiteUrl: lead.website_url,
        emails: uniqueEmails,
      };
    })
    .filter((lead) => lead.emails.length > 0);

  // Lookup of how many times each lead has been emailed (for the "already
  // contacted" badge). One query, grouped client-side.
  const { data: sendRows } = await supabase
    .from("email_sends")
    .select("lead_id,status")
    .eq("user_id", user.id)
    .eq("scan_run_id", runId);

  const sendCountByLead = new Map<string, number>();
  for (const row of sendRows ?? []) {
    if (row.status === "sent") {
      sendCountByLead.set(
        row.lead_id,
        (sendCountByLead.get(row.lead_id) ?? 0) + 1
      );
    }
  }

  const recipients = emailable.map((lead) => ({
    ...lead,
    timesEmailed: sendCountByLead.get(lead.id) ?? 0,
  }));

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/user/email-campaigns"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] transition hover:text-[var(--brand-700)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All email campaigns
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
          Compose to{" "}
          <span className="capitalize text-[var(--brand-700)]">
            {run.keyword}
          </span>{" "}
          · {run.location}
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {recipients.length} of {run.result_count} leads have an email address.
        </p>
      </div>

      <EmailComposer
        runId={run.id}
        recipients={recipients}
        senderName={profile?.full_name ?? null}
        senderEmail={profile?.email ?? user.email ?? null}
      />
    </div>
  );
}
