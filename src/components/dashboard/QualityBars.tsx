"use client";

import { motion } from "framer-motion";
import { Globe, Mail, Phone, MapPin } from "lucide-react";

type Props = {
  total: number;
  withWebsite: number;
  withEmail: number;
  withPhone: number;
  withAddress: number;
};

export function QualityBars({
  total,
  withWebsite,
  withEmail,
  withPhone,
  withAddress,
}: Props) {
  const rows = [
    {
      label: "Has website",
      value: withWebsite,
      icon: <Globe className="h-3.5 w-3.5" />,
      tone: "brand",
    },
    {
      label: "Has email",
      value: withEmail,
      icon: <Mail className="h-3.5 w-3.5" />,
      tone: "amber",
    },
    {
      label: "Has phone",
      value: withPhone,
      icon: <Phone className="h-3.5 w-3.5" />,
      tone: "success",
    },
    {
      label: "Has address",
      value: withAddress,
      icon: <MapPin className="h-3.5 w-3.5" />,
      tone: "neutral",
    },
  ] as const;

  const toneMap = {
    brand: "bg-[var(--brand-500)]",
    amber: "bg-[var(--accent-500)]",
    success: "bg-[var(--success-500)]",
    neutral: "bg-[var(--ink-muted)]",
  };
  const toneSoft = {
    brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
    amber: "bg-[var(--accent-50)] text-[var(--accent-700)]",
    success: "bg-[var(--success-50)] text-[var(--success-700)]",
    neutral: "bg-[var(--surface-sunken)] text-[var(--ink-muted)]",
  };

  return (
    <div className="space-y-4">
      {rows.map((r, i) => {
        const pct = total === 0 ? 0 : Math.round((r.value / total) * 100);
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-md ${toneSoft[r.tone]}`}
                >
                  {r.icon}
                </span>
                {r.label}
              </span>
              <span className="text-xs font-semibold tabular-nums text-[var(--ink-strong)]">
                {r.value}
                <span className="ml-1 text-[var(--ink-subtle)]">· {pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{
                  duration: 0.7,
                  delay: 0.05 + i * 0.06,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`h-full rounded-full ${toneMap[r.tone]}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
