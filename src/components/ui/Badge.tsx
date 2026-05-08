import * as React from "react";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "amber";

const tones: Record<Tone, string> = {
  neutral:
    "bg-[var(--surface-sunken)] text-[var(--ink-muted)] border border-[var(--border)]",
  brand:
    "bg-[var(--brand-50)] text-[var(--brand-700)] border border-[var(--brand-100)]",
  success:
    "bg-[var(--success-50)] text-[var(--success-700)] border border-[var(--success-100)]",
  warning:
    "bg-[var(--warning-50)] text-[var(--warning-700)] border border-[var(--warning-100)]",
  danger:
    "bg-[var(--danger-50)] text-[var(--danger-700)] border border-[var(--danger-100)]",
  amber:
    "bg-[var(--accent-50)] text-[var(--accent-700)] border border-[var(--accent-100)]",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
  iconLeft,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  iconLeft?: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] ${tones[tone]} ${className}`}
    >
      {iconLeft ? <span className="inline-flex h-3 w-3">{iconLeft}</span> : null}
      {children}
    </span>
  );
}
