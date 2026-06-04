import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SendersManager } from "@/components/outreach/SendersManager";

export const dynamic = "force-dynamic";

export default async function SendersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: senders } = await supabase
    .from("outreach_senders")
    .select(
      "id,email,display_name,provider,daily_limit,sends_today,last_reset_at,status,last_error,created_at"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/user/outreach"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] transition hover:text-[var(--brand-700)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Outreach
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
          Sender accounts
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Connect Gmail accounts that will send your outreach emails. The
          worker rotates across enabled senders to respect Gmail&apos;s
          ~500/day per-account limit and reduce spam-flag risk.
        </p>
      </div>

      <SendersManager initialSenders={senders ?? []} />
    </div>
  );
}
