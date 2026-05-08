import { GenerateForm } from "@/components/generate/GenerateForm";

export default function GeneratePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
          AI Lead Engine
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
          Tell us your <span className="brand-text-gradient">ideal customer</span>.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--ink-muted)] md:text-base">
          Describe the niche and the city. We&apos;ll surface verified leads with
          phones, emails, and websites — deduped and ready to contact.
        </p>
      </div>

      <GenerateForm />
    </div>
  );
}
