# KINGMAKER Mining Application — Implementation Blueprint

**Status:** Product/engineering specification. The public-facing mining screen is a preview only. No mining, CROWN crediting, KGM distribution, wallet payout or account system is live.

## Product rules (owner-approved direction)
- Players use the KINGMAKER mining application.
- Eligible mining activity earns **$CROWN**.
- Eligible miners may separately qualify for **$KGM** distributions only after the KINGMAKER game has launched and the ecosystem has been established, under separate, published rules.
- **$CROWN is the mining reward currency. $KGM is the governance and utility token.**
- There is no loan, lending, borrowing or credit mechanic.
- There is no automatic fixed CROWN-to-KGM conversion rate.
- Mining credits CROWN only; it does not trigger immediate KGM distribution.
- KGM launch and distribution are later milestones, gated on game launch, ecosystem establishment, final published eligibility rules, legal review and security approval.
- Never use hidden CPU/GPU mining or battery-draining background computation.

## Required service architecture before real rewards
1. **Identity and account service:** verified account lifecycle, session security, recovery and privacy controls.
2. **Eligibility engine:** versioned rules for allowed activity, regions, account age, abuse signals and exclusion/appeal handling.
3. **Activity ingestion:** signed, time-bounded activity events with idempotency keys, replay protection, rate limits and server-side validation. Browser timers and client-supplied totals are never authoritative.
4. **CROWN ledger:** append-only double-entry or equivalent auditable ledger; pending, approved, reversed and settled states; immutable event references; reconciliation and export.
5. **KGM allocation service:** a separate pool and ruleset, with snapshots, eligibility calculations, review, approval and claim records. It must never infer KGM from a CROWN balance. Keep distribution disabled until the KINGMAKER game is launched, the ecosystem is established and the separate KGM launch gates are approved.
6. **Wallet/claim service:** chain and contract selection only after legal and security approval; signed claims, nonce/replay protection, rate limits, sanctions/jurisdiction gates where applicable, and no custody of seed phrases/private keys.
7. **Operations:** monitoring, abuse review, audit trails, incident response, backups, restore tests, admin access controls and transparent public status.

## API contract to implement in a later server release
- `GET /api/mining/v1/status` — service status, rules version and whether enrollment is open.
- `POST /api/mining/v1/enrollment` — create an authenticated application enrollment.
- `GET /api/mining/v1/account` — read the authenticated user's eligibility and balances.
- `POST /api/mining/v1/activity` — submit a signed activity event for server validation; never accept a reward amount from the client.
- `GET /api/mining/v1/ledger` — paginated CROWN ledger with event IDs and states.
- `GET /api/mining/v1/kgm/eligibility` — read separately calculated KGM eligibility and rules version.
- `POST /api/mining/v1/kgm/claims` — initiate a claim only after the token and audited claim contract exist.

All endpoints require authentication, authorization, input schema validation, CSRF/origin protection where applicable, rate limiting, no-store responses for private data, structured audit logs and tests. Until the service is implemented, the public UI must show a non-live status and must not fabricate balances or reward events.

## Launch gates
- Owner approves exact activity types and eligibility rules.
- Owner approves CROWN emission/budget, ledger units, expiry/reversal policy and in-game use (if any).
- Owner approves KGM allocation cadence, eligibility, claim process and jurisdiction exclusions.
- KINGMAKER game launch and ecosystem establishment are completed before any KGM distribution is enabled.
- Legal review, privacy notice, threat model, independent code/contract audit and operational runbook complete.
- Automated tests cover duplicate/replayed events, tampered client payloads, multi-account abuse, reversals, ledger reconciliation, concurrent claims and service outages.
- Closed beta proves end-to-end activity validation and ledger integrity before any real reward is enabled.

## Current implementation
`mining.html` is a responsive, read-only product preview. It intentionally contains no fake start button, simulated earning rate, wallet request, token balance or claim action. This avoids presenting an unimplemented financial feature as live.


## Visual and client application direction
- The public mining gateway is the front door to the KINGMAKER civilization identity: cinematic science-fiction art direction, orbital/celestial motifs, restrained gold/cyan accents, premium typography and responsive layouts. It must not resemble a cartoon or a generic exchange dashboard.
- The website is intended to be mobile-first and installable as a Progressive Web App (PWA). The first client shell includes a web manifest, service worker and app icon; offline support is limited to the static shell.
- The optional wallet button uses an injected EIP-1193 provider to request account access only. It does not request a signature, initiate a transaction, transmit an address to a server or prove account ownership. A production account-link flow must use a server-generated nonce and a domain-bound signature challenge, with replay protection.
- The mining control remains disabled until a server-authoritative session service, eligibility rules, abuse controls and auditable CROWN ledger are deployed. No browser timer or local storage value may create rewards.
- Sponsorship placement is a reserved, inactive area. Ad inventory must comply with the chosen provider's policies; users must not be paid CROWN or KGM for viewing or clicking ads unless an explicitly approved provider program permits that exact incentive.
- This frontend is a design and PWA shell, not a live mining service, production account system, wallet payout service or token contract.


## Portal experience scope (current PR)
- The landing portal opens with the **SOMETHING NEW IS COMING** message and the premium KINGMAKER science-fiction identity.
- The visual world section uses animated CSS 3D-style planetary, orbital and city elements as a lightweight concept preview; it is not represented as a production 3D game engine.
- The portal explains the AI civilization and nation-building vision as roadmap concepts.
- Daily community participation is a clearly labelled local-only preview. It does not create an account record, start a mining session or issue CROWN.
- The sponsor video area is a reserved partner-content slot. No video ad is being served in the preview. Future placements must be labelled as sponsored and comply with the selected advertising provider's policies; do not reward ad views or clicks with tokens unless an approved program expressly permits it.
- PWA installation is available where the browser supports the install prompt. iOS users receive manual Add to Home Screen guidance.
