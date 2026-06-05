"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  CheckCircle2,
  XCircle,
  Trash2,
  UserPlus,
  X,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

export type Prospect = {
  id: string;
  leadId: string;
  email: string;
  status: string;
  currentStep: number;
  nextSendAt: string | null;
  lastSentAt: string | null;
  leadName: string;
  leadCategory: string | null;
  opened: boolean;
};

export type CandidateLead = {
  id: string;
  name: string;
  category: string | null;
  email: string;
};

export function ProspectsManager({
  campaignId,
  initialProspects,
  candidateLeads,
}: {
  campaignId: string;
  initialProspects: Prospect[];
  candidateLeads: CandidateLead[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  const counts = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let replied = 0;
    let bounced = 0;
    let completed = 0;
    for (const p of initialProspects) {
      if (p.status === "pending") pending += 1;
      else if (p.status === "in_progress") inProgress += 1;
      else if (p.status === "replied") replied += 1;
      else if (p.status === "bounced") bounced += 1;
      else if (p.status === "completed") completed += 1;
    }
    return { pending, inProgress, replied, bounced, completed };
  }, [initialProspects]);

  async function patchProspect(id: string, status: string) {
    const res = await fetch(`/api/outreach/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) router.refresh();
  }

  async function removeProspect(id: string) {
    if (!confirm("Remove this prospect from the campaign?")) return;
    const res = await fetch(`/api/outreach/prospects/${id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  return (
    <div className="surface-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink-strong)]">
            Prospects ({initialProspects.length})
          </h2>
          <p className="text-xs text-[var(--ink-muted)]">
            {counts.pending} pending · {counts.inProgress} in progress ·{" "}
            {counts.replied} replied · {counts.bounced} bounced ·{" "}
            {counts.completed} completed
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setAddOpen((v) => !v)}
          iconLeft={
            addOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />
          }
        >
          {addOpen ? "Close" : `Add prospects (${candidateLeads.length} available)`}
        </Button>
      </div>

      {addOpen ? (
        <AddProspectsPanel
          campaignId={campaignId}
          candidateLeads={candidateLeads}
          onClose={() => setAddOpen(false)}
        />
      ) : null}

      {initialProspects.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-sunken)]/40 p-6 text-center">
          <UserPlus className="mx-auto h-7 w-7 text-[var(--ink-subtle)]" />
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            No prospects yet — add some from the source niche above to get going.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
          {initialProspects.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-[var(--brand-50)]/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-[var(--ink-strong)]">
                    {p.leadName}
                  </span>
                  <ProspectStatusPill status={p.status} step={p.currentStep} />
                  {p.opened ? (
                    <span
                      title="Tracking pixel fired — recipient opened at least one email"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--sky-50)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--sky-700)]"
                    >
                      <Eye className="h-2.5 w-2.5" />
                      Opened
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                  {p.email}
                  {p.lastSentAt ? (
                    <>
                      {" · "}last sent{" "}
                      {new Date(p.lastSentAt).toLocaleString()}
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {p.status !== "replied" ? (
                  <button
                    type="button"
                    onClick={() => patchProspect(p.id, "replied")}
                    title="Mark as replied (stops the sequence)"
                    className="rounded p-1.5 text-[var(--ink-subtle)] hover:bg-[var(--success-50)] hover:text-[var(--success-700)]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => patchProspect(p.id, "pending")}
                    title="Re-enable this prospect"
                    className="rounded p-1.5 text-[var(--success-700)] hover:bg-[var(--success-50)]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {p.status !== "bounced" ? (
                  <button
                    type="button"
                    onClick={() => patchProspect(p.id, "bounced")}
                    title="Mark as bounced"
                    className="rounded p-1.5 text-[var(--ink-subtle)] hover:bg-[var(--danger-50)] hover:text-[var(--danger-700)]"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeProspect(p.id)}
                  title="Remove from campaign"
                  className="rounded p-1.5 text-[var(--ink-subtle)] hover:bg-[var(--danger-50)] hover:text-[var(--danger-700)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProspectStatusPill({
  status,
  step,
}: {
  status: string;
  step: number;
}) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: {
      cls: "bg-[var(--surface-sunken)] text-[var(--ink-muted)]",
      label: "Pending",
    },
    in_progress: {
      cls: "bg-[var(--brand-50)] text-[var(--brand-700)]",
      label: `Step ${step} sent`,
    },
    replied: {
      cls: "bg-[var(--success-50)] text-[var(--success-700)]",
      label: "Replied",
    },
    bounced: {
      cls: "bg-[var(--danger-50)] text-[var(--danger-700)]",
      label: "Bounced",
    },
    completed: {
      cls: "bg-[var(--brand-50)] text-[var(--brand-700)]",
      label: "Completed",
    },
    failed: {
      cls: "bg-[var(--warning-50)] text-[var(--warning-700)]",
      label: "Failed",
    },
  };
  const style = map[status] ?? map.pending;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.cls}`}
    >
      {style.label}
    </span>
  );
}

function AddProspectsPanel({
  campaignId,
  candidateLeads,
  onClose,
}: {
  campaignId: string;
  candidateLeads: CandidateLead[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAll() {
    if (selected.size === candidateLeads.length) setSelected(new Set());
    else setSelected(new Set(candidateLeads.map((l) => l.id)));
  }

  async function add() {
    if (selected.size === 0) return;
    setError(null);
    setAdding(true);
    const res = await fetch(
      `/api/outreach/campaigns/${campaignId}/prospects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected) }),
      }
    );
    setAdding(false);
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Couldn't add prospects.");
      return;
    }
    onClose();
    router.refresh();
  }

  if (candidateLeads.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)]/40 p-4 text-center text-xs text-[var(--ink-muted)]">
        All leads in this niche have already been added to the campaign.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)]/40 p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[var(--ink-strong)]">
          Available leads ({candidateLeads.length})
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className="font-semibold text-[var(--brand-700)] hover:text-[var(--brand-800)]"
        >
          {selected.size === candidateLeads.length ? "Clear" : "Select all"}
        </button>
      </div>
      <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] p-2">
        {candidateLeads.map((l) => {
          const checked = selected.has(l.id);
          return (
            <li key={l.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--brand-50)]/40">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(l.id)) next.delete(l.id);
                      else next.add(l.id);
                      return next;
                    });
                  }}
                  className="h-3.5 w-3.5 accent-[var(--brand-600)]"
                />
                <span className="min-w-0 flex-1 truncate text-xs">
                  <span className="font-medium text-[var(--ink-strong)]">
                    {l.name}
                  </span>{" "}
                  <span className="text-[var(--ink-subtle)]">· {l.email}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {error ? (
        <div className="text-xs text-[var(--danger-700)]">{error}</div>
      ) : null}
      <Button
        type="button"
        size="sm"
        onClick={add}
        loading={adding}
        disabled={selected.size === 0 || adding}
        className="w-full"
      >
        Add {selected.size} prospect{selected.size === 1 ? "" : "s"}
      </Button>
    </div>
  );
}
