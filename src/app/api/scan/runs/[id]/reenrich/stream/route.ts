import { createClient } from "@/lib/supabase/server";
import { harvestRunInProcess } from "@/lib/reenrich-inprocess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type Params = Promise<{ id: string }>;

// POST /api/scan/runs/[id]/reenrich/stream
//
// Streaming variant of the re-enrich endpoint. Returns Server-Sent Events so
// the Email finder UI can decrement the "without email" count live and drive a
// progress bar as each website is crawled. No credits charged.
//
// Event shapes (one JSON object per `data:` line):
//   { phase: "progress", done, total, newEmails }
//   { phase: "done", attempted, newEmails, newPhones, skipped, remaining }
//   { phase: "error", message }
//
// Two execution paths, mirroring the JSON route:
//   - Worker set (production): proxy the worker's SSE stream straight through.
//   - No worker (dev): generate the stream in-process.
export async function POST(_req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return sseError("Unauthorized", 401);

  const { data: run } = await supabase
    .from("scan_runs")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!run) return sseError("Run not found", 404);

  const workerUrl = process.env.WORKER_URL?.trim();
  const workerToken = process.env.WORKER_TOKEN?.trim();

  // Production — proxy the worker's SSE stream directly to the browser.
  if (workerUrl && workerToken) {
    let workerRes: Response;
    try {
      workerRes = await fetch(`${workerUrl.replace(/\/$/, "")}/scrape/reenrich`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${workerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scanRunId: id, userId: user.id, stream: true }),
      });
    } catch (err) {
      return sseError(
        err instanceof Error ? err.message : "Couldn't reach the re-enrich worker",
        502
      );
    }

    if (!workerRes.ok || !workerRes.body) {
      const msg = await workerRes.text().catch(() => "Worker failed");
      return sseError(msg || `Worker returned ${workerRes.status}`, 502);
    }

    return new Response(workerRes.body, { status: 200, headers: sseHeaders() });
  }

  // Dev — run the harvest in-process and emit SSE as it goes.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          /* controller closed */
        }
      };
      try {
        const result = await harvestRunInProcess(supabase, id, user.id, {
          onProgress: (p) => send({ phase: "progress", ...p }),
        });
        send({ phase: "done", ...result });
      } catch (err) {
        send({
          phase: "error",
          message: err instanceof Error ? err.message : "Re-enrichment failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { status: 200, headers: sseHeaders() });
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

// Send a single error event as a (still valid) SSE stream so the client's
// reader sees a structured { phase: "error" } instead of a parse failure.
function sseError(message: string, status: number): Response {
  const body = `data: ${JSON.stringify({ phase: "error", message })}\n\n`;
  return new Response(body, { status, headers: sseHeaders() });
}
