# KINGMAKER mining backend (six-hour sessions)

This folder contains the first server-authoritative mining backend schema. It is deliberately **disabled by default**. It does not make CROWN a blockchain token, guarantee cash value, or enable withdrawals.

## What this migration provides
- Supabase Auth user identity and a profile/referral-code table.
- A fixed six-hour session window enforced by PostgreSQL.
- One unclaimed session per user.
- Server-clock validation: a user cannot claim before the session ends.
- An append-only CROWN ledger with one unique reward entry per session.
- Row-level security so clients can read only their own sessions and ledger.
- Session start and claim functions that clients cannot write around.

## Required operator setup
1. Create a Supabase project and enable the intended authentication providers.
2. Run `migrations/202611160001_kingmaker_mining.sql` in the Supabase SQL Editor.
3. Keep `mining_config.enabled=false` while testing.
4. Set a reviewed reward rate only after the token/reward economics, legal position, abuse controls, terms, and funding source are approved. Example configuration (replace the rate; this is not a recommendation):
   `update public.mining_config set crown_per_hour = 0.1, enabled = true, updated_at = now() where id = true;`
5. Configure the client with the Supabase project URL and anon key using environment-specific deployment settings. Never put a service-role key in browser code.
6. Add monitoring, backups, rate limits, referral validation, admin audit controls, and independent security review before opening to the public.

## Client calls
After signing in, call RPC `start_kingmaker_mining` to start a session. After the server-side `ends_at` time, call RPC `claim_kingmaker_mining` with `p_session_id`. Read the authenticated user's own `mining_sessions` and `crown_ledger` rows for status and balance (balance = sum of ledger amounts).

## Not yet delivered
This migration is a backend foundation, not a deployed service. The browser client now reads its public Supabase settings from `mining-config.js`. The database is still not deployed until the project secrets are configured and the manual GitHub Actions deployment workflow is run. No live session, CROWN reward, referral bonus, wallet withdrawal, or sponsorship revenue is active. The app must not display rewards as live until the backend is deployed, configured, integrated, and tested. No private credentials are needed in GitHub.
