# KINGMAKER production backend deployment

## What is prepared in this repository
- Six-hour server-timed CROWN sessions.
- Email magic-link authentication.
- Server-side claim validation and append-only CROWN ledger.
- Authenticated balance RPC.
- Mining remains disabled by default until an operator enables it.
- Sponsored restart remains disabled until a real provider and signed server verification are implemented.

## Create and connect the Supabase project
1. Create a Supabase project in the KINGMAKER owner's account.
2. In Project Settings, copy the Project URL and publishable/anon key.
3. Set those two values in `mining-config.js` (`supabaseUrl` and `supabaseAnonKey`). This key is public by design. Never use a service-role or secret key in browser files.
4. In Supabase Authentication > URL Configuration, add the exact HTTPS mining page URL as an allowed redirect URL.
5. In GitHub repository Settings > Secrets and variables > Actions, add:
   - `SUPABASE_ACCESS_TOKEN`: a Supabase personal access token with access to this project.
   - `SUPABASE_PROJECT_REF`: the project reference ID.
   - `SUPABASE_DB_PASSWORD`: the database password chosen when creating the project.
6. Run GitHub Actions > **Deploy KINGMAKER Supabase database** > Run workflow. Review the dry-run output, then the workflow applies the migration.
7. Verify the migration history and tables/functions in the Supabase dashboard. Keep `mining_config.enabled=false` until the reward rate, abuse controls, policies, support and launch notices are approved.

Supabase's official CI/CD guide recommends storing these credentials as encrypted GitHub Actions secrets and deploying migrations through the CLI: https://supabase.com/docs/guides/deployment/managing-environments

## Rewarded ads
No provider is connected. Do not set `rewardedAdRestartEnabled` to true yet. A provider must be selected and its official signed server-side verification/callback contract implemented. A browser-only `completed: true` event is not proof of a completed ad and must never grant a restart.

The provider choice and its account-issued app/placement identifiers are required before production ad code can be completed. No sponsor revenue or ad views are currently active.

## Security
- Never commit Supabase access tokens, database passwords, service-role keys, provider secrets or signing secrets.
- The browser anon/publishable key is public and must be protected by RLS and least-privilege database functions.
- Test email auth, six-hour start/claim, duplicate claim prevention, account isolation and backups in a staging project before enabling public mining.


## Verified wallet linking
The browser wallet button is account-bound and does not treat an injected wallet connection as proof of ownership.
1. Apply migration `202611160014_secure_wallet_linking.sql` after the existing mining migrations.
2. Deploy the Edge Function: `supabase functions deploy verify-wallet-link`.
3. Confirm the function has the standard Supabase environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Supabase supplies these to deployed Edge Functions; never copy the service-role key into browser configuration.
4. Keep JWT verification enabled for the function. It authenticates the caller's Supabase access token, reads the user's short-lived challenge using server credentials, recovers the EIP-191 signer from the signature, and calls the service-role-only finalization RPC.
5. Test an owned wallet, a mismatched signature, an expired challenge, a replayed nonce, a wallet already linked to another member, and a wallet switch. Confirm no wallet address is stored until signature verification succeeds.

Challenges expire after five minutes and are limited to five requests per account per ten minutes. Linking proves control of the EVM address at signing time; it does not create a token, grant mining rewards, or authorize withdrawals.
