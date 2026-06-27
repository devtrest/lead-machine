-- Per-sender attribution for outreach sends.
--
-- Until now email_sends recorded WHAT was sent (recipient, subject, status,
-- opens) but not WHICH connected sender mailbox sent it. This adds sender_id
-- so the campaign detail page can show a per-sender breakdown (how many emails
-- each mailbox sent, to whom, opens, replies).
--
-- Nullable + ON DELETE SET NULL: sends made before this migration (and sends
-- where the sender was later disconnected) keep their row but show as an
-- "unknown sender" bucket in the UI. Idempotent — safe to re-run.

alter table public.email_sends
  add column if not exists sender_id uuid
    references public.outreach_senders (id) on delete set null;

create index if not exists email_sends_sender_id_idx
  on public.email_sends (sender_id);
