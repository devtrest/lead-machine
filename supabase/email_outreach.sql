-- Email outreach: tracks every email sent to a lead from the
-- /user/email-campaigns flow. One row per recipient per send (so a 50-lead
-- blast creates 50 rows). Used to (a) avoid double-sending, (b) show "last
-- emailed" in the leads table, (c) report on outreach throughput.
--
-- Safe to re-run.

create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  scan_run_id uuid references public.scan_runs (id) on delete set null,
  recipient_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error text,
  provider_message_id text,
  attachment_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_sends_user_created
  on public.email_sends (user_id, created_at desc);
create index if not exists idx_email_sends_lead
  on public.email_sends (lead_id);
create index if not exists idx_email_sends_scan_run
  on public.email_sends (scan_run_id);

alter table public.email_sends enable row level security;

drop policy if exists "Users read own email sends" on public.email_sends;
create policy "Users read own email sends"
  on public.email_sends for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own email sends" on public.email_sends;
create policy "Users insert own email sends"
  on public.email_sends for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own email sends" on public.email_sends;
create policy "Users update own email sends"
  on public.email_sends for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins read all email sends" on public.email_sends;
create policy "Admins read all email sends"
  on public.email_sends for select
  using (public.is_admin());
