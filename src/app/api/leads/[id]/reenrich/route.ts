import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichFromWebsite } from "@/lib/lead-enrichment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

type Params = Promise<{ id: string }>;

// POST /api/leads/[id]/reenrich
//
// Re-runs the email enrichment pipeline against ONE lead's website. Used
// by the "Find email" button on rows that don't have an email — saves
// the user from re-enriching the whole campaign just to check one lead.
//
// No credit charge: the lead was already paid for at scrape time, and
// re-enrichment doesn't generate a new lead. Enrichment is a pure website
// crawl (find_emails.py) — no third-party API, no per-lookup cost.
export async function POST(_req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership + pull the data we need to run enrichment.
  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id,website_url,user_id,lead_contacts(email,phone,source_url)"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  const websiteUrl = (lead.website_url as string | null) ?? null;
  if (!websiteUrl) {
    return NextResponse.json(
      { error: "Lead has no website to crawl" },
      { status: 400 }
    );
  }

  type ContactRow = { email: string | null; phone: string | null };
  const existingContacts =
    (lead.lead_contacts as ContactRow[] | null) ?? [];
  const existingEmails = new Set(
    existingContacts
      .map((c) => c.email?.toLowerCase().trim())
      .filter((v): v is string => Boolean(v))
  );
  const existingPhones = new Set(
    existingContacts
      .map((c) => c.phone?.trim())
      .filter((v): v is string => Boolean(v))
  );

  // Hard 25 s deadline — fits inside Vercel's 30 s function ceiling with
  // headroom for the Supabase round-trips. The crawl walks up to 7 pages at
  // ~5 s each worst-case; 25 s catches the rare slow site without blowing the
  // Vercel ceiling.
  let enriched: Awaited<ReturnType<typeof enrichFromWebsite>>;
  try {
    enriched = await Promise.race([
      enrichFromWebsite(websiteUrl, 3),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("enrichment deadline")),
          25_000
        )
      ),
    ]);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Enrichment failed",
      },
      { status: 502 }
    );
  }

  // Insert any NEW emails/phones (skip ones already on the lead).
  const newEmails = enriched.emails.filter((e) => !existingEmails.has(e));
  const newPhones = enriched.phones.filter((p) => !existingPhones.has(p));

  if (newEmails.length === 0 && newPhones.length === 0) {
    return NextResponse.json({
      ok: true,
      found: false,
      message:
        "No new email or phone found — site may be form-only or use a contact form.",
    });
  }

  const sourceUrl = enriched.sourceUrls[0] ?? websiteUrl;
  const rows: Array<{
    lead_id: string;
    phone: string | null;
    email: string | null;
    website_url: string | null;
    source_url: string | null;
  }> = [];

  for (const email of newEmails) {
    rows.push({
      lead_id: id,
      phone: null,
      email,
      website_url: websiteUrl,
      source_url: sourceUrl,
    });
  }
  for (const phone of newPhones) {
    rows.push({
      lead_id: id,
      phone,
      email: null,
      website_url: websiteUrl,
      source_url: sourceUrl,
    });
  }

  const { error: insErr } = await supabase
    .from("lead_contacts")
    .insert(rows);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    found: true,
    newEmails,
    newPhones,
    source: sourceUrl,
  });
}
