import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/outreach/inbox-check
// Pokes the Railway worker's /inbox/check endpoint so an IMAP poll fires
// immediately. User auth is checked here; the worker call uses the shared
// WORKER_TOKEN bearer.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerUrl = process.env.WORKER_URL?.trim();
  const workerToken = process.env.WORKER_TOKEN?.trim();
  if (!workerUrl || !workerToken) {
    return NextResponse.json(
      {
        error:
          "Worker not configured — set WORKER_URL and WORKER_TOKEN on Vercel.",
      },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      `${workerUrl.replace(/\/$/, "")}/inbox/check`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${workerToken}` },
      }
    );
    const json = (await res.json().catch(() => ({}))) as {
      senders?: number;
      fetched?: number;
      matched?: number;
      errors?: number;
      error?: string;
    };
    if (!res.ok) {
      return NextResponse.json(
        { error: json.error ?? `Worker returned ${res.status}` },
        { status: 502 }
      );
    }
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Worker unreachable" },
      { status: 502 }
    );
  }
}
