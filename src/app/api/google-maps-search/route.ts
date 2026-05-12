import { createClient } from "@/lib/supabase/server";
import {
  scrapeGoogleMaps,
  type ProgressEvent,
} from "@/lib/google-maps-scraper";
import { enrichFromWebsite } from "@/lib/lead-enrichment";
import { expandKeyword } from "@/lib/keyword-cluster";

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

  if (!user) return jsonError("Unauthorized", 401);

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

  // Reserve `limit` credits up front (1 credit per requested lead).
  if (plan !== "enterprise") {
    const { data: reserved, error: rpcError } = await supabase.rpc(
      "reserve_search_credits",
      { amount: limit }
    );
    if (rpcError) {
      const msg = /function .* does not exist/i.test(rpcError.message)
        ? "Run supabase/credit_reservation.sql to enable per-lead billing."
        : rpcError.message;
      return jsonError(msg, 400);
    }
    if (!reserved) {
      return jsonError(
        `Not enough credits. You need ${limit} but have fewer. Top up on the Billing page.`,
        402
      );
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

  // Route to the worker if WORKER_URL is set (production on Vercel + Railway);
  // otherwise run the scrape in-process (local dev convenience).
  const workerUrl = process.env.WORKER_URL?.trim();
  const workerToken = process.env.WORKER_TOKEN?.trim();

  if (workerUrl && workerToken) {
    return proxyToWorker({
      workerUrl,
      workerToken,
      scanRunId,
      userId,
      keyword,
      location,
      target: limit,
      limit,
      plan,
      supabase,
    });
  }

  return runEmbeddedScrape({
    scanRunId,
    userId,
    keyword,
    location,
    limit,
    plan,
    supabase,
  });
}

/**
 * Proxy path — production. The Railway worker does the scraping and DB
 * writes. We just forward the SSE stream to the browser and refund unused
 * credits when the worker finishes.
 */
async function proxyToWorker(opts: {
  workerUrl: string;
  workerToken: string;
  scanRunId: string;
  userId: string;
  keyword: string;
  location: string;
  target: number;
  limit: number;
  plan: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const { workerUrl, workerToken, scanRunId, limit, plan, supabase } = opts;

  let workerRes: Response;
  try {
    workerRes = await fetch(`${workerUrl.replace(/\/$/, "")}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scanRunId,
        userId: opts.userId,
        keyword: opts.keyword,
        location: opts.location,
        target: opts.target,
      }),
    });
  } catch (err) {
    // Worker unreachable — refund and bail.
    if (plan !== "enterprise") {
      await supabase.rpc("refund_search_credits", { amount: limit });
    }
    await markRunFailed(supabase, scanRunId, "Lead engine unreachable");
    return jsonError(
      err instanceof Error ? err.message : "Worker unreachable",
      502
    );
  }

  if (!workerRes.ok || !workerRes.body) {
    if (plan !== "enterprise") {
      await supabase.rpc("refund_search_credits", { amount: limit });
    }
    const msg = await workerRes.text().catch(() => "Worker failed");
    await markRunFailed(supabase, scanRunId, msg);
    return jsonError(msg, 502);
  }

  const upstream = workerRes.body;
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (err) {
        console.error("[lead-engine] stream pump error", err);
      } finally {
        // Worker stream ended. Read final scan_run state and refund any
        // unused credits (we reserved `limit` up front).
        if (plan !== "enterprise") {
          const { data: run } = await supabase
            .from("scan_runs")
            .select("result_count,status")
            .eq("id", scanRunId)
            .maybeSingle();

          const delivered = run?.result_count ?? 0;
          const status = run?.status ?? "running";

          // If the run failed, refund everything; otherwise refund the diff.
          const refund =
            status === "failed" ? limit : Math.max(0, limit - delivered);
          if (refund > 0) {
            await supabase
              .rpc("refund_search_credits", { amount: refund })
              .then(({ error }) => {
                if (error) {
                  console.error("[lead-engine] refund failed", error);
                }
              });
          }
        }
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

/**
 * Embedded path — local dev, where running a separate worker container is
 * inconvenient. Does the scrape in the Next.js process, same as before the
 * Vercel+Railway split.
 */
async function runEmbeddedScrape(opts: {
  scanRunId: string;
  userId: string;
  keyword: string;
  location: string;
  limit: number;
  plan: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const { scanRunId, userId, keyword, location, limit, plan, supabase } = opts;

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
        let results = await scrapeGoogleMaps({
          keyword,
          location,
          maxResults: limit,
          onProgress: (e) => send(e),
        });

        if (results.length < limit) {
          const expanded = await expandKeyword(keyword, 6);
          const seen = new Set(
            results.map(
              (r) => `${r.title.toLowerCase()}|${(r.placeUrl ?? "").toLowerCase()}`
            )
          );
          for (const altKeyword of expanded) {
            if (results.length >= limit) break;
            const needed = limit - results.length;
            const extra = await scrapeGoogleMaps({
              keyword: altKeyword,
              location,
              maxResults: Math.min(needed * 2, limit),
              onProgress: (e) => {
                if (
                  e.phase === "discovering" ||
                  e.phase === "extracting" ||
                  e.phase === "enriching"
                ) {
                  send({
                    phase: e.phase,
                    count: Math.min(limit, results.length + e.count),
                    target: limit,
                  });
                }
              },
            });
            for (const r of extra) {
              const key = `${r.title.toLowerCase()}|${(r.placeUrl ?? "").toLowerCase()}`;
              if (seen.has(key)) continue;
              seen.add(key);
              results.push(r);
              if (results.length >= limit) break;
            }
          }
          results = results.slice(0, limit);
        }

        send({ phase: "saving" });

        if (plan !== "enterprise" && results.length < limit) {
          await supabase
            .rpc("refund_search_credits", { amount: limit - results.length })
            .then(({ error: refundErr }) => {
              if (refundErr) {
                console.error("[lead-engine] refund failed", refundErr);
              }
            });
        }

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
        if (plan !== "enterprise") {
          await supabase
            .rpc("refund_search_credits", { amount: limit })
            .then(({ error: refundErr }) => {
              if (refundErr) {
                console.error(
                  "[lead-engine] refund-on-fail failed",
                  refundErr
                );
              }
            });
        }
        await markRunFailed(supabase, scanRunId, message);
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

async function markRunFailed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scanRunId: string,
  message: string
) {
  await supabase
    .from("scan_runs")
    .update({
      status: "failed",
      error: message,
      finished_at: new Date().toISOString(),
    })
    .eq("id", scanRunId);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
