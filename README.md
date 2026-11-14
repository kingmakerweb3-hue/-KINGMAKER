# KINGMAKER
### Play the World. Build the Future. Own Your Creation.

KINGMAKER is a browser-based nation-building and world-strategy game prototype. Build an economy, develop infrastructure, research technology, manage rival nations, expand territory, form alliances, wage simulated campaigns, and shape a national legacy.

## Current build: World Engine 1.1

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
- **Rival nation simulation** — Aurelia, Northreach, and Meridian maintain evolving treasuries, supplies, defence ratings, and diplomatic behavior.
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

## Next release priorities

1. Browser/device playtesting and gameplay balance.
2. Deeper NPC decision-making and event variety.
3. Better map presentation, accessibility, and onboarding.
4. Secure account and cloud-save backend.
5. Multiplayer server architecture, moderation, security, and release operations.

---
**KINGMAKER World Engine 0.9** — a playable single-player prototype under active development.
