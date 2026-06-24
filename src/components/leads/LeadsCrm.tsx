"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  Download,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Phone,
  Mail,
  Globe,
  MapPin,
  ExternalLink,
  Users,
  X,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Wand2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Drawer } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type Lead = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  rating: number | null;
  review_count: number | null;
  maps_url: string | null;
  website_url: string | null;
  created_at: string;
  scan_run_id?: string;
  lead_contacts: { phone: string | null; email: string | null; source_url: string | null }[];
};

type Campaign = {
  id: string;
  keyword: string;
  location: string;
  status: string;
  result_count: number;
  started_at: string;
};

type SortKey = "name" | "created_at";
type SortDir = "asc" | "desc";
type FilterPill = "all" | "withWebsite" | "withEmail" | "withPhone";

const PAGE_SIZE = 25;

export function LeadsCrm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaign");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterPill>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelected(new Set());

    (async () => {
      const leadsUrl = campaignId
        ? `/api/leads?limit=2000&runId=${encodeURIComponent(campaignId)}`
        : `/api/leads?limit=200`;

      const [leadsRes, runsRes] = await Promise.all([
        fetch(leadsUrl),
        campaignId ? fetch("/api/scan/runs") : Promise.resolve(null),
      ]);

      if (cancelled) return;

      const leadsJson = await leadsRes.json().catch(() => ({}));
      if (leadsRes.ok) setLeads((leadsJson.leads as Lead[]) ?? []);

      if (campaignId && runsRes) {
        const runsJson = await runsRes.json().catch(() => ({}));
        const match = ((runsJson.runs as Campaign[]) ?? []).find(
          (r) => r.id === campaignId
        );
        setCampaign(match ?? null);
      } else {
        setCampaign(null);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = leads.filter((l) => {
      if (q) {
        const hay = [l.name, l.category, l.address, l.website_url]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const phones = l.lead_contacts.some((c) => c.phone);
      const emails = l.lead_contacts.some((c) => c.email);
      switch (filter) {
        case "withWebsite":
          return Boolean(l.website_url);
        case "withEmail":
          return emails;
        case "withPhone":
          return phones;
        default:
          return true;
      }
    });

    out = [...out].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return (
        (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
      );
    });

    return out;
  }, [leads, search, filter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageLeads = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, filter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (pageLeads.every((l) => selected.has(l.id))) {
      setSelected((s) => {
        const next = new Set(s);
        pageLeads.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelected((s) => {
        const next = new Set(s);
        pageLeads.forEach((l) => next.add(l.id));
        return next;
      });
    }
  }

  function clearCampaign() {
    router.push("/user/leads");
  }

  function buildExportRows(rows: Lead[]) {
    return rows.map((l) => {
      const phones = Array.from(
        new Set(l.lead_contacts.map((c) => c.phone).filter(Boolean))
      ) as string[];
      const emails = Array.from(
        new Set(l.lead_contacts.map((c) => c.email).filter(Boolean))
      ) as string[];
      return {
        Name: l.name,
        Category: l.category ?? "",
        Address: l.address ?? "",
        Phone: phones.join(" | "),
        Email: emails.join(" | "),
        Website: l.website_url ?? "",
        "Maps URL": l.maps_url ?? "",
        Created: new Date(l.created_at).toISOString().slice(0, 10),
      };
    });
  }

  function exportCsv(rows: Lead[]) {
    const data = buildExportRows(rows);
    if (data.length === 0) return;
    const header = Object.keys(data[0]);
    const lines = [header.join(",")];
    for (const row of data) {
      const cells = header.map((h) => {
        const s = String(row[h as keyof typeof row] ?? "").replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      });
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, exportFileName("csv"));
  }

  function exportXlsx(rows: Lead[]) {
    const data = buildExportRows(rows);
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const cols = Object.keys(data[0]).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...data.map((r) => String(r[key as keyof typeof r] ?? "").length)
      );
      return { wch: Math.min(60, Math.max(10, maxLen + 2)) };
    });
    ws["!cols"] = cols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, exportFileName("xlsx"));
  }

  function exportFileName(ext: "csv" | "xlsx") {
    const stamp = new Date().toISOString().slice(0, 10);
    if (campaign) {
      const slug = `${campaign.keyword}-${campaign.location}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);
      return `leadmachine-${slug}-${stamp}.${ext}`;
    }
    return `leadmachine-leads-${stamp}.${ext}`;
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedRows = leads.filter((l) => selected.has(l.id));
  const exportRows = selected.size > 0 ? selectedRows : filtered;
  const allOnPageSelected =
    pageLeads.length > 0 && pageLeads.every((l) => selected.has(l.id));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="surface-card overflow-hidden p-0">
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
            {campaign ? "Campaign" : "CRM"}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
            {campaign ? "Campaign leads" : "Leads"}
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            <span className="tabular-nums">{filtered.length}</span> of{" "}
            <span className="tabular-nums">{leads.length}</span> leads
            {selected.size > 0 ? (
              <span className="tabular-nums"> · {selected.size} selected</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={exportRows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-3.5 py-2 text-xs font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
              Export {selected.size > 0 ? `(${selected.size})` : "all"}
            </button>
            {exportMenuOpen ? (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setExportMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] shadow-[var(--shadow-md)]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      exportCsv(exportRows);
                      setExportMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
                  >
                    <FileText className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                    CSV (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportXlsx(exportRows);
                      setExportMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3.5 py-2.5 text-left text-xs font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--success-700)]" />
                    Excel (.xlsx)
                  </button>
                </motion.div>
              </>
            ) : null}
          </div>
          {campaignId ? (
            <ReenrichButton
              campaignId={campaignId}
              total={leads.length}
              withEmail={leads.filter((l) =>
                (l.lead_contacts ?? []).some((c) => Boolean(c.email))
              ).length}
            />
          ) : null}
          <Link
            href="/user/jobs#generate"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-700)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </Link>
        </div>
      </div>

      {campaign ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-card flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)] text-[var(--brand-700)]">
              <Layers className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
                Filtered campaign
              </div>
              <div className="text-sm font-semibold text-[var(--ink-strong)]">
                {campaign.keyword}
                <span className="font-normal text-[var(--ink-muted)]">
                  {" "}
                  · {campaign.location}
                </span>
              </div>
              <div className="text-xs text-[var(--ink-subtle)]">
                {new Date(campaign.started_at).toLocaleString()} ·{" "}
                <span className="tabular-nums">{campaign.result_count}</span> leads
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/user/jobs"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-1.5 text-xs font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
            >
              All scraping campaigns
            </Link>
            <button
              type="button"
              onClick={clearCampaign}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--brand-700)] transition hover:bg-[var(--brand-50)]"
            >
              <X className="h-3 w-3" /> Clear filter
            </button>
          </div>
        </motion.div>
      ) : null}

      <div className="surface-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-subtle)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, address, category, website…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] py-2 pl-9 pr-9 text-sm text-[var(--ink-strong)] outline-none placeholder:text-[var(--ink-subtle)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--ink-subtle)] hover:bg-[var(--surface-sunken)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-[var(--ink-subtle)]" />
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterChip>
            <FilterChip
              active={filter === "withWebsite"}
              onClick={() => setFilter("withWebsite")}
            >
              Website
            </FilterChip>
            <FilterChip
              active={filter === "withEmail"}
              onClick={() => setFilter("withEmail")}
            >
              Email
            </FilterChip>
            <FilterChip
              active={filter === "withPhone"}
              onClick={() => setFilter("withPhone")}
            >
              Phone
            </FilterChip>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={
            leads.length === 0
              ? campaign
                ? "No leads in this campaign yet."
                : "No leads yet."
              : "No leads match your filters."
          }
          description={
            leads.length === 0
              ? "Generate your first batch of leads to populate this view."
              : "Try clearing the search or switching filters."
          }
          action={
            leads.length === 0 ? (
              <Link
                href="/user/generate"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
              >
                <Sparkles className="h-4 w-4" />
                Generate leads
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-4 py-2 text-sm font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
              >
                Reset filters
              </button>
            )
          }
        />
      ) : (
        <div className="surface-card overflow-hidden p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-10" />
                <col className="w-[28%] min-w-[200px]" />
                <col className="hidden md:table-column w-[16%]" />
                <col className="w-[20%] min-w-[140px]" />
                <col className="hidden lg:table-column w-[24%]" />
                <col className="hidden md:table-column w-[110px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-sunken)]">
                  <th className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--brand-600)]"
                    />
                  </th>
                  <SortHeader
                    label="Name"
                    sortKey="name"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={() => toggleSort("name")}
                  />
                  <th className="hidden md:table-cell px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
                    Category
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
                    Contact
                  </th>
                  <th className="hidden lg:table-cell px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
                    Website
                  </th>
                  <SortHeader
                    label="Added"
                    sortKey="created_at"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={() => toggleSort("created_at")}
                    align="right"
                    className="hidden md:table-cell"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {pageLeads.map((lead) => {
                  const phones = Array.from(
                    new Set(lead.lead_contacts.map((c) => c.phone).filter(Boolean))
                  ) as string[];
                  const emails = Array.from(
                    new Set(lead.lead_contacts.map((c) => c.email).filter(Boolean))
                  ) as string[];
                  const isSelected = selected.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setOpenLead(lead)}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-[var(--brand-50)]/60" : "hover:bg-[var(--surface-sunken)]/50"}`}
                    >
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(lead.id)}
                          className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--brand-600)]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="truncate font-medium text-[var(--ink-strong)]">
                          {lead.name}
                        </div>
                        {lead.address ? (
                          <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--ink-subtle)]">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{lead.address}</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 truncate text-xs text-[var(--ink-muted)]">
                        {lead.category ?? "—"}
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {phones.length > 0 ? (
                            <span
                              title={phones.join(", ")}
                              className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-50)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--brand-700)]"
                            >
                              <Phone className="h-3 w-3" />
                              {phones.length}
                            </span>
                          ) : null}
                          {emails.length > 0 ? (
                            <span
                              title={emails.join(", ")}
                              className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-50)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--accent-700)]"
                            >
                              <Mail className="h-3 w-3" />
                              {emails.length}
                            </span>
                          ) : lead.website_url ? (
                            // No email recorded for this lead, BUT we have a
                            // website to crawl. Show a per-row 'Find email'
                            // button that hits the same enrichment pipeline a
                            // bulk re-enrich would. Cheaper and more targeted
                            // than re-enriching the whole campaign.
                            <FindEmailButton
                              leadId={lead.id}
                              onFound={(emails, phones) => {
                                // Optimistic local-state update so the row
                                // immediately shows the new email pill and
                                // the Find email button disappears. Without
                                // this, router.refresh() doesn't help because
                                // the leads array lives in client state and
                                // is fetched via /api/leads — server-side
                                // refresh doesn't re-pull it.
                                setLeads((prev) =>
                                  prev.map((l) =>
                                    l.id === lead.id
                                      ? {
                                          ...l,
                                          lead_contacts: [
                                            ...l.lead_contacts,
                                            ...emails.map((e) => ({
                                              email: e,
                                              phone: null,
                                              source_url: null,
                                            })),
                                            ...phones.map((p) => ({
                                              phone: p,
                                              email: null,
                                              source_url: null,
                                            })),
                                          ],
                                        }
                                      : l
                                  )
                                );
                              }}
                            />
                          ) : null}
                          {lead.website_url ? (
                            <span
                              title={lead.website_url}
                              className="inline-flex items-center gap-1 rounded-md bg-[var(--success-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--success-700)] lg:hidden"
                            >
                              <Globe className="h-3 w-3" />
                            </span>
                          ) : null}
                          {phones.length === 0 && emails.length === 0 && !lead.website_url ? (
                            <span className="text-xs text-[var(--ink-subtle)]">—</span>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className="hidden lg:table-cell px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.website_url ? (
                          <a
                            href={lead.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-[var(--brand-700)] hover:underline"
                          >
                            <Globe className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {lead.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                            </span>
                          </a>
                        ) : (
                          <span className="text-xs text-[var(--ink-subtle)]">—</span>
                        )}
                      </td>
                      <td className="hidden md:table-cell whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-[var(--ink-subtle)]">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer — always shown so the user can see how many
              leads they have in total and how many are on this page, even
              when there's only one page of results. Avoids the previous
              footprint where the count gap (250 stored vs 80 visible) was
              invisible because the footer hid itself when totalPages === 1. */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface-sunken)]/50 px-4 py-3 text-xs text-[var(--ink-muted)]">
            <span className="tabular-nums">
              Showing{" "}
              <span className="font-semibold text-[var(--ink-strong)]">
                {pageLeads.length === 0
                  ? 0
                  : `${(page - 1) * PAGE_SIZE + 1}–${
                      (page - 1) * PAGE_SIZE + pageLeads.length
                    }`}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[var(--ink-strong)]">
                {filtered.length.toLocaleString()}
              </span>{" "}
              {filter !== "all" || search ? "matching " : ""}
              lead{filtered.length === 1 ? "" : "s"}
              {filtered.length !== leads.length ? (
                <span className="text-[var(--ink-subtle)]">
                  {" "}
                  · {leads.length.toLocaleString()} total
                </span>
              ) : null}
            </span>
            {totalPages > 1 ? (
              <div className="flex items-center gap-1">
                <span className="mr-2 tabular-nums text-[var(--ink-subtle)]">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-1 font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)] disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-1 font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <Drawer
        open={Boolean(openLead)}
        onClose={() => setOpenLead(null)}
        title={openLead?.name}
        description={openLead?.category ?? undefined}
        width="lg"
      >
        {openLead ? <LeadDetail lead={openLead} /> : null}
      </Drawer>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-[var(--brand-200)] bg-[var(--brand-50)] text-[var(--brand-700)]"
          : "border-[var(--border)] bg-[var(--surface-elev)] text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
      }`}
    >
      {children}
    </button>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  align,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onClick: () => void;
  align?: "right";
  className?: string;
}) {
  const active = sortKey === activeKey;
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)] ${align === "right" ? "text-right" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 transition hover:text-[var(--ink-strong)] ${align === "right" ? "flex-row-reverse" : ""} ${active ? "text-[var(--ink-strong)]" : ""}`}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </th>
  );
}

