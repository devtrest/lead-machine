"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Minus,
  Pause,
  Play,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { initialsFor } from "@/lib/avatar";

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: string;
  credits: number;
  role: string;
  suspended?: boolean | null;
  created_at: string | null;
};

type Confirm =
  | null
  | {
      kind: "credits";
      user: AdminUser;
      delta: number;
    }
  | {
      kind: "suspend";
      user: AdminUser;
      suspend: boolean;
    }
  | {
      kind: "delete";
      user: AdminUser;
    };

export function AdminUsersTable({ users }: { users: AdminUser[] }) {
  const router = useRouter();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [creditsAmount, setCreditsAmount] = useState("100");
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );
  const [, startTransition] = useTransition();

  function showToast(kind: "ok" | "error", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }

  async function callAction(
    body: Record<string, unknown>,
    userId: string,
    successMsg: string
  ) {
    setBusyUserId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", json.error ?? "Action failed");
        return;
      }
      showToast("ok", successMsg);
      setConfirm(null);
      startTransition(() => router.refresh());
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Network error");
    } finally {
      setBusyUserId(null);
    }
  }

  function openCredits(user: AdminUser, delta: number) {
    setCreditsAmount(String(Math.abs(delta)));
    setConfirm({ kind: "credits", user, delta });
  }

  function commitCredits() {
    if (confirm?.kind !== "credits") return;
    const sign = confirm.delta < 0 ? -1 : 1;
    const amount = Math.abs(parseInt(creditsAmount, 10) || 0);
    if (amount === 0) {
      showToast("error", "Enter an amount greater than 0");
      return;
    }
    callAction(
      { kind: "credits", userId: confirm.user.id, delta: sign * amount },
      confirm.user.id,
      `${sign > 0 ? "Added" : "Subtracted"} ${amount} credits`
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[var(--surface-sunken)]/60">
              <Th>User</Th>
              <Th>Plan</Th>
              <Th align="right">Credits</Th>
              <Th>Role</Th>
              <Th>Joined</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((row) => {
              const isBusy = busyUserId === row.id;
              const suspended = row.suspended === true;
              return (
                <tr
                  key={row.id}
                  className={`transition ${suspended ? "opacity-60" : ""} hover:bg-[var(--brand-50)]/40`}
                >
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-600)] to-[var(--sky-500)] text-[10px] font-bold text-white">
                        {initialsFor(row.full_name ?? row.email)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate text-sm font-medium text-[var(--ink-strong)]">
                          {row.full_name || row.email}
                          {suspended ? (
                            <span className="rounded-full bg-[var(--danger-50)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--danger-700)]">
                              Suspended
                            </span>
                          ) : null}
                        </div>
                        {row.full_name ? (
                          <div className="truncate text-[11px] text-[var(--ink-subtle)]">
                            {row.email}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elev)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                      {row.plan}
                    </span>
                  </Td>
                  <Td align="right" className="tabular-nums font-semibold text-[var(--ink-strong)]">
                    {row.credits}
                  </Td>
                  <Td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        row.role === "admin"
                          ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                          : "bg-[var(--surface-sunken)] text-[var(--ink-muted)]"
                      }`}
                    >
                      {row.role}
                    </span>
                  </Td>
                  <Td className="text-xs text-[var(--ink-muted)]">
                    {row.created_at
                      ? new Date(row.created_at).toLocaleDateString()
                      : "—"}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <ActionBtn
                        title="Add credits"
                        tone="brand"
                        onClick={() => openCredits(row, +100)}
                        disabled={isBusy}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </ActionBtn>
                      <ActionBtn
                        title="Subtract credits"
                        tone="amber"
                        onClick={() => openCredits(row, -100)}
                        disabled={isBusy || row.credits === 0}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </ActionBtn>
                      <ActionBtn
                        title={suspended ? "Reinstate" : "Suspend"}
                        tone="warning"
                        onClick={() =>
                          setConfirm({
                            kind: "suspend",
                            user: row,
                            suspend: !suspended,
                          })
                        }
                        disabled={isBusy}
                      >
                        {suspended ? (
                          <Play className="h-3.5 w-3.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5" />
                        )}
                      </ActionBtn>
                      <ActionBtn
                        title="Delete"
                        tone="danger"
                        onClick={() => setConfirm({ kind: "delete", user: row })}
                        disabled={isBusy}
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </ActionBtn>
                    </div>
                  </Td>
                </tr>
              );
            })}
            {users.length === 0 ? (
              <tr>
                <Td colSpan={6} className="text-center text-[var(--ink-subtle)]">
                  No users yet.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {confirm ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirm(null)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elev)] p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[var(--ink-strong)]">
                    {confirm.kind === "credits"
                      ? confirm.delta < 0
                        ? "Subtract credits"
                        : "Add credits"
                      : confirm.kind === "suspend"
                        ? confirm.suspend
                          ? "Suspend user"
                          : "Reinstate user"
                        : "Delete user"}
                  </h3>
                  <p className="mt-1 truncate text-sm text-[var(--ink-muted)]">
                    {confirm.user.full_name || confirm.user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {confirm.kind === "credits" ? (
                <div className="mt-5 space-y-3">
                  <label className="block text-xs font-medium text-[var(--ink-muted)]">
                    Amount
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={creditsAmount}
                    onChange={(e) => setCreditsAmount(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] px-3.5 py-2 text-sm font-semibold text-[var(--ink-strong)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
                  />
                  <p className="text-xs text-[var(--ink-subtle)]">
                    Current balance: {confirm.user.credits} credits
                  </p>
                </div>
              ) : confirm.kind === "suspend" ? (
                <p className="mt-4 text-sm text-[var(--ink-muted)]">
                  {confirm.suspend
                    ? "Suspended users keep their data but lose app access until reinstated."
                    : "Reinstating restores the user's app access immediately."}
                </p>
              ) : (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--danger-100)] bg-[var(--danger-50)] px-3.5 py-2.5 text-sm text-[var(--danger-700)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Deletes the profile and cascades all leads, campaigns, and
                    contacts. This cannot be undone.
                  </span>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]"
                >
                  Cancel
                </button>
                {confirm.kind === "credits" ? (
                  <button
                    type="button"
                    onClick={commitCredits}
                    disabled={busyUserId !== null}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-50"
                  >
                    {busyUserId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Confirm
                  </button>
                ) : confirm.kind === "suspend" ? (
                  <button
                    type="button"
                    onClick={() =>
                      callAction(
                        {
                          kind: "suspend",
                          userId: confirm.user.id,
                          suspended: confirm.suspend,
                        },
                        confirm.user.id,
                        confirm.suspend ? "User suspended" : "User reinstated"
                      )
                    }
                    disabled={busyUserId !== null}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--warning-500)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--warning-700)] disabled:opacity-50"
                  >
                    {busyUserId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {confirm.suspend ? "Suspend" : "Reinstate"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      callAction(
                        { kind: "delete", userId: confirm.user.id },
                        confirm.user.id,
                        "User deleted"
                      )
                    }
                    disabled={busyUserId !== null}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--danger-500)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--danger-700)] disabled:opacity-50"
                  >
                    {busyUserId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Delete
                  </button>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg ${
              toast.kind === "ok"
                ? "border-[var(--success-100)] bg-[var(--success-50)] text-[var(--success-700)]"
                : "border-[var(--danger-100)] bg-[var(--danger-50)] text-[var(--danger-700)]"
            }`}
          >
            {toast.kind === "ok" ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <span>{toast.text}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ActionBtn({
  title,
  tone,
  onClick,
  disabled,
  children,
}: {
  title: string;
  tone: "brand" | "amber" | "warning" | "danger";
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const toneMap = {
    brand:
      "border-[var(--border)] text-[var(--brand-700)] hover:border-[var(--brand-200)] hover:bg-[var(--brand-50)]",
    amber:
      "border-[var(--border)] text-[var(--accent-700)] hover:border-[var(--accent-100)] hover:bg-[var(--accent-50)]",
    warning:
      "border-[var(--border)] text-[var(--warning-700)] hover:border-[var(--warning-100)] hover:bg-[var(--warning-50)]",
    danger:
      "border-[var(--border)] text-[var(--danger-700)] hover:border-[var(--danger-100)] hover:bg-[var(--danger-50)]",
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-lg border bg-[var(--surface-elev)] transition disabled:cursor-not-allowed disabled:opacity-40 ${toneMap[tone]}`}
    >
      {children}
    </button>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)] ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
  align,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
  align?: "right";
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-5 py-3 text-sm ${align === "right" ? "text-right" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
