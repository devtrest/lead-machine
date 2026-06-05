-- Outreach v7: full Unibox feature set.
-- Star, categorize, archive, and add notes to incoming replies.
-- Run AFTER outreach_v6.sql. Idempotent.

alter table public.outreach_replies
  add column if not exists starred boolean not null default false;

alter table public.outreach_replies
  add column if not exists category text
  check (category in (
    'interested',
    'meeting_booked',
    'not_interested',
    'out_of_office',
    'unsubscribe',
    'wrong_person',
    'other'
  ));

alter table public.outreach_replies
  add column if not exists archived_at timestamptz;

alter table public.outreach_replies
  add column if not exists notes text;

-- Partial indexes — small write overhead, fast filter queries.
create index if not exists idx_outreach_replies_starred
  on public.outreach_replies (user_id, received_at desc)
  where starred = true;

create index if not exists idx_outreach_replies_category
  on public.outreach_replies (user_id, category, received_at desc)
  where category is not null;

create index if not exists idx_outreach_replies_archived
  on public.outreach_replies (user_id, archived_at)
  where archived_at is not null;
