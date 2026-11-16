-- Historical reward-rate adjustment retained for migration continuity.
-- The intended session rate is 100 CROWN/hour x 6 hours = 600 CROWN.
-- Mining remains disabled until production backend security and end-to-end
-- tests are complete. Existing sessions retain their snapshotted rate.
update public.mining_config
set enabled = false,
    session_seconds = 21600,
    crown_per_hour = 100,
    updated_at = now()
where id = true;
