-- Multi-provider sender support.
--
-- Previously: outreach_senders was Gmail-only. The smtp + imap hosts were
-- hardcoded in the worker + Vercel routes (smtp.gmail.com:465 / imap.gmail.com:993)
-- and the provider check constraint only allowed 'gmail' and 'smtp'.
--
-- This migration: add explicit smtp_host/smtp_port/smtp_secure/imap_host/
-- imap_port/imap_secure columns so a sender can describe any SMTP+IMAP
-- account — Outlook/Microsoft 365, Titan, Zoho, Yahoo, a custom domain
-- relay, or anything else. Code path stays the same; only the host strings
-- come from the row instead of constants.
--
-- The provider column is repurposed as a UI label / preset key so the
-- frontend can show 'Outlook' or 'Titan' instead of just 'smtp'. It's no
-- longer a check-constrained enum.
--
-- Idempotent — re-runs are a no-op. Existing Gmail rows are backfilled with
-- the Gmail hosts so the worker and inbox-check don't trip over null values
-- after this migration runs but before the user reconnects.

alter table public.outreach_senders
  add column if not exists smtp_host text,
  add column if not exists smtp_port integer,
  add column if not exists smtp_secure boolean default true,
  add column if not exists imap_host text,
  add column if not exists imap_port integer,
  add column if not exists imap_secure boolean default true;

-- Drop the legacy provider check constraint — provider is now a free-form
-- label / preset key, not a strict enum.
alter table public.outreach_senders
  drop constraint if exists outreach_senders_provider_check;

-- Backfill the new host columns for any existing Gmail rows so the worker
-- + inbox-check don't have to special-case nulls during the rollout.
update public.outreach_senders
   set smtp_host = coalesce(smtp_host, 'smtp.gmail.com'),
       smtp_port = coalesce(smtp_port, 465),
       smtp_secure = coalesce(smtp_secure, true),
       imap_host = coalesce(imap_host, 'imap.gmail.com'),
       imap_port = coalesce(imap_port, 993),
       imap_secure = coalesce(imap_secure, true)
 where provider = 'gmail';
