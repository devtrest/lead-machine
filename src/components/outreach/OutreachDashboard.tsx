"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Pause,
  Play,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/outreach/StatusBadge";
import { useToast } from "@/components/ui/Toast";

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
              className="surface-card p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
                  {stat.label}
                </div>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset"
                  style={{
                    backgroundColor: stat.bg,
                    color: stat.accent,
                    boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.04)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-4 text-2xl font-semibold tracking-tight tabular-nums text-[var(--ink-strong)]">
                {stat.value}
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
    <div className="surface-card flex flex-col items-center p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
        <Mail className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-[var(--ink-strong)]">
        No outreach campaigns yet
      </h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--ink-muted)]">
        Build your first email campaign in three steps: pick the prospect list,
        write the sequence, hit start. The worker handles delivery, rotation,
        and reply detection.
      </p>
      <Link
        href="/user/outreach/new"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-xs)] transition hover:bg-[var(--brand-700)]"
      >
        <Plus className="h-4 w-4" />
        Create your first campaign
      </Link>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"pause" | "resume" | null>(null);
  // Local status mirror so the badge + buttons flip without waiting for the
  // server round-trip. router.refresh() syncs the rest of the page.
  const [status, setStatus] = useState(campaign.status);

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

  // Pause / resume from the list view — same endpoints the detail page uses.
  // Pause = PATCH status=paused on the campaign row (worker tick skips paused
  // campaigns at the WHERE status='active' filter so no more sends fire).
  // Resume = POST /start (handles draft→active AND paused→active, also pokes
  // the worker tick immediately so the next send goes within seconds, not the
  // full 15-min wait).
  async function pauseCampaign(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy("pause");
    const res = await fetch(`/api/outreach/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    setBusy(null);
    if (res.ok) {
      setStatus("paused");
      toast.success("Campaign paused", `"${campaign.name}" is now paused`);
      router.refresh();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error("Couldn't pause", j.error);
    }
  }

  async function resumeCampaign(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy("resume");
    const res = await fetch(`/api/outreach/campaigns/${campaign.id}/start`, {
      method: "POST",
    });
    setBusy(null);
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) {
      setStatus("active");
      toast.success("Campaign resumed", `"${campaign.name}" is active again`);
      router.refresh();
    } else {
      toast.error("Couldn't resume", j.error);
    }
  }

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
        className="surface-card group block p-5 transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-semibold text-[var(--ink-strong)] group-hover:text-[var(--brand-700)]">
                {campaign.name}
              </h3>
              {campaign.niche ? (
                <div className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                  <span className="capitalize">{campaign.niche.keyword}</span>{" "}
                  · {campaign.niche.location}
                </div>
              ) : null}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Progress bar */}
        <div className="mt-5 space-y-1.5">
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
              className="h-full rounded-full bg-[var(--brand-600)]"
              initial={{ width: 0 }}
              animate={{ width: `${contactedPct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Metrics row */}
        <div className="mt-5 grid grid-cols-4 divide-x divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]/40">
          <Metric label="Prospects" value={campaign.prospects} />
          <Metric label="Sent" value={campaign.contactedSends} />
          <Metric
            label="Opened"
            value={campaign.opens}
            suffix={openRate > 0 ? `${openRate}%` : null}
          />
          <Metric
            label="Replied"
            value={campaign.replied}
            suffix={replyRate > 0 ? `${replyRate}%` : null}
          />
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3.5">
          <span className="text-[11px] text-[var(--ink-subtle)]">
            Created{" "}
            {new Date(campaign.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Pause / Resume — only meaningful for active or paused
                campaigns. Draft + completed have no in-flight sending to
                pause and need either Start (which lives on the detail page)
                or no action at all. */}
            {status === "active" ? (
              <button
                type="button"
                onClick={pauseCampaign}
                disabled={busy !== null}
                title="Pause sending"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ink-strong)] transition hover:border-[var(--warning-100)] hover:bg-[var(--warning-50)] hover:text-[var(--warning-700)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "pause" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Pause className="h-3 w-3" />
                )}
                Pause
              </button>
            ) : status === "paused" ? (
              <button
                type="button"
                onClick={resumeCampaign}
                disabled={busy !== null}
                title="Resume sending"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "resume" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Resume
              </button>
            ) : null}

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
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | null;
  suffix?: string | null;
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-base font-semibold tabular-nums text-[var(--ink-strong)]">
          {value ?? 0}
        </span>
        {suffix ? (
          <span className="text-[10px] font-semibold text-[var(--ink-subtle)]">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}
