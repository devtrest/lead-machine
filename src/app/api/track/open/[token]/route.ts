import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF — the smallest valid image we can return.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

type Params = Promise<{ token: string }>;

// GET /api/track/open/[token] — invoked by the recipient's mail client when
// they open the email. Records the open in email_opens, bumps open_count
// on email_sends. Returns the 1x1 pixel no matter what so a tracking failure
// never breaks the email display.
//
// Caveats around open tracking accuracy:
//   - Gmail and Apple Mail proxy images through their CDN, so we record
//     "image fetched" not "human opened". Still useful as a signal.
//   - Some clients (Outlook, plain-text mode) won't load images at all.
//   - Privacy-conscious recipients may block tracking. Don't treat the
//     absence of opens as confirmation they didn't read it.
export async function GET(_req: Request, ctx: { params: Params }) {
  const { token } = await ctx.params;

  const ua = _req.headers.get("user-agent") ?? null;
  // Best-effort IP — Vercel sets x-forwarded-for, x-real-ip varies.
  const ip =
    _req.headers.get("x-real-ip") ??
    _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  // Service role — open events come from arbitrary mail clients with no
  // auth, so we bypass RLS to record them. Pure insert; can't be abused
  // to read anyone else's data.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key && token && token.length >= 8) {
    try {
      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: send } = await supabase
        .from("email_sends")
        .select("id,open_count,first_opened_at")
        .eq("open_token", token)
        .maybeSingle();
      if (send) {
        await supabase.from("email_opens").insert({
          send_id: send.id,
          ip,
          user_agent: ua,
        });
        await supabase
          .from("email_sends")
          .update({
            open_count: (send.open_count as number) + 1,
            first_opened_at:
              (send.first_opened_at as string | null) ??
              new Date().toISOString(),
          })
          .eq("id", send.id);
      }
    } catch (err) {
      console.error("[track/open] insert failed:", err);
    }
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": PIXEL.length.toString(),
      // Aggressive no-cache so every open is logged separately if the
      // client re-fetches.
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
