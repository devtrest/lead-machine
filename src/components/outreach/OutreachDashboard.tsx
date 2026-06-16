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
  Eye,
  Reply,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/outreach/StatusBadge";

// String keys instead of function references so server components can pass
// these props across the server→client boundary without serialization issues.
export type IconKey =
  | "activity"
  | "send"
  | "users"
  | "trending-up"
  | "mail"
  | "eye";

const ICON_MAP: Record<IconKey, LucideIcon> = {
  activity: Activity,
  send: Send,
  users: Users,
  "trending-up": TrendingUp,
  mail: Mail,
  eye: Eye,
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
  opens: number;
  contactedSends: number;
  sentLast7Days: number[];
};

export function OutreachDashboard({
  heroStats,
  campaigns,
}: {
  heroStats: HeroStat[];
  campaigns: CampaignSummary[];
}) {
  return (
    <div className="space-y-6">
      {/* Hero stats row — five compact KPI tiles with brand-blob accents */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.06 } },
        }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
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
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-30 blur-2xl"
                style={{ background: stat.bg }}
                aria-hidden
              />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
                    {stat.label}
                  </div>
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset ring-white/40"
                    style={{ backgroundColor: stat.bg, color: stat.accent }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-[var(--ink-strong)]">
                  {stat.value}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Campaign cards grid */}
      {campaigns.length === 0 ? (
        <EmptyState />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.04 } },
          }}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="surface-card relative overflow-hidden p-12 text-center">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-gradient-to-br from-[var(--sky-200)] to-[var(--brand-100)] opacity-30 blur-3xl"
        aria-hidden
      />
      <div className="relative">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-100)]">
          <Mail className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[var(--ink-strong)]">
          No outreach campaigns yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-muted)]">
          Build your first email campaign in three steps: pick the prospect
          list, write the sequence, hit start. The worker handles delivery,
          rotation, and reply detection.
        </p>
        <Link
          href="/user/outreach/new"
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)] transition hover:bg-[var(--brand-700)]"
        >
          <Plus className="h-4 w-4" />
          Create your first campaign
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const contactedPct =
    campaign.prospects > 0
      ? Math.min(100, Math.round((campaign.contacted / campaign.prospects) * 100))
      : 0;
  const openRate =
    campaign.contactedSends > 0
      ? Math.round((campaign.opens / campaign.contactedSends) * 100)
      : 0;
  const replyRate =
    campaign.contacted > 0
      ? Math.round((campaign.replied / campaign.contacted) * 100)
      : 0;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/user/outreach/${campaign.id}`}
        className="surface-card group relative block overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-25 blur-2xl transition group-hover:opacity-45"
          aria-hidden
        />
        <div className="relative">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold text-[var(--ink-strong)] group-hover:text-[var(--brand-700)]">
                  {campaign.name}
                </h3>
              </div>
              {campaign.niche ? (
                <div className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                  <span className="capitalize">{campaign.niche.keyword}</span>{" "}
                  · {campaign.niche.location}
                </div>
              ) : null}
            </div>
            <StatusBadge status={campaign.status} />
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-[var(--ink-muted)]">Contacted</span>
              <span className="font-semibold tabular-nums text-[var(--ink-strong)]">
                {campaign.contacted}
                <span className="text-[var(--ink-subtle)]">
                  {" "}
                  / {campaign.prospects}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--sky-500)]"
                initial={{ width: 0 }}
                animate={{ width: `${contactedPct}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          {/* Metrics row */}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Metric
              icon={<Eye className="h-3 w-3" />}
              label="Opens"
              value={campaign.opens}
              suffix={openRate > 0 ? `${openRate}%` : null}
              tone="sky"
            />
            <Metric
              icon={<Reply className="h-3 w-3" />}
              label="Replies"
              value={campaign.replied}
              suffix={replyRate > 0 ? `${replyRate}%` : null}
              tone="success"
            />
            <Metric
              icon={<TrendingUp className="h-3 w-3" />}
              label="7d activity"
              value={null}
              sparkline={campaign.sentLast7Days}
              tone="brand"
            />
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
            <span className="text-[10px] text-[var(--ink-subtle)]">
              Created{" "}
              {new Date(campaign.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-700)] transition group-hover:gap-1.5">
              Open <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Metric({
  icon,
  label,
  value,
  suffix,
  sparkline,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  suffix?: string | null;
  sparkline?: number[];
  tone: "brand" | "sky" | "success";
}) {
  const toneMap = {
    brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
    sky: "bg-[var(--sky-50)] text-[var(--sky-700)]",
    success: "bg-[var(--success-50)] text-[var(--success-700)]",
  };
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink-subtle)]">
          {label}
        </span>
        <span
          className={`flex h-5 w-5 items-center justify-center rounded ${toneMap[tone]}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-1.5">
        {sparkline ? (
          <Sparkline values={sparkline} />
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold tabular-nums text-[var(--ink-strong)]">
              {value ?? 0}
            </span>
            {suffix ? (
              <span className="text-[10px] font-semibold text-[var(--ink-subtle)]">
                {suffix}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-5 items-end gap-0.5">
      {values.map((v, i) => {
        const heightPct = max === 0 ? 0 : (v / max) * 100;
        return (
          <div
            key={i}
            title={`Day ${i + 1}: ${v} sent`}
            className="w-1.5 rounded-sm bg-gradient-to-t from-[var(--brand-300)] to-[var(--brand-500)] transition"
            style={{ height: `${Math.max(15, heightPct)}%` }}
          />
        );
      })}
    </div>
  );
}
