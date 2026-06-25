import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/leads/import
// Body: { name: string, rows: [{ email, name?, company?, phone? }] }
//
// Turns a user-uploaded contact list into a prospect list the outreach wizard
// can target: creates a completed scan_run (so it shows up alongside scraped
// lists), one lead per row, and an email contact per lead. No credits charged —
// importing your own contacts isn't a scrape; the campaign still charges 1
// credit per prospect for the first send, same as any list.
//
// scan_runs.source is CHECK-constrained to ('google_maps','osm'), so we tag the
// run as google_maps but set location = "Imported" to mark its origin.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_ROWS = 5_000;

type IncomingRow = {
  email?: unknown;
  name?: unknown;
  company?: unknown;
  phone?: unknown;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rawName =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim()
      : "Imported list";
  const name = rawName.slice(0, 80);
  const rows: IncomingRow[] = Array.isArray(body?.rows) ? body.rows : [];

  // Validate + de-dupe emails.
  const clean: { email: string; name: string | null; phone: string | null }[] =
    [];
  const seen = new Set<string>();
  for (const r of rows) {
    const email = String(r?.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 120 || seen.has(email)) continue;
    seen.add(email);
    const nm = String(r?.name ?? "").trim() || String(r?.company ?? "").trim();
    const phone = String(r?.phone ?? "").trim();
    clean.push({
      email,
      name: nm ? nm.slice(0, 120) : null,
      phone: phone ? phone.slice(0, 40) : null,
    });
    if (clean.length >= MAX_ROWS) break;
  }

  if (clean.length === 0) {
    return NextResponse.json(
      { error: "No valid email addresses found in that file." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();

  // 1) The prospect list (scan_run).
  const { data: run, error: runErr } = await supabase
    .from("scan_runs")
    .insert({
      user_id: user.id,
      source: "google_maps",
      keyword: name,
      location: "Imported",
      status: "completed",
      limit_count: clean.length,
      result_count: clean.length,
      started_at: nowIso,
      finished_at: nowIso,
    })
    .select("id")
    .single();
  if (runErr || !run) {
    return NextResponse.json(
      { error: runErr?.message ?? "Could not create the list." },
      { status: 500 }
    );
  }
  const runId = run.id as string;

  // 2) Leads (RETURNING preserves input order for the contact mapping below).
  const leadRows = clean.map((r) => ({
    user_id: user.id,
    scan_run_id: runId,
    source: "import",
    name: r.name ?? r.email.split("@")[0],
    category: "Imported",
    dedupe_key: `import:${runId}:${r.email}`,
  }));
  const { data: insertedLeads, error: leadErr } = await supabase
    .from("leads")
    .insert(leadRows)
    .select("id");
  if (leadErr || !insertedLeads) {
    // Roll back the empty run so it doesn't linger as a 0-lead list.
    await supabase.from("scan_runs").delete().eq("id", runId);
    return NextResponse.json(
      { error: leadErr?.message ?? "Could not import leads." },
      { status: 500 }
    );
  }

  // 3) One email contact per lead (+ phone when present).
  const contactRows: Array<{
    lead_id: string;
    email: string | null;
    phone: string | null;
    website_url: string | null;
    source_url: string | null;
  }> = [];
  insertedLeads.forEach((lead, i) => {
    const r = clean[i];
    if (!r) return;
    contactRows.push({
      lead_id: lead.id as string,
      email: r.email,
      phone: null,
      website_url: null,
      source_url: "import",
    });
    if (r.phone) {
      contactRows.push({
        lead_id: lead.id as string,
        email: null,
        phone: r.phone,
        website_url: null,
        source_url: "import",
      });
    }
  });
  if (contactRows.length > 0) {
    await supabase.from("lead_contacts").insert(contactRows);
  }

  return NextResponse.json({
    list: {
      id: runId,
      keyword: name,
      location: "Imported",
      total: clean.length,
      emailable: clean.length,
    },
  });
}
