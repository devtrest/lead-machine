-- Lead socials: store the business's social profile URLs harvested off its
-- website (find_emails.py captures facebook/instagram/twitter/linkedin links
-- from the homepage). Run AFTER add_scan_lead_tables.sql. Idempotent.
--
-- One set of socials per business, so these live on `leads` (not the
-- per-contact `lead_contacts` table). No RLS changes needed — `leads` already
-- scopes by user_id and the worker writes with the service role.

alter table public.leads
  add column if not exists facebook_url text;
alter table public.leads
  add column if not exists instagram_url text;
alter table public.leads
  add column if not exists twitter_url text;
alter table public.leads
  add column if not exists linkedin_url text;
