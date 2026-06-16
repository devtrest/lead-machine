"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  ArrowRight,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Mail,
  Phone,
  Globe,
} from "lucide-react";
import { useMemo, useState } from "react";

// Each campaign row carries enrichment counts so the card can show
// "X leads · Y emails · Z phones" — useful at-a-glance for picking the
// most outreach-ready campaign.
export type CampaignSummary = {
  id: string;
  keyword: string;
  location: string;
  status: string;
  result_count: number;
  started_at: string;
  emails: number;
  phones: number;
  websites: number;
};

export function ProspectListsOverview({
  campaigns,
}: {
  campaigns: CampaignSummary[];
}) {
  const [search, setSearch] = useState("");

  const totalLeads = campaigns.reduce((s, c) => s + c.result_count, 0);
  const totalEmails = campaigns.reduce((s, c) => s + c.emails, 0);
  const totalPhones = campaigns.reduce((s, c) => s + c.phones, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.keyword.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
    );
  }, [campaigns, search]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-elev)] px-6 py-8 md:px-10 md:py-10">
        <div
          className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-50 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)] backdrop-blur">
              <Users className="h-3 w-3" />
              Prospect lists
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
              Your prospect lists by campaign.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--ink-muted)]">
              Every lead campaign you&apos;ve run lives here as its own list.
              Open a campaign to view, search, and export its prospects.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Lists" value={campaigns.length.toLocaleString()} />
            <Stat label="Leads" value={totalLeads.toLocaleString()} />
            <Stat label="Contacts" value={(totalEmails + totalPhones).toLocaleString()} />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-subtle)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by niche or city…"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] py-2.5 pl-10 pr-4 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
        />
      </div>

      {/* List */}
      {campaigns.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-[var(--brand-700)]" />
          <h3 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
            No lead campaigns yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--ink-muted)]">
            Create your first lead campaign — your prospects will land here
            organized by niche.
          </p>
          <Link
            href="/user/jobs"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition hover:bg-[var(--brand-700)]"
          >
            <Sparkles className="h-4 w-4" />
            Create a campaign
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-[var(--ink-muted)]">
          No campaigns match{" "}
          <span className="font-medium text-[var(--ink-strong)]">
            “{search}”
          </span>
          .
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((c, i) => (
            <CampaignTile key={c.id} campaign={c} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/80 p-3 text-center backdrop-blur">
      <div className="text-xl font-bold tabular-nums text-[var(--ink-strong)]">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-subtle)]">
        {label}
      </div>
    </div>
  );
}

function CampaignTile({
  campaign,
  index,
}: {
  campaign: CampaignSummary;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.28 }}
    >
      <Link
        href={`/user/leads?campaign=${campaign.id}`}
        className="surface-card group relative block overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-30 blur-2xl transition group-hover:opacity-50"
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold capitalize text-[var(--ink-strong)]">
                  {campaign.keyword}
                </h3>
                <StatusBadge status={campaign.status} />
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                {campaign.location} ·{" "}
                {new Date(campaign.started_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 -translate-x-1 text-[var(--ink-subtle)] opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-[var(--ink-strong)]">
              {campaign.result_count.toLocaleString()}
            </span>
            <span className="text-xs text-[var(--ink-muted)]">prospects</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Pill
              icon={<Mail className="h-3 w-3" />}
              label={`${campaign.emails} emails`}
              tone="brand"
            />
            <Pill
              icon={<Phone className="h-3 w-3" />}
              label={`${campaign.phones} phones`}
              tone="success"
            />
            <Pill
              icon={<Globe className="h-3 w-3" />}
              label={`${campaign.websites} websites`}
              tone="amber"
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Pill({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "brand" | "success" | "amber";
}) {
  const toneMap = {
    brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
    success: "bg-[var(--success-50)] text-[var(--success-700)]",
    amber: "bg-[var(--accent-50)] text-[var(--accent-700)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneMap[tone]}`}
    >
      {icon}
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<
    string,
    { cls: string; icon: React.ReactNode; label: string }
  > = {
    completed: {
      cls: "bg-[var(--success-50)] text-[var(--success-700)]",
      icon: <CheckCircle2 className="h-2.5 w-2.5" />,
      label: "Completed",
    },
    running: {
      cls: "bg-[var(--brand-50)] text-[var(--brand-700)]",
      icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
      label: "Running",
    },
    failed: {
      cls: "bg-[var(--danger-50)] text-[var(--danger-700)]",
      icon: <AlertTriangle className="h-2.5 w-2.5" />,
      label: "Failed",
    },
  };
  const s = styles[status] ?? styles.completed;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${s.cls}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
}
