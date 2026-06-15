// POST /api/outreach/campaigns/[id]/send-now
//
// "Send all pending now" — for demos and urgent blasts where instant beats
// humanization. Flips the campaign active if it isn't already, resets every
// pending prospect's next_send_at to NOW, and pokes the worker with fast=true
// + campaignId so it skips inter-send delays, send-window checks, and
// daily-limit caps. Worker still uses the Vercel SMTP relay so sends actually
// land.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

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

  // Pre-flight: must have a step and at least one pending/in_progress prospect.
  const { count: stepCount } = await supabase
    .from("outreach_steps")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id);
  if (!stepCount || stepCount === 0) {
    return NextResponse.json(
      { error: "Add at least one sequence step before sending" },
      { status: 400 }
    );
  }

  const { count: pendingCount } = await supabase
    .from("outreach_prospects")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id)
    .in("status", ["pending", "in_progress"]);
  if (!pendingCount || pendingCount === 0) {
    return NextResponse.json(
      { error: "No pending prospects to send to" },
      { status: 400 }
    );
  }

  // Reserve credits ONLY if the campaign is still draft (haven't charged yet).
  // Active/paused campaigns already had their credits deducted at start time —
  // re-charging on Send-Now would double-bill the user.
  if (campaign.status === "draft") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();
    const plan = (profile?.plan as string | null) ?? "starter";
    if (plan !== "enterprise") {
      const { data: reserved, error: rpcErr } = await supabase.rpc(
        "reserve_search_credits",
        { amount: pendingCount }
      );
      if (rpcErr) {
        return NextResponse.json({ error: rpcErr.message }, { status: 400 });
      }
      if (!reserved) {
        return NextResponse.json(
          {
            error: `Not enough credits. Sending needs ${pendingCount} (one per prospect for the initial email). Follow-ups are free.`,
          },
          { status: 402 }
        );
      }
    }
  }

  const nowIso = new Date().toISOString();

  // Activate + zero out next_send_at for everyone still pending so they're
  // all picked up in the same tick.
  await supabase
    .from("outreach_campaigns")
    .update({
      status: "active",
      ...(campaign.status === "draft" ? { started_at: nowIso } : {}),
    })
    .eq("id", id);

  await supabase
    .from("outreach_prospects")
    .update({ next_send_at: nowIso, retry_count: 0 })
    .eq("campaign_id", id)
    .in("status", ["pending", "in_progress"]);

  // Poke worker — synchronously this time so we return real send counts to
  // the UI instead of "kicked, watch the page".
  const result = await pokeWorker(id);

  return NextResponse.json({ ok: true, ...result });
}

async function pokeWorker(campaignId: string): Promise<Record<string, unknown>> {
  const workerUrl = process.env.WORKER_URL?.trim();
  const workerToken = process.env.WORKER_TOKEN?.trim();
  if (!workerUrl || !workerToken) {
    return { workerCalled: false };
  }
  try {
    const res = await fetch(
      `${workerUrl.replace(/\/$/, "")}/outreach/tick`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${workerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fast: true, campaignId }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { workerCalled: true, worker: json };
  } catch (err) {
    console.error("[outreach/send-now] worker poke failed:", err);
    return {
      workerCalled: true,
      workerError: err instanceof Error ? err.message : "unknown",
    };
  }
}
