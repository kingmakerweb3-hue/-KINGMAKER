-- KINGMAKER missed-session reset.
-- A player may claim a completed session until they start the next session.
-- If they start again without claiming, the old session is marked expired
-- and receives no CROWN. The next session always starts a fresh six-hour clock.

alter table public.mining_sessions
  drop constraint if exists mining_sessions_status_check;
alter table public.mining_sessions
  add constraint mining_sessions_status_check
  check (status in ('active','claimed','expired'));

drop index if exists public.one_open_mining_session_per_user;
create unique index one_open_mining_session_per_user
  on public.mining_sessions(user_id)
  where status = 'active';

create or replace function public.start_kingmaker_mining()
returns public.mining_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_cfg public.mining_config%rowtype;
  v_previous public.mining_sessions%rowtype;
  v_session public.mining_sessions%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

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
    -- Starting again without claiming forfeits the previous completed session.
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

create or replace function public.claim_kingmaker_mining(p_session_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.mining_sessions%rowtype;
  v_rate numeric(20,8);
  v_reward numeric(28,8);
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select * into v_session from public.mining_sessions
   where id=p_session_id and user_id=v_user for update;
  if not found then raise exception 'Mining session not found'; end if;
  if v_session.status = 'expired' then raise exception 'Session expired; no CROWN reward was issued'; end if;
  if v_session.claimed_at is not null or v_session.status = 'claimed' then
    raise exception 'Session already claimed';
  end if;
  if now() < v_session.ends_at then raise exception 'Six-hour session is not complete'; end if;

  v_rate := coalesce(v_session.reward_rate,0);
  if v_rate <= 0 then raise exception 'This session has no configured reward rate'; end if;
  v_reward := round(v_rate * 6,8);

  update public.mining_sessions
     set claimed_at=now(), status='claimed', reward=v_reward
   where id=p_session_id;

  insert into public.crown_ledger(user_id,session_id,entry_type,amount)
  values(v_user,p_session_id,'mining_reward',v_reward);

  return v_reward;
end;
$$;

revoke all on function public.start_kingmaker_mining() from public;
revoke all on function public.claim_kingmaker_mining(uuid) from public;
grant execute on function public.start_kingmaker_mining() to authenticated;
grant execute on function public.claim_kingmaker_mining(uuid) to authenticated;
