import { Activity, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function AdminActivityPage() {
  const supabase = await createClient();

  const { data: signals } = await supabase
    .from("enterprise_requests")
    .select("id,email,note,status,created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
          <Activity className="h-3.5 w-3.5" />
          Admin · Activity
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
          Enterprise queue
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Inbound requests from prospective Enterprise customers.
        </p>
      </div>

      <section className="surface-card p-6">
        {(signals ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-sunken)]/40 px-6 py-14 text-center">
            <Inbox className="mx-auto h-8 w-8 text-[var(--ink-subtle)]" />
            <p className="mt-3 text-sm font-medium text-[var(--ink-strong)]">
              No enterprise requests yet.
            </p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Inbound from the Pricing page will land here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(signals ?? []).map((s) => (
              <article
                key={s.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[var(--ink-strong)]">
                    {s.email ?? "anonymous"}
                  </span>
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">
                    {s.status}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-strong)]">
                  {s.note ?? (
                    <span className="text-[var(--ink-subtle)]">No note</span>
                  )}
                </p>
                <p className="mt-2 text-[11px] text-[var(--ink-subtle)]">
                  {new Date(s.created_at ?? "").toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
