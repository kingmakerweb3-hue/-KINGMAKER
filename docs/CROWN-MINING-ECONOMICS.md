# KINGMAKER CROWN Mining Economics

## Owner direction

Sponsorship and advertising receipts are KINGMAKER company revenue. They are not automatically shared with miners and are not an input to the CROWN reward formula. The owner may decide later how much CROWN to launch and what daily mining budget to authorize. Until that decision is configured, production issuance stays disabled.

## Pi-inspired participation mechanics

KINGMAKER independently implements the publicly described mechanics, not Pi Network code or branding:

- Daily, time-limited participation sessions (maximum 24 hours).
- A validated security-circle contribution bonus: +20% per verified member, capped at five (+100% maximum).
- A one-level direct-referral bonus: +25% per concurrently active eligible direct referral.
- A dynamic base rate calculated from the approved daily CROWN budget and the network's forecast weighted miner-hours.
- Referral and security-circle counts must be established by trusted server-side validation; never trust values sent by a browser.

The multiplier currently used is:

`multiplier = (1 + 0.20 × min(verifiedSecurityMembers, 5)) × (1 + 0.25 × activeDirectReferrals)`

The base rate is:

`baseRate = approvedDailyCrownBudget / forecastTotalWeightedMinerHours`

A member's estimated accrual is:

`CROWN = baseRate × multiplier × validatedActiveHours`

This is an emission-allocation model, not a promise of earnings. Actual issuance must be reconciled against the approved daily cap. If actual weighted activity differs from the forecast, the production allocator must perform end-of-day reconciliation and enforce the cap; the quote function alone is not an issuance ledger.

## What is deliberately excluded

- Sponsorship income does not determine miner rewards.
- No automatic CROWN-to-KGM conversion.
- No loans, lending, borrowing or construction mechanics.
- No phone CPU/GPU mining.
- No reward for ad views or clicks unless a specific ad provider explicitly authorizes incentivized traffic.
- No Node, app-usage or lockup bonuses until those real services and validation systems exist.
- No live rewards, wallet payouts or token claims are enabled by this calculation module.

## Production launch requirements

Before real CROWN issuance: choose the total CROWN pool and daily emission budget; implement authenticated server sessions, validated referrals and security-circle membership, anti-sybil controls, an append-only auditable ledger, concurrency-safe daily cap enforcement, admin authorization, monitoring, legal/privacy review and independent security testing. The daily budget must never exceed the remaining approved pool. The public mining portal must continue to show pre-launch until those controls are deployed.

## Code

- `src/mining-economics.js`: pure, dependency-free calculation functions.
- `tests/mining-economics.test.js`: formula, cap-configuration, validation and session-duration tests.

Run the suite with `npm test`.
