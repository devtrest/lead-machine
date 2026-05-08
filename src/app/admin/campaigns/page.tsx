import { Layers, Phone, Mail, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function AdminCampaignsPage() {
  const supabase = await createClient();

  const [{ data: roster }, { data: runs }, { data: leadRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,full_name")
      .limit(500),
    supabase
      .from("scan_runs")
      .select(
        "id,user_id,source,keyword,location,status,result_count,started_at,finished_at,error"
      )
      .order("started_at", { ascending: false })
      .limit(100),
    supabase
      .from("leads")
      .select(
        "id,name,address,website_url,user_id,lead_contacts(phone,email)"
      )
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const userMap = new Map(
    (roster ?? []).map((p) => [p.id, p.email ?? p.full_name ?? "—"])
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
          <Layers className="h-3.5 w-3.5" />
          Admin · Campaigns
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
          All campaigns
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Recent lead generation runs across every account.
        </p>
      </div>

      <section className="surface-card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--ink-strong)]">
            Recent runs
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
            Last {runs?.length ?? 0}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[var(--surface-sunken)]/60">
                <Th>Started</Th>
                <Th>Query</Th>
                <Th>Owner</Th>
                <Th>Status</Th>
                <Th align="right">Leads</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {(runs ?? []).map((run) => (
                <tr key={run.id} className="hover:bg-[var(--brand-50)]/40">
                  <Td className="whitespace-nowrap text-xs text-[var(--ink-muted)]">
                    {new Date(run.started_at ?? "").toLocaleString()}
                  </Td>
                  <Td>
                    <span className="font-medium text-[var(--ink-strong)]">
                      {run.keyword}
                    </span>
                    <span className="text-[var(--ink-subtle)]">
                      {" "}
                      · {run.location}
                    </span>
                  </Td>
                  <Td className="text-xs text-[var(--ink-muted)]">
                    {userMap.get(run.user_id ?? "") ?? "—"}
                  </Td>
                  <Td>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        run.status === "completed"
                          ? "bg-[var(--success-50)] text-[var(--success-700)]"
                          : run.status === "failed"
                            ? "bg-[var(--danger-50)] text-[var(--danger-700)]"
                            : "bg-[var(--warning-50)] text-[var(--warning-700)]"
                      }`}
                      title={run.error ?? undefined}
                    >
                      {run.status === "failed" ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : null}
                      {run.status}
                    </span>
                  </Td>
                  <Td align="right" className="tabular-nums font-semibold text-[var(--ink-strong)]">
                    {run.result_count}
                  </Td>
                </tr>
              ))}
              {(runs ?? []).length === 0 ? (
                <tr>
                  <Td colSpan={5} className="text-center text-[var(--ink-subtle)]">
                    No campaigns yet.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink-strong)]">
              Lead contact coverage
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              Recent leads with phones, emails, and websites.
            </p>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
            Last {leadRows?.length ?? 0}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[var(--surface-sunken)]/60">
                <Th>Lead</Th>
                <Th>Website</Th>
                <Th>Contacts</Th>
                <Th>Owner</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {(leadRows ?? []).map((lead) => {
                const phones = (lead.lead_contacts ?? []).filter((c) => c.phone);
                const emails = (lead.lead_contacts ?? []).filter((c) => c.email);
                return (
                  <tr key={lead.id} className="hover:bg-[var(--brand-50)]/40">
                    <Td>
                      <div className="font-medium text-[var(--ink-strong)]">
                        {lead.name}
                      </div>
                      <div className="text-xs text-[var(--ink-subtle)]">
                        {lead.address ?? "No address"}
                      </div>
                    </Td>
                    <Td className="max-w-[220px] truncate">
                      {lead.website_url ? (
                        <a
                          href={lead.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--brand-700)] hover:underline"
                        >
                          {lead.website_url
                            .replace(/^https?:\/\//, "")
                            .replace(/\/$/, "")}
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--ink-subtle)]">—</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex gap-1.5">
                        {phones.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-700)]">
                            <Phone className="h-3 w-3" />
                            {phones.length}
                          </span>
                        ) : null}
                        {emails.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-700)]">
                            <Mail className="h-3 w-3" />
                            {emails.length}
                          </span>
                        ) : null}
                        {phones.length === 0 && emails.length === 0 ? (
                          <span className="text-xs text-[var(--ink-subtle)]">—</span>
                        ) : null}
                      </div>
                    </Td>
                    <Td className="text-xs text-[var(--ink-muted)]">
                      {userMap.get(lead.user_id ?? "") ?? "—"}
                    </Td>
                  </tr>
                );
              })}
              {(leadRows ?? []).length === 0 ? (
                <tr>
                  <Td colSpan={4} className="text-center text-[var(--ink-subtle)]">
                    No leads yet.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)] ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
  align,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
  align?: "right";
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-5 py-3 text-sm ${align === "right" ? "text-right" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
