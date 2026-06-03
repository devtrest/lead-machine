import { Pause, Play, Check, FileText } from "lucide-react";

const STATUS_STYLES: Record<
  string,
  { label: string; cls: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Draft",
    cls: "bg-[var(--surface-sunken)] text-[var(--ink-muted)] border-[var(--border)]",
    icon: <FileText className="h-3 w-3" />,
  },
  active: {
    label: "Active",
    cls: "bg-[var(--success-50)] text-[var(--success-700)] border-[var(--success-100)]",
    icon: <Play className="h-3 w-3" />,
  },
  paused: {
    label: "Paused",
    cls: "bg-[var(--warning-50)] text-[var(--warning-700)] border-[var(--warning-100)]",
    icon: <Pause className="h-3 w-3" />,
  },
  completed: {
    label: "Completed",
    cls: "bg-[var(--brand-50)] text-[var(--brand-700)] border-[var(--brand-100)]",
    icon: <Check className="h-3 w-3" />,
  },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${style.cls}`}
    >
      {style.icon}
      {style.label}
    </span>
  );
}
