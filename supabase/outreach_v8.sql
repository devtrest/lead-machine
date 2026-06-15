-- Outreach v8: per-step delay unit.
-- Adds a 'days' | 'hours' selector for the follow-up wait so users can
-- schedule fast-follow-up cadences (e.g. "send follow-up 1 hour later")
-- instead of being locked to multi-day waits.
-- Run AFTER outreach_v7.sql. Idempotent.

alter table public.outreach_steps
  add column if not exists delay_unit text not null default 'days'
  check (delay_unit in ('days', 'hours'));
