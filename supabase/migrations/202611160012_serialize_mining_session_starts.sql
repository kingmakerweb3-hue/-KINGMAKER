-- Serialize session starts per authenticated member.
-- The unique partial index remains the final invariant; this lock makes
-- concurrent first-start/restart requests deterministic before session lookup.

create or replace function public.start_kingmaker_mining()
returns public.mining_sessions
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_cfg public.mining_config%rowtype;
  v_previous public.mining_sessions%rowtype;
  v_session public.mining_sessions%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  -- A transaction-scoped lock is released automatically on commit/rollback.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select * into v_cfg from public.mining_config where id = true;
  if not coalesce(v_cfg.enabled,false) or v_cfg.crown_per_hour <= 0 then
    raise exception 'Mining is not enabled by the KINGMAKER operator';
  end if;

  select * into v_previous
  from public.mining_sessions
  where user_id = v_user and status = 'active'
  order by started_at desc
  limit 1
  for update;

  if found then
    if v_previous.ends_at > now() then
      raise exception 'A six-hour mining session is already active';
    end if;
    update public.mining_sessions
       set status = 'expired'
     where id = v_previous.id and claimed_at is null;
  end if;

  insert into public.mining_sessions(user_id,started_at,ends_at,reward_rate)
  values(v_user,now(),now()+make_interval(secs=>v_cfg.session_seconds),v_cfg.crown_per_hour)
  returning * into v_session;

  return v_session;
end;
$$;
