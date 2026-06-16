"use client";

import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";

// Real portrait photos via randomuser.me's free CDN of consenting model photos.
// Indexed for stability — the same person stays with the same testimonial.
const testimonials = [
  {
    quote:
      "We replaced four tools with Lead Machine. Lead research that used to take a full day now takes 15 minutes — and the contact data is cleaner than what we were paying for.",
    name: "Maya Lindberg",
    role: "Head of Growth",
    company: "OutreachLab",
    photo: "https://randomuser.me/api/portraits/women/68.jpg",
    rating: 5,
  },
  {
    quote:
      "The AI niche expansion is the killer feature. I asked for 500 dental clinics in a city of 80, and it pulled in orthodontists, oral surgeons, and pediatric dentistry — perfectly relevant.",
    name: "Adrian Costa",
    role: "Founder",
    company: "DenseLeads",
    photo: "https://randomuser.me/api/portraits/men/32.jpg",
    rating: 5,
  },
  {
    quote:
      "Finally, a CRM-grade lead table that doesn't make me want to throw my laptop. Filters work the way I expect, exports are clean, and the drawer detail is genuinely useful.",
    name: "Priya Sharma",
    role: "Sales Operations",
    company: "Northwind Agency",
    photo: "https://randomuser.me/api/portraits/women/44.jpg",
    rating: 5,
  },
  {
    quote:
      "We hit our quarter early because of how fast we could get from idea (\"let's try yoga studios in Mexico City\") to a list of qualified leads ready for outbound.",
    name: "Jordan Reyes",
    role: "VP Sales",
    company: "Trailpoint",
    photo: "https://randomuser.me/api/portraits/men/45.jpg",
    rating: 5,
  },
  {
    quote:
      "The Excel export is the one thing every other tool gets wrong. Lead Machine puts everything in clean, well-named columns. I open it, sort, push to HubSpot, done.",
    name: "Lena Park",
    role: "RevOps Lead",
    company: "Fern & Co.",
    photo: "https://randomuser.me/api/portraits/women/22.jpg",
    rating: 5,
  },
  {
    quote:
      "Beautiful product. It's rare for a B2B tool to feel this calm and considered. My team actually enjoys opening it.",
    name: "Sam Otieno",
    role: "Agency Owner",
    company: "Studio North",
    photo: "https://randomuser.me/api/portraits/men/77.jpg",
    rating: 5,
  },
];

export function HomeTestimonials() {
  return (
    <section className="relative overflow-hidden bg-[var(--surface-elev)] py-20">
      <div
        className="absolute -left-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-[var(--brand-100)] opacity-50 blur-[120px]"
        aria-hidden
      />
      <div
        className="absolute -right-32 top-10 h-[20rem] w-[20rem] rounded-full bg-[var(--sky-100)] opacity-60 blur-[120px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-700)]">
            Loved by outbound teams
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-4xl">
            Built for the team chasing{" "}
            <span className="brand-text-gradient">this quarter&apos;s number</span>.
          </h2>
          <p className="mt-3 text-sm text-[var(--ink-muted)] md:text-base">
            Founders, growth leads, and agencies who&apos;d rather close deals than
            scrub spreadsheets.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                delay: (i % 3) * 0.07,
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xs)] transition hover:-translate-y-1 hover:shadow-md"
            >
              <Quote className="h-5 w-5 text-[var(--brand-200)]" />
              <div className="mt-2 flex items-center gap-0.5 text-[var(--accent-500)]">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-[var(--ink-strong)]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-[var(--border)] pt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.photo}
                  alt={t.name}
                  width={44}
                  height={44}
                  loading="lazy"
                  className="h-11 w-11 shrink-0 rounded-full bg-[var(--brand-50)] object-cover ring-2 ring-[var(--surface-elev)]"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--ink-strong)]">
                    {t.name}
                  </div>
                  <div className="truncate text-xs text-[var(--ink-muted)]">
                    {t.role} · {t.company}
                  </div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.4 }}
          className="mt-12 grid grid-cols-2 gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:grid-cols-4 md:p-8"
        >
          {[
            ["12,000+", "Active campaigns"],
            ["1.4M", "Leads generated"],
            ["62%", "Avg time saved"],
            ["4.9/5", "Customer rating"],
          ].map(([metric, label]) => (
            <div key={metric} className="text-center">
              <div className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)] md:text-3xl">
                <span className="brand-text-gradient">{metric}</span>
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-subtle)]">
                {label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
