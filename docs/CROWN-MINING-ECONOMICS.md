# KINGMAKER CROWN Mining Economics

## Owner supply direction

CROWN is designed with an **unlimited total supply**: no fixed maximum supply, finite launch pool or daily emission cap. Miners can continue participating without a hard supply ceiling.

Unlimited supply does not mean guaranteed market value, guaranteed income or uncontrolled browser-side minting. The owner must configure the base reward rate. Actual rewards require authenticated server sessions, validated activity and an auditable ledger. The rate can be reviewed and adjusted transparently as the network grows. The 24-hour session limit remains.

Sponsorship and advertising receipts are KINGMAKER company revenue. They are not automatically shared with miners and are not an input to the CROWN reward formula.

## Pi-inspired participation mechanics

KINGMAKER independently implements these publicly described participation mechanics:

- Daily, time-limited participation sessions (maximum 24 hours).
- Validated security-circle bonus: +20% per verified member, capped at five (+100% maximum).
- One-level direct-referral bonus: +25% per concurrently active eligible direct referral.
- Owner-configured base reward rate per weighted miner-hour.
- No fixed maximum CROWN supply and no daily emission cap under this policy.
- Referral and security-circle counts must be validated server-side; never trust browser-submitted values.

`multiplier = (1 + 0.20 × min(verifiedSecurityMembers, 5)) × (1 + 0.25 × activeDirectReferrals)`

`CROWN = configuredBaseRate × multiplier × validatedActiveHours`

This is a reward calculation, not a promise of earnings or token price. Until a base rate is configured, issuance remains disabled.

## Deliberate exclusions

- Sponsorship income does not determine miner rewards.
- No automatic CROWN-to-KGM conversion.
- No loans, lending, borrowing or construction mechanics.
- No phone CPU/GPU mining.
- No rewards for ad views or clicks unless the provider explicitly authorizes incentivized traffic.
- No Node, app-use or lockup bonuses until those services and validation systems exist.
- No live rewards, wallet payouts or token claims are enabled by this calculation module.

## Production launch requirements

Before real CROWN issuance: configure and publish the base reward rate; implement authenticated accounts and server-authoritative sessions; validate referrals and security-circle membership; deploy an append-only auditable ledger; implement anti-sybil controls, admin authorization, monitoring, legal/privacy review and independent security testing. Unlimited supply carries dilution/inflation risk; it does not establish market demand or value. The public portal must remain pre-launch until these controls are deployed.

## Code

- `src/mining-economics.js`: dependency-free calculation functions.
- `tests/mining-economics.test.js`: formula, unlimited-supply policy, validation and session-duration tests.

Run with `npm test`.
