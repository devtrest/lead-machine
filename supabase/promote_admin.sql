-- Run in Supabase SQL Editor (postgres role).
-- 1) Fixes trigger so Dashboard SQL can set role = admin (auth.uid() is null there).
-- 2) Promotes ONE login — use the SAME email you sign into the app with.

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

-- Change email to the account you use on localhost:
update public.profiles
set role = 'admin'
where email = 'umarzaman6869@gmail.com';
