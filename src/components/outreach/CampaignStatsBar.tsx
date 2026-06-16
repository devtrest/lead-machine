"use client";

import { motion } from "framer-motion";
import {
  Users,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Gauge,
  type LucideIcon,
} from "lucide-react";

export type CampaignStats = {
  totalProspects: number;
  pending: number;
  inProgress: number;
  replied: number;
  bounced: number;
  completed: number;
  sendsSent: number;
  sendsFailed: number;
  sendsAttempted: number;
  opens: number;
  sentToday: number;
  dailyLimit: number;
};

type Card = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent: string;
  bg: string;
};

export function CampaignStatsBar({ stats }: { stats: CampaignStats }) {
  const contacted = stats.sendsSent;
  const openRate =
    contacted > 0 ? Math.round((stats.opens / contacted) * 100) : 0;
  const replyRate =
    contacted > 0 ? Math.round((stats.replied / contacted) * 100) : 0;
  const progressPct =
    stats.totalProspects > 0
      ? Math.min(
          100,
          Math.round(
            ((stats.totalProspects - stats.pending) / stats.totalProspects) *
              100
          )
        )
      : 0;
  const dailyPct =
    stats.dailyLimit > 0
      ? Math.min(100, Math.round((stats.sentToday / stats.dailyLimit) * 100))
      : 0;

  const cards: Card[] = [
    {
      label: "Prospects",
      value: stats.totalProspects,
      hint: `${stats.pending} pending`,
      icon: Users,
      accent: "var(--ink-strong)",
      bg: "var(--surface-sunken)",
    },
    {
      label: "Contacted",
      value: contacted,
      hint:
        stats.sendsFailed > 0
          ? `${stats.sendsFailed} failed`
          : `${stats.inProgress} in progress`,
      icon: Send,
      accent: "var(--brand-700)",
      bg: "var(--brand-50)",
    },
    {
      label: "Pending",
      value: stats.pending,
      hint: "no email sent yet",
      icon: Clock,
      accent: "var(--warning-700)",
      bg: "var(--warning-50)",
    },
    {
      label: "Replied",
      value: stats.replied,
      hint: contacted > 0 ? `${replyRate}% reply rate` : undefined,
      icon: CheckCircle2,
      accent: "var(--success-700)",
      bg: "var(--success-50)",
    },
    {
      label: "Opened",
      value: stats.opens,
      hint: contacted > 0 ? `${openRate}% open rate` : undefined,
      icon: Eye,
      accent: "var(--sky-700)",
      bg: "var(--sky-50)",
    },
    {
      label: "Bounced",
      value: stats.bounced,
      hint: stats.bounced > 0 ? "3+ failed attempts" : undefined,
      icon: XCircle,
      accent: "var(--danger-700)",
      bg: "var(--danger-50)",
    },
  ];

  return (
    <div className="space-y-3">
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05 } },
        }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="surface-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-subtle)]">
                  {card.label}
                </div>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset"
                  style={{
                    backgroundColor: card.bg,
                    color: card.accent,
                    boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.04)",
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-3 text-xl font-semibold tracking-tight tabular-nums text-[var(--ink-strong)]">
                {card.value}
              </div>
              {card.hint ? (
                <div className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
                  {card.hint}
                </div>
              ) : null}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Progress bars row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ProgressCard
          label="Campaign progress"
          icon={Gauge}
          value={progressPct}
          right={`${stats.totalProspects - stats.pending} / ${stats.totalProspects} reached`}
          color="var(--brand-600)"
        />
        <ProgressCard
          label="Today's pace"
          icon={Send}
          value={dailyPct}
          right={`${stats.sentToday} / ${stats.dailyLimit} sent today`}
          color={
            dailyPct >= 100 ? "var(--warning-700)" : "var(--success-700)"
          }
        />
      </div>
    </div>
  );
}

function ProgressCard({
  label,
  icon: Icon,
  value,
  right,
  color,
}: {
  label: string;
  icon: LucideIcon;
  value: number;
  right: string;
  color: string;
}) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <span className="text-[11px] tabular-nums text-[var(--ink-muted)]">{right}</span>
      </div>
      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <div className="mt-1 text-right text-[11px] font-semibold tabular-nums text-[var(--ink-strong)]">
        {value}%
      </div>
    </div>
  );
}
