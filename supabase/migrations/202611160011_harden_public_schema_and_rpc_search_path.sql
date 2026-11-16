-- CROWN mining security hardening.
-- Client roles need schema USAGE for PostgREST, but must not be able to create
-- objects in public. This prevents object-shadowing attacks against
-- SECURITY DEFINER routines whose objects are intentionally schema-qualified.
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Put PostgreSQL built-ins first and keep temporary objects last. All application
-- tables/functions are schema-qualified in these RPCs; auth.uid() is qualified.
alter function public.start_kingmaker_mining()
  set search_path = pg_catalog, public, auth, extensions, pg_temp;
alter function public.claim_kingmaker_mining(uuid)
  set search_path = pg_catalog, public, auth, extensions, pg_temp;
alter function public.get_kingmaker_crown_balance()
  set search_path = pg_catalog, public, auth, extensions, pg_temp;
alter function public.get_kingmaker_referral_code()
  set search_path = pg_catalog, public, auth, extensions, pg_temp;
alter function public.apply_kingmaker_referral(text)
  set search_path = pg_catalog, public, auth, extensions, pg_temp;
alter function public.get_kingmaker_member_dashboard()
  set search_path = pg_catalog, public, auth, extensions, pg_temp;
alter function public.get_kingmaker_member_activity()
  set search_path = pg_catalog, public, auth, extensions, pg_temp;
