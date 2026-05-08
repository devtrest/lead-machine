import { createClient } from "@/lib/supabase/server";
import {
  scrapeGoogleMaps,
  type ProgressEvent,
} from "@/lib/google-maps-scraper";
import { enrichFromWebsite } from "@/lib/lead-enrichment";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function ceilingForPlan(plan: string | null | undefined) {
  switch (plan) {
    case "premium":
      return 250;
    case "pro":
      return 1000;
    case "enterprise":
      return 5000;
    default:
      return 50;
  }
}

type StreamEvent =
  | ProgressEvent
  | { phase: "harvesting"; count: number; target: number }
  | { phase: "saving" }
  | { phase: "saved"; runId: string; total: number }
  | { phase: "error"; message: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  const keyword =
    typeof body?.keyword === "string" ? body.keyword.trim() : "";
  const location =
    typeof body?.location === "string" ? body.location.trim() : "";
  const requestedTarget =
    typeof body?.target === "number" && Number.isFinite(body.target)
      ? Math.max(1, Math.floor(body.target))
      : 50;

  if (keyword.length < 2 || location.length < 2) {
    return jsonError("Keyword and location required", 400);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan,credits")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return jsonError("Profile unavailable — finish Supabase setup.", 400);
  }

  const plan = profile.plan as string;
  const ceiling = ceilingForPlan(plan);
  const limit = Math.min(requestedTarget, ceiling);

  if (plan !== "enterprise") {
    const { data: consumed, error: rpcError } = await supabase.rpc(
      "consume_search_credit"
    );
    if (rpcError) return jsonError(rpcError.message, 400);
    if (!consumed) {
      return jsonError("Credits depleted · upgrade or buy refill.", 402);
    }
  }

  const { data: runRow, error: runInsertError } = await supabase
    .from("scan_runs")
    .insert({
      user_id: user.id,
      source: "google_maps",
      keyword,
      location,
      limit_count: limit,
      status: "running",
    })
    .select("id")
    .single();

  if (runInsertError || !runRow) {
    return jsonError(runInsertError?.message ?? "Could not create scan run.", 400);
  }

  const scanRunId = runRow.id as string;
  const userId = user.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          /* controller closed */
        }
      };

      try {
        const results = await scrapeGoogleMaps({
          keyword,
          location,
          maxResults: limit,
          onProgress: (e) => send(e),
        });

        send({ phase: "saving" });

        if (results.length === 0) {
          await supabase
            .from("scan_runs")
            .update({
              status: "completed",
              result_count: 0,
              finished_at: new Date().toISOString(),
            })
            .eq("id", scanRunId)
            .eq("user_id", userId);
          send({ phase: "saved", runId: scanRunId, total: 0 });
          controller.close();
          return;
        }

        const leadRows = results.map((lead) => {
          const normalizedWebsite = lead.websiteUrl?.trim() || null;
          const dedupeKey = [
            lead.title.trim().toLowerCase(),
            (normalizedWebsite ?? lead.placeUrl ?? "").toLowerCase(),
          ].join("|");
          return {
            user_id: userId,
            scan_run_id: scanRunId,
            source: "google_maps",
            name: lead.title,
            category: lead.category ?? null,
            address: lead.address ?? null,
            rating: lead.rating ? Number(lead.rating) : null,
            review_count: lead.reviews
              ? Number(lead.reviews.replace(/[^\d]/g, "")) || null
              : null,
            maps_url: lead.placeUrl ?? null,
            website_url: normalizedWebsite,
            dedupe_key: dedupeKey,
          };
        });

        const { data: insertedLeads, error: leadsError } = await supabase
          .from("leads")
          .insert(leadRows)
          .select("id,website_url,name,maps_url");

        if (leadsError) throw leadsError;

        const contactRows: {
          lead_id: string;
          phone: string | null;
          email: string | null;
          website_url: string | null;
          source_url: string | null;
        }[] = [];

        for (const [idx, lead] of (insertedLeads ?? []).entries()) {
          const phone = results[idx]?.phone;
          if (phone) {
            contactRows.push({
              lead_id: lead.id as string,
              phone,
              email: null,
              website_url: (lead.website_url as string | null) ?? null,
              source_url: (lead.maps_url as string | null) ?? null,
            });
          }
        }

        // Email harvesting: crawl each lead's website (and /contact, /about)
        // for emails + extra phones, in parallel batches with progress events.
        const harvestable = (insertedLeads ?? [])
          .map((lead, idx) => ({ lead, idx }))
          .filter(({ lead }) => Boolean(lead.website_url));

        if (harvestable.length > 0) {
          send({
            phase: "harvesting",
            count: 0,
            target: harvestable.length,
          });
          const HARVEST_CONCURRENCY = 5;
          let cursor = 0;
          let done = 0;
          await Promise.all(
            Array.from({ length: HARVEST_CONCURRENCY }).map(async () => {
              while (true) {
                const i = cursor++;
                if (i >= harvestable.length) break;
                const { lead } = harvestable[i];
                const websiteUrl = lead.website_url as string;
                try {
                  const enriched = await enrichFromWebsite(websiteUrl, 3);
                  const sourceUrl = enriched.sourceUrls[0] ?? websiteUrl;
                  for (const email of enriched.emails) {
                    contactRows.push({
                      lead_id: lead.id as string,
                      phone: null,
                      email,
                      website_url: websiteUrl,
                      source_url: sourceUrl,
                    });
                  }
                  for (const phone of enriched.phones) {
                    contactRows.push({
                      lead_id: lead.id as string,
                      phone,
                      email: null,
                      website_url: websiteUrl,
                      source_url: sourceUrl,
                    });
                  }
                } catch {
                  /* best-effort */
                }
                done += 1;
                send({
                  phase: "harvesting",
                  count: done,
                  target: harvestable.length,
                });
              }
            })
          );
        }

        if (contactRows.length > 0) {
          const { error: contactsError } = await supabase
            .from("lead_contacts")
            .insert(contactRows);
          if (contactsError) {
            console.error(
              "[lead-engine] contact insert warning",
              contactsError
            );
          }
        }

        await supabase
          .from("scan_runs")
          .update({
            status: "completed",
            result_count: results.length,
            finished_at: new Date().toISOString(),
          })
          .eq("id", scanRunId)
          .eq("user_id", userId);

        send({ phase: "saved", runId: scanRunId, total: results.length });
        controller.close();
      } catch (err) {
        console.error("[lead-engine]", err);
        const message =
          err instanceof Error
            ? err.message
            : "The lead engine couldn't complete this run. Try again.";
        await supabase
          .from("scan_runs")
          .update({
            status: "failed",
            error: message,
            finished_at: new Date().toISOString(),
          })
          .eq("id", scanRunId)
          .eq("user_id", userId);
        send({ phase: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