function LeadDetail({ lead }: { lead: Lead }) {
  const phones = Array.from(
    new Set(lead.lead_contacts.map((c) => c.phone).filter(Boolean))
  ) as string[];
  const emails = Array.from(
    new Set(lead.lead_contacts.map((c) => c.email).filter(Boolean))
  ) as string[];
  return (
    <div className="space-y-6">
      {lead.category ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--ink-muted)]">
            {lead.category}
          </span>
        </div>
      ) : null}

      {lead.address ? (
        <DetailRow icon={<MapPin className="h-4 w-4" />} label="Address">
          {lead.address}
        </DetailRow>
      ) : null}

      {lead.website_url ? (
        <DetailRow icon={<Globe className="h-4 w-4" />} label="Website">
          <a
            href={lead.website_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 break-all text-[var(--brand-700)] hover:underline"
          >
            {lead.website_url}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </DetailRow>
      ) : null}

      {phones.length > 0 ? (
        <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone numbers">
          <div className="flex flex-wrap gap-1.5">
            {phones.map((p) => (
              <a
                key={p}
                href={`tel:${p}`}
                className="rounded-md border border-[var(--brand-100)] bg-[var(--brand-50)] px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
              >
                {p}
              </a>
            ))}
          </div>
        </DetailRow>
      ) : null}

      {emails.length > 0 ? (
        <DetailRow icon={<Mail className="h-4 w-4" />} label="Email addresses">
          <div className="flex flex-wrap gap-1.5">
            {emails.map((e) => (
              <a
                key={e}
                href={`mailto:${e}`}
                className="rounded-md border border-[var(--accent-100)] bg-[var(--accent-50)] px-2.5 py-1 text-xs font-medium text-[var(--accent-700)] transition hover:bg-[var(--accent-100)]"
              >
                {e}
              </a>
            ))}
          </div>
        </DetailRow>
      ) : null}

      {lead.maps_url ? (
        <a
          href={lead.maps_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-3.5 py-2 text-xs font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--surface-sunken)]"
        >
          <MapPin className="h-3.5 w-3.5" />
          Open on Maps
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-sm text-[var(--ink-strong)] break-words">
        {children}
      </div>
    </div>
  );
}

