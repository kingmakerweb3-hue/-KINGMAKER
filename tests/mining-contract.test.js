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
