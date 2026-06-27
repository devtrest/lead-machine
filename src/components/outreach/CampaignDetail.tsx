"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Trash2,
  Check,
  AlertTriangle,
  Zap,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ScheduleFields } from "@/components/outreach/ScheduleFields";
import {
  SenderBreakdown,
  type SenderActivity,
} from "@/components/outreach/SenderBreakdown";
import {
  SequenceEditor,
  type SequenceStep,
} from "@/components/outreach/SequenceEditor";
import {
  ProspectsManager,
  type Prospect,
  type CandidateLead,
} from "@/components/outreach/ProspectsManager";
import {
  CampaignStatsBar,
  type CampaignStats,
} from "@/components/outreach/CampaignStatsBar";
import { type TestSender } from "@/components/outreach/TestSendCard";

export type CampaignSchedule = {
  dailyLimit: number;
  timezone: string;
  sendDays: string[];
  sendWindowStart: string;
  sendWindowEnd: string;
};

export function CampaignDetail({
  campaignId,
  initialName,
  initialStatus,
  initialSchedule,
  steps,
  prospects,
  candidateLeads,
  stats,
  senderActivity,
  senders,
  attachedSenderIds,
}: {
  campaignId: string;
  initialName: string;
  initialStatus: string;
  initialSchedule: CampaignSchedule;
  steps: SequenceStep[];
  prospects: Prospect[];
  candidateLeads: CandidateLead[];
  stats: CampaignStats;
  senderActivity: SenderActivity[];
  senders: TestSender[];
  attachedSenderIds: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState(initialStatus);
  const [savingName, setSavingName] = useState(false);
  const [nameSavedAt, setNameSavedAt] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep local status in sync with server prop after each router.refresh()
  // below — otherwise Start/Pause buttons would still reflect the value the
  // page loaded with even after the worker auto-completes the campaign.
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  // Live updates: while there are prospects still in flight, re-fetch the
  // server data every 4s so the prospect rows, stats bar, "STEP X SENT",
  // and "OPENED" badges update without a browser reload. Polling auto-stops
  // when everyone hits a terminal status (completed/replied/bounced/failed).
  // We also stop while a button action is in flight so router.refresh
  // doesn't fight with the optimistic UI state.
  const hasActiveProspects = prospects.some(
    (p) => p.status === "pending" || p.status === "in_progress"
  );
  useEffect(() => {
    if (!hasActiveProspects || busy) return;
    const id = setInterval(() => {
      router.refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [hasActiveProspects, busy, router]);

  async function saveName() {
    if (!name.trim() || name.trim() === initialName) return;
    setSavingName(true);
    const res = await fetch(`/api/outreach/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSavingName(false);
    if (res.ok) {
      setNameSavedAt(Date.now());
      router.refresh();
    }
  }

  async function start() {
    setActionError(null);
    setBusy(true);
    const res = await fetch(
      `/api/outreach/campaigns/${campaignId}/start`,
      { method: "POST" }
    );
    setBusy(false);
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setActionError(json.error ?? "Couldn't start campaign.");
      return;
    }
    setStatus("active");
    router.refresh();
  }

  async function pause() {
    setActionError(null);
    setBusy(true);
    const res = await fetch(`/api/outreach/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    setBusy(false);
    if (res.ok) {
      setStatus("paused");
      router.refresh();
    }
  }

  async function resume() {
    // Same path as start — the start endpoint handles draft->active and
    // paused->active equivalently (only blocks if already active).
    await start();
  }

  async function sendAllNow() {
    setActionError(null);
    setBusy(true);
    const res = await fetch(
      `/api/outreach/campaigns/${campaignId}/send-now`,
      { method: "POST" }
    );
    setBusy(false);
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      worker?: { sent?: number; failed?: number; due?: number };
    };
    if (!res.ok) {
      setActionError(json.error ?? "Couldn't send.");
      return;
    }
    setStatus("active");
    const w = json.worker;
    if (w && typeof w.sent === "number") {
      setNameSavedAt(Date.now()); // reuse the "Saved" pill for a quick confirm flash
      setActionError(
        w.sent > 0
          ? null
          : w.failed && w.failed > 0
            ? `Worker tried ${w.due ?? 0} sends — all failed. Check Railway logs.`
            : "Worker found nothing due — try refreshing."
      );
    }
    router.refresh();
  }

  async function deleteCampaign() {
    if (
      !confirm(
        `Delete "${name}"? This permanently removes the sequence and all prospect state. Sent emails stay in the email_sends log.`
      )
    ) {
      return;
    }
    setActionError(null);
    setBusy(true);
    const res = await fetch(`/api/outreach/campaigns/${campaignId}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) {
      router.replace("/user/outreach");
      router.refresh();
      return;
    }
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setActionError(j.error ?? "Couldn't delete campaign.");
  }

  const sequenceLocked = status === "active";

  return (
    <div className="space-y-5">
      <div className="surface-card p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="min-w-0">
            <Input
              label="Campaign name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              disabled={savingName}
            />
            {nameSavedAt && Date.now() - nameSavedAt < 4000 ? (
              <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--success-700)]">
                <Check className="h-3 w-3" /> Saved
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={sendAllNow}
              disabled={busy}
              loading={busy}
              iconLeft={!busy ? <Zap className="h-3.5 w-3.5" /> : undefined}
              title="Activate + fire every pending email right now, no humanization delay, no daily-limit check"
            >
              Send all now
            </Button>
            {status === "draft" ? (
              <Button
                type="button"
                onClick={start}
                disabled={busy}
                loading={busy}
                iconLeft={!busy ? <Play className="h-3.5 w-3.5" /> : undefined}
              >
                Start campaign
              </Button>
            ) : null}
            {status === "active" ? (
              <Button
                type="button"
                variant="secondary"
                onClick={pause}
                disabled={busy}
                loading={busy}
                iconLeft={!busy ? <Pause className="h-3.5 w-3.5" /> : undefined}
              >
                Pause
              </Button>
            ) : null}
            {status === "paused" ? (
              <Button
                type="button"
                onClick={resume}
                disabled={busy}
                loading={busy}
                iconLeft={!busy ? <Play className="h-3.5 w-3.5" /> : undefined}
              >
                Resume
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={deleteCampaign}
              disabled={busy}
              iconLeft={<Trash2 className="h-3.5 w-3.5" />}
            >
              Delete
            </Button>
          </div>
        </div>

        {actionError ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {actionError}
          </div>
        ) : null}
      </div>

      <CampaignStatsBar stats={stats} />

      <SenderBreakdown activity={senderActivity} />

      <ScheduleEditor
        campaignId={campaignId}
        initial={initialSchedule}
      />

      <SequenceEditor
        campaignId={campaignId}
        initialSteps={steps}
        disabled={sequenceLocked}
      />

      <ProspectsManager
        campaignId={campaignId}
        initialProspects={prospects}
        candidateLeads={candidateLeads}
      />
    </div>
  );
}

// Editable schedule for an existing campaign. Persists via PATCH and only
// enables Save when something actually changed. Editing the schedule of an
// active campaign is allowed — the worker reads these on its next tick, so a
// change takes effect immediately for ongoing/follow-up sends.
function ScheduleEditor({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: CampaignSchedule;
}) {
  const router = useRouter();
  const [dailyLimit, setDailyLimit] = useState(initial.dailyLimit);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [sendDays, setSendDays] = useState<string[]>(initial.sendDays);
  const [sendWindowStart, setSendWindowStart] = useState(
    initial.sendWindowStart
  );
  const [sendWindowEnd, setSendWindowEnd] = useState(initial.sendWindowEnd);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    dailyLimit !== initial.dailyLimit ||
    timezone !== initial.timezone ||
    sendWindowStart !== initial.sendWindowStart ||
    sendWindowEnd !== initial.sendWindowEnd ||
    sendDays.join(",") !== initial.sendDays.join(",");

  async function save() {
    setError(null);
    if (sendDays.length === 0) {
      setError("Pick at least one send day.");
      return;
    }
    if (sendWindowStart >= sendWindowEnd) {
      setError("Send window end must be after start.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/outreach/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailyLimit,
        timezone,
        sendDays,
        sendWindowStart,
        sendWindowEnd,
      }),
    });
    setSaving(false);
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Couldn't save schedule.");
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  }

  return (
    <div className="surface-card space-y-5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
          <CalendarClock className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--ink-strong)]">
            Schedule
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            When ongoing sends and follow-ups go out. Changes apply on the
            worker&apos;s next tick — use &quot;Send all now&quot; above to
            bypass this entirely for an instant blast.
          </p>
        </div>
      </div>

      {/* Daily pace */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
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
          />
        </div>
        <div className="flex items-center gap-1.5 pb-1">
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

      <ScheduleFields
        timezone={timezone}
        setTimezone={setTimezone}
        sendDays={sendDays}
        setSendDays={setSendDays}
        sendWindowStart={sendWindowStart}
        setSendWindowStart={setSendWindowStart}
        sendWindowEnd={sendWindowEnd}
        setSendWindowEnd={setSendWindowEnd}
      />

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          loading={saving}
        >
          Save schedule
        </Button>
        {savedAt && Date.now() - savedAt < 4000 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--success-700)]">
            <Check className="h-3 w-3" /> Saved
          </span>
        ) : null}
      </div>
    </div>
  );
}
