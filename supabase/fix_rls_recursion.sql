-- =====================================================================
-- Fixes RLS recursion AND “policy already exists” from partial runs.
-- Drops EVERY policy on public.profiles + public.enterprise_requests, then rebuilds.
-- Select ALL → Run once (Ctrl+A in SQL Editor).
-- =====================================================================

do $$
declare
  r record;
begin
  for r in (
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'enterprise_requests')
  ) loop
    execute format(
      'drop policy if exists %I on public.%I',
      r.policyname,
      r.tablename
    );
  end loop;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins update any profile"
  on public.profiles for update
  using (public.is_admin());

create policy "Insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Admins read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Users insert enterprise request"
  on public.enterprise_requests for insert
  with check (auth.uid() = user_id);

create policy "Users read own enterprise requests"
  on public.enterprise_requests for select
  using (auth.uid() = user_id);

create policy "Admins read all enterprise requests"
  on public.enterprise_requests for select
  using (public.is_admin());

create or replace function public.lock_sensitive_profile_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and auth.uid() is not null
     and coalesce(public.is_admin(), false) is false then
    new.role := old.role;
    new.email := old.email;
    if coalesce(current_setting('app.allow_credit_mut', true), '') <> '1' then
      new.credits := old.credits;
    end if;
    if new.plan = 'enterprise' and old.plan is distinct from 'enterprise' then
      new.plan := old.plan;
    end if;
  end if;
  return new;
end;
$$;
