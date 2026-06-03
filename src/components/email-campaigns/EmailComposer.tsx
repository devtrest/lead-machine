"use client";

import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Paperclip,
  X,
  Check,
  AlertTriangle,
  Mail,
  ChevronDown,
} from "lucide-react";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EMAIL_TEMPLATES, getTemplate } from "@/lib/email-templates";

// Cap total attachment payload at ~3.5 MB. Vercel function bodies max out
// around 4.5 MB on Hobby; we leave room for subject/body/recipients JSON.
const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024;

type Recipient = {
  id: string;
  name: string;
  category: string | null;
  websiteUrl: string | null;
  emails: string[];
  timesEmailed: number;
};

type Attachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  base64: string;
};

type SendResult =
  | { state: "idle" }
  | { state: "sending"; sent: number; total: number }
  | { state: "done"; sent: number; failed: number; errors: string[] };

export function EmailComposer({
  runId,
  recipients,
  senderName,
  senderEmail,
}: {
  runId: string;
  recipients: Recipient[];
  senderName: string | null;
  senderEmail: string | null;
}) {
  const [templateId, setTemplateId] = useState("cold-intro");
  const [subject, setSubject] = useState(
    getTemplate("cold-intro")?.subject ?? ""
  );
  const [body, setBody] = useState(getTemplate("cold-intro")?.body ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(recipients.map((r) => r.id))
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [result, setResult] = useState<SendResult>({ state: "idle" });
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const senderLabel = senderName?.trim() || senderEmail || "your team";

  const totalAttachmentSize = useMemo(
    () => attachments.reduce((sum, a) => sum + a.size, 0),
    [attachments]
  );

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = getTemplate(id);
    if (!tpl) return;
    // Only overwrite subject/body when the user hasn't started editing them.
    // For the blank template, always clear so picking "Blank" feels intuitive.
    if (id === "blank") {
      setSubject("");
      setBody("");
      return;
    }
    setSubject(tpl.subject);
    setBody(tpl.body);
  }

  function toggleRecipient(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === recipients.length) setSelected(new Set());
    else setSelected(new Set(recipients.map((r) => r.id)));
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setValidationError(null);
    const next: Attachment[] = [...attachments];
    let running = totalAttachmentSize;

    for (const file of Array.from(files)) {
      if (running + file.size > MAX_ATTACHMENT_BYTES) {
        setValidationError(
          `Attachment limit is ${(MAX_ATTACHMENT_BYTES / 1024 / 1024).toFixed(1)} MB total. "${file.name}" would exceed that.`
        );
        break;
      }
      const base64 = await fileToBase64(file);
      next.push({
        id: crypto.randomUUID(),
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        base64,
      });
      running += file.size;
    }

    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function onSend() {
    setValidationError(null);
    if (!subject.trim()) {
      setValidationError("Add a subject.");
      return;
    }
    if (!body.trim()) {
      setValidationError("The email body is empty.");
      return;
    }
    if (selected.size === 0) {
      setValidationError("Select at least one recipient.");
      return;
    }

    const leadIds = Array.from(selected);
    setResult({ state: "sending", sent: 0, total: leadIds.length });

    try {
      const res = await fetch("/api/email-campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          subject: subject.trim(),
          body,
          leadIds,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            contentType: a.contentType,
            base64: a.base64,
          })),
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        sent?: number;
        failed?: number;
        errors?: string[];
        error?: string;
      };

      if (!res.ok) {
        setResult({
          state: "done",
          sent: json.sent ?? 0,
          failed: json.failed ?? leadIds.length,
          errors: [json.error ?? "Request failed."],
        });
        return;
      }

      setResult({
        state: "done",
        sent: json.sent ?? 0,
        failed: json.failed ?? 0,
        errors: json.errors ?? [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error.";
      setResult({
        state: "done",
        sent: 0,
        failed: leadIds.length,
        errors: [message],
      });
    }
  }

  const allSelected =
    recipients.length > 0 && selected.size === recipients.length;
  const sending = result.state === "sending";

  if (recipients.length === 0) {
    return (
      <div className="surface-card p-10 text-center">
        <Mail className="mx-auto h-10 w-10 text-[var(--ink-subtle)]" />
        <h3 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
          No emailable leads in this campaign
        </h3>
        <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
          None of the leads in this campaign have an email address yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_22rem]">
      <div className="surface-card space-y-4 p-5">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)]/60 px-3.5 py-2.5 text-xs">
          <span className="font-semibold text-[var(--ink-muted)]">FROM</span>
          <span className="truncate text-[var(--ink-strong)]">
            {senderLabel}
          </span>
          <span className="ml-auto truncate text-[var(--ink-subtle)]">
            Reply-to: {senderEmail ?? "—"}
          </span>
        </div>

        <TemplatePicker value={templateId} onChange={applyTemplate} />

        <Input
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What's this email about?"
          disabled={sending}
        />

        <div>
          <Textarea
            label="Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder="Write your message…"
            className="font-mono text-[13px] leading-relaxed"
            disabled={sending}
          />
          <p className="mt-1.5 text-[11px] text-[var(--ink-subtle)]">
            Placeholders:{" "}
            <code className="rounded bg-[var(--surface-sunken)] px-1">{`{{name}}`}</code>{" "}
            ·{" "}
            <code className="rounded bg-[var(--surface-sunken)] px-1">{`{{category}}`}</code>{" "}
            ·{" "}
            <code className="rounded bg-[var(--surface-sunken)] px-1">{`{{sender}}`}</code>
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-[var(--ink-muted)]">
              Attachments
            </label>
            <span className="text-[11px] text-[var(--ink-subtle)]">
              {(totalAttachmentSize / 1024 / 1024).toFixed(2)} /{" "}
              {(MAX_ATTACHMENT_BYTES / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-sunken)]/40 py-3 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--brand-400)] hover:bg-[var(--brand-50)]/40 hover:text-[var(--brand-700)] disabled:opacity-50"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Add file from computer
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />

          {attachments.length > 0 ? (
            <ul className="space-y-1.5">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-2 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Paperclip className="h-3 w-3 shrink-0 text-[var(--ink-subtle)]" />
                    <span className="truncate font-medium text-[var(--ink-strong)]">
                      {a.filename}
                    </span>
                    <span className="shrink-0 text-[var(--ink-subtle)]">
                      {(a.size / 1024).toFixed(0)} KB
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    aria-label={`Remove ${a.filename}`}
                    className="rounded p-1 text-[var(--ink-subtle)] hover:bg-[var(--danger-50)] hover:text-[var(--danger-700)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {validationError ? (
          <div className="flex items-start gap-2 rounded-xl border border-[var(--danger-100)] bg-[var(--danger-50)] px-3.5 py-2.5 text-sm text-[var(--danger-700)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        ) : null}

        {result.state === "done" ? (
          <ResultBanner result={result} />
        ) : null}

        <Button
          type="button"
          size="lg"
          onClick={onSend}
          loading={sending}
          disabled={sending}
          className="w-full"
          iconRight={!sending ? <Send className="h-4 w-4" /> : undefined}
        >
          {sending
            ? `Sending ${result.state === "sending" ? result.sent : 0} of ${result.state === "sending" ? result.total : 0}…`
            : `Send ${selected.size} email${selected.size === 1 ? "" : "s"}`}
        </Button>
      </div>

      <div className="surface-card p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Recipients ({selected.size}/{recipients.length})
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="text-[11px] font-semibold text-[var(--brand-700)] hover:text-[var(--brand-800)]"
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>
        </div>
        <ul className="max-h-[640px] divide-y divide-[var(--border)] overflow-y-auto">
          {recipients.map((r) => {
            const checked = selected.has(r.id);
            return (
              <li key={r.id}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-[var(--brand-50)]/40">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRecipient(r.id)}
                    disabled={sending}
                    className="mt-0.5 h-4 w-4 accent-[var(--brand-600)]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--ink-strong)]">
                        {r.name}
                      </span>
                      {r.timesEmailed > 0 ? (
                        <span
                          title={`Already emailed ${r.timesEmailed} time${r.timesEmailed === 1 ? "" : "s"} from this campaign`}
                          className="shrink-0 rounded-full bg-[var(--warning-50)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--warning-700)]"
                        >
                          Emailed
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                      {r.emails[0]}
                    </div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function TemplatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = EMAIL_TEMPLATES.find((t) => t.id === value);

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-[var(--ink-muted)]">
        Template
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] px-3.5 py-2.5 text-sm text-[var(--ink-strong)] transition hover:border-[var(--brand-400)]"
      >
        <span className="flex flex-col items-start">
          <span className="font-medium">{current?.name ?? "Choose"}</span>
          <span className="text-[11px] text-[var(--ink-subtle)]">
            {current?.description ?? ""}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--ink-subtle)] transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] shadow-lg"
          >
            {EMAIL_TEMPLATES.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition hover:bg-[var(--brand-50)]/60 ${
                    t.id === value ? "bg-[var(--brand-50)]/40" : ""
                  }`}
                >
                  <span className="text-sm font-medium text-[var(--ink-strong)]">
                    {t.name}
                  </span>
                  <span className="text-[11px] text-[var(--ink-subtle)]">
                    {t.description}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ResultBanner({
  result,
}: {
  result: Extract<SendResult, { state: "done" }>;
}) {
  const ok = result.failed === 0;
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
        ok
          ? "border-[var(--success-100)] bg-[var(--success-50)] text-[var(--success-700)]"
          : "border-[var(--warning-100)] bg-[var(--warning-50)] text-[var(--warning-700)]"
      }`}
    >
      {ok ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="min-w-0">
        <div className="font-semibold">
          {result.sent} sent
          {result.failed > 0 ? `, ${result.failed} failed` : ""}
        </div>
        {result.errors.length > 0 ? (
          <ul className="mt-1 list-inside list-disc text-xs opacity-90">
            {result.errors.slice(0, 3).map((e, i) => (
              <li key={i} className="truncate">
                {e}
              </li>
            ))}
            {result.errors.length > 3 ? (
              <li>…and {result.errors.length - 3} more</li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...Array.from(bytes.subarray(i, i + chunk))
    );
  }
  return btoa(binary);
}
