"use client";

import { useState } from "react";
import { Send, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export type TestSender = {
  id: string;
  email: string;
  display_name: string | null;
};

// Sends Step 1's subject + body to a single test address using one of the
// user's connected Gmail senders. Decoupled from any campaign — useful in
// the wizard before launch and on the detail page after edits.
export function TestSendCard({
  senders,
  defaultSenderId,
  subject,
  body,
  disabled,
  helpText,
}: {
  senders: TestSender[];
  defaultSenderId: string | null;
  subject: string;
  body: string;
  disabled?: boolean;
  helpText?: string;
}) {
  const toast = useToast();
  const [to, setTo] = useState("");
  const [senderId, setSenderId] = useState(
    defaultSenderId ?? senders[0]?.id ?? ""
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  async function onSend() {
    setError(null);
    if (!to.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!senderId) {
      setError("Pick a sender to send the test from.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError("Step 1 needs a subject and body before you can test.");
      return;
    }
    setSending(true);
    const res = await fetch("/api/outreach/test-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: to.trim(),
        senderId,
        subject,
        body,
      }),
    });
    setSending(false);
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      from?: string;
    };
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Couldn't send test.");
      toast.error("Test send failed", json.error);
      return;
    }
    setLastSentAt(Date.now());
    toast.success("Test email sent", `From ${json.from} → ${to}`);
  }

  return (
    <div className="surface-card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] text-[var(--brand-700)] ring-1 ring-inset ring-[var(--brand-100)]">
          <Send className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-subtle)]">
            Preview
          </div>
          <h2 className="mt-0.5 text-base font-semibold text-[var(--ink-strong)]">
            Send a test email
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {helpText ??
              "Drop in your own email (or a colleague's) to preview exactly what prospects will receive. Goes out through the picked sender."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <Input
          label="Send to"
          type="email"
          placeholder="you@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={disabled || sending || senders.length === 0}
        />
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[var(--ink-muted)]">
            Send via
          </label>
          {senders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--warning-200)] bg-[var(--warning-50)]/40 px-3 py-2.5 text-xs text-[var(--warning-800)]">
              No active senders connected yet.
            </div>
          ) : (
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              disabled={disabled || sending}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] px-3.5 py-2.5 text-sm text-[var(--ink-strong)]"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name ? `${s.display_name} ` : ""}&lt;{s.email}&gt;
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--danger-100)] bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      ) : null}

      {lastSentAt && Date.now() - lastSentAt < 8000 ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--success-100)] bg-[var(--success-50)] px-3 py-2 text-xs text-[var(--success-700)]">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Test sent. Check the inbox in a few seconds — Gmail SMTP is usually
          near-instant.
        </div>
      ) : null}

      <Button
        type="button"
        size="sm"
        onClick={onSend}
        loading={sending}
        disabled={disabled || sending || senders.length === 0}
        iconRight={!sending ? <Send className="h-3.5 w-3.5" /> : undefined}
      >
        Send test now
      </Button>

      <p className="text-[11px] text-[var(--ink-subtle)]">
        Test sends use sample placeholder values: <code className="rounded bg-[var(--surface-sunken)] px-1">{`{{name}}`}</code>{" "}
        = &quot;Test Lead&quot;,{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1">{`{{category}}`}</code>{" "}
        = &quot;your business&quot;. Subject prefixed with [TEST].
      </p>
    </div>
  );
}
