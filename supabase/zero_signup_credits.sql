-- Remove the 10-credit signup grant.
--
-- Original: profiles.credits defaulted to 10 so brand-new accounts could
-- generate their first 10 leads without paying. With the new $7 trial model
-- (item 24 in the revision pass), users land at ZERO credits — the only
-- ways to get credits are the $7/100-credit trial, or buying a plan outright.
-- Removes the "free leads" loophole and aligns the credit balance with the
-- onboarding plan picker that shows on first sign-in.
--
-- Run this AFTER schema.sql is already applied. It's idempotent — re-running
-- after the default is already 0 is a no-op. Existing user balances are NOT
-- touched (you wouldn't want to claw credits back from paying customers).
-- If you want to reset existing trial / freebie balances too, run that as
-- a separate manual statement.

alter table public.profiles
  alter column credits set default 0;
