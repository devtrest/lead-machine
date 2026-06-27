 \\\\\\\\\\\\-- Outreach v3 additions: multi-sender accounts, open tracking, campaign↔
-- sender mapping. Run AFTER outreach_v2.sql. Idempotent.

------------------------------------------------------------------------------
-- 1. outreach_senders: per-user Gmail (or other SMTP) accounts the user has
--    connected. The tick rotates across enabled senders for a campaign.
--    app_password is stored encrypted-at-rest by Supabase's pgsodium when
--    enabled; for now we trust Supabase's encryption-at-rest defaults.
------------------------------------------------------------------------------
create table if not exists public.outreach_senders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  provider text not null default 'gmail' check (provider in ('gmail', 'smtp')),
  app_password text not null,
  daily_limit integer not null default 100,
  sends_today integer not null default 0,
  last_reset_at date not null default current_date,
  status text not null default 'active' check (status in ('active', 'paused', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, email)
);

create index if not exists idx_outreach_senders_user
  on public.outreach_senders (user_id, status);

alter table public.outreach_senders enable row level security;

drop policy if exists "Users read own senders" on public.outreach_senders;
create policy "Users read own senders"
  on public.outreach_senders for select
  using (auth.uid() = user_id);

drop policy if exists "Users write own senders" on public.outreach_senders;
create policy "Users write own senders"
  on public.outreach_senders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

------------------------------------------------------------------------------
-- 2. outreach_campaign_senders: which senders are enabled for which campaign.
--    Tick picks the sender with the most daily-limit headroom on each send.
------------------------------------------------------------------------------
create table if not exists public.outreach_campaign_senders (
  campaign_id uuid not null references public.outreach_campaigns (id) on delete cascade,
  sender_id uuid not null references public.outreach_senders (id) on delete cascade,
  primary key (campaign_id, sender_id)
);

create index if not exists idx_campaign_senders_campaign
  on public.outreach_campaign_senders (campaign_id);

alter table public.outreach_campaign_senders enable row level security;

drop policy if exists "Users read own campaign senders"
  on public.outreach_campaign_senders;
create policy "Users read own campaign senders"
  on public.outreach_campaign_senders for select
  using (
    exists (
      select 1 from public.outreach_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users write own campaign senders"
  on public.outreach_campaign_senders;
create policy "Users write own campaign senders"
  on public.outreach_campaign_senders for all
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

------------------------------------------------------------------------------
-- 3. Open tracking. Each send gets a unique token; outbound HTML embeds
--    <img src=".../api/track/open/{token}"> which records a row in
--    email_opens on first fetch. open_count on email_sends is a counter
--    we increment.
--    Caveat: Gmail proxies / image caching makes opens unreliable. We
--    surface it as "opened at least once" not "opens=N".
------------------------------------------------------------------------------
alter table public.email_sends
  add column if not exists open_token text;
alter table public.email_sends
  add column if not exists open_count integer not null default 0;
alter table public.email_sends
  add column if not exists first_opened_at timestamptz;

create unique index if not exists idx_email_sends_open_token
  on public.email_sends (open_token)
  where open_token is not null;

create table if not exists public.email_opens (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references public.email_sends (id) on delete cascade,
  opened_at timestamptz not null default now(),
  ip text,
  user_agent text
);

create index if not exists idx_email_opens_send
  on public.email_opens (send_id, opened_at desc);

alter table public.email_opens enable row level security;

drop policy if exists "Users read own opens" on public.email_opens;
create policy "Users read own opens"
  on public.email_opens for select
  using (
    exists (
      select 1 from public.email_sends s
      where s.id = send_id and s.user_id = auth.uid()
    )
  );

-- Inserts to email_opens come from the tracking endpoint with the service
-- role key, so no insert policy is needed for end users.
