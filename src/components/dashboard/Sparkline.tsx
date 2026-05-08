"use client";

import { motion } from "framer-motion";

type Point = { date: string; value: number };

export function Sparkline({
  data,
  height = 80,
}: {
  data: Point[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)] text-xs text-[var(--ink-subtle)]"
        style={{ height }}
      >
        No activity yet
      </div>
    );
  }

  const width = 600;
  const padding = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX =
    data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: padding + i * stepX,
    y: padding + (height - padding * 2) * (1 - d.value / max),
  }));

  const pathLine = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const pathArea =
    pathLine +
    ` L ${points[points.length - 1].x.toFixed(2)} ${height - padding} L ${points[0].x.toFixed(2)} ${height - padding} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-[80px] w-full"
      role="img"
      aria-label="Lead growth sparkline"
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-500)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--brand-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={pathArea}
        fill="url(#sparkFill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
      <motion.path
        d={pathLine}
        fill="none"
        stroke="var(--brand-600)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 3.5 : 0}
          fill="var(--brand-600)"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.7 + i * 0.02 }}
        />
      ))}
    </svg>
  );
}
