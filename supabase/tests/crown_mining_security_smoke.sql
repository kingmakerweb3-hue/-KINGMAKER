-- KINGMAKER CROWN mining staging security smoke test.
-- Read-only: safe to run in Supabase SQL Editor after all migrations.
-- Raises an exception if any required security invariant is missing.
do $audit$
declare
  v_enabled boolean;
  v_session_seconds integer;
  v_rpc_count integer;
  v_bad_rpc_count integer;
begin
  select enabled, session_seconds
    into v_enabled, v_session_seconds
  from public.mining_config
  where id = true;

  if not found then
    raise exception 'FAIL: mining_config singleton row is missing';
  end if;
  if v_enabled is distinct from false then
    raise exception 'FAIL: mining must remain disabled during staging security tests';
  end if;
  if v_session_seconds <> 21600 then
    raise exception 'FAIL: mining session must be exactly 21,600 seconds';
  end if;

  if has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE') then
    raise exception 'FAIL: anon/authenticated must not have CREATE on public schema';
  end if;
  if not has_schema_privilege('anon', 'public', 'USAGE')
     or not has_schema_privilege('authenticated', 'public', 'USAGE') then
    raise exception 'FAIL: client roles require USAGE on public schema';
  end if;

  if has_table_privilege('anon', 'public.kingmaker_profiles', 'INSERT')
     or has_table_privilege('authenticated', 'public.kingmaker_profiles', 'INSERT')
     or has_table_privilege('anon', 'public.mining_sessions', 'INSERT')
     or has_table_privilege('authenticated', 'public.mining_sessions', 'INSERT')
     or has_table_privilege('anon', 'public.crown_ledger', 'INSERT')
     or has_table_privilege('authenticated', 'public.crown_ledger', 'INSERT')
     or has_table_privilege('anon', 'public.crown_ledger', 'UPDATE')
     or has_table_privilege('authenticated', 'public.crown_ledger', 'UPDATE')
     or has_table_privilege('anon', 'public.crown_ledger', 'DELETE')
     or has_table_privilege('authenticated', 'public.crown_ledger', 'DELETE') then
    raise exception 'FAIL: client roles have direct write privileges on protected mining tables';
  end if;

  if not (
    (select relrowsecurity from pg_class where oid = 'public.kingmaker_profiles'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.mining_config'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.mining_sessions'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.crown_ledger'::regclass)
  ) then
    raise exception 'FAIL: RLS is not enabled on every protected mining table';
  end if;

  select count(*), count(*) filter (
    where not prosecdef
       or coalesce(array_to_string(proconfig, ','), '') not like
          '%search_path=pg_catalog, public, auth, extensions, pg_temp%'
  )
  into v_rpc_count, v_bad_rpc_count
  from pg_proc
  where oid in (
    'public.start_kingmaker_mining()'::regprocedure,
    'public.claim_kingmaker_mining(uuid)'::regprocedure,
    'public.get_kingmaker_crown_balance()'::regprocedure,
    'public.get_kingmaker_referral_code()'::regprocedure,
    'public.apply_kingmaker_referral(text)'::regprocedure,
    'public.get_kingmaker_member_dashboard()'::regprocedure,
    'public.get_kingmaker_member_activity()'::regprocedure
  );

  if v_rpc_count <> 7 or v_bad_rpc_count <> 0 then
    raise exception 'FAIL: expected seven SECURITY DEFINER RPCs with hardened search_path; found %, unsafe %',
      v_rpc_count, v_bad_rpc_count;
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'one_open_mining_session_per_user'
      and indexdef ilike '%where (status = ''active''::text)%'
  ) then
    raise exception 'FAIL: unique one-active-session-per-user index is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crown_ledger'::regclass
      and conname = 'crown_ledger_session_id_key'
      and contype = 'u'
  ) then
    raise exception 'FAIL: unique ledger session credit constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_kingmaker_auth_user_created'
      and not tgisinternal
  ) then
    raise exception 'FAIL: new-account profile provisioning trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.handle_kingmaker_new_auth_user()'::regprocedure
      and prosecdef
      and coalesce(array_to_string(proconfig, ','), '') like
          '%search_path=pg_catalog, public, extensions, pg_temp%'
  ) then
    raise exception 'FAIL: signup profile trigger function is not SECURITY DEFINER with a hardened search_path';
  end if;

  if has_function_privilege('anon', 'public.handle_kingmaker_new_auth_user()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.handle_kingmaker_new_auth_user()', 'EXECUTE') then
    raise exception 'FAIL: client roles must not invoke the signup trigger function directly';
  end if;

  raise notice 'PASS: CROWN mining staging security invariants verified. Mining remains disabled.';
end;
$audit$;
