-- Outreach v5: incoming replies (Unibox).
-- Run AFTER outreach_v4.sql. Idempotent.

-- Track when we last polled each sender's IMAP so we don't re-fetch the
-- whole inbox every tick.
alter table public.outreach_senders
  add column if not exists last_inbox_check_at timestamptz;

-- Every detected reply from a lead lands here. Matched to a prospect by
-- "from address" against outreach_prospects.email scoped to the same user.
-- We also record the raw message-id so we can dedupe across re-checks.
create table if not exists public.outreach_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sender_id uuid references public.outreach_senders (id) on delete set null,
  prospect_id uuid references public.outreach_prospects (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  campaign_id uuid references public.outreach_campaigns (id) on delete set null,
  message_id text,           -- RFC 822 Message-ID header, used for dedup
  from_email text not null,
  from_name text,
  subject text,
  snippet text,              -- first ~500 chars of the body
  received_at timestamptz not null,
  read_at timestamptz,       -- when the user marked it read in the Unibox
  created_at timestamptz not null default now(),
  unique (sender_id, message_id)
);

create index if not exists idx_outreach_replies_user_received
  on public.outreach_replies (user_id, received_at desc);
create index if not exists idx_outreach_replies_prospect
  on public.outreach_replies (prospect_id);
create index if not exists idx_outreach_replies_campaign
  on public.outreach_replies (campaign_id, received_at desc);

alter table public.outreach_replies enable row level security;

drop policy if exists "Users read own replies" on public.outreach_replies;
create policy "Users read own replies"
  on public.outreach_replies for select
  using (auth.uid() = user_id);

drop policy if exists "Users update own replies" on public.outreach_replies;
create policy "Users update own replies"
  on public.outreach_replies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Inserts come from the worker (service role), so no insert policy for users.
