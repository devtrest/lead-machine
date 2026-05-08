-- Run in Supabase SQL Editor (one-time setup)

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  plan text not null default 'starter' check (plan in ('starter', 'premium', 'pro', 'enterprise')),
  credits integer not null default 10 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enterprise_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.enterprise_requests enable row level security;

-- Bypasses RLS — safe to call inside profiles policies (avoids infinite recursion).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

create or replace function public.lock_sensitive_profile_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip lock when auth.uid() is null (e.g. SQL Editor / service role) so admins can be promoted there.
  if tg_op = 'UPDATE'
     and auth.uid() is not null
     and coalesce(public.is_admin(), false) is false then
    new.role := old.role;
    new.email := old.email;
    if coalesce(current_setting('app.allow_credit_mut', true), '') <> '1' then
      new.credits := old.credits;
    end if;
    if new.plan = 'enterprise' and old.plan is distinct from 'enterprise' then
      new.plan := old.plan;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_lock_cols on public.profiles;
create trigger trg_profiles_lock_cols
before update on public.profiles
for each row execute function public.lock_sensitive_profile_cols();

create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create or replace function public.consume_search_credit()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  perform set_config('app.allow_credit_mut', '1', true);
  update public.profiles
  set credits = credits - 1, updated_at = now()
  where id = auth.uid() and credits >= 1
  returning credits into remaining;
  perform set_config('app.allow_credit_mut', '', true);
  return found;
end;
$$;

grant execute on function public.consume_search_credit() to authenticated;

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins update any profile"
  on public.profiles for update
  using (public.is_admin());

create policy "Insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Admins read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Users insert enterprise request"
  on public.enterprise_requests for insert
  with check (auth.uid() = user_id);

create policy "Users read own enterprise requests"
  on public.enterprise_requests for select
  using (auth.uid() = user_id);

create policy "Admins read all enterprise requests"
  on public.enterprise_requests for select
  using (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'user'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Optional: promote first admin manually:
-- update public.profiles set role = 'admin' where email = 'you@company.com';

-- Persistent scan and lead intelligence tables
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

create policy "Users read own scan runs"
  on public.scan_runs for select
  using (auth.uid() = user_id);

create policy "Users insert own scan runs"
  on public.scan_runs for insert
  with check (auth.uid() = user_id);

create policy "Users update own scan runs"
  on public.scan_runs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins read all scan runs"
  on public.scan_runs for select
  using (public.is_admin());

create policy "Users read own leads"
  on public.leads for select
  using (auth.uid() = user_id);

create policy "Users insert own leads"
  on public.leads for insert
  with check (auth.uid() = user_id);

create policy "Users update own leads"
  on public.leads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins read all leads"
  on public.leads for select
  using (public.is_admin());

create policy "Users read contacts for own leads"
  on public.lead_contacts for select
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id and l.user_id = auth.uid()
    )
  );

create policy "Users insert contacts for own leads"
  on public.lead_contacts for insert
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_id and l.user_id = auth.uid()
    )
  );

create policy "Admins read all lead contacts"
  on public.lead_contacts for select
  using (public.is_admin());
