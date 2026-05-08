# Nichely

AI-powered lead generation. Tell Nichely a niche and a city, get verified business
leads with phones, emails, and websites — deduped and CRM-ready.

## Stack

- **Next.js 15** (App Router) + React 19 + Tailwind v4
- **Supabase** for auth, database, and row-level security
- **Puppeteer** for the lead engine (search-feed scrape + parallel detail-page enrichment + website email harvesting)
- **Framer Motion** for UI animations
- **Stripe** for billing (scaffolded; fill env vars to enable)
- **Resend** for transactional email (optional; falls back to console log)

## Prerequisites

- Node.js 20+ and npm
- A Supabase project (free tier is fine)
- Chrome / Chromium (Puppeteer downloads its own by default)

## Local setup

```bash
git clone <this-repo>
cd nichely
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
# → http://localhost:3001
```

### Database setup

In your Supabase project's SQL editor, run these scripts in order:

1. `supabase/schema.sql` — main tables, RLS, triggers
2. `supabase/add_scan_lead_tables.sql` — scan/lead tables (idempotent)
3. `supabase/admin_user_actions.sql` — admin suspend/delete capability

To promote your first admin: edit `supabase/promote_admin.sql` with your email and run it.

## Routes

- `/` — marketing site
- `/how-it-works`, `/pricing`, `/faq` — marketing pages
- `/login`, `/signup` — auth
- `/user/*` — user dashboard (Dashboard, Generate, Leads, Campaigns, Settings)
- `/admin/*` — admin console (Overview, Users, Campaigns, Activity)

## Deployment notes

The current build deploys end-to-end on **Railway** — Next.js app + Puppeteer in
one container. For higher traffic, split the Puppeteer scraper into a separate
worker service (Railway) and host the frontend on Vercel.

## License

Private.