// "Re-enrich emails" — re-runs the email-harvest pipeline against every lead
// in this campaign that doesn't already have an email. Useful when the
// original scrape was enriched under an older / slower code version and
// coverage came out low. NO credits charged — the lead was already paid for
// at scrape time.
function ReenrichButton({
  campaignId,
  total,
  withEmail,
}: {
  campaignId: string;
  total: number;
  withEmail: number;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const missing = Math.max(0, total - withEmail);

  async function reenrich() {
    if (missing === 0) {
      toast.success("Every lead already has an email", "Nothing to re-harvest");
      return;
    }
    if (
      !confirm(
        `Re-run the email harvester on ${missing.toLocaleString()} lead${
          missing === 1 ? "" : "s"
        } that don't have an email yet? No credits will be charged. The harvester runs in the background — refresh the page in 2-3 minutes to see new emails fill in.`
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(
      `/api/scan/runs/${campaignId}/reenrich`,
      { method: "POST" }
    );
    setBusy(false);
    if (res.ok) {
      toast.success(
        "Re-enrichment started",
        `Crawling ${missing} websites — refresh in 2-3 min`
      );
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error("Couldn't start re-enrichment", j.error);
    }
  }

  return (
    <button
      type="button"
      onClick={reenrich}
      disabled={busy || missing === 0}
      title={
        missing === 0
          ? "Every lead already has an email"
          : `Re-harvest ${missing} leads that don't have an email yet`
      }
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--ink-strong)] transition hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)] hover:text-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Wand2 className="h-3.5 w-3.5" />
      )}
      Re-enrich emails
    </button>
  );
}


