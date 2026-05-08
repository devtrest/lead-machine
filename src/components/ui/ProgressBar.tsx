"use client";

import { motion } from "framer-motion";

export function ProgressBar({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)] ${className}`}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative h-full rounded-full bg-gradient-to-r from-[var(--brand-700)] via-[var(--brand-500)] to-[var(--sky-500)]"
      >
        <span className="absolute inset-0 animate-pulse rounded-full bg-white/20" />
      </motion.div>
    </div>
  );
}
