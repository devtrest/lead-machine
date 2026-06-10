-- Trial subscriptions: $1 for 100 credits / 3 days, then auto-charge the
-- selected full plan via Stripe off-session PaymentIntent on the saved card.
-- Safe to re-run.

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.profiles
  add column if not exists trial_started_at timestamptz;

alter table public.profiles
  add column if not exists trial_ends_at timestamptz;

-- Which plan we'll auto-charge after the 3-day window: starter/premium/pro.
alter table public.profiles
  add column if not exists trial_target_plan text
    check (trial_target_plan in ('starter','premium','pro') or trial_target_plan is null);

-- Trial conversion state machine:
--   null              = no trial ever (default for legacy users)
--   'active'          = $1 paid, 100 credits granted, waiting for conversion
--   'converted'       = full plan charged, credits granted, all-paid customer
--   'failed'          = auto-charge failed (card declined / expired / etc.)
--   'cancelled'       = user cancelled before conversion (no charge)
alter table public.profiles
  add column if not exists trial_status text
    check (trial_status in ('active','converted','failed','cancelled') or trial_status is null);

-- Last error from a failed conversion charge so admins can debug.
alter table public.profiles
  add column if not exists trial_last_error text;

-- Index for the worker's "find trials due for conversion" sweep — partial on
-- the small set of active trials only, so the sweep stays fast at scale.
create index if not exists idx_profiles_trial_due
  on public.profiles (trial_ends_at)
  where trial_status = 'active' and stripe_customer_id is not null;
