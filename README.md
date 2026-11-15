# KINGMAKER

**Build Your Nation. Shape Its Future.**

KINGMAKER is a browser-based nation-building strategy prototype. Its current playable build combines a turn-based national simulation with a deterministic procedural world and an interactive WebGL planet.

## Current playable scope

- **Nation management:** name and govern a nation, manage population and stability, and construct farms, mines, workshops, factories, markets, academies, power grids, housing, and transport.
- **Economic simulation:** production, workforce, consumption, wages, treasury balance, shortages, recession and recovery.
- **World market:** buy and sell resources against shared finite stock; prices respond to supply, demand, and rival activity.
- **Six rival nations:** distinct strategic personalities, economic priorities, autonomous investment, research, trade, diplomacy, and military posture.
- **Diplomacy and conflict:** relations, treaties, aid, agreements, rivalries, military recruitment, fortifications, and territory capture through conflict.
- **Procedural planet:** seeded world generation, regional borders, settlements, resource deposits, selectable regions, and a rotatable WebGL globe with animated clouds, atmosphere, city lights, buildings, routes, and moving transport markers.
- **Territorial development:** claim unoccupied regions, establish settlements, build roads, and develop finite resource sites.
- **Campaigns and progression:** three scenarios, staged objectives, achievements, world events, and a local World Director that gives rule-based strategic advice.
- **Creator Studio:** publish and commission in-game designs; rival adoption, capped simulated royalties, experience, and reputation are part of the local game economy.
- **Save management:** validated, versioned JSON saves, migration, automatic recovery backups, and manual export/import.

## Run locally

Requirements: Node.js 20 or newer.

```sh
npm run dev
```

Open http://127.0.0.1:4173.

The development server binds to loopback (127.0.0.1); it is intended for local development, not direct public hosting.

## Controls

- **Advance World** resolves production, consumption, rival decisions, market prices, diplomacy, conflicts, and world events.
- **World** contains the strategic map, interactive planet, region inspection, and living events.
- **Nation** manages the national charter and infrastructure.
- **Economy** manages industry and trade against finite market stock.
- **Defence** manages troops and regional fortifications.
- **Diplomacy** manages relationships, agreements, and conflict.
- **Research** unlocks technologies and production improvements.
- **Campaign** tracks scenario objectives and achievements.
- **World Director** provides local rule-based recommendations; it is not connected to a hosted AI model.
- **Creator Studio** runs an in-game design publication and adoption simulation.
- **Export save / Import save** move a validated JSON save between browsers.
- **New nation** starts a new campaign while preserving the previous safe save for recovery.

## Quality checks

```sh
npm run check
npm test
```

The engine is in `src/engine.js`, the procedural globe is in `src/world3d.js`, the browser interface is in `src/app.js`, and automated tests are in `tests/`.

## Important product boundaries

This branch is a **local, single-player playable prototype**, not a finished public Web3 launch. It does not currently include online multiplayer, wallet connection, on-chain assets, real cryptocurrency payments, a live player marketplace, hosted AI services, or production account infrastructure. All credits, resources, creator royalties, and market activity are simulated game values with no real-world or financial value.

The 3D planet is procedurally rendered in WebGL; it is not yet a fully authored AAA 3D environment with detailed walkable cities, character animation, or cinematic missions.

Before calling this a release-ready product, the project still needs full automated test execution on the current branch, desktop and mobile browser acceptance testing, performance and accessibility review, security review, save/import edge-case testing, balance testing, and a separate design and implementation phase for any online or Web3 economy. Do not treat the current prototype as a live investment or income product.
