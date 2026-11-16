# KINGMAKER Mining — Supabase Production Setup Runbook

**Status: operator action required. Do not enable mining during setup.**

This runbook is for the owner of the KINGMAKER Supabase project. The application is deliberately fail-closed: new mining sessions remain paused until the schema, authentication, security policies, and end-to-end tests have been verified.

## 1. Open the correct project

1. Sign in to the Supabase account that owns the KINGMAKER project.
2. Open the project whose reference is `narpyrvmftxnjvorxxgm`.
3. Confirm this is the intended production project before running SQL.
4. Take a database backup or confirm point-in-time recovery is available before applying migrations.

Never share the Supabase password, database password, service-role key, access token, or recovery codes in chat or commit them to GitHub.

## 2. Apply the database migrations in order

Open **SQL Editor** in the Supabase Dashboard. Apply the repository migration files in ascending order, one at a time:

1. `supabase/migrations/202611160001_kingmaker_mining.sql`
2. `supabase/migrations/202611160002_kingmaker_referrals.sql`
3. `supabase/migrations/202611160003_kingmaker_member_dashboard.sql`
4. `supabase/migrations/202611160004_kingmaker_member_activity.sql`
5. `supabase/migrations/202611160005_enable_crown_pilot.sql`
6. `supabase/migrations/202611160006_set_600_crown_session.sql`
7. `supabase/migrations/202611160007_set_600_crown_base_reward.sql`
8. `supabase/migrations/202611160008_expire_missed_mining_sessions.sql`

The historical migrations 005 and 006 temporarily set earlier pilot values. Migration 007 is the final reward correction and leaves `mining_config.enabled = false`, `crown_per_hour = 100`, and `session_seconds = 21600`. Run the full sequence in order in one controlled maintenance window. **Do not enable mining** as part of this setup.

## 3. Verify the database is still paused

Run this read-only query in SQL Editor:

```sql
select enabled, session_seconds, crown_per_hour
from public.mining_config
where id = true;
```

Expected final result:

- `enabled = false`
- `session_seconds = 21600`
- `crown_per_hour = 100`

Verify the key tables have row-level security enabled:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('kingmaker_profiles','mining_config','mining_sessions','crown_ledger')
order by tablename;
```

Expected: `rowsecurity = true` for all four tables.

Do not paste query output containing personal member data. The two checks above return configuration/security metadata only.

## 4. Configure email authentication

In **Authentication → Providers**, enable the Email provider and confirm the project's email/OTP settings. In **Authentication → URL Configuration**, add the exact production web redirect used by the mining page:

`https://kingmakerweb3-hue.github.io/-KINGMAKER/mining.html`

Use the exact URL; do not add broad wildcard redirects. Configure an owned SMTP provider before inviting public users, and test sign-in and sign-out with a controlled test account.

The native iOS/Android wrappers still need a verified deep-link/callback configuration before native email sign-in can be called production-ready. Do not assume the web redirect automatically opens the native app.

## 5. Security checks before any pilot

- Confirm RLS is enabled and that no anonymous role can read member sessions, profiles, or ledger rows.
- Confirm browser users cannot insert/update/delete mining sessions or ledger entries directly.
- Confirm only authenticated users can execute the start, claim, referral, and private dashboard RPCs.
- Confirm the browser bundle contains only the Supabase project URL and public anon key. A public anon key is not an admin secret; never put a service-role key in the app.
- Confirm the project owner has MFA enabled and database backups are configured.
- Review Auth rate limits, email deliverability, abuse monitoring, privacy policy, account deletion, and support process.

## 6. End-to-end acceptance tests — use test accounts only

With `enabled` still false, confirm a signed-in test account can request a magic link and read only its own empty dashboard. Confirm the start-session RPC is rejected while mining is paused.

A separate controlled staging test is required to validate the complete six-hour lifecycle, duplicate/concurrent claim protection, missed-session expiry, ledger reconciliation, clock manipulation resistance, and account isolation. Do not enable production rewards just to test the interface.

## 7. Release boundary

The initial rule is one completed six-hour session = 600 off-chain CROWN points (100 per hour); no 10% bonus. If a completed session is not claimed before the player starts the next session, the old session expires for zero credit and the new session starts a fresh six-hour clock.

CROWN is an off-chain participation point with no cash value and no transfer or withdrawal feature. It is not KGM and there is no promised conversion. The app does not perform cryptocurrency mining on the device.

**Launch remains blocked** until the owner completes the steps above, native callback handling is validated, security and end-to-end tests pass, and the owner explicitly approves activation. Keep `mining_config.enabled = false` until all launch gates are signed off.
