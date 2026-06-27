"use client";

import { useMemo } from "react";
import { Globe } from "lucide-react";

// Shared scheduling controls (timezone + send days + send window) used by both
// the campaign wizard and the campaign-detail schedule editor. Pure
// presentational: it owns no state, just renders the given values and calls
// back on change. Keeping it in one place means the two surfaces can never
// drift apart in look or in the set of valid options.

// Day order used everywhere in the schedule UI (Mon-first, like a calendar).
export const DAY_DEFS: { key: string; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export const ALL_DAYS = DAY_DEFS.map((d) => d.key);

const DAY_PRESETS: { label: string; days: string[] }[] = [
  { label: "Every day", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
  { label: "Weekdays", days: ["mon", "tue", "wed", "thu", "fri"] },
  { label: "Weekends", days: ["sat", "sun"] },
];

// A curated set of common IANA zones for the dropdown. The user's currently
// selected zone is injected at the top so it's always selectable even if it
// isn't in this list.
const COMMON_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
];

// Best-effort detection of the browser's IANA zone, for "use my timezone"
// defaults. Falls back to UTC where unavailable.
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function ScheduleFields({
  timezone,
  setTimezone,
  sendDays,
  setSendDays,
  sendWindowStart,
  setSendWindowStart,
  sendWindowEnd,
  setSendWindowEnd,
}: {
  timezone: string;
  setTimezone: (v: string) => void;
  sendDays: string[];
  setSendDays: (v: string[]) => void;
  sendWindowStart: string;
  setSendWindowStart: (v: string) => void;
  sendWindowEnd: string;
  setSendWindowEnd: (v: string) => void;
}) {
  // Dedupe the selected zone into the curated list (selected first).
  const tzOptions = useMemo(() => {
    return Array.from(new Set<string>([timezone, ...COMMON_TIMEZONES]));
  }, [timezone]);

  const daySet = useMemo(() => new Set(sendDays), [sendDays]);

  function toggleDay(key: string) {
    const next = new Set(daySet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Keep canonical Mon-first order.
    setSendDays(DAY_DEFS.filter((d) => next.has(d.key)).map((d) => d.key));
  }

  const presetMatch = (days: string[]) =>
    days.length === sendDays.length && days.every((d) => daySet.has(d));

  return (
    <div className="space-y-5">
      {/* Timezone */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
          <Globe className="h-3.5 w-3.5" />
          Timezone
        </label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-2 text-sm text-[var(--ink-strong)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
        >
          {tzOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {/* Send days */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-medium text-[var(--ink-muted)]">
            Send days
          </label>
          <div className="flex items-center gap-1.5">
            {DAY_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setSendDays(p.days)}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                  presetMatch(p.days)
                    ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                    : "border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--brand-300)]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DAY_DEFS.map((d) => {
            const on = daySet.has(d.key);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDay(d.key)}
                aria-pressed={on}
                className={`h-9 w-12 rounded-lg border text-xs font-semibold transition ${
                  on
                    ? "border-[var(--brand-500)] bg-[var(--brand-600)] text-white shadow-[var(--shadow-xs)]"
                    : "border-[var(--border)] bg-[var(--surface-elev)] text-[var(--ink-muted)] hover:border-[var(--brand-300)]"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Send window */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--ink-muted)]">
          Send window
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={sendWindowStart}
              onChange={(e) => setSendWindowStart(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-2 text-sm text-[var(--ink-strong)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
            />
            <span className="text-xs text-[var(--ink-subtle)]">to</span>
            <input
              type="time"
              value={sendWindowEnd}
              onChange={(e) => setSendWindowEnd(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-2 text-sm text-[var(--ink-strong)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
            />
          </div>
          <span className="text-[11px] text-[var(--ink-subtle)]">
            Emails send only between these hours, {timezone.replace(/_/g, " ")}{" "}
            time.
          </span>
        </div>
      </div>
    </div>
  );
}
