"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Trash2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  SequenceEditor,
  type SequenceStep,
} from "@/components/outreach/SequenceEditor";
import {
  ProspectsManager,
  type Prospect,
  type CandidateLead,
} from "@/components/outreach/ProspectsManager";

export function CampaignDetail({
  campaignId,
  initialName,
  initialStatus,
  steps,
  prospects,
  candidateLeads,
}: {
  campaignId: string;
  initialName: string;
  initialStatus: string;
  steps: SequenceStep[];
  prospects: Prospect[];
  candidateLeads: CandidateLead[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState(initialStatus);
  const [savingName, setSavingName] = useState(false);
  const [nameSavedAt, setNameSavedAt] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function deleteCampaign() {
    if (
      !confirm(
        `Delete "${name}"? This permanently removes the sequence and all prospect state. Sent emails stay in the email_sends log.`
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/outreach/campaigns/${campaignId}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) {
      router.replace("/user/outreach");
      router.refresh();
    }
  }

  const sequenceLocked = status === "active";

  return (
    <div className="space-y-5">
      <div className="surface-card p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Input
              label="Campaign name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              disabled={savingName}
            />
            {nameSavedAt && Date.now() - nameSavedAt < 4000 ? (
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--success-700)]">
                <Check className="h-3 w-3" /> Saved
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
