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

## Current status (as of latest commit `cfcd491`)

**What works:**
- Marketing site, auth, billing (trial + credit packs), dashboard, leads CRM,
  admin console — all live
- Full **cold-email outreach suite**: multi-step sequence wizard, multi-provider
  senders (Gmail/Outlook/Titan/Zoho/Yahoo/custom SMTP+IMAP), round-robin sending,
  open tracking, and a **Unibox** that polls IMAP for replies
- Local dev (`npm run dev`) runs the full lead-gen pipeline end-to-end in-process
- Frontend deploys to **Vercel** (`lead-machine-m9i9.vercel.app`)
- Worker deploys to **Railway** (`lead-machine-production-256b.up.railway.app`)
- All migrations are runnable in Supabase SQL editor (run order below)

**Place lookup is Google Places API (New).** Puppeteer is fully removed from
both the worker and the root frontend (`src/lib`). The migration was forced by
Google blocking cloud-server IPs from Maps. Places API works from any IP,
returns structured data, and is generally free at this scale.

Email harvesting (`enrichFromWebsite`) and keyword clustering still work the
same way — Places API doesn't return emails, and it hard-caps at ~60 results
per query so clustering remains essential for high-count campaigns.

**Email harvesting is now a Python script** (`worker/find_emails.py`, stdlib
only). `enrichFromWebsite` in both `worker/src/enrichment.ts` and the dev
mirror `src/lib/lead-enrichment.ts` is a thin wrapper that spawns the script as
a subprocess (one call per lead) and parses its JSON. There is **no third-party
email API** — the old Apollo (`api.apollo.io`) Layer-2 fallback was removed
entirely. Every email we report came straight out of the HTML source of one of
the lead's own pages; no guessing, no per-lookup cost. Local dev (`npm run dev`)
therefore needs `python3` on PATH (override the binary with `PYTHON_BIN`); the
worker Docker image installs it.

**What changed since the last doc pass (commits `a32771b`..`cfcd491`):**
- **Outreach grew from a one-shot composer into a full sequencer.** A 4-step
  campaign **wizard** (`/user/outreach/new`) creates campaign + steps + prospects
  + sender assignments atomically via `POST /api/outreach/campaigns/create-full`.
- **Multi-provider senders.** Users connect their own mailboxes (Gmail, Outlook/
  M365, Titan, Zoho, Yahoo, or arbitrary custom SMTP/IMAP). Credentials are
  live-verified on add and stored in `outreach_senders`. The worker round-robins
  across a campaign's senders, respecting per-sender daily caps.
- **Unibox.** IMAP polling pulls replies into `outreach_replies`; the
  `/user/inbox` page is a Gmail-style triage UI (categories, star, archive,
  notes, search, inline threaded reply).
- **Open tracking** via a 1×1 pixel at `/api/track/open/[token]`.
- **Relay-through-Vercel send path.** Railway's egress IPs get blocked by
  Gmail/IMAP, so the worker POSTs send/poll work to Vercel routes
  (`/api/worker/send-mail`, `/api/outreach/inbox-check`) which run on cleaner IPs.
- **Trial billing.** Signup now grants **0 credits**; users start a **$1 / 7-day
  trial** (100 credits) that auto-converts to a chosen plan. A worker job charges
  off-session at trial end.
- **Dedicated admin login** at `/leadmachineadmin` (noindexed), separate from the
  user `/login`.
- **Background-jobs page** (`/user/jobs`) polls `scan_runs` for live scrape status.

## Architecture

```
Browser ↔ Vercel (Next.js)              ↔ Supabase (auth + DB + RLS)
            ↕ SSE+Bearer   ↑ relay (send-mail / inbox-check)
        Railway (Express worker)
            ├─ Places API (place lookup)   → target websites (email harvest)
            ├─ outreach-tick  (15 min)     → send next step via senders
            ├─ inbox-check    (10 min)     → IMAP poll for replies
            └─ trial-charge   (hourly)     → Stripe off-session conversion
```

- **Vercel (frontend)** — Next.js 15 App Router. Marketing site, auth UI, user
  dashboard, admin console. `/api/google-maps-search` is a thin SSE proxy to the
  Railway worker when `WORKER_URL` is set. Also hosts **relay routes** the worker
  calls back into (`/api/worker/send-mail`, `/api/outreach/inbox-check`) to send
  email and poll IMAP from Vercel's IPs instead of Railway's (which Gmail blocks).
