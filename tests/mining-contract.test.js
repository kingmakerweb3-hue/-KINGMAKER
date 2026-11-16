"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sql = fs.readFileSync(path.join(root, "supabase/migrations/202611160001_kingmaker_mining.sql"), "utf8");
const client = fs.readFileSync(path.join(root, "mining-foundation.js"), "utf8");
const config = fs.readFileSync(path.join(root, "mining-config.js"), "utf8");

test("CROWN mining is disabled by default and sessions are exactly six hours", () => {
  assert.match(sql, /enabled boolean not null default false/);
  assert.match(sql, /session_seconds integer not null default 21600 check \(session_seconds = 21600\)/);
  assert.match(sql, /valid_session_window check \(ends_at = started_at \+ interval '6 hours'\)/);
  assert.match(config, /rewardedAdRestartEnabled: false/);
});

test("starting a session requires an authenticated member and snapshots the configured rate", () => {
  assert.match(sql, /if v_user is null then raise exception 'Authentication required'/);
  assert.match(sql, /if not coalesce\(v_cfg\.enabled,false\) or v_cfg\.crown_per_hour <= 0 then/);
  assert.match(sql, /insert into public\.mining_sessions\(user_id,started_at,ends_at,reward_rate\)/);
  assert.match(sql, /v_cfg\.crown_per_hour\)/);
});

test("claims are owner-scoped, time-gated, and use the session's snapshotted rate", () => {
  assert.match(sql, /where id=p_session_id and user_id=v_user for update/);
  assert.match(sql, /if now\(\) < v_session\.ends_at then raise exception/);
  assert.match(sql, /v_rate := coalesce\(v_session\.reward_rate,0\)/);
  assert.match(sql, /insert into public\.crown_ledger\(user_id,session_id,entry_type,amount\)/);
  assert.match(sql, /session_id uuid unique references public\.mining_sessions\(id\)/);
  assert.doesNotMatch(sql, /select crown_per_hour into v_rate from public\.mining_config where id=true and enabled=true/);
});

test("browser mining fails closed without public Supabase configuration", () => {
  assert.match(client, /if \(!config\.supabaseUrl \|\| !config\.supabaseAnonKey \|\| !window\.supabase\?\.createClient\)/);
  assert.match(client, /NETWORK CLOSED · MINING PAUSED/);
  assert.match(client, /miningEnabled = !configError && configRow\?\.enabled === true/);
});

test("sponsored restart requires an enabled provider and a server verification RPC", () => {
  assert.match(client, /config\.rewardedAdRestartEnabled === true/);
  assert.match(client, /result\.completed !== true \|\| !result\.verificationToken/);
  assert.match(client, /restart_mining_after_verified_ad/);
  assert.doesNotMatch(client, /from\(["']crown_ledger["']\)\.insert/);
});

test("member dashboard RPC exposes only the signed-in member's aggregate activity", () => {
  const dashboard = fs.readFileSync(path.join(root, "supabase/migrations/202611160003_kingmaker_member_dashboard.sql"), "utf8");
  assert.match(dashboard, /security definer/);
  assert.match(dashboard, /if v_user is null then raise exception 'Authentication required'/);
  assert.match(dashboard, /where p\.referred_by = v_user/);
  assert.match(dashboard, /where s\.user_id = v_user/);
  assert.match(dashboard, /grant execute on function public\.get_kingmaker_member_dashboard\(\) to authenticated/);
  assert.match(client, /get_kingmaker_member_dashboard/);
});

test("member activity RPC is authenticated, owner-scoped, bounded, and ledger-backed", () => {
  const activity = fs.readFileSync(path.join(root, "supabase/migrations/202611160004_kingmaker_member_activity.sql"), "utf8");
  assert.match(activity, /security definer/);
  assert.match(activity, /if v_user is null then raise exception 'Authentication required'/);
  assert.match(activity, /where s\.user_id = v_user/);
  assert.match(activity, /l\.user_id = v_user/);
  assert.match(activity, /order by s\.started_at desc\s+limit 20/);
  assert.match(activity, /grant execute on function public\.get_kingmaker_member_activity\(\) to authenticated/);
  assert.match(activity, /s\.ends_at > now\(\)/);
  assert.match(client, /get_kingmaker_member_activity/);
  assert.match(client, /row\.credited_crown == null/);
});

test("signing out clears private referral details from the member screen", () => {
  assert.match(client, /referralCode\) referralCode\.textContent = "Sign in to load"/);
  assert.match(client, /copyReferral\) copyReferral\.disabled = true/);
  assert.match(client, /referralInput\) referralInput\.value = ""/);
});