// Per-row 'Find email' button — shown on lead rows that don't have an email
// yet but DO have a website. Hits /api/leads/[id]/reenrich which re-runs the
// same enrichment pipeline against just that one lead's website. Cheaper and
// faster than re-enriching the whole campaign for users who only care about
// a few specific leads. No credit charge to the user (the lead was already
// paid for) and no third-party API cost — enrichment is a pure website crawl.
function FindEmailButton({
  leadId,
  onFound,
}: {
  leadId: string;
  // Fires when the API returns new emails / phones. The parent uses this
  // to optimistically update its local leads state so the row's pill
  // changes from this button → an email count badge without waiting for a
  // refetch.
  onFound?: (emails: string[], phones: string[]) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function findEmail() {
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/reenrich`, {
      method: 'POST',
    });
    setBusy(false);
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      found?: boolean;
      newEmails?: string[];
      newPhones?: string[];
      error?: string;
      message?: string;
    };
    if (!res.ok || !json.ok) {
      toast.error('Find email failed', json.error);
      return;
    }
    const newEmails = json.newEmails ?? [];
    const newPhones = json.newPhones ?? [];
    if (json.found && newEmails.length > 0) {
      toast.success(`Found ${newEmails[0]}`, 'Saved to this lead');
      onFound?.(newEmails, newPhones);
    } else if (json.found && newPhones.length > 0) {
      toast.success('Found new phone', 'Saved to this lead');
      onFound?.([], newPhones);
    } else {
      toast.error(
        'No email found',
        json.message ?? 'Site may be form-only or have no public email.'
      );
    }
  }

  return (
    <button
      type="button"
      onClick={findEmail}
      disabled={busy}
      title="Re-crawl this site for an email"
      className="inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--brand-200)] bg-[var(--brand-50)]/40 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-700)] transition hover:border-solid hover:bg-[var(--brand-50)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Wand2 className="h-3 w-3" />
      )}
      Find email
    </button>
  );
}
