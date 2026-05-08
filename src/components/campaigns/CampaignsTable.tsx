"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, AlertTriangle } from "lucide-react";

type Run = {
  id: string;
  keyword: string;
  location: string;
  source: string;
  status: string;
  limit_count: number;
  result_count: number;
  started_at: string;
  finished_at: string | null;
  error: string | null;
};

export function CampaignsTable({ runs }: { runs: Run[] }) {
  return (
    <div className="surface-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-sunken)]/60">
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                Niche
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                Location
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                Status
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                Leads
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                Started
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {runs.map((run, i) => (
              <motion.tr
                key={run.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025, duration: 0.22 }}
                className="hover:bg-[var(--brand-50)]/40"
              >
                <td className="px-5 py-3.5">
                  <div className="font-medium text-[var(--ink-strong)]">
                    {run.keyword}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-[var(--ink-muted)]">
                  {run.location}
                </td>
                <td className="px-5 py-3.5">
                  <StatusPill status={run.status} error={run.error} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="text-sm font-semibold tabular-nums text-[var(--ink-strong)]">
                    {run.result_count}
                  </span>
                  <span className="ml-1 text-xs text-[var(--ink-subtle)]">
                    / {run.limit_count}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-xs text-[var(--ink-muted)]">
                  {new Date(run.started_at).toLocaleString()}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {run.result_count > 0 ? (
                    <Link
                      href={`/user/leads?campaign=${run.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-800)]"
                    >
                      View leads <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : null}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status, error }: { status: string; error: string | null }) {
  const cls =
    status === "completed"
      ? "bg-[var(--success-50)] text-[var(--success-700)] border-[var(--success-100)]"
      : status === "failed"
        ? "bg-[var(--danger-50)] text-[var(--danger-700)] border-[var(--danger-100)]"
        : "bg-[var(--warning-50)] text-[var(--warning-700)] border-[var(--warning-100)]";
  return (
    <span
      title={error ?? undefined}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {status === "failed" ? <AlertTriangle className="h-3 w-3" /> : null}
      {status}
    </span>
  );
}
