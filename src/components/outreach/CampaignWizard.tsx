"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Folder,
  Mail,
  Plus,
  Send,
  Trash2,
  Users,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { EMAIL_TEMPLATES, getTemplate } from "@/lib/email-templates";

export type ProspectList = {
  id: string;
  keyword: string;
  location: string;
  total: number;
  emailable: number;
};

export type WizardSender = {
  id: string;
  email: string;
  display_name: string | null;
  daily_limit: number;
  sends_today: number;
  status: string;
};

type Step = {
  subject: string;
  body: string;
  delay_days: number;
  delay_unit: "minutes" | "hours" | "days";
};

const STEP_LABELS = ["Basics", "Prospect lists", "Sequence", "Senders & start"];

export function CampaignWizard({
  prospectLists,
  senders,
}: {
  prospectLists: ProspectList[];
  senders: WizardSender[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [stepIdx, setStepIdx] = useState(0);
  const [name, setName] = useState("");
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(
    new Set()
  );
  const [sequence, setSequence] = useState<Step[]>(() => {
    const t = getTemplate("cold-intro");
    return [
      {
        subject: t?.subject ?? "",
        body: t?.body ?? "",
        delay_days: 0,
        delay_unit: "days" as const,
      },
    ];
  });
  const [selectedSenderIds, setSelectedSenderIds] = useState<Set<string>>(
    () => new Set(senders.length === 1 ? [senders[0].id] : [])
  );
  const [dailyLimit, setDailyLimit] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProspectCount = useMemo(() => {
    return prospectLists
      .filter((l) => selectedListIds.has(l.id))
      .reduce((sum, l) => sum + l.emailable, 0);
  }, [prospectLists, selectedListIds]);

  function next() {
    setError(null);
    if (stepIdx === 0) {
      if (!name.trim()) {
        setError("Give your campaign a name.");
        return;
      }
    } else if (stepIdx === 1) {
      if (selectedListIds.size === 0) {
        setError("Pick at least one prospect list.");
        return;
      }
    } else if (stepIdx === 2) {
      for (const [i, s] of sequence.entries()) {
        if (!s.subject.trim() || !s.body.trim()) {
          setError(`Step ${i + 1}: subject and body are required.`);
          return;
        }
      }
    }
    setStepIdx((i) => Math.min(STEP_LABELS.length - 1, i + 1));
  }

  function back() {
    setError(null);
    setStepIdx((i) => Math.max(0, i - 1));
  }

  async function submit(startNow: boolean) {
    setError(null);
    if (startNow && selectedSenderIds.size === 0) {
      setError(
        "You need at least one connected sender to start. Save as draft or connect a sender."
      );
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/outreach/campaigns/create-full", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        scanRunIds: Array.from(selectedListIds),
        steps: sequence.map((s, i) => ({
          subject: s.subject,
          body: s.body,
          delay_days: i === 0 ? 0 : s.delay_days,
          delay_unit: i === 0 ? "days" : s.delay_unit,
        })),
        senderIds: Array.from(selectedSenderIds),
        dailyLimit,
        startNow,
      }),
    });
    setSubmitting(false);
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      error?: string;
      prospects?: number;
    };
    if (!res.ok || !json.id) {
      setError(json.error ?? "Couldn't create campaign.");
      toast.error("Failed to create campaign", json.error);
      return;
    }
    toast.success(
      startNow ? "Campaign started" : "Campaign saved as draft",
      `${json.prospects ?? 0} prospects imported.`
    );
    router.replace(`/user/outreach/${json.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Progress indicator */}
      <StepIndicator currentStep={stepIdx} />

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIdx}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          {stepIdx === 0 ? (
            <StepBasics name={name} setName={setName} />
          ) : stepIdx === 1 ? (
            <StepProspectLists
              prospectLists={prospectLists}
              selectedIds={selectedListIds}
              onChange={setSelectedListIds}
              totalSelected={selectedProspectCount}
            />
          ) : stepIdx === 2 ? (
            <StepSequence sequence={sequence} setSequence={setSequence} />
          ) : (
            <StepSendersAndStart
              senders={senders}
              selectedSenderIds={selectedSenderIds}
              setSelectedSenderIds={setSelectedSenderIds}
              dailyLimit={dailyLimit}
              setDailyLimit={setDailyLimit}
              summary={{
                name,
                listsCount: selectedListIds.size,
                prospectsCount: selectedProspectCount,
                stepsCount: sequence.length,
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--danger-100)] bg-[var(--danger-50)] px-3.5 py-2.5 text-sm text-[var(--danger-700)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={back}
          disabled={stepIdx === 0 || submitting}
          iconLeft={<ArrowLeft className="h-3.5 w-3.5" />}
        >
          Back
        </Button>
        <div className="flex items-center gap-2">
          {stepIdx < STEP_LABELS.length - 1 ? (
            <Button
              type="button"
              onClick={next}
              iconRight={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Continue
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => submit(false)}
                loading={submitting}
              >
                Save as draft
              </Button>
              <Button
                type="button"
                onClick={() => submit(true)}
                loading={submitting}
                iconRight={<Send className="h-3.5 w-3.5" />}
              >
                Save & start
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEP_LABELS.map((label, i) => {
        const isDone = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                isDone
                  ? "bg-[var(--brand-600)] text-white"
                  : isCurrent
                    ? "bg-[var(--brand-50)] text-[var(--brand-700)] ring-2 ring-[var(--brand-500)]"
                    : "bg-[var(--surface-sunken)] text-[var(--ink-subtle)]"
              }`}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`truncate text-xs font-semibold ${
                  isCurrent || isDone
                    ? "text-[var(--ink-strong)]"
                    : "text-[var(--ink-subtle)]"
                }`}
              >
                {label}
              </div>
              {i < STEP_LABELS.length - 1 ? (
                <div className="mt-1 h-0.5 w-full rounded-full bg-[var(--border)]">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: isDone ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-[var(--brand-600)]"
                  />
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepBasics({
  name,
  setName,
}: {
  name: string;
  setName: (v: string) => void;
}) {
  return (
    <div className="surface-card space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-[var(--ink-strong)]">
          Name your campaign
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Just a label so you can find it later. Example: &quot;Q3 dentist
          outreach&quot;.
        </p>
      </div>
      <Input
        label="Campaign name"
        placeholder="e.g. Q3 dentist outreach"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
    </div>
  );
}

function StepProspectLists({
  prospectLists,
  selectedIds,
  onChange,
  totalSelected,
}: {
  prospectLists: ProspectList[];
  selectedIds: Set<string>;
  onChange: (s: Set<string>) => void;
  totalSelected: number;
}) {
  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className="surface-card space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-[var(--ink-strong)]">
          Pick prospect lists
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Each list is a niche you scraped earlier. Tick the folders you want
          to email. Only leads with emails get imported.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {prospectLists.map((l) => {
          const active = selectedIds.has(l.id);
          return (
            <motion.button
              key={l.id}
              type="button"
              onClick={() => toggle(l.id)}
              whileTap={{ scale: 0.985 }}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                active
                  ? "border-[var(--brand-500)] bg-[var(--brand-50)]/60 ring-2 ring-[var(--brand-500)]/15"
                  : "border-[var(--border)] bg-[var(--surface-elev)] hover:border-[var(--brand-300)]"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  active
                    ? "bg-[var(--brand-600)] text-white"
                    : "bg-[var(--surface-sunken)] text-[var(--ink-muted)]"
                }`}
              >
                <Folder className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium capitalize text-[var(--ink-strong)]">
                  {l.keyword}
                </div>
                <div className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                  {l.location}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-50)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-700)]">
                    <Mail className="h-2.5 w-2.5" />
                    {l.emailable} emails
                  </span>
                  <span className="text-[10px] text-[var(--ink-subtle)]">
                    of {l.total} leads
                  </span>
                </div>
              </div>
              {active ? (
                <Check className="h-4 w-4 text-[var(--brand-700)]" />
              ) : null}
            </motion.button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]/40 px-3 py-2">
        <Users className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
        <span className="text-xs text-[var(--ink-muted)]">
          {selectedIds.size > 0 ? (
            <>
              <span className="font-semibold text-[var(--ink-strong)]">
                {totalSelected}
              </span>{" "}
              prospects will be imported from{" "}
              <span className="font-semibold text-[var(--ink-strong)]">
                {selectedIds.size}
              </span>{" "}
              list{selectedIds.size === 1 ? "" : "s"}.
            </>
          ) : (
            "Pick at least one list to continue."
          )}
        </span>
      </div>
    </div>
  );
}

function StepSequence({
  sequence,
  setSequence,
}: {
  sequence: Step[];
  setSequence: (s: Step[]) => void;
}) {
  function update<K extends keyof Step>(i: number, k: K, v: Step[K]) {
    const next = sequence.slice();
    next[i] = { ...next[i], [k]: v };
    setSequence(next);
  }
  function addStep() {
    const t = getTemplate("follow-up");
    setSequence([
      ...sequence,
      {
        subject: t?.subject ?? "Re: {{name}}",
        body: t?.body ?? "",
        delay_days: 3,
        delay_unit: "days",
      },
    ]);
  }
  function removeStep(i: number) {
    setSequence(sequence.filter((_, idx) => idx !== i));
  }
  function applyTemplate(i: number, tplId: string) {
    const t = getTemplate(tplId);
    if (!t) return;
    const next = sequence.slice();
    next[i] = { ...next[i], subject: t.subject, body: t.body };
    setSequence(next);
  }

  return (
    <div className="surface-card space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-[var(--ink-strong)]">
          Build the sequence
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Step 1 sends as soon as the campaign starts. Follow-ups wait the
          configured number of days after the previous send.
        </p>
      </div>

      <div className="space-y-3">
        {sequence.map((s, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 items-center justify-center rounded-full bg-[var(--brand-50)] px-2 text-[11px] font-bold text-[var(--brand-700)]">
                  Step {i + 1}
                </span>
                {i === 0 ? (
                  <span className="text-[11px] text-[var(--ink-subtle)]">
                    sends immediately
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-subtle)]">
                    Wait
                    <input
                      type="number"
                      min={0}
                      value={s.delay_days}
                      onChange={(e) =>
                        update(
                          i,
                          "delay_days",
                          Math.max(0, Number(e.target.value) || 0)
                        )
                      }
                      className="w-14 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-center text-[12px]"
                    />
                    <select
                      value={s.delay_unit}
                      onChange={(e) =>
                        update(
                          i,
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
                  </div>
                )}
              </div>
              {sequence.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  className="rounded p-1 text-[var(--ink-subtle)] hover:bg-[var(--danger-50)] hover:text-[var(--danger-700)]"
                  aria-label={`Remove step ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-3">
              <select
                onChange={(e) => applyTemplate(i, e.target.value)}
                defaultValue=""
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-2.5 py-1.5 text-xs text-[var(--ink-strong)]"
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
              <Input
                label="Subject"
                value={s.subject}
                onChange={(e) => update(i, "subject", e.target.value)}
              />
              <Textarea
                label="Body"
                value={s.body}
                onChange={(e) => update(i, "body", e.target.value)}
                rows={7}
                className="font-mono text-[12.5px] leading-relaxed"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addStep}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-sunken)]/40 py-3 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--brand-400)] hover:bg-[var(--brand-50)]/40 hover:text-[var(--brand-700)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add follow-up step
        </button>
      </div>

      <p className="text-[11px] text-[var(--ink-subtle)]">
        Placeholders:{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1">{`{{name}}`}</code>{" "}
        ·{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1">{`{{category}}`}</code>{" "}
        ·{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1">{`{{sender}}`}</code>
      </p>
    </div>
  );
}

function StepSendersAndStart({
  senders,
  selectedSenderIds,
  setSelectedSenderIds,
  dailyLimit,
  setDailyLimit,
  summary,
}: {
  senders: WizardSender[];
  selectedSenderIds: Set<string>;
  setSelectedSenderIds: (s: Set<string>) => void;
  dailyLimit: number;
  setDailyLimit: (v: number) => void;
  summary: {
    name: string;
    listsCount: number;
    prospectsCount: number;
    stepsCount: number;
  };
}) {
  function toggle(id: string) {
    const next = new Set(selectedSenderIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSenderIds(next);
  }

  // Suggest a pace based on prospect count: drip over ~10 days, clamped 5-150.
  const suggested = Math.max(
    5,
    Math.min(150, Math.ceil(summary.prospectsCount / 10))
  );

  return (
    <div className="space-y-4">
      <div className="surface-card space-y-3 p-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink-strong)]">
            Daily send pace
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            How many emails this campaign sends per day, total across all
            steps + senders. Slower pace = better deliverability + lower spam
            risk.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <Input
              label="Emails per day"
              type="number"
              min={1}
              max={500}
              value={dailyLimit}
              onChange={(e) =>
                setDailyLimit(
                  Math.max(1, Math.min(500, Number(e.target.value) || 50))
                )
              }
              hint={`Suggested: ${suggested}/day (${summary.prospectsCount} prospects ÷ ~10 days).`}
            />
          </div>
          <div className="flex items-center gap-1.5">
            {[25, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDailyLimit(preset)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  dailyLimit === preset
                    ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                    : "border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--brand-300)]"
                }`}
              >
                {preset}/day
              </button>
            ))}
          </div>
        </div>
        {summary.prospectsCount > 0 ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]/40 px-3 py-2 text-[11px] text-[var(--ink-muted)]">
            At {dailyLimit}/day this campaign will finish step 1 in approximately{" "}
            <span className="font-semibold text-[var(--ink-strong)]">
              {Math.ceil(summary.prospectsCount / dailyLimit)} day
              {Math.ceil(summary.prospectsCount / dailyLimit) === 1 ? "" : "s"}
            </span>
            .
          </div>
        ) : null}
      </div>

      <div className="surface-card space-y-3 p-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink-strong)]">
            Pick sender accounts
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            The worker rotates across selected accounts to respect Gmail&apos;s
            ~500/day per-account ceiling and keep sender reputation healthy.
          </p>
        </div>

        {senders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--warning-200)] bg-[var(--warning-50)]/40 p-4 text-sm">
            <p className="font-medium text-[var(--warning-800)]">
              No active senders connected
            </p>
            <p className="mt-1 text-xs text-[var(--warning-700)]">
              You can save as draft now and connect a Gmail account from{" "}
              <Link
                href="/user/senders"
                className="font-semibold underline"
              >
                Senders
              </Link>{" "}
              before starting.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {senders.map((s) => {
              const checked = selectedSenderIds.has(s.id);
              const remaining = s.daily_limit - s.sends_today;
              return (
                <li key={s.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      checked
                        ? "border-[var(--brand-500)] bg-[var(--brand-50)]/60"
                        : "border-[var(--border)] hover:border-[var(--brand-300)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(s.id)}
                      className="h-4 w-4 accent-[var(--brand-600)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[var(--ink-strong)]">
                        {s.display_name ? `${s.display_name} ` : ""}
                        <span className="text-[var(--ink-muted)]">
                          &lt;{s.email}&gt;
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--ink-muted)]">
                        {remaining} of {s.daily_limit} sends available today
                      </div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="surface-card space-y-3 p-5">
        <h2 className="text-base font-semibold text-[var(--ink-strong)]">
          Review
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[var(--ink-subtle)]">Name</dt>
            <dd className="font-medium text-[var(--ink-strong)]">
              {summary.name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--ink-subtle)]">Prospects</dt>
            <dd className="font-medium text-[var(--ink-strong)]">
              {summary.prospectsCount} from {summary.listsCount} list
              {summary.listsCount === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--ink-subtle)]">Sequence</dt>
            <dd className="font-medium text-[var(--ink-strong)]">
              <FileText className="-mt-0.5 mr-1 inline h-3.5 w-3.5 text-[var(--ink-muted)]" />
              {summary.stepsCount} step{summary.stepsCount === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--ink-subtle)]">Senders</dt>
            <dd className="font-medium text-[var(--ink-strong)]">
              {selectedSenderIds.size} selected
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--ink-subtle)]">Daily pace</dt>
            <dd className="font-medium text-[var(--ink-strong)]">
              {dailyLimit}/day
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
