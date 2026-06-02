# Lead Machine — Project Memory

This file orients Claude (or any new contributor) to the current state of this
codebase. Read this before making changes.

---

## What this product is

**Lead Machine** is a self-serve B2B lead-generation SaaS. The user enters a
niche + city + target count; the system returns a CRM-ready list of businesses
with phones, emails, websites, addresses — deduped and exportable to CSV / Excel.

Originally named "Nichely"; rebranded in May 2026. All user-facing strings now
say **Lead Machine**. The logo is at `public/logo-mark.svg` (funnel + 3 dots,
indigo → sky-blue gradient).

## Current status (as of latest commit `63c0ad9`)

**What works:**
- Marketing site, auth, billing, dashboard, leads CRM, admin console — all live
- Local dev (`npm run dev`) runs the full pipeline end-to-end with embedded
  Puppeteer
- Frontend deploys cleanly to **Vercel** (`lead-machine-m9i9.vercel.app`)
- Worker deploys cleanly to **Railway** (`lead-machine-production-256b.up.railway.app`)
- All migrations are runnable in Supabase SQL editor

**Place lookup is now Google Places API (New).** Puppeteer is fully removed
from both the worker and the root frontend (`src/lib`). The migration was
forced by Google blocking cloud-server IPs from Maps — Puppeteer-on-Railway
was getting consent walls instead of search results. Places API works from
any IP, returns structured data, and is generally free at this scale (Google
gives a generous monthly quota per project).

Email harvesting (`enrichFromWebsite`) and keyword clustering still work the
same way — Places API doesn't return emails, and it hard-caps at 60 results
per query so clustering remains essential for high-count campaigns.

## Architecture

```
Browser ↔ Vercel (Next.js)          ↔ Supabase (auth + DB + RLS)
                ↕  SSE + Bearer
            Railway (Express worker, Puppeteer)
                ↕  parallel HTTP
            Target websites (email harvest)
```

- **Vercel (frontend)** — Next.js 15 App Router. Marketing site, auth UI, user
  dashboard, admin console. The `/api/google-maps-search` route is a thin SSE
  proxy to the Railway worker (when `WORKER_URL` env is set).
- **Railway (worker)** — Express server in `/worker`. Owns Puppeteer +
  email-harvest crawl. Writes leads + contacts directly to Supabase via the
  service-role key. Streams SSE progress back to the frontend.
- **Supabase** — Postgres + Auth + RLS. Service-role key is held only by the
  Railway worker and Stripe webhook handler.

**Dev mode fallback:** if `WORKER_URL` is unset (no `.env.local` entry), the
frontend's `/api/google-maps-search` runs the scrape **in-process** using the
copies of the scraper code at `src/lib/google-maps-scraper.ts`,
`src/lib/lead-enrichment.ts`, `src/lib/keyword-cluster.ts`. This is why
`npm run dev` works without a worker running.

## Tech stack

- **Next.js 15** (App Router) + React 19
- **Tailwind v4** + custom CSS variables in `src/app/globals.css`
  (design tokens: `--brand-*` indigo, `--sky-*` companion, `--accent-*` amber,
  semantic `--surface-*`, `--ink-*`, `--success/danger/warning-*`, shadows,
  radii, motion easings)
- **Framer Motion** for transitions, staggered entrances, layout animations
- **Lucide React** for icons
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) for auth + DB
- **Google Places API (New)** — Text Search for place lookup. Replaced Puppeteer
  after Google started blocking cloud-server IPs from Maps.
- **Stripe** for billing — `mode: payment` (one-time lifetime credit packs,
  NOT subscriptions)
- **Resend** (optional) for transactional email; mailer falls back to
  `console.log` when `RESEND_API_KEY` is absent
- **xlsx** (SheetJS) for Excel exports
- **TypeScript** strict mode; project compiles clean with `tsc --noEmit`

## Project structure

