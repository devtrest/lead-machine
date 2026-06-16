-- subscriptions.sql — pivot from one-time lifetime packs to monthly Stripe
-- subscriptions with a $1 / 3-day trial, monthly credit grants that ROLL OVER
-- (credits are never reset, only added), an onboarding gate, and the
-- "activate early / cancel at period end" lifecycle.
--
-- Idempotent: safe to re-run. Run AFTER trial_subscriptions.sql + zero_signup_credits.sql.

-- 1) Allow the new 'growth' plan slug alongside the existing ones.
--    (We keep 'premium' in the check for backward-compat with old rows.)
alter table public.profiles
  drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('starter', 'premium', 'growth', 'pro', 'enterprise'));

-- 2) Subscription lifecycle columns (Stripe is the source of truth; these mirror it).
alter table public.profiles
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,            -- trialing | active | past_due | canceled | null
  add column if not exists current_period_end timestamptz,      -- when the next charge / period boundary is
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists monthly_credit_grant integer not null default 0; -- credits added each paid invoice

-- 3) Onboarding gate. New users must start a trial + answer questions before
--    reaching the dashboard. Existing users are backfilled as already onboarded.
alter table public.profiles
  add column if not exists onboarded boolean not null default false,
  add column if not exists onboarding_answers jsonb;

-- Backfill: anyone created before this migration should NOT be forced through
-- onboarding. New signups get onboarded=false via the column default.
update public.profiles
  set onboarded = true
  where onboarded = false
    and created_at < now();

-- 4) Index for the subscription renewal sweep / due lookups.
create index if not exists idx_profiles_subscription
  on public.profiles (subscription_status, current_period_end)
  where stripe_subscription_id is not null;

-- 5) credit_grants — an audit trail of monthly grants so we can show
--    "monthly credits" vs "lifetime/top-up credits" and dedupe webhook
--    re-deliveries by Stripe invoice id.
create table if not exists public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  kind text not null check (kind in ('trial', 'subscription', 'topup', 'manual')),
  stripe_invoice_id text,           -- set for subscription invoices; used for idempotency
  stripe_payment_intent_id text,    -- set for one-time top-ups / trial
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_credit_grants_invoice
  on public.credit_grants (stripe_invoice_id)
  where stripe_invoice_id is not null;
create index if not exists idx_credit_grants_user
  on public.credit_grants (user_id, created_at desc);

alter table public.credit_grants enable row level security;

drop policy if exists "Users read own credit grants" on public.credit_grants;
create policy "Users read own credit grants" on public.credit_grants
  for select using (auth.uid() = user_id);

drop policy if exists "Admins read all credit grants" on public.credit_grants;
create policy "Admins read all credit grants" on public.credit_grants
  for select using (public.is_admin());
-- Inserts happen via the service-role webhook only (bypasses RLS).