test("magic-link sign-in handles network errors and throttles resend requests", () => {
  assert.match(client, /signInCooldownUntil = 0/);
  assert.match(client, /Date\.now\(\) < signInCooldownUntil/);
  assert.match(client, /signInWithOtp/);
  assert.match(client, /finally \{/);
  assert.match(client, /Network error\. Check your connection/);
  assert.match(client, /RESEND LINK IN /);
  assert.match(client, /60000/);
});

test("Supabase auth state changes defer refresh work until after the callback returns", () => {
  assert.ok(client.includes("onAuthStateChange((_event, _session) => {"));
  assert.ok(client.includes("authRefreshTimer = setTimeout(() =>"));
  assert.ok(client.includes("refresh().catch(() =>"));
  assert.match(client, /after the callback returns to avoid auth-lock deadlocks/);
});

test("missed completed sessions expire without reward and a fresh six-hour session can start", () => {
  const reset = fs.readFileSync(path.join(root, "supabase/migrations/202611160008_expire_missed_mining_sessions.sql"), "utf8");
  assert.match(reset, /check \(status in \('active','claimed','expired'\)\)/);
  assert.match(reset, /where status = 'active'/);
  assert.match(reset, /set status = 'expired'/);
  assert.match(reset, /Session expired; no CROWN reward was issued/);
  assert.match(reset, /insert into public\.mining_sessions\(user_id,started_at,ends_at,reward_rate\)/);
  assert.match(client, /PREVIOUS SESSION MISSED · NO REWARD/);
  assert.match(client, /SESSION MISSED · EXPIRED/);
});

test("mining SECURITY DEFINER RPCs use a hardened search path and client roles cannot create public-schema objects", () => {
  const hardening = fs.readFileSync(path.join(root, "supabase/migrations/202611160011_harden_public_schema_and_rpc_search_path.sql"), "utf8");
  assert.match(hardening, /revoke create on schema public from public, anon, authenticated/i);
  assert.match(hardening, /grant usage on schema public to anon, authenticated/i);
  assert.equal((hardening.match(/set search_path = pg_catalog, public, auth, extensions, pg_temp/g) || []).length, 7);
  for (const rpc of [
    "start_kingmaker_mining()",
    "claim_kingmaker_mining(uuid)",
    "get_kingmaker_crown_balance()",
    "get_kingmaker_referral_code()",
    "apply_kingmaker_referral(text)",
    "get_kingmaker_member_dashboard()",
    "get_kingmaker_member_activity()"
  ]) assert.ok(hardening.includes("alter function public." + rpc), "missing hardened search_path for " + rpc);
});


test("pilot reward configuration stays paused at 100 CROWN per hour for a 600 CROWN session", () => {
  for (const migrationName of [
    "202611160005_enable_crown_pilot.sql",
    "202611160006_set_600_crown_session.sql",
    "202611160007_set_600_crown_base_reward.sql"
  ]) {
    const migration = fs.readFileSync(path.join(root, "supabase/migrations", migrationName), "utf8");
    assert.match(migration, /enabled = false/);
    assert.match(migration, /session_seconds = 21600/);
    assert.match(migration, /crown_per_hour = 100/);
  }
  assert.match(client, /sessionReward = !configError && configRow/);
  assert.match(client, /sessionReward\.toFixed\(8\)/);
  assert.match(client, /Claim this completed session for /);
  assert.doesNotMatch(client, /Claim this completed session for 600 CROWN/);
});

test("missed-session reset expires only the prior active session and never credits it", () => {
  const reset = fs.readFileSync(path.join(root, "supabase/migrations/202611160008_expire_missed_mining_sessions.sql"), "utf8");
  assert.match(reset, /where user_id = v_user and status = 'active'/);
  assert.match(reset, /if v_previous\.ends_at > now\(\) then/);
  assert.match(reset, /update public\.mining_sessions\s+set status = 'expired'\s+where id = v_previous\.id and claimed_at is null/);
  assert.doesNotMatch(reset, /insert into public\.crown_ledger[\s\S]*?status = 'expired'/);
  assert.match(reset, /insert into public\.mining_sessions\(user_id,started_at,ends_at,reward_rate\)/);
});


test("concurrent session starts are serialized per member before checking active sessions", () => {
  const concurrency = fs.readFileSync(path.join(root, "supabase/migrations/202611160012_serialize_mining_session_starts.sql"), "utf8");
  assert.match(concurrency, /pg_advisory_xact_lock\(hashtextextended\(v_user::text, 0\)\)/);
  assert.ok(concurrency.indexOf("pg_advisory_xact_lock") < concurrency.indexOf("from public.mining_sessions"));
  assert.match(concurrency, /set search_path = pg_catalog, public, auth, extensions, pg_temp/);
});
