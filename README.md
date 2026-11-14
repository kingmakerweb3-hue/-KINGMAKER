## World Engine 2.7 — International World Council

- Added a rotating international agenda every five turns, with food relief, scientific cooperation and regional security sessions.
- Players can contribute resources for diplomatic, stability and influence benefits, or decline without spending resources.
- Added eligibility checks, three-turn session expiry, persistent council resolutions and save migration defaults.

## World Engine 2.6 — Bilateral trade negotiations

- Added direct resource negotiations with each peaceful rival: export 20 food for 30 credits or import 20 materials for 35 credits.
- Successful deals improve diplomatic relations and trust; rival reserves are adjusted to reflect the exchange.
- Added a three-turn per-rival negotiation cooldown, eligibility checks, save persistence and a bilateral trade ledger.

## World Engine 2.5 — Alliance council and diplomatic trust

- Added persistent diplomatic trust scores alongside relationship ratings.
- Added diplomatic summits with eligibility, credit and influence costs to build trust.
- Defensive alliances now require meaningful relations and established trust, rather than being an immediate purchase.
- Added alliance termination, diplomatic consequences, and a persistent alliance council record.

## World Engine 2.4 — Strategic rival intelligence

- Replaced random rival posture rolls with focus-driven decisions based on each nation's treasury, food, materials, and defence strength.
- Aurelia prioritizes commerce and trade channels; Northreach invests in border security; Meridian funds research.
- Rival governments respond to food shortages by spending treasury to rebuild reserves, and each displays its latest strategic action.
- Added persistent research reserves and last-action intelligence to rival records, with safe defaults for existing saves.

## World Engine 2.3 — National mandates

- Added four optional one-time national mandates: Food Security Reserve, Civic Confidence, Regional Goodwill and Industrial Base.
- Each mandate displays live progress, eligibility and its reward.
- Rewards can only be claimed once and are persisted in the local save.
- Claiming a mandate awards credits and diplomatic influence.
- Updated the PWA cache and visible build version to 2.3.

## World Engine 2.2 — Embassy and diplomatic missions

- Added three player-led diplomatic missions: envoys, humanitarian aid and research exchange.
- Missions have distinct costs and effects on relationships, influence or stability.
- Missions are blocked during wars; research exchange requires a minimum relationship and research reserve.
- Added relationship standing labels and a persistent local diplomatic history.
- Updated the PWA cache and visible build version to 2.2.

## World Engine 2.1 — Legacy save recovery

- Hardened the first-load save reader so incomplete older saves receive safe defaults before the first render.
- Preserves valid legacy progress while filling missing building, price, relationship, NPC, technology and event data.
- Handles malformed or unreadable browser storage by starting a fresh nation instead of crashing at startup.
- Added two Chromium tests for legacy-save migration and malformed-save recovery.
- Updated the PWA cache and visible build version to 2.1.

# KINGMAKER
### Play the World. Build the Future. Own Your Creation.

KINGMAKER is a browser-based nation-building and world-strategy game prototype. Build an economy, develop infrastructure, research technology, manage rival nations, expand territory, form alliances, wage simulated campaigns, and shape a national legacy.

## Current build: World Engine 2.7

### Playable systems
- **Nation management** — name your nation and choose a government style.
- **Citizens & government** — track public happiness, population growth, housing capacity, tax revenue, and migration.
- **Capital city development** — expand the capital through residential, industrial, commercial, civic, and research districts; upgrade the capital to unlock more development plots.
- **Rival city intelligence** — inspect simulated rival population estimates, civic mood, treasury, and food reserves.
- **Taxation** — set a 5%–25% tax rate; higher rates increase revenue but can reduce happiness and population growth.
- **Government policies** — choose Balanced Administration, Public Works, Food Security, Research Grants, Open Trade, Civic Services, or National Service, each with distinct trade-offs.
- **Economy** — manage food, materials, credits, population, stability, power, and influence.
- **Infrastructure** — build farms, workshops, markets, academies, and power grids.
- **Trade** — buy and sell resources at simulated market prices.
- **Diplomacy** — improve relations with rival NPC nations.
- **Research** — unlock technologies that improve production and governance.
- **Territorial expansion** — claim twelve neutral regions with permanent regional bonuses.
- **Military** — recruit infantry and border guards, calculate army strength, and pay upkeep.
- **Conflict** — declare wars and resolve turn-based campaign outcomes against rival nations.
- **Rival nation simulation** — Aurelia, Northreach, and Meridian maintain evolving treasuries, supplies, research reserves, defence ratings, and focus-driven strategic decisions.
- **Dynamic world events** — harvests, droughts, festivals, innovation, market booms, supply disruptions, diplomatic summits, and energy breakthroughs create changing conditions.
- **Expanded World Atlas** — twelve claimable sectors in a responsive interactive grid, with permanent resource yields and a strategic frontier that strengthens the army.
- **Trade agreements** — negotiate five-turn economic pacts with eligible rivals for recurring credits and materials.
- **Alliances and peace** — form defensive alliances and negotiate an end to active conflicts.
- **World Director** — receive local rule-based strategic guidance.
- **Campaign** — complete eight national milestones and earn in-game rewards.
- **Achievements** — record completed milestones and military victory.
- **Creator Studio** — register creations in your local game profile.
- **World history** — review important events.
- **Save system** — browser autosave plus JSON export and import.
- **Installable web app foundation** — web manifest, app icon, and service worker for supported HTTPS hosting.

## Run the game

1. Download or clone this repository.
2. Open `index.html` in a modern browser for local play.
3. For install/offline app behavior, host the repository over HTTPS (for example, with a static hosting provider that supports service workers).
4. Your nation autosaves in the browser's local storage.

