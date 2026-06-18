import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// POST /api/outreach/campaigns/[id]/start
// Flips a draft/paused campaign to active. Queues step 1 immediately
// (next_send_at = now) for all pending prospects. Optionally pings the
// Railway worker so the first send fires within seconds instead of waiting
// for the next 15-min tick.
export async function POST(_req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: campaign } = await supabase
    .from("outreach_campaigns")
    .select("id,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  // Note: we used to refuse with 409 "Already active" here. That was wrong
  // — it made the campaign UN-RECOVERABLE if it got stuck in the active-but-
  // never-sending state (e.g. started outside send window with the old non-
  // fast poke). Start is now idempotent: clicking it on an already-active
  // campaign re-pokes the worker with fast mode + campaignId, so the user
  // can unstick a campaign without having to Pause→Resume first.
  const wasActive = campaign.status === "active";

  // Make sure at least one step + one prospect exist.
  const { count: stepCount } = await supabase
    .from("outreach_steps")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id);
  if (!stepCount || stepCount === 0) {
    return NextResponse.json(
      { error: "Add at least one sequence step before starting" },
      { status: 400 }
    );
  }
  const { count: prospectCount } = await supabase
    .from("outreach_prospects")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id)
    .in("status", ["pending", "in_progress"]);
  if (!prospectCount || prospectCount === 0) {
    return NextResponse.json(
      { error: "No active prospects to send to" },
      { status: 400 }
    );
  }

  // Charge 1 credit per prospect that will receive the initial email.
  // Follow-ups (step 2+) are free for every plan. Enterprise is unmetered.
  // Skip the reservation when re-pokeing an already-active campaign — we
  // already charged on the first Start; re-charging would double-bill.
  if (!wasActive) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();
    const plan = (profile?.plan as string | null) ?? "starter";
    if (plan !== "enterprise") {
      const { data: reserved, error: rpcErr } = await supabase.rpc(
        "reserve_search_credits",
        { amount: prospectCount }
      );
      if (rpcErr) {
        return NextResponse.json({ error: rpcErr.message }, { status: 400 });
      }
      if (!reserved) {
        return NextResponse.json(
          {
            error: `Not enough credits. Starting this campaign needs ${prospectCount} (one per prospect for the initial email). Follow-ups are free.`,
          },
          { status: 402 }
        );
      }
    }
  }

  const nowIso = new Date().toISOString();

  await supabase
    .from("outreach_campaigns")
    .update({ status: "active", started_at: nowIso })
    .eq("id", id);

  // Queue step 1 for everyone still pending (don't disturb in-progress
  // prospects mid-sequence — their next_send_at is already scheduled).
  await supabase
    .from("outreach_prospects")
    .update({ next_send_at: nowIso })
    .eq("campaign_id", id)
    .eq("status", "pending");

  // Kick the worker so the first send goes out within seconds. The first
  // tick after Start runs in FAST mode — bypasses humanization delays,
  // ignores send-window/daily-limit checks for this campaign — so the user
  // sees prospects move out of 'pending' immediately. Follow-up steps go
  // through normal ticks which DO respect window + humanization, so
  // long-term cadence is unchanged.
  //
  // Without fast=true: most users hit "campaign active but all prospects
  // pending" because their campaign was created with default UTC timezone +
  // 9-5 window, and they Start it from a non-UTC timezone outside that
  // window — the worker silently skips the campaign as out-of-window. From
  // the user's perspective the system looks broken even though it's behaving
  // as configured.
  pokeWorker(id);

  return NextResponse.json({ ok: true });
}

function pokeWorker(campaignId: string): void {
  const workerUrl = process.env.WORKER_URL?.trim();
  const workerToken = process.env.WORKER_TOKEN?.trim();
  if (!workerUrl || !workerToken) return;
  // No await — truly fire-and-forget. The worker tick may run for tens of
  // seconds (one SMTP send per prospect, even in fast mode), longer than
  // Vercel Hobby's 30s function ceiling. Letting the request hang would
  // make the UI think Start failed when it's actually progressing fine.
  // The worker keeps running in the background regardless.
  fetch(`${workerUrl.replace(/\/$/, "")}/outreach/tick`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fast: true, campaignId }),
  }).catch((err) => {
    console.error("[outreach/start] worker poke failed:", err);
  });
}
