import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/outreach/campaigns/create-full
// One-shot campaign creation from the wizard. Body:
//   {
//     name: string,
//     scanRunIds: string[],        // "prospect list folders" to import from
//     steps: [{subject, body, delay_days}],
//     senderIds: string[],         // outreach_senders.id values to attach
//     startNow: boolean            // true = flip status to 'active' immediately
//   }
//
// Atomically does:
//   1. inserts the campaign (status='draft' or 'active' per startNow)
//   2. inserts steps with step_order=1..N (step 1 has delay_days=0 forced)
//   3. imports all leads-with-emails from each scanRunId as prospects
//   4. attaches senders to campaign
//   5. if startNow, sets next_send_at=now for all pending prospects and
//      pokes the worker /outreach/tick so the first send fires immediately
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    scanRunIds?: string[];
    steps?: { subject?: string; body?: string; delay_days?: number }[];
    senderIds?: string[];
    dailyLimit?: number;
    startNow?: boolean;
  };

  const name = body.name?.trim();
  const scanRunIds = Array.isArray(body.scanRunIds) ? body.scanRunIds : [];
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const senderIds = Array.isArray(body.senderIds) ? body.senderIds : [];
  const dailyLimit = Math.max(
    1,
    Math.min(500, Math.floor(Number(body.dailyLimit) || 50))
  );
  const startNow = Boolean(body.startNow);

  // ---- Validate ----
  if (!name) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }
  if (scanRunIds.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one prospect list" },
      { status: 400 }
    );
  }
  if (steps.length === 0) {
    return NextResponse.json(
      { error: "Add at least one sequence step" },
      { status: 400 }
    );
  }
  for (const [i, s] of steps.entries()) {
    if (!s.subject?.trim() || !s.body?.trim()) {
      return NextResponse.json(
        { error: `Step ${i + 1}: subject and body are required` },
        { status: 400 }
      );
    }
  }
  if (startNow && senderIds.length === 0) {
    return NextResponse.json(
      { error: "Attach at least one sender before starting" },
      { status: 400 }
    );
  }

  // Verify scan_runs all belong to this user.
  const { data: ownedRuns } = await supabase
    .from("scan_runs")
    .select("id")
    .eq("user_id", user.id)
    .in("id", scanRunIds);
  const ownedRunIds = new Set((ownedRuns ?? []).map((r) => r.id));
  if (ownedRunIds.size !== scanRunIds.length) {
    return NextResponse.json(
      { error: "One or more prospect lists are not yours" },
      { status: 403 }
    );
  }

  // Verify senders all belong to this user and are active.
  if (senderIds.length > 0) {
    const { data: ownedSenders } = await supabase
      .from("outreach_senders")
      .select("id,status")
      .eq("user_id", user.id)
      .in("id", senderIds);
    const ownedSenderIds = new Set(
      (ownedSenders ?? []).filter((s) => s.status === "active").map((s) => s.id)
    );
    if (ownedSenderIds.size !== senderIds.length) {
      return NextResponse.json(
        { error: "One or more senders are inactive or not yours" },
        { status: 403 }
      );
    }
  }

  // ---- 1. Create campaign (use the first scan_run as the canonical
  // scan_run_id for compatibility; the full prospect set is imported
  // explicitly below across all selected runs). ----
  const { data: campaign, error: campErr } = await supabase
    .from("outreach_campaigns")
    .insert({
      user_id: user.id,
      scan_run_id: scanRunIds[0],
      name,
      status: "draft",
      daily_limit: dailyLimit,
    })
    .select("id")
    .single();
  if (campErr || !campaign) {
    return NextResponse.json(
      { error: campErr?.message ?? "Couldn't create campaign" },
      { status: 400 }
    );
  }
  const campaignId = campaign.id as string;

  // ---- 2. Insert sequence steps ----
  const stepRows = steps.map((s, idx) => ({
    campaign_id: campaignId,
    step_order: idx + 1,
    delay_days:
      idx === 0 ? 0 : Math.max(0, Math.floor(Number(s.delay_days) || 0)),
    subject: s.subject!.trim(),
    body: s.body!,
  }));
  const stepsRes = await supabase.from("outreach_steps").insert(stepRows);
  if (stepsRes.error) {
    return NextResponse.json({ error: stepsRes.error.message }, { status: 400 });
  }

  // ---- 3. Import prospects from all selected scan_runs ----
  const { data: leads } = await supabase
    .from("leads")
    .select("id,lead_contacts(email)")
    .eq("user_id", user.id)
    .in("scan_run_id", scanRunIds);

  type LeadRow = {
    id: string;
    lead_contacts: { email: string | null }[] | null;
  };
  const prospectRows: { campaign_id: string; lead_id: string; email: string }[] =
    [];
  for (const lead of (leads ?? []) as LeadRow[]) {
    const email = (lead.lead_contacts ?? [])
      .map((c) => c.email)
      .find((e): e is string => Boolean(e && e.length > 0));
    if (email) {
      prospectRows.push({
        campaign_id: campaignId,
        lead_id: lead.id,
        email: email.toLowerCase(),
      });
    }
  }
  if (prospectRows.length > 0) {
    await supabase
      .from("outreach_prospects")
      .upsert(prospectRows, {
        onConflict: "campaign_id,lead_id",
        ignoreDuplicates: true,
      });
  }

  // ---- 4. Attach senders ----
  if (senderIds.length > 0) {
    await supabase.from("outreach_campaign_senders").insert(
      senderIds.map((sid) => ({
        campaign_id: campaignId,
        sender_id: sid,
      }))
    );
  }

  // ---- 5. Start if requested ----
  if (startNow && prospectRows.length > 0) {
    const nowIso = new Date().toISOString();
    await supabase
      .from("outreach_campaigns")
      .update({ status: "active", started_at: nowIso })
      .eq("id", campaignId);
    await supabase
      .from("outreach_prospects")
      .update({ next_send_at: nowIso })
      .eq("campaign_id", campaignId)
      .eq("status", "pending");
    void pokeWorker(); // fire-and-forget
  }

  return NextResponse.json({
    id: campaignId,
    prospects: prospectRows.length,
    steps: steps.length,
    started: startNow,
  });
}

async function pokeWorker(): Promise<void> {
  const workerUrl = process.env.WORKER_URL?.trim();
  const workerToken = process.env.WORKER_TOKEN?.trim();
  if (!workerUrl || !workerToken) return;
  try {
    await fetch(`${workerUrl.replace(/\/$/, "")}/outreach/tick`, {
      method: "POST",
      headers: { Authorization: `Bearer ${workerToken}` },
    });
  } catch (err) {
    console.error("[create-full] worker poke failed:", err);
  }
}