```
/  (root — deploys to Vercel)
├── src/
│   ├── app/
│   │   ├── page.tsx                  marketing home
│   │   ├── how-it-works/page.tsx     marketing
│   │   ├── pricing/page.tsx          marketing
│   │   ├── faq/page.tsx              marketing
│   │   ├── login/                    auth (with User/Admin tab toggle)
│   │   ├── signup/
│   │   ├── user/                     user dashboard (AppShell)
│   │   │   ├── page.tsx              KPIs + lead growth sparkline + quality
│   │   │   ├── generate/             AI-style streaming generate flow
│   │   │   ├── leads/                CRM table + drawer + filters + export
│   │   │   ├── campaigns/            scan_runs history
│   │   │   ├── billing/              lifetime credit packs (Stripe checkout)
│   │   │   ├── settings/             profile + plan
│   │   │   └── layout.tsx            wraps in AppShell, gates suspended users
│   │   ├── admin/                    admin console (AdminShell — distinct UI)
│   │   │   ├── page.tsx              overview KPIs + chart + quick links
│   │   │   ├── users/                AdminUsersTable: +/- credits, suspend, delete
│   │   │   ├── campaigns/            all campaigns + lead coverage
│   │   │   ├── activity/             enterprise queue
│   │   │   └── layout.tsx
│   │   └── api/
│   │       ├── google-maps-search/   SSE — proxies to worker if WORKER_URL set
│   │       ├── leads/                user lead list + per-runId filter
│   │       ├── scan/runs/            campaign list
│   │       ├── billing/checkout/     Stripe checkout (payment mode, lifetime)
│   │       ├── billing/webhook/      Stripe webhook → grants credits + sends email
│   │       ├── admin/credits/        legacy single-user credit grant
│   │       ├── admin/users/          admin actions (credits +/-, suspend, delete)
│   │       ├── enterprise/           enterprise interest form
│   │       └── profile/plan/         legacy plan switcher (not used post-Stripe)
│   ├── components/
│   │   ├── AppShell.tsx              user sidebar + topbar + avatar dropdown
│   │   ├── AdminShell.tsx            admin sidebar + topbar (own theme)
│   │   ├── SiteHeader.tsx            marketing header
│   │   ├── PricingSection.tsx        lifetime tiers (Starter/Premium/Pro/Enterprise)
│   │   ├── ui/                       design-system primitives
│   │   │   Button, Card, Input, Badge, Skeleton, EmptyState, Drawer,
│   │   │   Counter (animated number), ProgressBar (eased), BrandMark
│   │   ├── home/                     HomeHero, HomeFeatures, HomeHowItWorks,
│   │   │                              HomePreview, HomeTestimonials, HomeFaq,
│   │   │                              HomeFooter, PageHero
│   │   ├── dashboard/                DashboardKpis, Sparkline, QualityBars
│   │   ├── generate/GenerateForm.tsx SSE consumer + animated step ladder
│   │   ├── leads/LeadsCrm.tsx        table-fixed CRM with sort, filter, drawer,
│   │   │                              CSV + Excel export, campaign-scoped view
│   │   ├── campaigns/CampaignsTable.tsx
│   │   ├── admin/AdminUsersTable.tsx per-row actions with confirmation modals
│   │   └── billing/BillingPanel.tsx
│   └── lib/
│       ├── supabase/                 server + client + middleware session
│       ├── avatar.ts                 initialsFor() — app uses initials only
│       ├── stripe.ts                 client + price-id map + credit grants
│       ├── mailer.ts                 Resend-or-console mailer + plan-activated tmpl
│       ├── places-api.ts             Google Places API (New) Text Search client
│       │                              (dev-mode mirror of worker/src/places-api.ts)
│       ├── google-maps-scraper.ts    thin wrapper over places-api.ts that emits
│       │                              the legacy ProgressEvent shape so the API
│       │                              route doesn't have to change (file name
│       │                              kept for import compatibility)
│       ├── lead-enrichment.ts        website email/phone crawler (10 contact URLs,
│       │                              mailto/tel hrefs, unobfuscation,
│       │                              decoy filter)
│       ├── keyword-cluster.ts        Mistral API + curated 20-niche static map
│       │                              + generic prefix fallback
│       ├── google-leads.ts           OLDER Places-API helper used by
│       │                              /api/leads/discover (server-only bearer)
│       └── osm.ts, google-maps.ts    legacy, unused in current product flow
├── worker/                            deploys to Railway (Dockerfile root dir = /worker)
│   ├── src/
│   │   ├── server.ts                 Express + SSE /scrape, Bearer auth, heartbeat
│   │   ├── scrape-job.ts             orchestrator: scrape → cluster-expand →
│   │   │                              insert leads → harvest emails → mark complete
│   │   ├── places-api.ts             Google Places API (New) Text Search client
│   │   ├── scraper.ts                thin wrapper over places-api.ts emitting
│   │   │                              the legacy ProgressEvent shape
│   │   ├── enrichment.ts             same logic as src/lib/lead-enrichment.ts
│   │   ├── keywords.ts               same as src/lib/keyword-cluster.ts
│   │   └── db.ts                     Supabase service-role client
│   ├── Dockerfile                    node:20-slim (no Chromium — Places API is HTTP)
│   ├── railway.json                  buildCommand + healthcheck /health
│   └── package.json                  separate deps (just express + supabase-js)
├── supabase/                         SQL migrations (run in Supabase SQL Editor)
│   ├── schema.sql                    base tables + RLS + triggers (run FIRST)
│   ├── add_scan_lead_tables.sql      scan_runs, leads, lead_contacts (idempotent)
│   ├── admin_user_actions.sql        adds `suspended` column + admin delete policy
│   ├── credit_reservation.sql        reserve_search_credits / refund_search_credits
│   ├── fix_rls_recursion.sql         older patch, may not be needed on fresh installs
│   ├── promote_admin.sql             one-time: edit email + run to grant admin
│   └── backfill_profiles.sql         one-time for users created before trigger
├── middleware.ts                     Supabase session refresh on every request
├── .vercelignore                     excludes /worker, /supabase (root only)
└── .env.example                      template for env vars
```

