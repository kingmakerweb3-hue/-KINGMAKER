# KINGMAKER Release 1.0 — Product Lock and Ship Checklist

**Status:** Active release target  
**Product:** KINGMAKER — Build Your Nation, Shape Its Future  
**Primary platform:** Web browser (desktop-first, responsive where practical)  
**Release principle:** Finish, test, deploy, operate. Do not keep expanding scope while launch blockers remain.

This document is the acceptance contract for Release 1.0. A feature is not complete because code was committed: it must work in the running game, survive a save/reload, have tests where applicable, and be documented.

## 1. Release 1.0 player promise

A player can open KINGMAKER in a supported browser, start or continue a nation, explore and build on its 3D island, manage a functioning economy, research technologies, interact with rival nations, make strategic decisions, save progress, and understand how to play.

Release 1.0 is a complete, hosted **web game**. It is not an app-store release.

## 2. Must ship in 1.0

### Core game loop
- New campaign, scenario selection, clear objectives, victory/defeat states and restart.
- Reliable turn advancement with understandable production, consumption, income, wages and market results.
- Build and upgrade nation infrastructure; manage food, materials, ore, goods, power, credits and science.
- Research with visible and testable effects.
- Trade against finite market stock with clear prices and affordability feedback.
- Save automatically, recover safely, and export/import a validated save.

### World and presentation
- Stable 3D archipelago scene with a detailed home island, selectable outer-island territories, ownership borders, finite resource deposits, ocean and lighting/day-night; home-island buildings, roads and districts remain playable.
- Citizens and vehicles animate without breaking controls or causing unacceptable performance.
- Functional placement/selection controls, camera controls, and clear selected-object feedback.
- Industrial, harbor and renewable-energy areas are visually legible and connected to game systems.
- Usable interface at target desktop resolutions, with graceful small-screen behavior and accessible labels/keyboard focus for key controls.

### Strategy and living systems
- Rival nations make autonomous, reproducible strategic decisions and visibly report activity.
- Diplomacy, treaties, conflict, world events and their outcomes work end-to-end.
- World Director advice reflects actual game state and never presents itself as an unrestricted human-like AI.
- Workforce, resource shortages, energy limits and crisis effects are reflected consistently in forecasts and actual turns.

### Accounts, Web3 and economy boundary
- The first public 1.0 build must be playable without connecting a wallet.
- The existing wallet/asset prototype must remain clearly marked as experimental until authentication, ownership reads, chain configuration, failure handling and security review are complete.
- No token sale, real-money purchase, cash-out, paid marketplace settlement, or promise of financial return ships without a separately approved legal/compliance plan, audited contracts, threat model, custody decision and tested transaction lifecycle.
- No private keys or seed phrases are collected or stored by KINGMAKER.
- Any in-game currency or asset without verified on-chain settlement is clearly labelled as simulated/off-chain.

### Launch and operations
- Hosted production web build on an owned domain/hosting account, using HTTPS.
- Production configuration separated from development; secrets kept out of the repository and browser bundle.
- Error monitoring, uptime checks, backups, restore procedure, privacy notice, terms, contact/support route and a visible version/build identifier.
- Basic analytics limited to product health and consent-respecting usage; no sensitive wallet or personal data in logs.
- A documented rollback procedure and a named human operator responsible for hosting, incident response and player support.
- Public launch only after a closed playtest and all release gates below pass.

## 3. Explicitly not a 1.0 blocker / later releases

These are future expansions unless specifically promoted through a written scope change: full MMO-scale multiplayer, massive seamless multi-continent streaming, unrestricted generative AI agents, advanced combat simulation, creator token royalties with real-money settlement, token launches, speculative NFT trading, mobile app-store distribution, and unlimited user-generated asset publishing.

Do not simulate these capabilities in marketing or imply they are live.

## 4. Release gates — all must pass

- [ ] **Build:** clean install and documented start command work on supported Node.js version; no console-breaking runtime errors.
- [ ] **Automated tests:** `npm run check` and `npm test` pass on Node 20 and 22 in CI.
- [ ] **Gameplay:** a new campaign can be played through its main objectives; victory/defeat and restart work.
- [ ] **Economy:** deterministic tests cover production, staffing, renewable power, factory throttling, market trades, shortages and crises.
- [ ] **Save safety:** save/export/import/recovery and legacy migration tests pass; malformed or oversized input is rejected safely.
- [ ] **3D smoke test:** supported desktop browser loads the scene; camera, island selection and claims, home-island placement, roads, resource extraction, save/reload and turn updates work; no fatal WebGL errors.
- [ ] **Performance:** representative target hardware sustains a usable frame rate in the populated archipelago scene; memory does not grow continuously during a 20-minute play session.
- [ ] **Security:** server routes, input validation, dependencies, headers, secrets and any wallet code receive a documented review; no unreviewed real-money flow.
- [ ] **Accessibility/usability:** core actions have labels, visible focus, readable contrast and a usable onboarding/tutorial path.
- [ ] **Operations:** production deployment, HTTPS, monitoring, backups, restore and rollback are verified.
- [ ] **Playtest:** at least 10 external testers complete a guided session; all critical/blocker issues are fixed and retested.
- [ ] **Release sign-off:** owner approves the candidate build, release notes, known issues and launch communication.

A checkbox is only checked when there is evidence (CI run, test result, recording, deployment URL, review record or sign-off). Do not mark a gate complete from a code commit alone.

## 5. Build order — work toward the gates, not endless feature additions

1. Stabilize the current branch: fix failing CI/tests first; stop adding visual extras until the build is green.
2. Close core gameplay gaps and add regression tests for every corrected bug.
3. Complete a browser smoke-test path for the full new-game → build → turn → save → reload loop.
4. Finish onboarding, interface polish, error handling and responsive behavior.
5. Complete security and production-readiness work; keep real-money Web3 flows disabled unless separately approved.
6. Deploy a private release candidate, run playtests, fix blockers, then publish 1.0.
7. After launch, prioritize player-reported defects and retention improvements over new systems.

## 6. Audience and live operations after launch

- Start with a small closed test group, then an invite-based public beta, then widen access.
- Publish short gameplay clips and transparent development updates; show actual gameplay, not concept-only renders.
- Maintain a community feedback channel, issue triage, patch notes and a predictable update cadence.
- Track activation, tutorial completion, return sessions, crashes and performance. Do not optimize token speculation or financial promises.
- The project owner must control domain, hosting, repository, billing, signing keys and recovery credentials. The development assistant can help prepare code and procedures but cannot independently own or continuously operate these accounts.

## 7. Current known status (baseline at document creation)

The repository contains a local single-player browser prototype with a Three.js island, nation economy, research, campaigns, rival AI rules, diplomacy, events, creator systems, save migration, finite resource extraction and a wallet/asset prototype.

It is **not yet Release 1.0**. A hosted production deployment, complete release-candidate browser test, external playtest, operations setup and production security sign-off are not established by this document. Wallet connection and marketplace prototype code must not be represented as completed blockchain settlement.

## 8. Definition of done

Release 1.0 is done only when every mandatory gate in Section 4 has evidence, the owner approves the release candidate, and real players can access the hosted game and complete the core nation-building loop. Once that happens, feature work moves to post-launch updates rather than delaying the 1.0 launch indefinitely.
