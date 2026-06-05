import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/outreach/StatusBadge";
import { CampaignDetail } from "@/components/outreach/CampaignDetail";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function CampaignDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaign } = await supabase
    .from("outreach_campaigns")
    .select(
      "id,name,status,scan_run_id,created_at,started_at,finished_at,daily_limit,scan_runs(keyword,location)"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!campaign) notFound();

  const niche = Array.isArray(campaign.scan_runs)
    ? campaign.scan_runs[0]
    : campaign.scan_runs;

  const [stepsRes, prospectsRes, leadsRes, sendersRes, campaignSendersRes] =
    await Promise.all([
      supabase
        .from("outreach_steps")
        .select("id,step_order,delay_days,subject,body")
        .eq("campaign_id", id)
        .order("step_order", { ascending: true }),
      supabase
        .from("outreach_prospects")
        .select(
          "id,lead_id,email,status,current_step,next_send_at,last_sent_at,leads(name,category)"
        )
        .eq("campaign_id", id)
        .order("added_at", { ascending: true }),
      // All leads in the source niche that have an email — so user can add
      // more prospects from the same niche.
      supabase
        .from("leads")
        .select("id,name,category,lead_contacts(email)")
        .eq("user_id", user.id)
        .eq("scan_run_id", campaign.scan_run_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("outreach_senders")
        .select("id,email,display_name")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase
        .from("outreach_campaign_senders")
        .select("sender_id")
        .eq("campaign_id", id),
    ]);

  const steps = (stepsRes.data ?? []).map((s) => ({
    id: s.id as string,
    step_order: s.step_order as number,
    delay_days: s.delay_days as number,
    subject: s.subject as string,
    body: s.body as string,
  }));

  // Lead-ids in this campaign that have at least one opened send. Used to
  // surface an "opened" badge on the prospect row.
  const { data: openedSends } = await supabase
    .from("email_sends")
    .select("lead_id")
    .eq("campaign_id", id)
    .eq("status", "sent")
    .not("first_opened_at", "is", null);
  const openedLeadIds = new Set(
    (openedSends ?? [])
      .map((r) => r.lead_id as string | null)
      .filter((v): v is string => Boolean(v))
  );

  type ProspectRow = {
    id: string;
    lead_id: string;
    email: string;
    status: string;
    current_step: number;
    next_send_at: string | null;
    last_sent_at: string | null;
    leads:
      | { name: string; category: string | null }
      | { name: string; category: string | null }[]
      | null;
  };
  const prospects = (prospectsRes.data ?? []).map((p) => {
    const row = p as ProspectRow;
    const leadObj = Array.isArray(row.leads) ? row.leads[0] ?? null : row.leads;
    return {
      id: row.id,
      leadId: row.lead_id,
      email: row.email,
      status: row.status,
      currentStep: row.current_step,
      nextSendAt: row.next_send_at,
      lastSentAt: row.last_sent_at,
      leadName: leadObj?.name ?? "(unknown lead)",
      leadCategory: leadObj?.category ?? null,
      opened: openedLeadIds.has(row.lead_id),
    };
  });

  const existingLeadIds = new Set(prospects.map((p) => p.leadId));
  type LeadRow = {
    id: string;
    name: string;
    category: string | null;
    lead_contacts: { email: string | null }[] | null;
  };
  const candidateLeads = ((leadsRes.data ?? []) as LeadRow[])
    .filter((l) => !existingLeadIds.has(l.id))
    .map((l) => {
      const email = (l.lead_contacts ?? [])
        .map((c) => c.email)
        .find((e): e is string => Boolean(e && e.length > 0));
      return email
        ? {
            id: l.id,
            name: l.name,
            category: l.category,
            email: email.toLowerCase(),
          }
        : null;
    })
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  // ---- Per-campaign stats: prospect breakdown + send/open counts -----------
  const todayMidnightUtc = new Date();
  todayMidnightUtc.setUTCHours(0, 0, 0, 0);
  const [sendsRes, sentTodayRes] = await Promise.all([
    supabase
      .from("email_sends")
      .select("status,first_opened_at")
      .eq("campaign_id", id),
    supabase
      .from("email_sends")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "sent")
      .gte("sent_at", todayMidnightUtc.toISOString()),
  ]);

  let sendsAttempted = 0;
  let sendsSent = 0;
  let sendsFailed = 0;
  let opens = 0;
  for (const row of sendsRes.data ?? []) {
    sendsAttempted += 1;
    if (row.status === "sent") sendsSent += 1;
    else if (row.status === "failed") sendsFailed += 1;
    if (row.first_opened_at) opens += 1;
  }

  // Prospect breakdown
  let pendingCount = 0;
  let inProgressCount = 0;
  let repliedCount = 0;
  let bouncedCount = 0;
  let completedCount = 0;
  for (const p of prospects) {
    if (p.status === "pending") pendingCount += 1;
    else if (p.status === "in_progress") inProgressCount += 1;
    else if (p.status === "replied") repliedCount += 1;
    else if (p.status === "bounced") bouncedCount += 1;
    else if (p.status === "completed") completedCount += 1;
  }

  const stats = {
    totalProspects: prospects.length,
    pending: pendingCount,
    inProgress: inProgressCount,
    replied: repliedCount,
    bounced: bouncedCount,
    completed: completedCount,
    sendsSent,
    sendsFailed,
    sendsAttempted,
    opens,
    sentToday: sentTodayRes.count ?? 0,
    dailyLimit: (campaign.daily_limit as number) ?? 50,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/user/outreach"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] transition hover:text-[var(--brand-700)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All campaigns
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
              {campaign.name}
            </h1>
            <StatusBadge status={campaign.status} />
          </div>
          {niche ? (
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Source:{" "}
              <span className="capitalize">{niche.keyword}</span> ·{" "}
              {niche.location}
            </p>
          ) : null}
        </div>
      </div>

      <CampaignDetail
        campaignId={campaign.id}
        initialName={campaign.name}
        initialStatus={campaign.status}
        steps={steps}
        prospects={prospects}
        candidateLeads={candidateLeads}
        stats={stats}
        senders={
          (sendersRes.data ?? []).map((s) => ({
            id: s.id as string,
            email: s.email as string,
            display_name: (s.display_name as string | null) ?? null,
          }))
        }
        attachedSenderIds={
          (campaignSendersRes.data ?? []).map((r) => r.sender_id as string)
        }
      />
    </div>
  );
}
