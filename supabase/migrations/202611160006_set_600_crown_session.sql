-- KINGMAKER CROWN pilot reward adjustment.
-- 110 CROWN per hour x exactly 6 hours = 660 CROWN per completed session.
-- The 10% session bonus is included in the effective hourly rate.
-- Applies to sessions started after this configuration update; existing sessions
-- retain the reward rate snapshotted when they began.
update public.mining_config
set enabled = true,
    session_seconds = 21600,
    crown_per_hour = 110,
    updated_at = now()
where id = true;
