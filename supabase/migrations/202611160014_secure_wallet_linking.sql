-- Secure, one-time EVM wallet ownership challenges for KINGMAKER members.
create table if not exists public.kingmaker_wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  nonce text not null unique,
  message text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists kingmaker_wallet_challenges_user_created
  on public.kingmaker_wallet_challenges(user_id, created_at desc);
alter table public.kingmaker_wallet_challenges enable row level security;
revoke all on public.kingmaker_wallet_challenges from public, anon, authenticated;

create table if not exists public.kingmaker_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_address text not null unique check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.kingmaker_wallets enable row level security;
revoke all on public.kingmaker_wallets from public, anon, authenticated;
create policy "members read own verified wallet"
  on public.kingmaker_wallets for select to authenticated
  using (auth.uid() = user_id);
grant select on public.kingmaker_wallets to authenticated;

create or replace function public.create_kingmaker_wallet_challenge(p_wallet_address text)
returns table(challenge_id uuid, nonce text, message text, expires_at timestamptz)
language plpgsql security definer
set search_path = pg_catalog, public, auth, extensions, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_address text := lower(p_wallet_address);
  v_nonce text := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires timestamptz := now() + interval '5 minutes';
  v_message text;
  v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_address !~ '^0x[0-9a-f]{40}$' then raise exception 'Invalid EVM wallet address'; end if;
  v_message := 'KINGMAKER CROWN Wallet Link' || E'\n' ||
    'Address: ' || v_address || E'\n' ||
    'Nonce: ' || v_nonce || E'\n' ||
    'Expires: ' || to_char(v_expires at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  insert into public.kingmaker_wallet_challenges(user_id,wallet_address,nonce,message,expires_at)
    values(v_user,v_address,v_nonce,v_message,v_expires)
    returning id into v_id;
  return query select v_id,v_nonce,v_message,v_expires;
end;
$$;
revoke all on function public.create_kingmaker_wallet_challenge(text) from public, anon;
grant execute on function public.create_kingmaker_wallet_challenge(text) to authenticated;

-- Called only by the Edge Function using the service-role key after EIP-191 recovery.
create or replace function public.complete_kingmaker_wallet_link(
  p_user_id uuid, p_wallet_address text, p_nonce text
) returns void
language plpgsql security definer
set search_path = pg_catalog, public, auth, extensions, pg_temp
as $$
declare
  v_challenge public.kingmaker_wallet_challenges%rowtype;
  v_address text := lower(p_wallet_address);
begin
  if p_user_id is null or v_address !~ '^0x[0-9a-f]{40}$' then
    raise exception 'Invalid wallet link request';
  end if;
  select * into v_challenge
    from public.kingmaker_wallet_challenges
    where user_id = p_user_id and nonce = p_nonce
    for update;
  if not found or v_challenge.consumed_at is not null or v_challenge.expires_at <= now() then
    raise exception 'Wallet challenge is invalid, expired, or already used';
  end if;
  if v_challenge.wallet_address <> v_address then
    raise exception 'Wallet address does not match the signed challenge';
  end if;
  if exists (select 1 from public.kingmaker_wallets where wallet_address = v_address and user_id <> p_user_id) then
    raise exception 'This wallet is already linked to another KINGMAKER account';
  end if;
  insert into public.kingmaker_wallets(user_id,wallet_address,verified_at,updated_at)
    values(p_user_id,v_address,now(),now())
    on conflict (user_id) do update
      set wallet_address = excluded.wallet_address,
          verified_at = now(), updated_at = now();
  update public.kingmaker_wallet_challenges set consumed_at = now() where id = v_challenge.id;
end;
$$;
revoke all on function public.complete_kingmaker_wallet_link(uuid,text,text) from public, anon, authenticated;
grant execute on function public.complete_kingmaker_wallet_link(uuid,text,text) to service_role;
