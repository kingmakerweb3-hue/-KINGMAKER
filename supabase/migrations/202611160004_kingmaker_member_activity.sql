-- Private, bounded mining activity history for the signed-in member.
create or replace function public.get_kingmaker_member_activity()
returns table (
  session_id uuid,
  started_at timestamptz,
  ends_at timestamptz,
  claimed_at timestamptz,
  session_status text,
  credited_crown numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  return query
  select s.id, s.started_at, s.ends_at, s.claimed_at, s.status, l.amount
  from public.mining_sessions s
  left join public.crown_ledger l
    on l.session_id = s.id and l.user_id = v_user and l.entry_type = 'mining_reward'
  where s.user_id = v_user
  order by s.started_at desc
  limit 20;
end;
$$;

revoke all on function public.get_kingmaker_member_activity() from public;
grant execute on function public.get_kingmaker_member_activity() to authenticated;

-- Do not show an expired, unclaimed session as currently active in the dashboard.
create or replace function public.get_kingmaker_member_dashboard()
returns table (
  referral_count bigint,
  sessions_total bigint,
  sessions_claimed bigint,
  active_session_ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  return query
  select
    (select count(*) from public.kingmaker_profiles p where p.referred_by = v_user),
    (select count(*) from public.mining_sessions s where s.user_id = v_user),
    (select count(*) from public.mining_sessions s where s.user_id = v_user and s.status = 'claimed'),
    (select s.ends_at from public.mining_sessions s
      where s.user_id = v_user and s.status = 'active' and s.ends_at > now()
      order by s.started_at desc limit 1);
end;
$$;

revoke all on function public.get_kingmaker_member_dashboard() from public;
grant execute on function public.get_kingmaker_member_dashboard() to authenticated;
