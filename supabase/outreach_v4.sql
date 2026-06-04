-- Outreach v4: move daily send limit from per-sender to per-campaign.
-- Run AFTER outreach_v3.sql. Idempotent.
--
-- Rationale: Gmail's ~500/day per account is a HARD ceiling we enforce
-- silently at the sender level (no user choice needed). What the user
-- actually wants to control is the campaign-level pace: "this campaign
-- sends 50/day so we drip evenly over 2 weeks." So daily_limit moves up
-- to outreach_campaigns where it belongs.

alter table public.outreach_campaigns
  add column if not exists daily_limit integer not null default 50
  check (daily_limit between 1 and 500);