## Routes

**Public:**
- `/` — marketing home with hero, features, how-it-works, preview, testimonials, pricing, FAQ, footer CTA
- `/how-it-works`, `/pricing`, `/faq` — standalone marketing pages
- `/login` — has User / Admin segmented toggle; validates role on submit
- `/signup` — two-column sales pitch on left, form on right

**User app** (`AppShell` — left sidebar with Dashboard / Generate / Leads /
Campaigns / Billing / Settings / Admin (if admin)):
- `/user` — dashboard
- `/user/generate` — niche + location + count + SSE animated progress
- `/user/leads` — CRM table; supports `?campaign={runId}` for campaign-scoped view
- `/user/campaigns` — scan_runs history with "View leads" deep links
- `/user/billing` — credit packs (Stripe checkout)
- `/user/settings` — profile + plan info

**Admin console** (`AdminShell` — distinct visual theme, own sidebar):
- `/admin` — overview KPIs + lead growth chart + quick links
- `/admin/users` — user management with inline +credits, -credits, suspend, delete
- `/admin/campaigns` — all campaigns + lead coverage
- `/admin/activity` — enterprise queue

## Data model (Supabase)

Run order in SQL editor:
1. `supabase/schema.sql`
2. `supabase/add_scan_lead_tables.sql`
3. `supabase/admin_user_actions.sql`
4. `supabase/credit_reservation.sql`

**Tables:**
- `profiles` (id FK auth.users, email, full_name, role, plan, credits, suspended, created_at, updated_at)
- `enterprise_requests` (id, user_id, email, note, status, created_at)
- `scan_runs` (id, user_id, source, keyword, location, status, limit_count, result_count, started_at, finished_at, error)
- `leads` (id, user_id, scan_run_id, source, name, category, address, rating, review_count, maps_url, website_url, dedupe_key, created_at)
- `lead_contacts` (id, lead_id, phone, email, website_url, source_url, created_at)

**Functions:**
- `is_admin()` — used in RLS policies (SECURITY DEFINER, avoids RLS recursion)
- `handle_new_user()` — trigger on auth.users INSERT → creates profile
- `lock_sensitive_profile_cols()` — trigger preventing users from changing their own role/credits/email
- `consume_search_credit()` — legacy single-credit decrement (still works, no longer used)
- `reserve_search_credits(amount)` — deducts N credits up front
- `refund_search_credits(amount)` — refunds unused credits

**RLS:** users can read/insert/update their own rows; admins can read/update/delete all.
Cascade chain: auth.users → profiles → scan_runs → leads → lead_contacts.

## Auth flow

1. Login form has User/Admin segmented toggle (`src/app/login/login-form.tsx`)
2. On submit: `signInWithPassword` → fetch `profiles.role` → route accordingly
   - User tab: routes to `/user`
   - Admin tab: validates `role === "admin"`; if not, signs out + shows error
3. Suspended users (`profiles.suspended === true`) get redirected to a
   "Account suspended" screen by `src/app/user/layout.tsx` before they reach
   any user-facing page

## Billing model — lifetime credit packs (NOT subscriptions)

- 3 paid tiers: Starter ($49 / 250 credits), Premium ($149 / 1000), Pro ($399 / 5000)
- 4th tier Enterprise → talk-to-sales modal, no checkout
- All plans are **one-time payment** (`mode: "payment"` in Stripe checkout)
- Webhook (`/api/billing/webhook`) only handles `checkout.session.completed`
- On completion: bump `profiles.plan`, add credits to balance, send confirmation email
- **1 lead = 1 credit**. Credits are reserved up front via
  `reserve_search_credits(amount)` and the unused portion is refunded after the
  scrape (`refund_search_credits(limit - delivered)`).
