"use client";

import { motion } from "framer-motion";

type Point = { date: string; value: number };

export function Sparkline({
  data,
  height = 120,
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
  const padding = 10;
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

  // Faint horizontal gridlines for an analytics-chart feel.
  const gridYs = [0, 0.5, 1].map(
    (t) => padding + (height - padding * 2) * t
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Lead growth chart"
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-500)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--brand-500)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sparkStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--brand-600)" />
          <stop offset="100%" stopColor="var(--sky-500)" />
        </linearGradient>
      </defs>

      {gridYs.map((y, i) => (
        <line
          key={i}
          x1={padding}
          x2={width - padding}
          y1={y}
          y2={y}
          stroke="var(--border)"
          strokeWidth={1}
          strokeDasharray="2 5"
          vectorEffect="non-scaling-stroke"
        />
      ))}

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
        stroke="url(#sparkStroke)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      {points.map((p, i) =>
        i === points.length - 1 ? (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5} fill="var(--brand-600)" opacity={0.18} />
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={3}
              fill="var(--surface-elev)"
              stroke="var(--brand-600)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.9 }}
            />
          </g>
        ) : null
      )}
    </svg>
  );
}
