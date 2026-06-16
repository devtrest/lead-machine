import { Sparkles, Zap, Globe2, ShieldCheck } from "lucide-react";
import { GenerateForm } from "@/components/generate/GenerateForm";

const stats = [
  {
    icon: Zap,
    label: "Live results",
    body: "Every lead is fetched fresh — no recycled lists.",
  },
  {
    icon: Globe2,
    label: "40+ countries",
    body: "Any city, any niche, anywhere on the map.",
  },
  {
    icon: ShieldCheck,
    label: "Auto-deduped",
    body: "We collapse repeats before they hit your database.",
  },
];

export default function GeneratePage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--brand-50)] via-[var(--surface-elev)] to-[var(--sky-50)] px-6 py-10 text-center md:px-10 md:py-12">
        <div
          className="absolute -right-32 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-[var(--brand-200)] to-[var(--sky-200)] opacity-60 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-24 -left-32 h-72 w-72 rounded-full bg-gradient-to-br from-[var(--sky-200)] to-[var(--brand-100)] opacity-50 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)] backdrop-blur">
            <Sparkles className="h-3 w-3" />
            AI lead engine
          </div>
          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-[40px] md:leading-tight">
            Tell us your{" "}
            <span className="brand-text-gradient">ideal customer</span>.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--ink-muted)] md:text-base">
            Describe the niche and the city. We&apos;ll surface verified leads
            with phones, emails, and websites — deduped and ready to contact.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-3xl">
        <GenerateForm />
      </div>

      {/* Trust strip */}
      <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="surface-card flex items-start gap-3 p-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-100)]">
              <s.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--ink-strong)]">
                {s.label}
              </div>
              <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
