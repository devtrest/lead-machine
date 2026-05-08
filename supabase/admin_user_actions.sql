-- Adds admin user-management capabilities: suspension flag + delete policy.
-- Safe to re-run.

-- 1. Suspended flag on profiles. Suspended users keep their data but the
--    middleware/layout can refuse access (we'll wire that next).
alter table public.profiles
  add column if not exists suspended boolean not null default false;

-- 2. Allow admins to delete any profile row. The cascade FK on auth.users
--    means this orphans the auth user (they can sign in but have no profile,
--    so the app's profile-missing screen kicks in). For full account deletion,
--    use Supabase auth admin API with service role.
drop policy if exists "Admins delete any profile" on public.profiles;
create policy "Admins delete any profile"
  on public.profiles for delete
  using (public.is_admin());
