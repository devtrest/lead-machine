import { Users as UsersIcon } from "lucide-react";
import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import { createClient } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: roster } = await supabase
    .from("profiles")
    .select("id,email,full_name,plan,credits,role,suspended,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
          <UsersIcon className="h-3.5 w-3.5" />
          Admin · Users
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
          User management
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Add or subtract credits, suspend, or delete accounts inline.
        </p>
      </div>

      <section className="surface-card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--ink-strong)]">
            Accounts
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
            {roster?.length ?? 0} total
          </span>
        </div>
        <AdminUsersTable users={roster ?? []} />
      </section>
    </div>
  );
}
