const STATUS_STYLES: Record<
  string,
  { label: string; cls: string; dot: string }
> = {
  draft: {
    label: "Draft",
    cls: "bg-[var(--surface-sunken)] text-[var(--ink-muted)] ring-[var(--border)]",
    dot: "bg-[var(--ink-subtle)]",
  },
  active: {
    label: "Active",
    cls: "bg-[var(--success-50)] text-[var(--success-700)] ring-[var(--success-100)]",
    dot: "bg-[var(--success-500)]",
  },
  paused: {
    label: "Paused",
    cls: "bg-[var(--warning-50)] text-[var(--warning-700)] ring-[var(--warning-100)]",
    dot: "bg-[var(--warning-500)]",
  },
  completed: {
    label: "Completed",
    cls: "bg-[var(--brand-50)] text-[var(--brand-700)] ring-[var(--brand-100)]",
    dot: "bg-[var(--brand-500)]",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset ${style.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}
