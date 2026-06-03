import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

type StepInput = {
  step_order?: number;
  delay_days?: number;
  subject?: string;
  body?: string;
};

// PUT /api/outreach/campaigns/[id]/steps
// Replaces the entire sequence atomically. Body: { steps: [{subject, body, delay_days}, ...] }
// Step order is derived from array index (1-based). Step 1 always has delay_days=0.
export async function PUT(req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { steps?: StepInput[] };
  const steps = Array.isArray(body.steps) ? body.steps : [];
  if (steps.length === 0) {
    return NextResponse.json({ error: "At least one step required" }, { status: 400 });
  }

  // Verify campaign ownership.
  const { data: campaign } = await supabase
    .from("outreach_campaigns")
    .select("id,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Block edits while running. User must pause first to revise the sequence.
  if (campaign.status === "active") {
    return NextResponse.json(
      { error: "Pause the campaign before editing its sequence" },
      { status: 409 }
    );
  }

  const rows = steps.map((s, idx) => {
    const subject = (s.subject ?? "").toString();
    const stepBody = (s.body ?? "").toString();
    if (!subject.trim() || !stepBody.trim()) {
      throw new Error(`Step ${idx + 1} needs a subject and body`);
    }
    return {
      campaign_id: id,
      step_order: idx + 1,
      delay_days: idx === 0 ? 0 : Math.max(0, Math.floor(Number(s.delay_days) || 0)),
      subject: subject.trim(),
      body: stepBody,
    };
  });

  // Delete existing then insert new — small N, safe to do as two ops.
  const del = await supabase
    .from("outreach_steps")
    .delete()
    .eq("campaign_id", id);
  if (del.error) {
    return NextResponse.json({ error: del.error.message }, { status: 400 });
  }

  const ins = await supabase.from("outreach_steps").insert(rows);
  if (ins.error) {
    return NextResponse.json({ error: ins.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
