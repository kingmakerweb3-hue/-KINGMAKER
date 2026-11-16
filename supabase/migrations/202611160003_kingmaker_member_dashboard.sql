-- Private, read-only member dashboard. All counts are scoped to auth.uid().
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
      where s.user_id = v_user and s.status = 'active'
      order by s.started_at desc limit 1);
end;
$$;

revoke all on function public.get_kingmaker_member_dashboard() from public;
grant execute on function public.get_kingmaker_member_dashboard() to authenticated;