- **Railway (worker)** — Express server in `/worker`. Runs the lead-gen scrape +
  email-harvest crawl, and three background loops: **outreach-tick** (sends the
  next due step, every 15 min), **inbox-check** (IMAP reply poll, every 10 min),
  and **trial-charge** (Stripe off-session conversion at trial end, hourly).
  Writes to Supabase via the service-role key.
- **Supabase** — Postgres + Auth + RLS. Service-role key is held only by the
  Railway worker and the Vercel server-side routes (Stripe webhook, relay,
  open-tracking). Never exposed to the client.

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
- **Stripe** for billing — `mode: payment` (one-time lifetime credit packs) +
  a **$1 / 7-day trial** that auto-converts off-session (PaymentIntent, saved
  card) to the chosen plan. NOT recurring subscriptions.
- **Nodemailer** (SMTP) + **imapflow** (IMAP) + **mailparser** (MIME) power the
  outreach send/reply stack across multiple providers.
- **Resend** (optional) for transactional + outreach email fallback; mailer
  falls back to `console.log` when no provider is configured.
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
│   │   │   ├── jobs/                 live background-job page (polls scan_runs)
│   │   │   ├── leads/                CRM table + drawer + filters + export
│   │   │   ├── outreach/             list + new (4-step wizard) + [id]: multi-
│   │   │   │                          step sequences on autopilot
│   │   │   ├── inbox/                Unibox — IMAP reply triage UI
│   │   │   ├── senders/              connect/manage sending mailboxes
│   │   │   ├── billing/              trial + lifetime credit packs (Stripe)
│   │   │   ├── settings/             profile + plan
│   │   │   └── layout.tsx            wraps in AppShell, gates suspended users
│   │   ├── leadmachineadmin/         dedicated admin sign-in (noindexed)
│   │   ├── admin/                    admin console (AdminShell — distinct UI)
│   │   │   ├── page.tsx              overview KPIs + chart + quick links
│   │   │   ├── users/                AdminUsersTable: +/- credits, suspend, delete
│   │   │   ├── campaigns/            all campaigns + lead coverage
│   │   │   ├── activity/             enterprise queue
│   │   │   └── layout.tsx
│   │   └── api/
│   │       ├── google-maps-search/   SSE — proxies to worker if WORKER_URL set
│   │       ├── search/               place-search helper
│   │       ├── leads/                lead list + per-runId filter; leads/discover
│   │       ├── scan/runs/            campaign list
│   │       ├── billing/checkout/     Stripe checkout (payment mode, lifetime)
│   │       ├── billing/trial/        starts $1/7-day trial (saves card on file)
│   │       ├── billing/webhook/      Stripe webhook → grants credits + sends email
│   │       ├── outreach/campaigns/   GET (list), POST (draft); create-full POST
│   │       │                          (wizard: campaign+steps+prospects+senders
│   │       │                          atomically); [id] PATCH/DELETE; [id]/steps
│   │       │                          PUT; [id]/start POST; [id]/send-now POST
│   │       │                          ("send all now", fast mode); [id]/prospects
│   │       ├── outreach/prospects/   [id] PATCH (mark replied/bounced) + DELETE
│   │       ├── outreach/senders/     GET/POST (add + live-verify SMTP/IMAP); [id]
│   │       │                          PATCH (pause/limit/rename) + DELETE
│   │       ├── outreach/inbox-check/ POST — IMAP poll from Vercel ("Check now")
│   │       ├── outreach/replies/     [id] PATCH (star/category/archive/notes);
│   │       │                          [id]/send POST (threaded inline reply)
│   │       ├── outreach/test-send/   send a test email to your own inbox
│   │       ├── track/open/[token]/   1×1 open-tracking pixel
│   │       ├── worker/send-mail/     relay: worker → Vercel SMTP send (clean IP)
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
│   │   ├── outreach/                 OutreachDashboard, CampaignWizard (4-step
│   │   │                              create flow), CampaignDetail, SequenceEditor,
│   │   │                              ProspectsManager, SendersManager,
│   │   │                              CampaignStatsBar, StatusBadge, TestSendCard,
│   │   │                              UniboxList, InboxCheckButton,
│   │   │                              ConnectedInboxesStrip
│   │   ├── admin/AdminUsersTable.tsx per-row actions with confirmation modals
│   │   └── billing/BillingPanel.tsx
│   └── lib/
│       ├── supabase/                 server + client + middleware session
│       ├── avatar.ts                 initialsFor() — app uses initials only
│       ├── stripe.ts                 client + price-id map + credit grants +
│       │                              trial constants ($1/100cr/7-day)
│       ├── sender-providers.ts       SMTP/IMAP presets for Gmail/Outlook/Titan/
│       │                              Zoho/Yahoo + custom; validation helpers
│       ├── mailer.ts                 Resend-or-console mailer + plan-activated tmpl
│       ├── email-templates.ts        outreach templates + {{name}}/{{category}}/
│       │                              {{sender}} placeholder renderer
│       ├── places-api.ts             Google Places API (New) Text Search client
│       │                              (dev-mode mirror of worker/src/places-api.ts)
│       ├── google-maps-scraper.ts    thin wrapper over places-api.ts that emits
│       │                              the legacy ProgressEvent shape so the API
│       │                              route doesn't have to change (file name
│       │                              kept for import compatibility)
│       ├── lead-enrichment.ts        dev-mode wrapper: spawns worker/find_emails.py
│       │                              (the website email/phone crawler) as a
│       │                              subprocess and parses its JSON. No Apollo.
│       ├── keyword-cluster.ts        Mistral API + curated 20-niche static map
│       │                              + generic prefix fallback
│       ├── google-leads.ts           OLDER Places-API helper used by
│       │                              /api/leads/discover (server-only bearer)
│       └── osm.ts, google-maps.ts    legacy, unused in current product flow
├── worker/                            deploys to Railway (Dockerfile root dir = /worker)
│   ├── src/
│   │   ├── server.ts                 Express + SSE /scrape, Bearer auth, heartbeat,
│   │   │                              /outreach/tick + /inbox/check endpoints, and
│   │   │                              3 background loops: outreach-tick (15m),
│   │   │                              inbox-check (10m), trial-charge (hourly)
│   │   ├── scrape-job.ts             orchestrator: scrape → cluster-expand →
│   │   │                              insert leads → harvest emails → mark complete
│   │   ├── outreach-tick.ts          autopilot: active campaigns → due prospects →
│   │   │                              render → round-robin senders → send (relay
│   │   │                              via Vercel) → advance state → sweep completed.
│   │   │                              Send window, per-campaign daily limit,
│   │   │                              30–90s humanization, retry/backoff, fast mode
│   │   ├── inbox-check.ts            IMAP poll across active senders → parse MIME →
│   │   │                              upsert outreach_replies, mark prospects replied
│   │   ├── trial-charge.ts           sweep due trials → Stripe off-session charge →
│   │   │                              convert plan / mark failed
│   │   ├── places-api.ts             Google Places API (New) Text Search client
│   │   ├── scraper.ts                thin wrapper over places-api.ts emitting
│   │   │                              the legacy ProgressEvent shape
│   │   ├── enrichment.ts             spawns ../find_emails.py per lead, parses
│   │   │                              its JSON (same wrapper as the dev mirror)
│   │   ├── keywords.ts               same as src/lib/keyword-cluster.ts
│   │   └── db.ts                     Supabase service-role client
│   ├── find_emails.py                website email/phone crawler (stdlib-only
│   │                                 Python): 7 contact paths, mailto/tel hrefs,
│   │                                 unobfuscation, decoy filter. THE email
│   │                                 finder — no Apollo / third-party API.
│   ├── Dockerfile                    node:22-slim (no Chromium — Places API is HTTP)
│   ├── railway.json                  buildCommand + healthcheck /health
│   └── package.json                  separate deps (express, supabase-js,
│                                      nodemailer, imapflow, mailparser, stripe)
├── supabase/                         SQL migrations (run in Supabase SQL Editor)
│   ├── schema.sql                    base tables + RLS + triggers (run FIRST)
│   ├── add_scan_lead_tables.sql      scan_runs, leads, lead_contacts (idempotent)
│   ├── admin_user_actions.sql        adds `suspended` column + admin delete policy
│   ├── credit_reservation.sql        reserve_search_credits / refund_search_credits
│   ├── email_outreach.sql            email_sends table + RLS (idempotent)
│   ├── outreach_campaigns.sql        outreach_campaigns/steps/prospects + extends
│   │                                  email_sends with campaign_id/step_order
│   ├── fix_rls_recursion.sql         older RLS patch
│   ├── outreach_v2.sql               send windows, retry/bounce tracking
│   ├── outreach_v3.sql               outreach_senders, outreach_campaign_senders,
│   │                                  email_opens, open_token on email_sends
│   ├── outreach_v4.sql               campaign-level daily_limit
│   ├── outreach_v5.sql               outreach_replies + last_inbox_check_at
│   ├── outreach_v6.sql               make email_sends.lead_id nullable
│   ├── outreach_v7.sql               Unibox: star/category/archive/notes on replies
│   ├── outreach_v8.sql / v8b.sql     per-step delay_unit (days/hours, then minutes)
│   ├── senders_multi_provider.sql    smtp/imap host+port+secure cols; provider freed
│   ├── trial_subscriptions.sql       profiles trial_* cols + stripe_customer_id
│   ├── zero_signup_credits.sql       default credits 10 → 0
│   ├── promote_admin.sql             one-time: edit email + run to grant admin
│   └── backfill_profiles.sql         one-time for users created before trigger
├── middleware.ts                     Supabase session refresh on every request
├── .vercelignore                     excludes /worker, /supabase (root only)
└── .env.example                      template for env vars
```

## Routes

**Public:**
- `/` — marketing home with hero, features, how-it-works, preview, testimonials, pricing, FAQ, footer CTA
- `/how-it-works`, `/use-cases`, `/pricing`, `/faq` — standalone marketing pages
- `/about`, `/contact` — company pages (contact form composes a mailto)
- `/privacy`, `/terms`, `/cookies` — legal pages (shared `LegalDoc` component)
- `/login` — user sign-in (show/hide password)
- `/signup` — two-column sales pitch on left, form on right
- `/leadmachineadmin` — **dedicated admin sign-in**, noindexed. Separate URL so
  user and admin credentials can't be confused and a compromised user login is
  bounded to `/user`.

**User app** (`AppShell` — left sidebar with Dashboard / Generate / Jobs / Leads /
Outreach / Inbox / Senders / Billing / Settings / Admin (if admin)):
- `/user` — dashboard (KPIs, lead growth, open rate)
- `/user/generate` — niche + location + count + SSE animated progress
- `/user/jobs` — live background-job page; polls `scan_runs.result_count`
- `/user/leads` — CRM table; supports `?campaign={runId}` for campaign-scoped view
- `/user/outreach` — list of outreach campaigns + dashboard stats; per-card
  Pause/Resume
- `/user/outreach/new` — **4-step wizard**: pick prospect list(s) → build sequence
  → attach senders → review/start. Creates everything atomically via create-full.
- `/user/outreach/[id]` — detail/edit: rename, sequence editor (subject/body/
  delay with days·hours·minutes unit + template picker), prospects manager,
  attached senders, stats bar, Start / Pause / Send-all-now / test-send / Delete.
  Sends fire on the worker's 15-min tick (or instantly via Send-all-now fast mode).
- `/user/inbox` — **Unibox**: IMAP-polled replies with tabs (All/Unread/Starred/
  Interested/Meeting/Not interested/OOO/Archived), search, star, category tags,
  notes, inline threaded reply, "Reply in Gmail", and a "Check now" button.
- `/user/senders` — connect mailboxes (Gmail/Outlook/Titan/Zoho/Yahoo/custom);
  per-sender status, daily-quota bar, pause/resume, disconnect.
- `/user/billing` — trial + credit packs (Stripe)
- `/user/settings` — profile + plan info

**Admin console** (`AdminShell` — distinct visual theme, own sidebar):
- `/admin` — overview KPIs + lead growth chart + quick links
- `/admin/users` — user management with inline +credits, -credits, suspend, delete
- `/admin/campaigns` — all campaigns + lead coverage
- `/admin/activity` — enterprise queue

## Data model (Supabase)

Run order in SQL editor (fresh install — all idempotent):
1. `supabase/schema.sql`
2. `supabase/add_scan_lead_tables.sql`
3. `supabase/admin_user_actions.sql`
4. `supabase/credit_reservation.sql`
5. `supabase/email_outreach.sql`
6. `supabase/outreach_campaigns.sql`
7. `supabase/fix_rls_recursion.sql`
8. `supabase/outreach_v2.sql`
9. `supabase/outreach_v3.sql`
10. `supabase/outreach_v4.sql`
11. `supabase/outreach_v5.sql`
12. `supabase/outreach_v6.sql`
13. `supabase/outreach_v7.sql`
14. `supabase/outreach_v8.sql` → `outreach_v8b.sql`
15. `supabase/senders_multi_provider.sql`
16. `supabase/trial_subscriptions.sql`
17. `supabase/zero_signup_credits.sql`
Then one-time: `promote_admin.sql` (edit email first), `backfill_profiles.sql`.

**Tables:**
- `profiles` (id FK auth.users, email, full_name, role, plan, **credits (default 0)**,
  suspended, **stripe_customer_id**, **trial_started_at**, **trial_ends_at**,
  **trial_target_plan**, **trial_status**, **trial_last_error**, created_at, updated_at)
- `enterprise_requests` (id, user_id, email, note, status, created_at)
- `scan_runs` (id, user_id, source, keyword, location, status, limit_count, result_count, started_at, finished_at, error)
- `leads` (id, user_id, scan_run_id, source, name, category, address, rating, review_count, maps_url, website_url, dedupe_key, created_at)
- `lead_contacts` (id, lead_id, phone, email, website_url, source_url, created_at)
- `email_sends` (id, user_id, lead_id (nullable), scan_run_id, campaign_id, step_order, recipient_email, subject, body, status, error, provider_message_id, attachment_count, **open_token (unique)**, **open_count**, **first_opened_at**, sent_at, created_at)
- `outreach_campaigns` (id, user_id, scan_run_id, name, status, **send_window_start**, **send_window_end**, **send_days[]**, **timezone**, **daily_limit (default 50, 1–500)**, created_at, started_at, finished_at) — status in draft/active/paused/completed
- `outreach_steps` (id, campaign_id, step_order, delay_days, **delay_unit (minutes/hours/days)**, subject, body, created_at) — unique on (campaign_id, step_order); step 1 = no delay
- `outreach_prospects` (id, campaign_id, lead_id, email, status, current_step, next_send_at, last_sent_at, **retry_count**, **bounce_reason**, added_at) — unique on (campaign_id, lead_id); status in pending/in_progress/replied/bounced/completed/failed
- **`outreach_senders`** (id, user_id, email, display_name, provider, app_password (encrypted at rest), smtp_host/port/secure, imap_host/port/secure, daily_limit, sends_today, last_reset_at, last_inbox_check_at, status (active/paused/error), last_error, created_at) — unique on (user_id, email)
- **`outreach_campaign_senders`** (campaign_id, sender_id) — PK (campaign_id, sender_id); which senders a campaign rotates across
- **`email_opens`** (id, send_id FK email_sends, opened_at, ip, user_agent)
- **`outreach_replies`** (id, user_id, sender_id, prospect_id, lead_id, campaign_id, message_id, from_email, from_name, subject, snippet, received_at, read_at, starred, category, archived_at, notes, created_at) — unique on (sender_id, message_id); category in interested/meeting_booked/not_interested/out_of_office/unsubscribe/wrong_person/other

**Functions:**
- `is_admin()` — used in RLS policies (SECURITY DEFINER, avoids RLS recursion)
- `handle_new_user()` — trigger on auth.users INSERT → creates profile
- `lock_sensitive_profile_cols()` — trigger preventing users from changing their own role/credits/email/plan (except → enterprise)
- `consume_search_credit()` — legacy single-credit decrement (still works, no longer used)
- `reserve_search_credits(amount)` — deducts N credits up front
- `refund_search_credits(amount)` — refunds unused credits

**RLS:** users read/insert/update their own rows; admins read/update/delete all.
Worker (service role) inserts `email_sends`, `email_opens`, `outreach_replies`.
Cascade chain: auth.users → profiles → scan_runs → leads → lead_contacts.
`outreach_senders.app_password` is encrypted at rest and never returned to the client.

## Auth flow

1. **Users** sign in at `/login` (`src/app/login/login-form.tsx`):
   `signInWithPassword` → routes to `/user`.
2. **Admins** sign in at `/leadmachineadmin` (`admin-login-form.tsx`), a separate
   noindexed URL: validates `role === "admin"`; if not, signs out + shows error.
   Keeping it on its own URL bounds the blast radius of a leaked user login.
3. Suspended users (`profiles.suspended === true`) get redirected to an
   "Account suspended" screen by `src/app/user/layout.tsx` before they reach
   any user-facing page.

## Billing model — trial + lifetime credit packs (NOT recurring subscriptions)

- **Signup grants 0 credits** (`zero_signup_credits.sql`). New users must start a
  trial or buy a plan to use the product.
- **$1 / 7-day trial** (`/api/billing/trial`): grants 100 credits immediately,
  saves the card on file (Stripe customer + PaymentIntent), and records
  `trial_target_plan`. Constants in `src/lib/stripe.ts` (`TRIAL_PRICE_CENTS=100`,
  `TRIAL_CREDIT_GRANT=100`, `TRIAL_DURATION_DAYS=7`).
- **Trial conversion** is handled by the worker's hourly `trial-charge` job: at
  `trial_ends_at`, it charges the target plan **off-session** against the saved
  card. Success → `trial_status='converted'` + plan credits granted; failure →
  `trial_status='failed'` + `trial_last_error`. Webhook records the payment.
- 3 paid tiers (one-time, `mode: "payment"`): Starter / Premium / Pro. 4th tier
  Enterprise → talk-to-sales modal, no checkout.
- Webhook (`/api/billing/webhook`) handles `checkout.session.completed` (pack
  purchase) and the trial PaymentIntent flow.
- On grant: bump `profiles.plan`, add credits to balance, send confirmation email.
- **Lead generation: 1 lead = 1 credit.** Reserved up front via
  `reserve_search_credits(amount)`; unused portion refunded after the scrape
  (`refund_search_credits(limit - delivered)`).
- **Outreach: 1 credit per prospect for step 1 only** (follow-up steps are free),
  charged at campaign start / when adding prospects to an active campaign.
- Enterprise plan = unmetered (no credit deduction).

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
`GOOGLE_MAPS_API_KEY` in `.env.local` **and `python3` on PATH** (the email
harvest in `lead-enrichment.ts` spawns `worker/find_emails.py`).

### Follow-up worth considering

With Places API being so fast (sub-second per call), the dedicated Railway
worker is mostly unnecessary — the whole pipeline could fit inside a Vercel
function comfortably. The `WORKER_URL`/`WORKER_TOKEN` plumbing is still in
place so deployments can choose; revisit if you want to decommission Railway
and simplify the stack to just Vercel + Supabase. **Note:** the outreach
autopilot + inbox poll + trial-charge loops need a long-running process, so the
worker can't be fully retired without moving those to cron.

## Outreach pipeline (cold email)

### Senders (`/user/senders`, `outreach_senders`)
- Users connect their own mailboxes. Presets in `src/lib/sender-providers.ts`:
  **Gmail** (smtp 465 / imap 993, app password), **Outlook/M365** (smtp 587
  STARTTLS), **Titan**, **Zoho**, **Yahoo**, or **custom** SMTP+IMAP.
- `POST /api/outreach/senders` **live-verifies** credentials with a real
  nodemailer `transporter.verify()` before inserting. Bad creds → friendly error.
- `app_password` is encrypted at rest and never returned to the client.
- Each sender has a `daily_limit` (provider ceiling) + `sends_today` counter that
  rolls over at UTC midnight. Status: active / paused / error.

### Campaign creation (4-step wizard → `create-full`)
`/user/outreach/new` (`CampaignWizard`) collects: prospect list(s) from completed
scans with emailable leads → sequence steps → senders → optional start-now.
`POST /api/outreach/campaigns/create-full` does it all atomically: create
campaign (draft) → insert steps (step 1 forced to zero delay) → import all
leads-with-emails as prospects → attach senders via `outreach_campaign_senders`
→ if `startNow` and credits available, activate + queue + poke the worker.

### Sending (worker `outreach-tick.ts`, every 15 min)
1. Load active campaigns + steps + senders + schedule (send window, send days,
   timezone, `daily_limit`).
2. Skip campaigns outside their send window or already at the daily limit
   (unless **fast mode**).
3. Find due prospects (`status in (pending,in_progress)` AND `next_send_at <= now`),
   limit 200; **claim** them by bumping `next_send_at` +10 min (anti-double-send).
4. Per prospect: pick next step → render `{{name}}/{{category}}/{{sender}}` →
   30–90 s humanization pause → **round-robin** pick a sender with headroom →
   send (with open-tracking pixel) → advance `current_step`, compute next
   `next_send_at` from the next step's `delay_unit`+value, or mark `completed`.
5. On failure: retry with backoff (1h/4h/12h), `bounced` after 3 attempts.
6. Sweep campaigns with no remaining work → `completed`.

**Send path / Railway IP block:** Gmail blocks Railway's egress IPs, so the
worker relays sends through `POST /api/worker/send-mail` on Vercel (cleaner IPs);
direct SMTP is only a local-dev fallback. **Send-all-now** (`/[id]/send-now`,
fast mode) skips delays/window/limit for an instant blast. **Test-send**
(`/api/outreach/test-send`) emails your own inbox before launch.

### Replies (Unibox — `/user/inbox`, `outreach_replies`)
- Worker `inbox-check.ts` (every 10 min) + the Vercel `/api/outreach/inbox-check`
  ("Check now" button) poll each active sender's IMAP via **imapflow**, parse MIME
  with **mailparser**, dedupe on `(sender_id, message_id)`, and upsert replies.
- A reply only logs if its `from_email` matches a prior `email_sends` recipient
  (filters newsletters). If it maps to a prospect, that prospect is marked
  `replied` and follow-ups stop.
- Unibox UI: tabs/filters, search, star, category tags, notes, and an **inline
  threaded reply** (`/[id]/send`) sent via the matching sender's SMTP with
  `In-Reply-To`/`References` headers.

### Open tracking (`email_opens`)
Each send embeds a 1×1 pixel `<img src="/api/track/open/{open_token}">`. The
endpoint records an `email_opens` row + bumps `email_sends.open_count`. Caveat:
Gmail/Apple proxy images, so treat it as "opened at least once," not exact.

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

Place lookup uses the Google Places API, so local dev needs `GOOGLE_MAPS_API_KEY`
in `.env.local`. (Puppeteer is fully removed — no headless browser to manage.)
For outreach features locally, you also need at least one sender configured and
the worker running, or the tick just logs instead of sending.

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
- Also required for relay + tracking (worker calls these back): `SUPABASE_SERVICE_ROLE_KEY`
- Optional: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER/PREMIUM/PRO`, `RESEND_API_KEY`

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
- **Outreach sending is now per-user senders** (stored in `outreach_senders`,
  configured in `/user/senders`) — no global Gmail/Resend env var needed for the
  primary path. The worker relays sends through Vercel (`APP_URL` /
  `NEXT_PUBLIC_APP_URL` + `WORKER_TOKEN`) to dodge Railway's IP block.
  - Legacy/fallback (optional): `GMAIL_USER` + `GMAIL_APP_PASSWORD`, or
    `RESEND_API_KEY` + `OUTREACH_FROM`. With no sender and no fallback, the tick
    logs to stdout instead of sending.
