import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  scrapeGoogleMaps,
  type ProgressEvent,
} from "@/lib/google-maps-scraper";
import { enrichFromWebsite } from "@/lib/lead-enrichment";
import { expandKeyword, expandLocation } from "@/lib/keyword-cluster";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Per-request leads cap (not the plan's lifetime grant — that's enforced
// separately by reserve_search_credits running against the user's balance).
function ceilingForPlan(plan: string | null | undefined) {
  switch (plan) {
    case "premium":
      return 2_000;
    case "pro":
      return 5_000;
    case "enterprise":
      return 10_000;
    default:
      return 500;
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

  // Concurrency cap: at most 5 campaigns scraping at once per user. Keeps the
  // worker load bounded and the account efficient. Checked before reserving
  // credits so a rejected start costs nothing.
  const MAX_CONCURRENT_RUNS = 5;
  const { count: runningCount } = await supabase
    .from("scan_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "running");
  if ((runningCount ?? 0) >= MAX_CONCURRENT_RUNS) {
    return jsonError(
      `You can run up to ${MAX_CONCURRENT_RUNS} campaigns at once. Wait for one to finish, then start another.`,
      429
    );
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

  // Drain the worker stream in the BACKGROUND so the connection completes
  // cleanly on the worker side AND we get to refund unused credits when
  // it's done. The Vercel function returns immediately so the user's
  // browser doesn't sit on a 60-300 s SSE connection — they get redirected
  // to /user/jobs in ~200 ms and watch the run fill in via scan_runs polls.
  //
  // Why background-drain instead of just abandoning the request: if we
  // close the upstream without reading it, the worker's res.write() will
  // raise EPIPE and abort the scrape mid-flight. The drain is a no-op
  // pump that just lets the worker finish.
  void (async () => {
    const reader = workerRes.body!.getReader();
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch (err) {
      console.error("[lead-engine] background drain error", err);
    } finally {
      // Refund any unused portion of the up-front credit reservation.
      // result_count is updated by the worker as it goes; reading it once
      // the stream is done gives us the final delivered count.
      if (plan !== "enterprise") {
        const { data: run } = await supabase
          .from("scan_runs")
          .select("result_count,status")
          .eq("id", scanRunId)
          .maybeSingle();

        const delivered = run?.result_count ?? 0;
        const status = run?.status ?? "running";
        const refund =
          status === "failed" ? limit : Math.max(0, limit - delivered);
        if (refund > 0) {
          await supabase
            .rpc("refund_search_credits", { amount: refund })
            .then(({ error }) => {
              if (error) console.error("[lead-engine] refund failed", error);
            });
        }
      }
    }
  })();

  // Acknowledge immediately. The frontend never read the SSE events anyway
  // — it just redirects to /user/jobs and polls scan_runs. Returning JSON
  // instead of SSE means the Vercel function completes in <1 s instead of
  // sitting open for 60-300 s and racing the function timeout.
  return NextResponse.json({
    ok: true,
    scanRunId,
    // status echo so the existing GenerateForm submit handler can detect
    // "accepted" without changing its expectations.
    status: "running",
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
        // Query grid: vary location (geographic) + keyword to beat the ~60/
        // query Places cap and actually reach the target. Mirrors the worker.
        type Place = Awaited<ReturnType<typeof scrapeGoogleMaps>>[number];
        const seen = new Set<string>();
        const collected: Place[] = [];
        const keyOf = (r: Place) =>
          `${r.title.toLowerCase()}|${(r.placeUrl ?? r.websiteUrl ?? "").toLowerCase()}`;

        const reportProgress = async () => {
          const n = Math.min(limit, collected.length);
          send({ phase: "discovering", count: n, target: limit });
          await supabase
            .from("scan_runs")
            .update({ result_count: n })
            .eq("id", scanRunId)
            .eq("user_id", userId)
            .then(
              () => {},
              () => {}
            );
        };

        const runQuery = async (kw: string, loc: string) => {
          if (collected.length >= limit) return;
          const found = await scrapeGoogleMaps({
            keyword: kw,
            location: loc,
            maxResults: 60,
            onProgress: () => {},
          });
          for (const r of found) {
            if (collected.length >= limit) break;
            const k = keyOf(r);
            if (seen.has(k)) continue;
            seen.add(k);
            collected.push(r);
          }
          await reportProgress();
        };

        const locations = [location, ...expandLocation(location)];
        for (const loc of locations) {
          if (collected.length >= limit) break;
          await runQuery(keyword, loc);
        }
        if (collected.length < limit) {
          const altKeywords = await expandKeyword(keyword, 14);
          for (const kw of altKeywords) {
            if (collected.length >= limit) break;
            for (const loc of locations) {
              if (collected.length >= limit) break;
              await runQuery(kw, loc);
            }
          }
        }
        const results = collected.slice(0, limit);

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

        // Surface the lead count live while the slower harvest runs.
        await supabase
          .from("scan_runs")
          .update({ result_count: results.length })
          .eq("id", scanRunId)
          .eq("user_id", userId);

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
          const HARVEST_CONCURRENCY = 10;
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