- Enterprise plan = unmetered (no credit deduction)

## Lead generation pipeline

### Worker mode (production — `WORKER_URL` set)

1. **Frontend `/api/google-maps-search`:**
   - Auth check
   - `reserve_search_credits(limit)` — 1 credit per requested lead
   - Insert `scan_runs` row with status='running'
   - POST to Railway worker `/scrape` with Bearer token + body
     `{ scanRunId, userId, keyword, location, target }`
   - Stream worker's SSE response back to browser
   - When worker stream ends: read `scan_runs.result_count` from DB,
     call `refund_search_credits(limit - delivered)`

2. **Worker `/scrape`:**
   - Validates `WORKER_TOKEN` Bearer match
   - Sends `phase: launching → searching → discovering → extracting → enriching` events
   - Calls Google Places API Text Search (`places-api.ts`)
   - If `results.length < target`: calls `expandKeyword()` to get related niches,
     queries Places API for each, dedupes by title+placeUrl
   - Inserts leads into Supabase (service-role client)
   - Sends `phase: harvesting` events while crawling each lead's website for
     emails/phones (parallel batches of 5)
   - Inserts lead_contacts
   - Updates `scan_runs.status = "completed"`, `result_count = N`
   - Sends final `phase: saved` event with `runId` and `total`

### Dev mode (no `WORKER_URL`)

Same logic, runs in-process in the Next.js route. Uses parallel copies of the
client code in `src/lib/` (`places-api.ts`, `lead-enrichment.ts`,
`keyword-cluster.ts`). Used when running `npm run dev` locally — needs
`GOOGLE_MAPS_API_KEY` in `.env.local`.

### Follow-up worth considering

With Places API being so fast (sub-second per call), the dedicated Railway
worker is mostly unnecessary — the whole pipeline could fit inside a Vercel
function comfortably. The `WORKER_URL`/`WORKER_TOKEN` plumbing is still in
place so deployments can choose; revisit if you want to decommission Railway
and simplify the stack to just Vercel + Supabase.

## Local development

```bash
git clone <repo>
cd lead-machine
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
# → http://localhost:3001
```

Puppeteer runs **headed** locally by default (NODE_ENV !== "production"), which
is what makes local scraping work — Google doesn't flag residential IPs.

Run migrations in Supabase SQL editor in the order listed under "Data model".
Promote yourself to admin: edit `supabase/promote_admin.sql` with your email
and run it.

## Production deployment

### Vercel (frontend)
- Repo: `devtrest/lead-machine`
- Root directory: `/` (default)
- `.vercelignore` excludes `/worker` and `/supabase`
- Env vars required:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_APP_URL` (the Vercel domain — `https://lead-machine-m9i9.vercel.app`)
  - `WORKER_URL` (the Railway worker domain)
  - `WORKER_TOKEN` (shared secret — must match Railway)
- Optional: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER/PREMIUM/PRO`, `SUPABASE_SERVICE_ROLE_KEY` (Stripe webhook), `RESEND_API_KEY`

**Limit:** Hobby tier function duration = 30 s. The proxy-mode `/api/google-maps-search`
route can hit this for large scrapes (the route holds open the SSE stream).
Workaround paths: (a) Pro plan ($20/mo, 300 s), (b) direct browser-to-worker
SSE pattern with signed token, or (c) switch place lookup to Places API which
is fast enough that 30 s is plenty.

### Railway (worker)
- Same repo
- Root directory: `/worker` (REQUIRED — must be set in Settings → Source)
- Dockerfile is auto-detected
- Env vars required:
  - `WORKER_TOKEN` (must match Vercel)
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (the long JWT from Supabase → Settings → API)
  - `GOOGLE_MAPS_API_KEY` (Places API New, with Places API New enabled in
    Google Cloud Console for the project)
- Optional: `MISTRAL_API_KEY` (AI keyword expansion)

### Supabase auth URL config
- **Site URL**: the Vercel domain
- **Redirect URLs**: add `https://your-vercel-domain.vercel.app/**`

## Coding conventions

- TypeScript strict mode throughout. Both packages compile clean.
- Tailwind utility-first. Custom semantic tokens via CSS variables (see
  `src/app/globals.css`). Avoid hardcoded hex colors in components.
- Light theme only — there's no dark mode, despite the `slate-*` class names.
  Legacy `.app-console` color-remap is gone.
- Framer Motion for all transitions/animations. Standard easing:
  `[0.22, 1, 0.36, 1]`.
