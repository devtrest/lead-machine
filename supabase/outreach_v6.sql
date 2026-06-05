-- Outreach v6: allow email_sends.lead_id to be null + broaden inbox match.
-- Run AFTER outreach_v5.sql. Idempotent.

-- Test sends (and one-off sends not tied to a scraped lead) need lead_id
-- nullable. The FK already cascades on delete; nullable is the only change.
alter table public.email_sends
  alter column lead_id drop not null;
