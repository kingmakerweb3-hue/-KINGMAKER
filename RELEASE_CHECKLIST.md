# KINGMAKER public release checklist

This checklist distinguishes what exists today from what must be completed before calling the game a commercial release.

## Available in the current browser prototype
- Single-player nation building, economy, government, city districts and infrastructure.
- Research, simulated rivals, diplomacy, trade, alliances, conflict and regional expansion.
- Campaign milestones, achievements, victory paths and local Creator Studio records.
- Browser autosave and JSON save export/import.
- Installable web-app foundation (HTTPS hosting required for service-worker behavior).

## Release blockers
- [ ] Fix and verify all failing automated tests; add tests only after reproducing behavior against the actual interface.
- [ ] Complete manual playthroughs from a new save through each victory path.
- [ ] Balance resource generation, costs, tax effects, research pacing, rival difficulty and battle outcomes.
- [ ] Test current desktop and mobile browsers, small screens, keyboard access and reduced motion.
- [ ] Add clear onboarding, help, feedback/contact channel and bug-report process.
- [ ] Add privacy notice and terms that accurately describe actual data handling.
- [ ] Decide whether accounts/cloud saves/multiplayer are required for launch; these need a secure hosted backend and cannot be simulated in the client.
- [ ] Select a payment provider available to the publisher's legal entity and country; verify identity, business, tax and payout requirements before integration.
- [ ] If selling digital goods, implement server-verified entitlements, receipts, refunds, support and abuse controls. Never trust client-only purchase flags.
- [ ] Run security review, dependency review, backup/restore test and production deployment verification.
- [ ] Obtain permission for all art, music, fonts, trademarks and other third-party assets.
- [ ] Publish store/listing materials only after the product and platform requirements are met.

## Monetization principles
Do not promise earnings. Start with a free public playtest, measure retention and gather feedback. Consider a clearly priced premium edition or optional cosmetic/supporter purchases only after the game provides repeatable value. Do not sell pay-to-win advantages without a deliberate design decision and clear disclosure.

## Current release status
**Prototype / public playtest candidate — not a finished commercial release.** There is currently no payment processing, online account system, cloud save, cross-device sync or live multiplayer. The local game simulations do not represent real financial assets or cryptocurrency.
