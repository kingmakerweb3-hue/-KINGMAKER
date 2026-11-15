# KINGMAKER Network PWA — prototype scope

## What this branch adds
- A responsive mobile-first KINGMAKER Network page at `/network.html`.
- Installable Progressive Web App metadata and a small offline cache.
- Daily local-browser check-in, streak counter, and demo participation points.
- Optional EIP-1193 wallet address display; no signatures, approvals, or transactions.
- A shareable page URL.

## Important limitations
This is a front-end prototype only. KMP is a local demo counter, not a cryptocurrency, token, mining reward, investment, or promise of future value. The counter is stored in one browser's local storage and can be reset or modified by the user. It is not synchronized across devices and has no server-side anti-abuse protection. No actual proof-of-work or background mining occurs. Referral attribution is not implemented. No token contract is deployed and no reward can be withdrawn or transferred.

## Production work required before a public token launch
1. Decide jurisdiction, legal classification, token utility, supply, emissions, eligibility, and anti-Sybil rules.
2. Build account identity and a secure server-side ledger with idempotent daily claims, rate limits, audit trails, and database persistence.
3. Define wallet custody boundaries and use audited contracts on a selected chain.
4. Add verified referral attribution, abuse detection, monitoring, privacy and terms pages.
5. Independent security review, load testing, backups, incident response, and staged public beta.

Do not market demo points as a coin or promise future conversion. Do not ask users for seed phrases or private keys.