- All client components explicitly `"use client"` (App Router requirement).
- Date handling: ISO strings in DB; format client-side with `toLocaleString()`.
- Server-side Supabase: `createClient` from `@/lib/supabase/server` (handles
  cookies + RLS via user JWT).
- Service-role Supabase: only in worker and Stripe webhook. Never expose to client.
- Don't add `<Image>` for the brand mark — it's already inlined with
  `<img>` + `eslint-disable-next-line` because it's a tiny SVG.

## Things NOT to do

- Don't rename anything to "Nichely" — that was the old brand.
- Don't add the service-role key to the Vercel frontend env vars
  (it would expose to client unless prefixed away from `NEXT_PUBLIC_`).
- Don't run `mode: "subscription"` Stripe checkouts — the product is one-time
  lifetime plans only.
- Don't auto-deploy migrations. All SQL changes go through Supabase SQL editor.
- Don't commit `worker/node_modules/` — root `.gitignore` now matches
  `node_modules/` at any depth. If you ever see a giant commit creeping in,
  amend it before pushing.
- Don't use the Hobby-tier Vercel as the choke point for long-running scrapes.
  The 30 s timeout is real. Architectural fix: direct browser↔worker SSE.
- Don't trust localhost results as proof of production behavior. Google blocks
  cloud IPs aggressively — what works on your residential IP fails on Railway
  and vice versa.

## Decisions log

- **May 2026 — rebrand Nichely → Lead Machine.** Logo: funnel + 3 dots, indigo→sky.
  All "Google Maps" mentions removed from user-facing UI (kept in code comments
  and internal API route names since renaming routes would break the frontend
  fetch).
- **May 2026 — gradient palette: pure blue.** `--brand-*` (indigo) + `--sky-*`
  (cyan-blue). Amber stays as a standalone accent (rating chips, email pills).
- **May 2026 — testimonials use real portrait photos.** `randomuser.me` CDN.
  In-app avatars use initials, not generated images.
- **May 2026 — admin gets its own shell.** `AdminShell` with separate sidebar,
  different background gradient, "Switch to user app" button. Admin pages
  split into Overview / Users / Campaigns / Activity sub-routes.
- **May 2026 — billing model switched from monthly to lifetime credit packs.**
  Stripe checkout uses `mode: "payment"`. Webhook only listens to
  `checkout.session.completed`. Credit grant amounts: Starter 250 / Premium 1000 /
  Pro 5000. Per-lead credit accounting via `reserve_search_credits` +
  `refund_search_credits` RPCs.
- **May 2026 — worker split.** Puppeteer moved into `/worker` Express service
  deployed to Railway. Frontend `/api/google-maps-search` becomes a Bearer-token
  SSE proxy when `WORKER_URL` is set. Dev mode keeps embedded scraper.
- **May 2026 — stealth plugin added** (`puppeteer-extra-plugin-stealth`) after
  Google started blocking Railway IPs. Helped with fingerprint detection but
  not IP-level blocking. Removed in the same month after the Places API
  migration made Puppeteer unnecessary.
- **May 2026 — place lookup migrated to Google Places API (New).** Driven by
  Google's persistent IP block on cloud Puppeteer scrapers. The
  `scrapeGoogleMaps`/`MapsPlace`/`ProgressEvent` interface was preserved so
  `scrape-job.ts`, the API route, and the UI did not need to change. Email
  harvesting (own crawl) and keyword clustering both stay.
- **May 2026 — Puppeteer fully removed.** From both the worker and the root
  frontend's `src/lib`. The worker Dockerfile switched from
  `ghcr.io/puppeteer/puppeteer` to plain `node:20-slim`; image size dropped
  ~10x and cold starts got faster. The legacy `google-maps-scraper.ts` file
  name was kept so the API route's import didn't have to change.

## Open work / followups

1. Consider decommissioning the Railway worker — Places API is fast enough
   that the whole flow fits inside a Vercel function comfortably, and the
   `/api/google-maps-search` proxy already runs the pipeline embedded when
   `WORKER_URL` is unset.
2. Real-time credit decrement animation in the topbar while scrape runs
   (currently it just refreshes on next page load).
3. Wait-for-CI gate, automated migrations on deploy, and a staging environment
   are unbuilt — production pushes go straight to `main`.
4. Restrict the production `GOOGLE_MAPS_API_KEY` to a single API in Google
   Cloud Console (Places API New only) — currently allowed for any API on
   the project.

---

If you're picking this up cold: run `npm run dev`, sign in as the admin user
(`umar43310@gmail.com`), and walk Dashboard → Generate → Leads → Campaigns →
Billing → Admin. That's the full surface area of the product.
