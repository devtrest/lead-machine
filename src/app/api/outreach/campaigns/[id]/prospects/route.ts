import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// POST /api/outreach/campaigns/[id]/prospects
// Body: { leadIds: string[] }
// Imports leads as prospects. Skips leads without emails. Duplicates (lead
// already in this campaign) are ignored via the (campaign_id, lead_id)
// unique constraint.
export async function POST(req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { leadIds?: string[] };
  const leadIds = Array.isArray(body.leadIds) ? body.leadIds : [];
  if (leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds required" }, { status: 400 });
  }

  // Verify campaign ownership + status. Active campaigns charge credits
  // when prospects are added (one credit per prospect for the initial
  // email). Drafts and paused campaigns are free — the credit reservation
  // happens at Start time instead.
  const { data: campaign } = await supabase
    .from("outreach_campaigns")
    .select("id,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Resolve emails. We cache the first email per lead onto the prospect row
  // so future contact-row edits don't change who we'll send to.
  const { data: leads } = await supabase
    .from("leads")
    .select("id,lead_contacts(email)")
    .eq("user_id", user.id)
    .in("id", leadIds);

  type LeadRow = {
    id: string;
    lead_contacts: { email: string | null }[] | null;
  };

  const rows: { campaign_id: string; lead_id: string; email: string }[] = [];
  for (const lead of (leads ?? []) as LeadRow[]) {
    const email = (lead.lead_contacts ?? [])
      .map((c) => c.email)
      .find((e): e is string => Boolean(e && e.length > 0));
    if (email) {
      rows.push({ campaign_id: id, lead_id: lead.id, email: email.toLowerCase() });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ added: 0, skipped: leadIds.length });
  }

  // De-dup against rows already in the DB so we only charge for genuinely
  // new prospects. Without this, adding the same lead twice (which the
  // unique constraint already silently rejects) would still deduct credits.
  const { data: alreadyIn } = await supabase
    .from("outreach_prospects")
    .select("lead_id")
    .eq("campaign_id", id)
    .in(
      "lead_id",
      rows.map((r) => r.lead_id)
    );
  const existing = new Set((alreadyIn ?? []).map((r) => r.lead_id as string));
  const fresh = rows.filter((r) => !existing.has(r.lead_id));

  if (campaign.status === "active" && fresh.length > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();
    const plan = (profile?.plan as string | null) ?? "starter";
    if (plan !== "enterprise") {
      const { data: reserved, error: rpcErr } = await supabase.rpc(
        "reserve_search_credits",
        { amount: fresh.length }
      );
      if (rpcErr) {
        return NextResponse.json({ error: rpcErr.message }, { status: 400 });
      }
      if (!reserved) {
        return NextResponse.json(
          {
            error: `Adding ${fresh.length} prospect${fresh.length === 1 ? "" : "s"} to a running campaign costs ${fresh.length} credit${fresh.length === 1 ? "" : "s"}. Top up on the Billing page.`,
          },
          { status: 402 }
        );
      }
    }
  }

  const { error } = await supabase
    .from("outreach_prospects")
    .upsert(rows, { onConflict: "campaign_id,lead_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    added: fresh.length,
    skipped: leadIds.length - fresh.length,
    charged: campaign.status === "active" ? fresh.length : 0,
  });
}
