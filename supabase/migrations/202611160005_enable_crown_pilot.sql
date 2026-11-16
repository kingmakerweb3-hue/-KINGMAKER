-- Historical pilot configuration retained for migration continuity.
-- Mining must remain disabled until production backend security and end-to-end
-- tests are complete. This migration must never activate member rewards.
-- CROWN is an off-chain participation ledger balance, not a withdrawable token.
update public.mining_config
set enabled = false,
    session_seconds = 21600,
    crown_per_hour = 100,
    updated_at = now()
where id = true;
