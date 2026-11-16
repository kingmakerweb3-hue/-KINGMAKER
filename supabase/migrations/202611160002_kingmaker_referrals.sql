-- KINGMAKER member referral identity (no automatic financial rewards).
-- A referral is attribution only; any future bonus requires separately published rules.
create or replace function public.get_kingmaker_referral_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  insert into public.kingmaker_profiles(user_id)
  values(v_user) on conflict (user_id) do nothing;
  select referral_code into v_code
    from public.kingmaker_profiles where user_id=v_user;
  return v_code;
end;
$$;

create or replace function public.apply_kingmaker_referral(p_referral_code text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_referrer uuid;
  v_existing uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_referral_code is null or length(trim(p_referral_code)) < 5 then
    raise exception 'Enter a valid referral code';
  end if;
  insert into public.kingmaker_profiles(user_id)
  values(v_user) on conflict (user_id) do nothing;
  select user_id into v_referrer
    from public.kingmaker_profiles
    where referral_code=upper(trim(p_referral_code));
  if v_referrer is null then raise exception 'Referral code not found'; end if;
  if v_referrer=v_user then raise exception 'You cannot use your own referral code'; end if;
  select referred_by into v_existing
    from public.kingmaker_profiles where user_id=v_user for update;
  if v_existing is not null then raise exception 'A referral has already been applied'; end if;
  update public.kingmaker_profiles
    set referred_by=v_referrer where user_id=v_user and referred_by is null;
  if not found then raise exception 'Referral could not be applied'; end if;
  return true;
end;
$$;

revoke all on function public.get_kingmaker_referral_code() from public;
revoke all on function public.apply_kingmaker_referral(text) from public;
grant execute on function public.get_kingmaker_referral_code() to authenticated;
grant execute on function public.apply_kingmaker_referral(text) to authenticated;
