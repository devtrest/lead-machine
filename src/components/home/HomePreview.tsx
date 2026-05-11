"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function HomePreview() {
  return (
    <section className="relative overflow-hidden py-20">
      <div
        className="absolute -right-40 top-20 h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-[var(--brand-100)] to-[var(--sky-100)] opacity-60 blur-[100px]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-5 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
              Built for outbound teams
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
              The CRM you wish your spreadsheet was.
            </h2>
            <p className="mt-3 text-sm text-[var(--ink-muted)] md:text-base">
              Filter by what matters — rating, contact data, niche cluster.
              Multi-select rows, export to CSV, deep-link by campaign. We
              built Lead Machine for the team that has to hit the number this
              quarter.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-[var(--ink-strong)]">
              {[
                "Sticky, sortable columns with real CRM ergonomics",
                "Per-lead drawer with tappable phones and emails",
                "Bulk export and per-campaign deep links",
                "Search across name, address, category, and website",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand-600)]" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elev)] shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
              <div className="border-b border-[var(--border)] px-5 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--ink-strong)]">
                    Leads
                  </h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
                    138 filtered
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    ["All", false],
                    ["Has website", true],
                    ["Has email", false],
                    ["Rating ≥ 4", false],
                  ].map(([label, active]) => (
                    <span
                      key={String(label)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        active
                          ? "bg-[var(--brand-600)] text-white"
                          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)]"
                      }`}
                    >
                      {label as string}
                    </span>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {tableRows.map((row, i) => (
                  <motion.div
                    key={row.name}
                    initial={{ opacity: 0, y: 4 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04 }}
                    className="grid grid-cols-[1.5fr_0.8fr_0.6fr] items-center gap-3 px-5 py-3 text-xs hover:bg-[var(--brand-50)]/30"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--ink-strong)]">
                        {row.name}
                      </div>
                      <div className="truncate text-[11px] text-[var(--ink-subtle)]">
                        {row.address}
                      </div>
                    </div>
                    <div className="text-[11px] text-[var(--ink-muted)]">
                      {row.category}
                    </div>
                    <div className="text-right font-semibold text-[var(--accent-700)]">
                      ★ {row.rating}
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-sunken)]/50 px-5 py-3 text-[11px] text-[var(--ink-muted)]">
                <span>Page 1 of 6</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-2.5 py-1 font-semibold text-[var(--brand-700)]">
                  <Sparkles className="h-3 w-3" /> Auto-deduped
                </span>
              </div>
            </div>

          </motion.div>
        </div>
      </div>
    </section>
  );
}

const tableRows = [
  {
    name: "Bright Smile Dental",
    address: "F-7 Markaz · Islamabad",
    category: "Dental clinic",
    rating: 4.7,
  },
  {
    name: "OraDent F8",
    address: "Hashim Plaza · Islamabad",
    category: "Dental clinic",
    rating: 4.4,
  },
  {
    name: "Z Dental Studio",
    address: "Mount View Plaza · Islamabad",
    category: "Dentist",
    rating: 4.6,
  },
  {
    name: "Smile Architects",
    address: "Blue Area · Islamabad",
    category: "Orthodontist",
    rating: 4.8,
  },
];