- For trial conversion: the worker's hourly `trial-charge` job needs
  `STRIPE_SECRET_KEY` (off-session charges).
- Optional: `MISTRAL_API_KEY` (AI keyword expansion), `MAIL_FROM` (fallback)

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
- **June 2026 — email outreach feature.** New `/user/email-campaigns` section
  with list view + compose page. Sends via Resend (`OUTREACH_FROM` env var,
  falls back to `MAIL_FROM`; logs to console if no API key). Per-recipient
  attempts logged to new `email_sends` table — used for the "already emailed"
  badge on the recipient list. Reply-to is set to the user's profile email
  so replies land in their inbox, not in the verified outreach domain.
  Attachments base64-encoded client-side, capped at 3.5 MB total to stay
  under Vercel's 4.5 MB request body limit. Templates are hardcoded in
  `src/lib/email-templates.ts` with `{{name}}` / `{{category}}` / `{{sender}}`
  placeholders; user-editable templates deferred.
- **June 2026 — outreach autopilot (Phase 1+2).** Replaced the one-shot
  email-campaigns compose with a full multi-step sequence builder at
  `/user/outreach`. Each campaign has a name, a parent scan_run, a sequence
  of steps (subject/body/delay_days), and a set of prospects (leads with
  emails). The Railway worker runs a 15-min `setInterval` (`outreach-tick.ts`)
  that picks due prospects, sends the next step, advances `current_step`,
  and computes `next_send_at` from the next step's delay.
  Bearer-auth'd `POST /outreach/tick` lets the Vercel `start` route poke the
  worker so the first send fires within seconds. Concurrency safety: tick
  bumps `next_send_at` 10 min into the future as a soft claim. Status
  transitions per prospect: pending → in_progress → completed (or replied/
  bounced/failed). Reply detection is manual for v1 — user clicks
  CheckCircle2 to mark replied. Attachments per step deferred.
  Picked Railway worker over Vercel Cron (Hobby tier only does daily) so
  the autopilot stays on the same infra we already pay for.
