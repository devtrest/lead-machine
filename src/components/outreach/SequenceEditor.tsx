"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, AlertTriangle, Check, Mail, Clock } from "lucide-react";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EMAIL_TEMPLATES, getTemplate } from "@/lib/email-templates";

export type SequenceStep = {
  id?: string;
  step_order: number;
  delay_days: number;
  delay_unit?: "minutes" | "hours" | "days";
  subject: string;
  body: string;
};

export function SequenceEditor({
  campaignId,
  initialSteps,
  disabled,
}: {
  campaignId: string;
  initialSteps: SequenceStep[];
  disabled: boolean;
}) {
  const [steps, setSteps] = useState<SequenceStep[]>(() =>
    initialSteps.length > 0
      ? initialSteps
      : [
          {
            step_order: 1,
            delay_days: 0,
            delay_unit: "days",
            subject:
              getTemplate("cold-intro")?.subject ?? "",
            body: getTemplate("cold-intro")?.body ?? "",
          },
        ]
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SequenceStep>(
    idx: number,
    key: K,
    value: SequenceStep[K]
  ) {
    setSteps((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }

  function applyTemplateToStep(idx: number, templateId: string) {
    const tpl = getTemplate(templateId);
    if (!tpl) return;
    setSteps((prev) => {
      const next = prev.slice();
      next[idx] = {
        ...next[idx],
        subject: tpl.subject,
        body: tpl.body,
      };
      return next;
    });
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        step_order: prev.length + 1,
        delay_days: 3,
        delay_unit: "days",
        subject: getTemplate("follow-up")?.subject ?? "",
        body: getTemplate("follow-up")?.body ?? "",
      },
    ]);
  }

  function removeStep(idx: number) {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, step_order: i + 1, delay_days: i === 0 ? 0 : s.delay_days }))
    );
  }

  async function save() {
    setError(null);
    if (steps.length === 0) {
      setError("At least one step is required.");
      return;
    }
    for (const [i, s] of steps.entries()) {
      if (!s.subject.trim() || !s.body.trim()) {
        setError(`Step ${i + 1}: subject and body are required.`);
        return;
      }
    }
    setSaving(true);
    const res = await fetch(`/api/outreach/campaigns/${campaignId}/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        steps: steps.map((s, i) => ({
          step_order: i + 1,
          delay_days: i === 0 ? 0 : s.delay_days,
          delay_unit: i === 0 ? "days" : (s.delay_unit ?? "days"),
          subject: s.subject,
          body: s.body,
        })),
      }),
    });
    setSaving(false);
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Couldn't save sequence.");
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <div className="surface-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
            <Mail className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-subtle)]">
              Sequence
            </div>
            <h2 className="mt-0.5 text-base font-semibold text-[var(--ink-strong)]">
              {steps.length} step{steps.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              Step 1 sends immediately when a prospect enters the campaign. Each
              follow-up waits the configured delay after the previous step.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && Date.now() - savedAt < 4000 ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--success-700)]">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={save}
            loading={saving}
            disabled={disabled || saving}
          >
            Save sequence
          </Button>
        </div>
      </div>

      {disabled ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--warning-100)] bg-[var(--warning-50)] px-3 py-2 text-xs text-[var(--warning-700)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Pause the campaign to edit its sequence.
        </div>
      ) : null}

      <div className="relative mt-5 space-y-3 pl-9">
        <span
          aria-hidden
          className="absolute left-[14px] top-2 bottom-12 w-px bg-[var(--border)]"
        />
        <AnimatePresence initial={false}>
          {steps.map((s, idx) => (
            <motion.div
              key={s.id ?? `idx-${idx}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="relative rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] p-4 shadow-[var(--shadow-xs)]"
            >
              <span className="absolute -left-9 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[11px] font-bold tabular-nums text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
                {idx + 1}
              </span>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--ink-strong)]">
                    Step {idx + 1}
                  </span>
                  {idx === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-50)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--success-700)]">
                      Sends immediately
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-full bg-[var(--surface-sunken)] px-2 py-1 text-[11px] text-[var(--ink-muted)]">
                      <Clock className="h-3 w-3 text-[var(--ink-subtle)]" />
                      <span>Wait</span>
                      <input
                        type="number"
                        min={0}
                        value={s.delay_days}
                        disabled={disabled}
                        onChange={(e) =>
                          update(
                            idx,
                            "delay_days",
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-12 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-center text-[12px] tabular-nums"
                      />
                      <select
                        value={s.delay_unit ?? "days"}
                        disabled={disabled}
                        onChange={(e) =>
                          update(
                            idx,
                            "delay_unit",
                            (e.target.value as "minutes" | "hours" | "days")
                          )
                        }
                        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[12px]"
                      >
                        <option value="minutes">minutes</option>
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                      </select>
                      <span>after step {idx}</span>
                    </div>
                  )}
                </div>
                {steps.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    disabled={disabled}
                    aria-label={`Remove step ${idx + 1}`}
                    className="rounded-md p-1 text-[var(--ink-subtle)] transition hover:bg-[var(--danger-50)] hover:text-[var(--danger-700)] disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--ink-muted)]">
                    Quick template
                  </label>
                  <select
                    disabled={disabled}
                    onChange={(e) => applyTemplateToStep(idx, e.target.value)}
                    defaultValue=""
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-2.5 py-1.5 text-xs text-[var(--ink-strong)]"
                  >
                    <option value="" disabled>
                      Apply a template…
                    </option>
                    {EMAIL_TEMPLATES.filter((t) => t.id !== "blank").map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {t.description}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Subject"
                  value={s.subject}
                  onChange={(e) => update(idx, "subject", e.target.value)}
                  disabled={disabled}
                />
                <Textarea
                  label="Body"
                  value={s.body}
                  onChange={(e) => update(idx, "body", e.target.value)}
                  rows={8}
                  className="font-mono text-[12.5px] leading-relaxed"
                  disabled={disabled}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!disabled ? (
          <button
            type="button"
            onClick={addStep}
            className="relative -ml-9 flex w-[calc(100%+2.25rem)] items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-sunken)]/40 py-3 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)]/40 hover:text-[var(--brand-700)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add follow-up step
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-[11px] text-[var(--ink-subtle)]">
        Placeholders:{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1">{`{{name}}`}</code>{" "}
        ·{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1">{`{{category}}`}</code>{" "}
        ·{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1">{`{{sender}}`}</code>
      </p>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      ) : null}
    </div>
  );
}
