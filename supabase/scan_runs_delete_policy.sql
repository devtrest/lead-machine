-- Allow users to delete their own scan runs (lead scrapes).
--
-- scan_runs shipped with read / insert / update RLS policies but NO delete
-- policy, so a user's DELETE was silently blocked by RLS: 0 rows removed, no
-- error returned — the UI showed "Scrape deleted" while the row stayed put.
--
-- Deleting a scan_run cascades through its FK chain (leads → lead_contacts,
-- and outreach_campaigns → steps/prospects/senders) so the run and everything
-- derived from it go together. Idempotent — safe to re-run.

drop policy if exists "Users delete own scan runs" on public.scan_runs;
create policy "Users delete own scan runs"
  on public.scan_runs for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins delete all scan runs" on public.scan_runs;
create policy "Admins delete all scan runs"
  on public.scan_runs for delete
  using (public.is_admin());
