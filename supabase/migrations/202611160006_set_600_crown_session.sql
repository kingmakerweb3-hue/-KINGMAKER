-- KINGMAKER CROWN pilot reward adjustment.
-- 100 CROWN per hour x exactly 6 hours = 600 CROWN per completed session.
-- Applies to sessions started after this configuration update; existing sessions
-- retain the reward rate snapshotted when they began.
update public.mining_config
set enabled = true,
    session_seconds = 21600,
    crown_per_hour = 100,
    updated_at = now()
where id = true;
