"use client";

import { motion } from "framer-motion";
import { Users, Layers, Mail, TrendingUp, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Counter } from "@/components/ui/Counter";

type Props = {
  totalLeads: number;
  totalCampaigns: number;
  completedCampaigns: number;
  totalPhones: number;
  totalEmails: number;
  credits: number;
};

export function DashboardKpis({
  totalLeads,
  totalCampaigns,
  completedCampaigns,
  totalPhones,
  totalEmails,
  credits,
}: Props) {
  const tiles = [
    {
      label: "Total leads",
      value: totalLeads,
      hint: "Across all campaigns",
      icon: <Users className="h-4 w-4" />,
      tone: "brand" as const,
      href: "/user/leads",
    },
    {
      label: "Campaigns",
      value: totalCampaigns,
      hint: `${completedCampaigns} completed`,
      icon: <Layers className="h-4 w-4" />,
      tone: "amber" as const,
      href: "/user/jobs",
    },
    {
      label: "Contacts found",
      value: totalPhones + totalEmails,
      hint: `${totalPhones} phones · ${totalEmails} emails`,
      icon: <Mail className="h-4 w-4" />,
      tone: "success" as const,
      href: "/user/leads",
    },
    {
      label: "Available credits",
      value: credits,
      hint: "1 credit = 1 lead delivered",
      iconImg: "/credits-icon.svg",
      tone: "credits" as const,
      href: "/user/billing",
    },
  ];

  // Color lives only in a refined icon tile — soft fill + inset ring + a faint
  // inner highlight. No colored bars; the premium feel comes from the tile,
  // typography, and spacing.
  const toneMap = {
    brand:
      "bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]",
    amber:
      "bg-gradient-to-br from-[var(--accent-50)] to-[var(--accent-100)] text-[var(--accent-700)] ring-1 ring-inset ring-[var(--accent-100)]",
    success:
      "bg-gradient-to-br from-[var(--success-50)] to-[var(--success-100)] text-[var(--success-700)] ring-1 ring-inset ring-[var(--success-100)]",
    credits:
      "bg-gradient-to-br from-[var(--brand-50)] to-[var(--sky-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]",
  };

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile, i) => (
        <motion.div
          key={tile.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.32,
            delay: i * 0.06,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Link
            href={tile.href}
            className="group surface-card relative block p-5 transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]"
          >
            <div className="flex items-start justify-between">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ${toneMap[tile.tone]}`}
              >
                {tile.iconImg ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={tile.iconImg} alt="" aria-hidden className="h-5 w-5" />
                ) : (
                  tile.icon
                )}
              </span>
              <ArrowRight className="mt-1 h-4 w-4 -translate-x-1 text-[var(--ink-subtle)] opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
            </div>
            <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">
              {tile.label}
            </div>
            <div className="mt-1 text-[30px] font-semibold leading-none tracking-tight tabular-nums text-[var(--ink-strong)]">
              <Counter value={tile.value} />
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-[var(--ink-muted)]">
              {tile.tone === "brand" ? (
                <TrendingUp className="h-3 w-3 text-[var(--success-500)]" />
              ) : null}
              {tile.hint}
            </div>
          </Link>
        </motion.div>
      ))}
    </section>
  );
}
