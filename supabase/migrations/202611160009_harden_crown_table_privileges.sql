-- Explicit privilege hardening for the CROWN mining data model.
-- RLS remains enabled, but table ACLs must also prevent direct client writes.
-- All profile/session/ledger mutations are performed by reviewed SECURITY DEFINER RPCs.

drop policy if exists "profile owner can create" on public.kingmaker_profiles;

revoke all privileges on table
  public.kingmaker_profiles,
  public.mining_config,
  public.mining_sessions,
  public.crown_ledger
from public, anon, authenticated;

-- Authenticated members may read only what the RLS policies expose.
grant select on table
  public.kingmaker_profiles,
  public.mining_config,
  public.mining_sessions,
  public.crown_ledger
to authenticated;

-- RPCs are the only client entry points for profile creation, referrals,
-- mining-session transitions, claims, balance, dashboard, and activity.
revoke all on function public.start_kingmaker_mining() from public, anon, authenticated;
revoke all on function public.claim_kingmaker_mining(uuid) from public, anon, authenticated;
revoke all on function public.get_kingmaker_crown_balance() from public, anon, authenticated;
revoke all on function public.get_kingmaker_referral_code() from public, anon, authenticated;
revoke all on function public.apply_kingmaker_referral(text) from public, anon, authenticated;
revoke all on function public.get_kingmaker_member_dashboard() from public, anon, authenticated;
revoke all on function public.get_kingmaker_member_activity() from public, anon, authenticated;

grant execute on function public.start_kingmaker_mining() to authenticated;
grant execute on function public.claim_kingmaker_mining(uuid) to authenticated;
grant execute on function public.get_kingmaker_crown_balance() to authenticated;
grant execute on function public.get_kingmaker_referral_code() to authenticated;
grant execute on function public.apply_kingmaker_referral(text) to authenticated;
grant execute on function public.get_kingmaker_member_dashboard() to authenticated;
grant execute on function public.get_kingmaker_member_activity() to authenticated;
