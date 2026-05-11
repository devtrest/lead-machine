-- Reserve N credits up front (one per lead requested), and refund the unused
-- portion at the end of a scan. Both functions are SECURITY DEFINER and
-- self-targeted (auth.uid()) so users can only modify their own credits.
-- Safe to re-run.

create or replace function public.reserve_search_credits(amount int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if amount is null or amount < 1 then
    return false;
  end if;
  perform set_config('app.allow_credit_mut', '1', true);
  update public.profiles
  set credits = credits - amount, updated_at = now()
  where id = auth.uid() and credits >= amount;
  perform set_config('app.allow_credit_mut', '', true);
  return found;
end;
$$;

grant execute on function public.reserve_search_credits(int) to authenticated;

create or replace function public.refund_search_credits(amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if amount is null or amount < 1 then
    return;
  end if;
  perform set_config('app.allow_credit_mut', '1', true);
  update public.profiles
  set credits = credits + amount, updated_at = now()
  where id = auth.uid();
  perform set_config('app.allow_credit_mut', '', true);
end;
$$;

grant execute on function public.refund_search_credits(int) to authenticated;
