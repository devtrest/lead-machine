# Lead Machine

AI-powered lead generation. Tell Lead Machine a niche and a city, get verified
business leads with phones, emails, and websites — deduped and CRM-ready.

## Architecture

```
                ┌──────────────────────────────────────┐
                │  Frontend  (Next.js, Vercel)         │
                │   ├─ Marketing + Auth + Dashboard    │
                │   └─ /api/google-maps-search proxies │
                │      to the worker via SSE           │
                └──────────────────────────────────────┘
                                  │ Bearer token
                                  ▼
                ┌──────────────────────────────────────┐
                │  Worker  (Express + Puppeteer,       │
                │           Railway, Dockerfile)       │
                │   ├─ Scrapes Google Maps             │
                │   ├─ Enriches detail pages           │
                │   ├─ Expands niche (Mistral / static)│
                │   ├─ Harvests emails from websites   │
                │   └─ Writes leads → Supabase         │
                └──────────────────────────────────────┘
                                  │
                                  ▼
                ┌──────────────────────────────────────┐
                │  Supabase  (auth + DB + RLS)         │
                └──────────────────────────────────────┘
```

## Stack

- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind v4 + Framer Motion
- **Worker:** Express + Puppeteer (TypeScript, deployed via Dockerfile)
- **Database/Auth:** Supabase
- **Billing:** Stripe (one-time payments, lifetime credit packs)
- **Email:** Resend (optional; mailer falls back to console log without it)
- **AI keyword expansion:** Mistral API (optional; static niche map without it)

## Prerequisites

- Node.js 20+ and npm
- A Supabase project (free tier is fine)

## Local setup

```bash
git clone <this-repo>
cd lead-machine
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
# → http://localhost:3001
```

Without `WORKER_URL` set, the frontend runs Puppeteer in-process (convenient
for local dev — no second service to manage).

### Database setup

In your Supabase project's SQL editor, run these scripts in order:

1. `supabase/schema.sql` — main tables, RLS, triggers
2. `supabase/add_scan_lead_tables.sql` — scan/lead tables (idempotent)
3. `supabase/admin_user_actions.sql` — admin suspend/delete capability
4. `supabase/credit_reservation.sql` — per-lead credit billing

To promote your first admin: edit `supabase/promote_admin.sql` with your email
and run it.

## Routes

- `/` — marketing site
- `/how-it-works`, `/pricing`, `/faq` — marketing pages
- `/login`, `/signup` — auth (role-aware redirect on sign-in)
- `/user/*` — user dashboard (Dashboard, Generate, Leads, Campaigns, Billing, Settings)
- `/admin/*` — admin console (Overview, Users, Campaigns, Activity)

## Production deployment

### Worker → Railway

See [worker/README.md](worker/README.md) for full instructions. The short
version:

1. Railway → **New project** → **Deploy from GitHub** → pick this repo
2. **Settings → Source → Root Directory** → `/worker`
3. Railway auto-detects the Dockerfile
4. Add env vars: `WORKER_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
5. Generate a domain → copy it

### Frontend → Vercel

1. Vercel → **Import Project** → pick this repo (it's already excluded
   from worker via `.vercelignore`)
2. Add env vars (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` = your Vercel domain
   - `WORKER_URL` = the Railway worker domain
   - `WORKER_TOKEN` = same secret as the worker
   - Stripe keys + `SUPABASE_SERVICE_ROLE_KEY` if you want billing
3. Deploy

### Supabase auth URL config

After deploying, update **Authentication → URL Configuration**:
- **Site URL** = your Vercel domain
- **Redirect URLs** → add `https://your-domain.vercel.app/**`

## License

Private.
