-- KINGMAKER pilot reward correction.
-- Initial pilot rule: 100 CROWN/hour x 6 hours = 600 CROWN
-- for one fully completed session. The optional 10% bonus is disabled.
-- This affects sessions started after this migration; existing sessions
-- keep the reward_rate snapshotted when they started.
update public.mining_config
set enabled = true,
    session_seconds = 21600,
    crown_per_hour = 100,
    updated_at = now()
where id = true;
