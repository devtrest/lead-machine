"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Plus,
  Mail,
  Send,
  Users,
  TrendingUp,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/outreach/StatusBadge";

// String keys instead of function references so server components can pass
// these props across the server→client boundary without serialization issues.
export type IconKey = "activity" | "send" | "users" | "trending-up" | "mail";

const ICON_MAP: Record<IconKey, LucideIcon> = {
  activity: Activity,
  send: Send,
  users: Users,
  "trending-up": TrendingUp,
  mail: Mail,
};

type HeroStat = {
  label: string;
  value: number | string;
  iconKey: IconKey;
  accent: string;
  bg: string;
};

export type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  scan_run_id: string;
  created_at: string;
  niche: { keyword: string; location: string } | null;
  prospects: number;
  contacted: number;
  replied: number;
  bounced: number;
  sentLast7Days: number[];
};

export function OutreachDashboard({
  heroStats,
  campaigns,
}: {
  heroStats: HeroStat[];
  campaigns: CampaignSummary[];
}) {
  const EmptyIcon = Mail;
  return (
    <div className="space-y-6">
      {/* Hero stats */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.06 } },
        }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {heroStats.map((stat) => {
          const Icon = ICON_MAP[stat.iconKey];
          return (
            <motion.div
              key={stat.label}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="surface-card relative overflow-hidden p-4"
            >
              <div className="flex items-start justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
                  {stat.label}
                </div>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: stat.bg, color: stat.accent }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-[var(--ink-strong)]">
                {stat.value}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Campaigns table */}
      {campaigns.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <EmptyIcon className="mx-auto h-10 w-10 text-[var(--ink-subtle)]" />
          <h3 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
            No outreach campaigns yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--ink-muted)]">
            Build your first campaign in 3 steps: pick a niche, write the
            sequence, hit start. The worker handles the rest.
          </p>
          <Link
            href="/user/outreach/new"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
          >
            <Plus className="h-4 w-4" />
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="surface-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-sunken)]/60">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Campaign
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Prospects
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Contacted
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Replied
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    7d activity
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {campaigns.map((c, i) => (
                  <CampaignRow key={c.id} campaign={c} delay={i * 0.03} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignRow({
  campaign,
  delay,
}: {
  campaign: CampaignSummary;
  delay: number;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="group hover:bg-[var(--brand-50)]/40"
    >
      <td className="px-5 py-3.5">
        <Link
          href={`/user/outreach/${campaign.id}`}
          className="block min-w-0"
        >
          <div className="truncate text-sm font-medium text-[var(--ink-strong)] group-hover:text-[var(--brand-700)]">
            {campaign.name}
          </div>
          {campaign.niche ? (
            <div className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
              <span className="capitalize">{campaign.niche.keyword}</span> ·{" "}
              {campaign.niche.location}
            </div>
          ) : null}
        </Link>
      </td>
      <td className="px-5 py-3.5">
        <StatusBadge status={campaign.status} />
      </td>
      <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-[var(--ink-strong)]">
        {campaign.prospects}
      </td>
      <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-[var(--ink-strong)]">
        {campaign.contacted}
      </td>
      <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-[var(--success-700)]">
        {campaign.replied}
      </td>
      <td className="px-5 py-3.5">
        <Sparkline values={campaign.sentLast7Days} />
      </td>
      <td className="px-5 py-3.5 text-right">
        <Link
          href={`/user/outreach/${campaign.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-700)] transition group-hover:gap-1.5 group-hover:text-[var(--brand-800)]"
        >
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </td>
    </motion.tr>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-8 items-end gap-0.5">
      {values.map((v, i) => {
        const heightPct = max === 0 ? 0 : (v / max) * 100;
        return (
          <div
            key={i}
            title={`Day ${i + 1}: ${v} sent`}
            className="w-2 rounded-sm bg-[var(--brand-200)] transition group-hover:bg-[var(--brand-500)]"
            style={{ height: `${Math.max(6, heightPct)}%` }}
          />
        );
      })}
    </div>
  );
}
