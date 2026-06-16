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

  const toneMap = {
    brand:
      "bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-100)]",
    amber:
      "bg-[var(--accent-50)] text-[var(--accent-700)] ring-1 ring-[var(--accent-100)]",
    success:
      "bg-[var(--success-50)] text-[var(--success-700)] ring-1 ring-[var(--success-100)]",
    credits:
      "bg-gradient-to-br from-[var(--brand-50)] to-[var(--sky-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-100)]",
  };

  const accentMap = {
    brand: "from-[var(--brand-200)] to-[var(--brand-100)]",
    amber: "from-[var(--accent-200)] to-[var(--accent-100)]",
    success: "from-[var(--success-200)] to-[var(--success-100)]",
    credits: "from-[var(--brand-200)] to-[var(--sky-200)]",
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
            className="group surface-card relative block overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
          >
            <div
              className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${accentMap[tile.tone]} opacity-40 blur-2xl transition group-hover:opacity-60`}
              aria-hidden
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-subtle)]">
                  {tile.label}
                </span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneMap[tile.tone]}`}
                >
                  {tile.iconImg ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={tile.iconImg}
                      alt=""
                      aria-hidden
                      className="h-5 w-5"
                    />
                  ) : (
                    tile.icon
                  )}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
                <Counter value={tile.value} />
                <ArrowRight className="h-4 w-4 -translate-x-1 text-[var(--ink-subtle)] opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-[var(--ink-subtle)]">
                {tile.tone === "brand" ? (
                  <TrendingUp className="h-3 w-3 text-[var(--success-500)]" />
                ) : null}
                {tile.hint}
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </section>
  );
}