The current game does not require a backend, API key, or build step.

## Save data

- Autosaves are stored in the browser and on the device where you play.
- Use **Export Save** to back up your nation to a JSON file.
- Use **Import Save** to restore an exported game.
- Clearing browser site data can remove local saves. Keep backups.
- Local browser saves do not automatically sync between devices.

## Prototype boundaries

This is a playable single-player prototype, not a finished online commercial release.
- Rival behavior, markets, diplomacy, territorial yields, and battles are local game simulations.
- The World Director is a local rule-based agent, not a connected generative AI service.
- Creator registrations are in-game records, not legal copyright registrations.
- The game does not process real payments, cryptocurrency, or real-world assets.
- Online accounts, cloud saves, cross-device sync, live multiplayer, and hosted backend services are not implemented.
- Service-worker offline support requires HTTPS or localhost hosting and should be verified after deployment.

## World Engine 2.0 — Quality console and stability checks

- Corrected the browser document title to World Engine 2.0.
- Added a Quality Console with 13 non-destructive browser smoke checks.
- Diagnostics inspect navigation panels, required interface elements, core function availability, nation-state numeric integrity, building inventory, research tree, territories, rival diplomacy, victory paths, campaign milestones, browser storage, and service-worker support.
- Results are shown as pass/fail cards with a summary count.
- Running diagnostics does not advance turns, spend resources, or intentionally change the nation save.
- These checks are a browser-side smoke test and do not replace manual gameplay testing across browsers and devices.

## World Engine 1.9 — Victory paths and endgame

- Added four optional victory paths: Economic Supremacy, Military Dominance, Diplomatic Unity, and Scientific Renaissance.
- Each path has explicit measurable requirements and can be claimed once its requirements are met.
- Victory records preserve turn, date, treasury, population, territory count, and researched technologies.
- The Campaign tab displays progress, claim status, and a Hall of Victories.
- Players may continue in sandbox mode after earning a victory; there is no forced game over.

## World Engine 1.8 — Save migration and protection

- Save exports now use a versioned KINGMAKER save envelope with export timestamp and state.
- Import accepts both legacy raw-state JSON saves and the new versioned format.
- Import validates core state structure and numeric values, fills missing fields for older saves, and normalizes key arrays.
- Import is limited to 2 MB and requires confirmation before replacing the current local nation.
- Browser storage failures now produce a visible warning instead of failing silently.
- Saves remain local to the browser/device; exporting a file is required to move progress between devices.

## World Engine 1.7 — Advanced research branches

- Expanded the technology tree with National Logistics, Public Health, and Renewable Energy.
- Added research prerequisites: Logistics requires Industrial Methods; Public Health requires Civic Governance; Renewable Energy requires Energy Systems.
- Research effects apply during each world turn: Logistics improves road-network income, Public Health supports growth and civic stability, and Renewables increases power output from Power Grid buildings.
- Research UI shows prerequisite locks and the total technologies researched.

## World Engine 1.6 — National exchange

- Added a National Exchange tab for food, materials, and power.
- Players can buy or sell quantities up to 1,000 units per transaction.
- Market prices adjust based on national reserves and are bounded by defined price bands.
- Trades validate treasury or stock, settle immediately, and create a 20-entry local ledger.
- This is an in-game simulation only; no real money or cryptocurrency payments are used.

## World Engine 1.5 — Expanded campaign progression

- Added four campaign milestones for capital development, roads, territorial expansion, and civic investment.
- New milestones award credits and influence through the existing campaign reward system.
- Campaign progress indicators show the required level, district count, or territory count.
- Existing completed milestones and saves remain intact.

## World Engine 1.4 — Rival power trends

- Added a rolling 12-turn snapshot history for rival treasury, food, materials, defence strength, and diplomatic relations.
- Added a Regional Power Trends panel showing current values and changes from the previous snapshot.
- Existing saves initialize an empty history safely; the current rival state is recorded on load.
- Snapshot collection occurs after each completed world turn.

## World Engine 1.3 — Interactive strategic atlas

- Replaced the plain region list in the world situation panel with an interactive strategic atlas.
- The capital is a distinct map node linking directly to Capital City development.
- All twelve regions are selectable and show ownership, terrain, strategic yield, and claim costs.
- Territory selection updates a live inspector with an affordability-aware claim action.
- Map tiles reflow for tablet and mobile screens; the atlas is schematic rather than a geographic map.

## World Engine 1.2 — Capital logistics

- Added a five-level capital road and logistics network.
- Each road level produces +3 credits and +1 material per world turn.
- Every two road levels add +1 stability per turn.
- Road upgrades have scaling credit and material costs and are capped at level five.
- Road level is stored in the existing local save and initializes safely for older saves.

## Next release priorities

1. Browser/device playtesting and gameplay balance.
2. Deeper NPC decision-making and event variety.
3. Better map presentation, accessibility, and onboarding.
4. Secure account and cloud-save backend.
5. Multiplayer server architecture, moderation, security, and release operations.

---
**KINGMAKER World Engine 2.5** — a playable single-player prototype under active development.

## Automated browser checks

The repository includes Playwright smoke tests for Chromium. On every push to `main` and pull request targeting `main`, GitHub Actions installs Chromium and runs:

```bash
npm install
npx playwright install --with-deps chromium
npm test
```

The suite covers dashboard rendering and browser errors, all navigation tabs, the 13-check Quality Console, turn advancement and local save persistence, JSON save export, legacy-save migration and recovery, diplomatic mission rules, national mandate rewards, and focus-driven rival decisions. The workflow result is the authoritative automated browser-test status for each commit.