- **June 2026 — outreach sender = Gmail SMTP first, Resend fallback.** The
  initial outreach build assumed a verified Resend domain; the user only had
  a Vercel subdomain (which can't host DNS records) and didn't want to buy
  a domain. Swapped `outreach-tick.ts` to a strategy chain: Gmail SMTP via
  nodemailer + App Password is preferred (no domain needed; ~500/day cap;
  ToS-grey for bulk cold outreach but works), then Resend with verified
  domain, then console.log. Added `nodemailer` + `@types/nodemailer` to
  worker deps. New env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Gmail
  forces the SMTP "from" to match the authenticated user, so the
  Reply-To stays as the user's profile email — though when GMAIL_USER ==
  profile.email they're the same and replies just land naturally.
- **June 2026 — outreach P2A: 4-step wizard + multi-sender + open tracking.**
  Campaign creation became a `CampaignWizard` (prospect list → sequence →
  senders → review) writing through `create-full`. Sends round-robin across
  per-campaign senders. Daily limit moved from a sender setting to a campaign
  setting. Added send-window/send-days/timezone scheduling and a 1×1
  open-tracking pixel (`email_opens`, `open_token`). Per-step delay gained a
  `delay_unit` (days → +hours → +minutes).
- **June 2026 — per-user multi-provider senders.** `/user/senders` lets users
  connect Gmail/Outlook/Titan/Zoho/Yahoo/custom mailboxes, stored in
  `outreach_senders` with full SMTP+IMAP config (presets in
  `src/lib/sender-providers.ts`). Credentials are live-verified via
  `transporter.verify()` on add and encrypted at rest. This replaced the global
  `GMAIL_*`/Resend env-var strategy as the primary send path.
- **June 2026 — Unibox + IMAP reply polling.** `inbox-check.ts` (worker, 10-min)
  + a Vercel `/api/outreach/inbox-check` route poll each active sender's IMAP
  (imapflow + mailparser), upsert into `outreach_replies` (dedup on
  sender+message_id), and auto-mark matching prospects `replied`. `/user/inbox`
  is a Gmail-style triage UI (categories, star, archive, notes, search, inline
  threaded reply). Replaced the manual "click to mark replied" of P1.
- **June 2026 — relay sends/polls through Vercel.** Railway egress IPs get
  blocked by Gmail SMTP/IMAP. The worker now POSTs to Vercel routes
  (`/api/worker/send-mail`, `/api/outreach/inbox-check`) which run on cleaner
  IPs. Also forced IPv4 + SMTP port 465 to stabilize Railway↔Gmail.
- **June 2026 — trial billing + zero signup credits.** Signup grant dropped
  10 → 0. New `$1 / 7-day` trial (`/api/billing/trial`) grants 100 credits and
  saves a card; the worker's hourly `trial-charge.ts` auto-converts to the
  selected plan off-session at trial end. New `profiles.trial_*` +
  `stripe_customer_id` columns. (Price has moved over time — $1/3-day, then
  $7/7-day; current constants in `src/lib/stripe.ts` are $1 / 100 credits / 7-day.)
- **June 2026 — dedicated admin login URL.** Admin sign-in moved off the shared
  `/login` toggle to its own noindexed `/leadmachineadmin` route, so user and
  admin credentials can't be confused and a leaked user login can't reach admin.
- **June 2026 — email harvesting moved to a Python script; Apollo removed.**
  The website email/phone crawl now lives in `worker/find_emails.py` (stdlib
  only — urllib/re/html, no pip deps). `enrichFromWebsite` in both
  `worker/src/enrichment.ts` and the dev mirror `src/lib/lead-enrichment.ts`
  became a thin wrapper that spawns the script per lead and parses its JSON
  (`{emails, phones, sourceUrls}`); the return shape is unchanged so scrape-job,
  reenrich-job, and the single-lead route didn't change. The Apollo
  (`api.apollo.io`) Layer-2 fallback (`worker/src/apollo.ts`,
  `src/lib/apollo-enrich.ts`, `APOLLO_API_KEY`) was deleted entirely — no
  third-party email API, no per-lookup cost; emails come only from the lead's
  own site. Worker Dockerfile now `apt-get install python3` + copies the script
  to `/app/find_emails.py`. Local dev needs `python3` on PATH (override binary
  with `PYTHON_BIN`). Google Places (lead lookup) is untouched.

## Open work / followups

1. **Gmail OAuth senders** — currently senders use app passwords (requires 2FA +
   manual app-password creation, and is ToS-grey for bulk). OAuth via the Gmail
   API would be cleaner but needs a Google Cloud OAuth app + verification.
2. **Reply detection is heuristic** — matches inbound `from_email` against prior
   `email_sends`. No threading-by-`References` yet; auto-categorization is manual.
   Click tracking + per-step analytics still unbuilt.
3. **Outreach attachments per step** — deferred. Needs Supabase Storage + a
   per-step join table; worker fetches + base64-encodes on send.
4. **Open-tracking reliability** — Gmail/Apple image proxies inflate/obscure
   opens. Treated as "opened at least once," not exact; revisit if analytics matter.
5. Decommissioning Railway is unattractive — outreach-tick, inbox-check, and
   trial-charge all need a long-running process (Vercel Cron Hobby is daily-only).
6. Real-time credit decrement animation in the topbar while a scrape runs.
7. Wait-for-CI gate, automated migrations on deploy, and a staging environment
   are unbuilt — production pushes go straight to `main`.
8. Restrict the production `GOOGLE_MAPS_API_KEY` to Places API (New) only in
   Google Cloud Console — currently allowed for any API on the project.

---

If you're picking this up cold: run `npm run dev`, sign in (admin at
`/leadmachineadmin`), and walk Dashboard → Generate → Jobs → Leads → Outreach
(create a campaign via the wizard) → Senders → Inbox → Billing → Admin. That's
the full surface area of the product.
