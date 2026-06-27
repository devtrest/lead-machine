-- Make deleting an outreach campaign always succeed.
--
-- email_sends and outreach_replies both carry a campaign_id that should become
-- NULL when the parent campaign is deleted (we keep the historical send/reply
-- rows, just detached). If those FKs were created as RESTRICT/NO ACTION in a
-- given database, deleting a campaign that has any sends or replies fails with
-- a foreign-key violation — which is exactly the "Delete does nothing" symptom.
--
-- This drops and recreates both constraints as ON DELETE SET NULL. It's a safe
-- no-op if they're already correct. Idempotent — re-runnable.

alter table public.email_sends
  drop constraint if exists email_sends_campaign_id_fkey;
alter table public.email_sends
  add constraint email_sends_campaign_id_fkey
  foreign key (campaign_id)
  references public.outreach_campaigns (id)
  on delete set null;

alter table public.outreach_replies
  drop constraint if exists outreach_replies_campaign_id_fkey;
alter table public.outreach_replies
  add constraint outreach_replies_campaign_id_fkey
  foreign key (campaign_id)
  references public.outreach_campaigns (id)
  on delete set null;
