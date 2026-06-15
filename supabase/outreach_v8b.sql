-- Outreach v8b: extend delay_unit to allow 'minutes'.
-- Postgres doesn't have an "extend check constraint" syntax, so we drop +
-- re-add. Safe to run before or after v8 — the IF EXISTS guards both paths.

alter table public.outreach_steps
  drop constraint if exists outreach_steps_delay_unit_check;

alter table public.outreach_steps
  add constraint outreach_steps_delay_unit_check
  check (delay_unit in ('minutes', 'hours', 'days'));
