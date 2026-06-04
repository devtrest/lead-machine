-- Outreach v2 additions: send-window scheduling + retry/bounce tracking.
-- Run AFTER supabase/outreach_campaigns.sql. Idempotent.

------------------------------------------------------------------------------
-- Campaign-level send scheduling. Default: 9am-5pm weekdays in UTC.
-- The Railway tick checks current time against these before each send so
-- you don't get flagged for sending at 3am or on Sundays.
------------------------------------------------------------------------------
alter table public.outreach_campaigns
  add column if not exists send_window_start text not null default '09:00';
alter table public.outreach_campaigns
  add column if not exists send_window_end text not null default '17:00';
alter table public.outreach_campaigns
  add column if not exists send_days text[] not null
    default array['mon','tue','wed','thu','fri'];
alter table public.outreach_campaigns
  add column if not exists timezone text not null default 'UTC';

------------------------------------------------------------------------------
-- Per-prospect retry / bounce tracking. retry_count bumps on transient
-- failures; after 3 we flip status='bounced' with the last error in
-- bounce_reason so the user can see what went wrong.
------------------------------------------------------------------------------
alter table public.outreach_prospects
  add column if not exists retry_count integer not null default 0;
alter table public.outreach_prospects
  add column if not exists bounce_reason text;
