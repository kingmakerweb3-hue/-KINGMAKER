# KINGMAKER Six-Hour Mining & CROWN Economy — Design Specification

**Status: design only — not live, not deployed, and not a source of real-world earnings.**

This specification defines a future in-game reward loop. Until account identity, persistent server storage, anti-abuse controls, economy balance, legal review, and security testing are complete, all rewards remain simulated game data.

## 1. Terminology and asset separation
- **CROWN:** proposed off-chain gameplay points earned through participation. CROWN has no cash value, is not transferable, and is not redeemable.
- **KGM:** proposed KINGMAKER ecosystem asset. Its chain, token standard, supply, utility, distribution, custody model, and launch status are undecided. Do not imply that KGM exists or can be purchased, mined, or withdrawn.
- CROWN and KGM are separate. There is no automatic conversion, exchange rate, or promise of future conversion.

## 2. Six-hour session lifecycle
A session lasts exactly 21,600 seconds.
1. An authenticated player requests a session.
2. The server checks eligibility, account status, cooldowns, and whether another session is active.
3. The server records an immutable start timestamp and session identifier.
4. The client displays a countdown calculated from server timestamps. Client clocks never determine rewards.
5. Before 21,600 seconds have elapsed, the claim endpoint returns SESSION_NOT_COMPLETE.
6. At or after completion, the server atomically marks the session claimed and credits the configured CROWN amount once.
7. A unique database constraint and transaction prevent duplicate claims, including retries and simultaneous requests.
8. The player may start another session only after the prior session is claimed and any configured cooldown has elapsed.

## 3. Reward calculation
Use a server-owned, versioned reward configuration. The base reward must be set only after economy simulations and abuse testing; it is intentionally unspecified here.

earned = base_reward × eligible_multiplier

The multiplier is derived exclusively from validated server-side eligibility. Do not accept a reward amount or multiplier supplied by the browser.

Referral or group bonuses are not enabled by this specification. Any future bonus requires documented eligibility, caps, anti-sybil controls, transparent rules, and legal review. Avoid pay-to-recruit structures and guaranteed-income language.

## 4. Minimum data model
### mining_sessions
- id — unguessable unique identifier
- user_id — authenticated account reference
- started_at — server UTC timestamp
- ends_at — server UTC timestamp
- claimed_at — nullable server UTC timestamp
- status — active, claimed, expired, or cancelled
- rules_version — reward configuration version

### crown_ledger
- id — unique ledger entry
- user_id
- session_id — unique for mining-session credits
- amount — integer smallest unit, never floating point
- reason
- created_at

The balance is derived from the append-only ledger or maintained transactionally with reconciliation. Never let a browser write balances directly.

## 5. API contract (future)
- POST /api/mining/sessions — start a session; reject if one is already active.
- GET /api/mining/status — return server time, active session, completion time, and balance.
- POST /api/mining/sessions/{id}/claim — atomically claim a completed session; idempotent retries return the original result.
- GET /api/mining/history — return paginated session and ledger history.

All endpoints require authentication, authorization checks, rate limits, input validation, and audit logging. Never expose secrets or private keys.

## 6. Abuse prevention and operational controls
- Enforce one active session per account in the database.
- Use server UTC time; ignore client-provided timestamps.
- Make claim processing transactional and idempotent.
- Rate-limit start and claim attempts.
- Detect account farming and suspicious referral patterns before any bonus is enabled.
- Keep an auditable ledger; provide support and dispute procedures.
- Add monitoring for duplicate claims, failed transactions, unusual reward rates, and database inconsistencies.
- Provide an administrative kill switch to pause new sessions and claims safely.
- Do not add wallet connection or on-chain transfers until a separate reviewed architecture is approved.

## 7. Acceptance tests
- A session cannot be claimed before 21,600 seconds.
- A session can be credited only once.
- Two concurrent claim requests produce one credit.
- Retrying a successful claim returns the same result without a second credit.
- A user cannot start a second active session.
- Editing the device clock does not change eligibility.
- A forged user ID, amount, multiplier, or session ID is rejected.
- A database failure does not create a partial credit.
- Session history and ledger balance reconcile.
- Account suspension and the global kill switch prevent new reward issuance.

## 8. Launch gates
Do not enable real-value rewards or describe this feature as live until all of the following are complete: production authentication, durable database, tested atomic ledger, independent security review, load and abuse testing, privacy and legal review for target markets, operational monitoring, and explicit product approval.

**Player-facing wording before launch:** “Six-hour CROWN sessions are a planned gameplay feature. CROWN is currently a simulated in-game point with no cash value. KGM token functionality is not live.”