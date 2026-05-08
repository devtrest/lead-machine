import { NextResponse } from "next/server";
import { discoverGoogleLeads } from "@/lib/google-leads";

function toBool(value: unknown, defaultValue: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return defaultValue;
}

function toInt(value: unknown, defaultValue: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function isAuthorized(req: Request) {
  const token = process.env.LEADS_API_BEARER?.trim();
  if (!token) return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${token}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!googleApiKey) {
    return NextResponse.json(
      { error: "Server missing GOOGLE_MAPS_API_KEY" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const keyword = typeof body?.keyword === "string" ? body.keyword.trim() : "";
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  const limit = toInt(body?.limit, 20, 1, 60);
  const includeEmails = toBool(body?.includeEmails, true);
  const maxEmailsPerLead = toInt(body?.maxEmailsPerLead, 3, 1, 10);

  if (keyword.length < 2 || location.length < 2) {
    return NextResponse.json(
      { error: "keyword and location are required" },
      { status: 400 }
    );
  }

  try {
    const leads = await discoverGoogleLeads({
      keyword,
      location,
      limit,
      includeEmails,
      maxEmailsPerLead,
      apiKey: googleApiKey,
    });

    return NextResponse.json({
      ok: true,
      query: { keyword, location, limit, includeEmails, maxEmailsPerLead },
      total: leads.length,
      leads,
      note: "Google Maps HTML scraping is not used. Data comes from Google Places API and public business websites.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lead discovery failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
