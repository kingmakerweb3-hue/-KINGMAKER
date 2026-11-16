-- KINGMAKER mining backend foundation
-- Apply with Supabase SQL Editor after creating a Supabase project.
-- Rewards remain disabled until an operator explicitly configures a rate and deploys this schema.
create extension if not exists pgcrypto;

create table if not exists public.kingmaker_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  referral_code text unique not null default upper(substr(encode(gen_random_bytes(8),'hex'),1,10)),
  referred_by uuid references public.kingmaker_profiles(user_id),
  created_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[A-Za-z0-9_]{3,24}$'),
  constraint no_self_referral check (referred_by is null or referred_by <> user_id)
);

create table if not exists public.mining_config (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  session_seconds integer not null default 21600 check (session_seconds = 21600),
  crown_per_hour numeric(20,8) not null default 0 check (crown_per_hour >= 0),
  updated_at timestamptz not null default now()
);
insert into public.mining_config(id) values (true) on conflict (id) do nothing;

create table if not exists public.mining_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  claimed_at timestamptz,
  status text not null default 'active' check (status in ('active','claimed')),
  reward numeric(28,8),
  created_at timestamptz not null default now(),
  constraint valid_session_window check (ends_at = started_at + interval '6 hours'),
  constraint nonnegative_reward check (reward is null or reward >= 0)
);
alter table public.mining_sessions add column if not exists status text not null default 'active';
update public.mining_sessions set status = case when claimed_at is null then 'active' else 'claimed' end;
alter table public.mining_sessions drop constraint if exists mining_sessions_status_check;
alter table public.mining_sessions add constraint mining_sessions_status_check check (status in ('active','claimed'));

create unique index if not exists one_open_mining_session_per_user
  on public.mining_sessions(user_id) where claimed_at is null;

create table if not exists public.crown_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid unique references public.mining_sessions(id),
  entry_type text not null check (entry_type in ('mining_reward','admin_adjustment','reversal')),
  amount numeric(28,8) not null check (amount <> 0),
  created_at timestamptz not null default now()
);

alter table public.kingmaker_profiles enable row level security;
alter table public.mining_config enable row level security;
alter table public.mining_sessions enable row level security;
alter table public.crown_ledger enable row level security;

create policy "profile owner can read" on public.kingmaker_profiles for select using (auth.uid() = user_id);
create policy "profile owner can create" on public.kingmaker_profiles for insert with check (auth.uid() = user_id and referred_by is null);
create policy "config readable" on public.mining_config for select using (true);
create policy "users read own sessions" on public.mining_sessions for select using (auth.uid() = user_id);
create policy "users read own ledger" on public.crown_ledger for select using (auth.uid() = user_id);
-- No client-side insert/update/delete policies: all reward/session writes go through SECURITY DEFINER functions.

create or replace function public.start_kingmaker_mining()
returns public.mining_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_cfg public.mining_config%rowtype;
  v_session public.mining_sessions%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_cfg from public.mining_config where id = true;
  if not coalesce(v_cfg.enabled,false) or v_cfg.crown_per_hour <= 0 then
    raise exception 'Mining is not enabled by the KINGMAKER operator';
  end if;
  if exists (select 1 from public.mining_sessions where user_id=v_user and claimed_at is null and ends_at > now()) then
    raise exception 'A six-hour mining session is already active';
  end if;
  -- Expired, unclaimed sessions must be claimed before another session starts.
  if exists (select 1 from public.mining_sessions where user_id=v_user and claimed_at is null) then
    raise exception 'Claim your completed session before starting another';
  end if;
  insert into public.mining_sessions(user_id,started_at,ends_at)
  values(v_user,now(),now()+make_interval(secs=>v_cfg.session_seconds))
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
  if v_session.claimed_at is not null then raise exception 'Session already claimed'; end if;
  if now() < v_session.ends_at then raise exception 'Six-hour session is not complete'; end if;
  select crown_per_hour into v_rate from public.mining_config where id=true and enabled=true;
  if coalesce(v_rate,0) <= 0 then raise exception 'Mining rewards are currently disabled'; end if;
  v_reward := round(v_rate * 6,8);
  update public.mining_sessions set claimed_at=now(), status='claimed', reward=v_reward where id=p_session_id;
  insert into public.crown_ledger(user_id,session_id,entry_type,amount)
  values(v_user,p_session_id,'mining_reward',v_reward);
  return v_reward;
end;
$$;

revoke all on function public.start_kingmaker_mining() from public;
revoke all on function public.claim_kingmaker_mining(uuid) from public;
grant execute on function public.start_kingmaker_mining() to authenticated;
grant execute on function public.claim_kingmaker_mining(uuid) to authenticated;
grant select on public.kingmaker_profiles, public.mining_config, public.mining_sessions, public.crown_ledger to authenticated;
