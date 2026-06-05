import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const ALLOWED_CATEGORIES = new Set([
  "interested",
  "meeting_booked",
  "not_interested",
  "out_of_office",
  "unsubscribe",
  "wrong_person",
  "other",
]);

// PATCH /api/outreach/replies/[id]
// Body accepts any combination of:
//   read: boolean            (toggle read_at)
//   starred: boolean         (toggle starred)
//   archived: boolean        (toggle archived_at)
//   category: string | null  (set / clear category)
//   notes: string            (replace notes)
export async function PATCH(req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    read?: boolean;
    starred?: boolean;
    archived?: boolean;
    category?: string | null;
    notes?: string;
  };

  const patch: Record<string, unknown> = {};
  if (body.read === true) patch.read_at = new Date().toISOString();
  if (body.read === false) patch.read_at = null;
  if (typeof body.starred === "boolean") patch.starred = body.starred;
  if (body.archived === true) patch.archived_at = new Date().toISOString();
  if (body.archived === false) patch.archived_at = null;
  if (body.category === null) {
    patch.category = null;
  } else if (typeof body.category === "string") {
    if (!ALLOWED_CATEGORIES.has(body.category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    patch.category = body.category;
  }
  if (typeof body.notes === "string") patch.notes = body.notes;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("outreach_replies")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
