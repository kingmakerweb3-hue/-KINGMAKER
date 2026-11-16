-- KINGMAKER controlled CROWN pilot activation.
-- Initial pilot rate: 1 off-chain CROWN ledger credit per hour.
-- Each completed six-hour session credits 6 CROWN.
-- This is an internal, off-chain participation balance, not a token,
-- cash equivalent, withdrawal right, or promise of future conversion.
-- Operators can pause new sessions by setting enabled=false.
update public.mining_config
set enabled = true,
    session_seconds = 21600,
    crown_per_hour = 1,
    updated_at = now()
where id = true;
