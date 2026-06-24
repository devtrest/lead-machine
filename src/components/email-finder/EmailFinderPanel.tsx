"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Globe,
  Loader2,
  MailSearch,
  Search,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

// One prospect list (scan_run) with the counts the finder needs: how many
// leads have a crawlable website, how many already have an email, and the
// difference ("missing") — the leads we can still try to harvest an email for.
export type FinderList = {
  id: string;
  keyword: string;
  location: string;
  status: string;
  result_count: number;
  started_at: string;
  websites: number;
  withEmail: number;
  missing: number;
};

export function EmailFinderPanel({ lists }: { lists: FinderList[] }) {
  const [search, setSearch] = useState("");

  const totals = useMemo(
    () => ({
      missing: lists.reduce((s, l) => s + l.missing, 0),
      withEmail: lists.reduce((s, l) => s + l.withEmail, 0),
      websites: lists.reduce((s, l) => s + l.websites, 0),
    }),
    [lists]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter(
      (l) =>
        l.keyword.toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q)
    );
  }, [lists, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
            Email finder
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
            Scrape emails from your leads&apos; websites
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
            For leads that have a website but no email yet, we re-crawl the
            site — homepage, contact, about and terms pages — to find a real
            email. Runs on leads you already scraped, so it&apos;s{" "}
            <span className="font-medium text-[var(--ink-strong)]">
              free — no credits charged.
            </span>
          </p>
        </div>
        <div className="flex items-stretch gap-2">
          <Stat label="No email" value={totals.missing.toLocaleString()} highlight />
          <Stat label="With email" value={totals.withEmail.toLocaleString()} />
          <Stat label="Websites" value={totals.websites.toLocaleString()} />
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-subtle)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by niche or city…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] py-2 pl-9 pr-4 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
        />
      </div>

      {/* List */}
      {lists.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--brand-700)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <h3 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
            No prospect lists yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--ink-muted)]">
            Run a lead campaign first — then come back here to fill in any
            missing emails across your prospects.
          </p>
          <Link
            href="/user/jobs"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
          >
            <Sparkles className="h-4 w-4" />
            Create a campaign
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-[var(--ink-muted)]">
          No lists match{" "}
          <span className="font-medium text-[var(--ink-strong)]">
            “{search}”
          </span>
          .
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((l, i) => (
            <ListTile key={l.id} list={l} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`min-w-[88px] rounded-lg border px-4 py-2.5 text-center ${
        highlight
          ? "border-[var(--brand-200)] bg-[var(--brand-50)]"
          : "border-[var(--border)] bg-[var(--surface-elev)]"
      }`}
    >
      <div
        className={`text-xl font-semibold tabular-nums ${
          highlight ? "text-[var(--brand-700)]" : "text-[var(--ink-strong)]"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
        {label}
      </div>
    </div>
  );
}

function ListTile({ list, index }: { list: FinderList; index: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Live crawl progress (done / total sites) while a scrape is streaming.
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  // Emails found so far this run — drives the live count-down + coverage bar.
  const [found, setFound] = useState(0);

  // When fresh server data arrives (after router.refresh resolves), the live
  // overrides are baked into list.* — drop them so we show the server truth
  // without flashing the pre-scrape numbers.
  useEffect(() => {
    setFound(0);
    setProg(null);
  }, [list.missing, list.withEmail]);

  // Apply live progress on top of the server snapshot.
  const liveWithEmail = list.withEmail + found;
  const liveMissing = Math.max(0, list.missing - found);
  const coverage =
    list.websites > 0
      ? Math.min(100, Math.round((liveWithEmail / list.websites) * 100))
      : 0;
  const crawlPct =
    prog && prog.total > 0
      ? Math.min(100, Math.round((prog.done / prog.total) * 100))
      : 0;

  async function scrape() {
    if (list.missing === 0) {
      toast.success(
        "Nothing to scrape",
        "Every lead with a website already has an email"
      );
      return;
    }
    if (
      !confirm(
        `Scrape emails for ${list.missing.toLocaleString()} lead${
          list.missing === 1 ? "" : "s"
        } in “${list.keyword}” that don't have one yet? No credits will be charged.`
      )
    ) {
      return;
    }
    setBusy(true);
    setDone(false);
    setFound(0);
    setProg({ done: 0, total: list.missing });

    let final: {
      newEmails?: number;
      attempted?: number;
      remaining?: number;
    } | null = null;

    try {
      const res = await fetch(`/api/scan/runs/${list.id}/reenrich/stream`, {
        method: "POST",
      });
      if (!res.ok || !res.body) {
        toast.error("Couldn't scrape emails", `Server returned ${res.status}`);
        setBusy(false);
        setProg(null);
        return;
      }

      // Parse the SSE stream frame by frame.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const dataLine = frame
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (!payload) continue;
          let evt: {
            phase?: string;
            done?: number;
            total?: number;
            newEmails?: number;
            attempted?: number;
            remaining?: number;
            message?: string;
          };
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (evt.phase === "progress") {
            setProg({ done: evt.done ?? 0, total: evt.total ?? list.missing });
            setFound(evt.newEmails ?? 0);
          } else if (evt.phase === "done") {
            final = evt;
            setFound(evt.newEmails ?? 0);
          } else if (evt.phase === "error") {
            throw new Error(evt.message || "Scrape failed");
          }
        }
      }

      setDone(true);
      const f = final?.newEmails ?? found;
      const attempted = final?.attempted ?? 0;
      const remaining = final?.remaining ?? 0;

      if (f > 0) {
        toast.success(
          `Found ${f} new email${f === 1 ? "" : "s"}`,
          remaining > 0
            ? `${remaining} site${remaining === 1 ? "" : "s"} left — click again to continue`
            : "Saved to your leads"
        );
      } else if (remaining > 0) {
        toast.success(
          "Still working…",
          `${remaining} site${remaining === 1 ? "" : "s"} left — click again to continue`
        );
      } else {
        toast.success(
          "No new emails found",
          attempted > 0
            ? `Crawled ${attempted} site${attempted === 1 ? "" : "s"} — none list a public email`
            : "Nothing left to crawl"
        );
      }
      router.refresh();
    } catch (err) {
      toast.error(
        "Couldn't scrape emails",
        err instanceof Error ? err.message : undefined
      );
      setProg(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.28 }}
      className="surface-card flex flex-col p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold capitalize text-[var(--ink-strong)]">
            {list.keyword}
          </h3>
          <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
            {list.location} ·{" "}
            {new Date(list.started_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <Link
          href={`/user/leads?campaign=${list.id}`}
          className="shrink-0 text-xs font-medium text-[var(--brand-700)] hover:underline"
        >
          View leads
        </Link>
      </div>

      {/* While scraping: show live crawl progress. Idle: show email coverage. */}
      {busy ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
            <span className="inline-flex items-center gap-1 font-medium text-[var(--brand-700)]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Crawling {prog?.done ?? 0}/{prog?.total ?? list.missing}
            </span>
            <span className="font-semibold tabular-nums text-[var(--ink-strong)]">
              {found} found
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div
              className="h-full rounded-full bg-[var(--brand-500)] transition-[width] duration-300"
              style={{ width: `${crawlPct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {list.websites} websites
            </span>
            <span className="font-semibold tabular-nums text-[var(--ink-strong)]">
              {coverage}% have email
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div
              className="h-full rounded-full bg-[var(--brand-500)] transition-[width] duration-500"
              style={{ width: `${coverage}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums text-[var(--ink-strong)]">
            {liveMissing.toLocaleString()}
          </span>
          <span className="text-xs text-[var(--ink-muted)]">
            without email
          </span>
        </div>

        <button
          type="button"
          onClick={scrape}
          disabled={busy || liveMissing === 0}
          title={
            liveMissing === 0
              ? "Every lead with a website already has an email"
              : `Scrape emails for ${liveMissing} leads`
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : done ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <MailSearch className="h-3.5 w-3.5" />
          )}
          {busy ? "Scraping…" : liveMissing === 0 ? "All found" : "Scrape emails"}
        </button>
      </div>
    </motion.div>
  );
}
