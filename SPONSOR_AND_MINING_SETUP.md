# KINGMAKER mining and sponsor foundation

## What this commit provides
- A six-hour session interface connected to the existing Supabase RPC foundation.
- Server-side session start and claim calls; the browser does not calculate or write CROWN balances.
- A fail-closed sponsored restart integration point. It remains disabled until an approved rewarded-ad provider and server-side verification are configured.
- No fake ad views, local mining balances, or simulated payouts.

## Required production setup
1. Create a Supabase project and apply `supabase/migrations/202611160001_kingmaker_mining.sql`.
2. Enable Supabase Auth and configure the site's allowed redirect URLs.
3. Add the Supabase JS v2 browser library before `mining-foundation.js`.
4. Before loading the mining client, configure:
   ```js
   window.KM_CONFIG = {
     supabaseUrl: "https://YOUR-PROJECT.supabase.co",
     supabaseAnonKey: "YOUR_PUBLIC_ANON_KEY",
     rewardedAdRestartEnabled: false
   };
   ```
   The anon key is public by design; never expose a service-role key.
5. Review and explicitly enable the mining configuration only after rate limits, abuse controls, legal terms, privacy notice, support and operational monitoring are ready.

## Rewarded sponsor restart contract
The browser expects an approved provider adapter at `window.KM_REWARDED_ADS.show({ placement: "mining_restart" })`, returning a provider verification token only after genuine completion. The client then calls `restart_mining_after_verified_ad`. That RPC is intentionally not included or enabled yet: a trusted server webhook must first validate the provider's signed callback, enforce one-time use, and create a server-only grant. Never trust a browser boolean such as `completed: true` as proof of an ad view.

## Deployment status
This is source-code foundation only. It does not activate mining, issue CROWN, serve sponsor ads, create a production account service, or publish the website. The Supabase project, ad-provider contract, and hosting deployment must be configured and tested before public launch.
