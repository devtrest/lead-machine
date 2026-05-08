"use client";

import { motion } from "framer-motion";
import { Users, Layers, Mail, Coins } from "lucide-react";
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
      tone: "brand",
    },
    {
      label: "Campaigns",
      value: totalCampaigns,
      hint: `${completedCampaigns} completed`,
      icon: <Layers className="h-4 w-4" />,
      tone: "amber",
    },
    {
      label: "Contacts found",
      value: totalPhones + totalEmails,
      hint: `${totalPhones} phones · ${totalEmails} emails`,
      icon: <Mail className="h-4 w-4" />,
      tone: "success",
    },
    {
      label: "Credits",
      value: credits,
      hint: "Refresh on next cycle",
      icon: <Coins className="h-4 w-4" />,
      tone: "neutral",
    },
  ] as const;

  const toneMap = {
    brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
    amber: "bg-[var(--accent-50)] text-[var(--accent-700)]",
    success: "bg-[var(--success-50)] text-[var(--success-700)]",
    neutral: "bg-[var(--surface-sunken)] text-[var(--ink-strong)]",
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
          className="surface-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-subtle)]">
              {tile.label}
            </span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneMap[tile.tone]}`}
            >
              {tile.icon}
            </span>
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
            <Counter value={tile.value} />
          </div>
          <div className="mt-1 text-xs text-[var(--ink-subtle)]">{tile.hint}</div>
        </motion.div>
      ))}
    </section>
  );
}
