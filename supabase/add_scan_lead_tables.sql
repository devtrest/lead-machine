-- Adds the scan/lead tables that were missing from the original schema run.
-- Safe to re-run: tables use IF NOT EXISTS, policies use DROP/CREATE.

create table if not exists public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('google_maps', 'osm')),
  keyword text not null,
  location text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  limit_count integer not null default 10,
  result_count integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_run_id uuid not null references public.scan_runs (id) on delete cascade,
  source text not null default 'google_maps',
  name text not null,
  category text,
  address text,
  rating numeric(3,2),
  review_count integer,
  maps_url text,
  website_url text,
  dedupe_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  phone text,
  email text,
  website_url text,
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_scan_runs_user_started on public.scan_runs (user_id, started_at desc);
create index if not exists idx_leads_user_created on public.leads (user_id, created_at desc);
create index if not exists idx_leads_dedupe on public.leads (user_id, dedupe_key);
create index if not exists idx_lead_contacts_lead on public.lead_contacts (lead_id);

alter table public.scan_runs enable row level security;
alter table public.leads enable row level security;
alter table public.lead_contacts enable row level security;

drop policy if exists "Users read own scan runs" on public.scan_runs;
create policy "Users read own scan runs"
  on public.scan_runs for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own scan runs" on public.scan_runs;
create policy "Users insert own scan runs"
  on public.scan_runs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own scan runs" on public.scan_runs;
create policy "Users update own scan runs"
  on public.scan_runs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins read all scan runs" on public.scan_runs;
create policy "Admins read all scan runs"
  on public.scan_runs for select
  using (public.is_admin());

drop policy if exists "Users read own leads" on public.leads;
create policy "Users read own leads"
  on public.leads for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own leads" on public.leads;
create policy "Users insert own leads"
  on public.leads for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own leads" on public.leads;
create policy "Users update own leads"
  on public.leads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins read all leads" on public.leads;
create policy "Admins read all leads"
  on public.leads for select
  using (public.is_admin());

drop policy if exists "Users read contacts for own leads" on public.lead_contacts;
create policy "Users read contacts for own leads"
  on public.lead_contacts for select
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id and l.user_id = auth.uid()
    )
  );

drop policy if exists "Users insert contacts for own leads" on public.lead_contacts;
create policy "Users insert contacts for own leads"
  on public.lead_contacts for insert
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_id and l.user_id = auth.uid()
    )
  );

drop policy if exists "Admins read all lead contacts" on public.lead_contacts;
create policy "Admins read all lead contacts"
  on public.lead_contacts for select
  using (public.is_admin());
