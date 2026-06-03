"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Eligible = {
  id: string;
  keyword: string;
  location: string;
  emailable: number;
};

export function NewCampaignForm({ eligible }: { eligible: Eligible[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scanRunId, setScanRunId] = useState(eligible[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Give your campaign a name.");
      return;
    }
    if (!scanRunId) {
      setError("Pick a source niche.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), scanRunId }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      error?: string;
    };
    if (!res.ok || !json.id) {
      setSubmitting(false);
      setError(json.error ?? "Couldn't create campaign.");
      return;
    }
    router.replace(`/user/outreach/${json.id}`);
    router.refresh();
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      onSubmit={onSubmit}
      className="surface-card space-y-4 p-5"
    >
      <Input
        label="Campaign name"
        placeholder="e.g. Q3 dentist outreach"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-[var(--ink-muted)]">
          Source niche
        </label>
        <p className="text-[11px] text-[var(--ink-subtle)]">
          The campaign will pull leads (with emails) from this niche.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {eligible.map((r) => {
            const active = scanRunId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setScanRunId(r.id)}
                className={`flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left text-sm transition ${
                  active
                    ? "border-[var(--brand-500)] bg-[var(--brand-50)]/60 ring-2 ring-[var(--brand-500)]/20"
                    : "border-[var(--border)] bg-[var(--surface-elev)] hover:border-[var(--brand-400)]"
                }`}
              >
                <span className="font-medium capitalize text-[var(--ink-strong)]">
                  {r.keyword}
                </span>
                <span className="text-xs text-[var(--ink-muted)]">
                  {r.location}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
                  {r.emailable} with email
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--danger-100)] bg-[var(--danger-50)] px-3.5 py-2.5 text-sm text-[var(--danger-700)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        loading={submitting}
        className="w-full"
        iconRight={!submitting ? <ArrowRight className="h-4 w-4" /> : undefined}
      >
        {submitting ? "Creating…" : "Create campaign"}
      </Button>
    </motion.form>
  );
}
