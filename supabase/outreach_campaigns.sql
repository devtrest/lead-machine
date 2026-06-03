-- Multi-step outreach campaigns: user creates a campaign tied to a scan_run
-- (the "parent niche"), defines a sequence of email steps with delays, and
-- the Railway worker's 15-min tick sends each step to each prospect as its
-- next_send_at falls due. Replaces the prior one-shot /user/email-campaigns
-- compose flow.
--
-- Safe to re-run.

------------------------------------------------------------------------------
-- 1. outreach_campaigns: the top-level object
------------------------------------------------------------------------------
create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_run_id uuid not null references public.scan_runs (id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists idx_outreach_campaigns_user
  on public.outreach_campaigns (user_id, created_at desc);
create index if not exists idx_outreach_campaigns_status
  on public.outreach_campaigns (status) where status = 'active';

alter table public.outreach_campaigns enable row level security;

drop policy if exists "Users read own outreach campaigns" on public.outreach_campaigns;
create policy "Users read own outreach campaigns"
  on public.outreach_campaigns for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own outreach campaigns" on public.outreach_campaigns;
create policy "Users insert own outreach campaigns"
  on public.outreach_campaigns for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own outreach campaigns" on public.outreach_campaigns;
create policy "Users update own outreach campaigns"
  on public.outreach_campaigns for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own outreach campaigns" on public.outreach_campaigns;
create policy "Users delete own outreach campaigns"
  on public.outreach_campaigns for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins read all outreach campaigns" on public.outreach_campaigns;
create policy "Admins read all outreach campaigns"
  on public.outreach_campaigns for select
  using (public.is_admin());

------------------------------------------------------------------------------
-- 2. outreach_steps: the sequence of emails within a campaign
--    step_order=1 sends immediately when prospect enters the campaign.
--    delay_days on step N is the gap AFTER step N-1 sends.
------------------------------------------------------------------------------
create table if not exists public.outreach_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns (id) on delete cascade,
  step_order integer not null check (step_order >= 1),
  delay_days integer not null default 0 check (delay_days >= 0),
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, step_order)
);

create index if not exists idx_outreach_steps_campaign
  on public.outreach_steps (campaign_id, step_order);

alter table public.outreach_steps enable row level security;

drop policy if exists "Users read own outreach steps" on public.outreach_steps;
create policy "Users read own outreach steps"
  on public.outreach_steps for select
  using (
    exists (
      select 1 from public.outreach_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users write own outreach steps" on public.outreach_steps;
create policy "Users write own outreach steps"
  on public.outreach_steps for all
  using (
    exists (
      select 1 from public.outreach_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.outreach_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Admins read all outreach steps" on public.outreach_steps;
create policy "Admins read all outreach steps"
  on public.outreach_steps for select
  using (public.is_admin());

------------------------------------------------------------------------------
-- 3. outreach_prospects: per-recipient state machine
--    current_step = highest step already sent (0 = nothing yet).
--    next_send_at = when the (current_step + 1) step should fire.
--    Status transitions:
--      pending  → in_progress (after first send)
--      in_progress → completed (when all steps sent)
--      any  → replied / bounced (terminal; tick stops sending)
------------------------------------------------------------------------------
create table if not exists public.outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'replied', 'bounced', 'completed', 'failed')),
  current_step integer not null default 0,
  next_send_at timestamptz,
  last_sent_at timestamptz,
  added_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

create index if not exists idx_outreach_prospects_campaign
  on public.outreach_prospects (campaign_id);
create index if not exists idx_outreach_prospects_due
  on public.outreach_prospects (next_send_at)
  where status in ('pending', 'in_progress');

alter table public.outreach_prospects enable row level security;

drop policy if exists "Users read own prospects" on public.outreach_prospects;
create policy "Users read own prospects"
  on public.outreach_prospects for select
  using (
    exists (
      select 1 from public.outreach_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users write own prospects" on public.outreach_prospects;
create policy "Users write own prospects"
  on public.outreach_prospects for all
  using (
    exists (
      select 1 from public.outreach_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.outreach_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Admins read all prospects" on public.outreach_prospects;
create policy "Admins read all prospects"
  on public.outreach_prospects for select
  using (public.is_admin());

------------------------------------------------------------------------------
-- 4. Extend email_sends so the scheduler can attribute every send to its
--    campaign + step. Backfilled NULL for legacy one-shot sends.
------------------------------------------------------------------------------
alter table public.email_sends
  add column if not exists campaign_id uuid references public.outreach_campaigns (id) on delete set null;

alter table public.email_sends
  add column if not exists step_order integer;

create index if not exists idx_email_sends_campaign
  on public.email_sends (campaign_id, created_at desc);
