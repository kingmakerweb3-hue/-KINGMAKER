# KINGMAKER

**KINGMAKER — Play the World. Build the Future. Own Your Creation.**

KINGMAKER is being developed as a **web-first, AI-enabled, Web3 civilization world**: a persistent-feeling living world where people build nations, shape economies, discover technologies, interact with intelligent systems, and—once safely designed and implemented—use blockchain assets and a player economy.

The website remains the KINGMAKER project hub. Native iOS and Android distribution work is specifically for the existing **CROWN Mining app** (`mining.html`), not the nation-building game. See [the mining mobile build guide](MOBILE_APP_BUILD.md) and [store release plan](MOBILE_STORE_RELEASE_PLAN.md).

## The vision

KINGMAKER is intended to go beyond a conventional city-building game:

- **A living 3D world:** large, believable environments, terrain, oceans, forests, cities, infrastructure, weather, lighting, day/night cycles, citizens, vehicles, and visible world activity.
- **Nation-scale simulation:** populations, resources, production, trade, infrastructure, governments, diplomacy, rival nations, world events, and long-term consequences.
- **AI-driven world systems:** intelligent world directors, agents, characters, rival decision-making, dynamic events, and responsive systems. The current World Director and rival behavior are rule-based game systems; deeper AI integration is future work, not a current live capability.
- **Technology evolution:** research and technological progression that can change how a civilization produces, builds, moves, communicates, and lives—including advanced and futuristic eras.
- **Web3 ecosystem:** a planned wallet-connected experience, clearly defined KINGMAKER coin/token utility, blockchain-based ownership where appropriate, and a marketplace. These components are not live yet; chain, token design, custody model, and purchase flow must be decided before implementation.
- **Creator ownership:** a long-term direction in which creators can make, publish, and potentially own or trade eligible creations under transparent rules.

The visual target is a serious, high-fidelity next-generation world—not a cartoon presentation. The current browser 3D island is an early prototype and does **not** yet represent the intended final visual quality or world scale.

## Current prototype

The current playable prototype is a local, single-player browser game built with JavaScript and a small Node.js development server. It does not currently require an account, database, wallet, external AI service, or paid service.

### Run locally

Requirements: Node.js 20 or newer.

```sh
npm run dev
```

Open <http://127.0.0.1:4173>. The server only binds to loopback.

### Current systems

- **Advance World** resolves production and consumption, rival decisions, market supply and prices, diplomacy, agreements, conflicts, and world events.
- **Nation** lets you rename the nation, set its government, and build infrastructure.
- **Economy** lets you build industries; buy and sell food, materials, ore, and goods against shared finite world-market stock; and review the national income and wage ledger.
- **Diplomacy** lets you send aid, recall an envoy, offer agreements, and manage conflict.
- **Research** unlocks production and resilience effects.
- **Campaign** offers three scenarios with objectives, achievements, victory, and defeat.
- **World Director** provides local rule-based advice based on current game state.
- **Creator Studio** lets you publish designs into a bounded local market. Rival nations can adopt designs when their needs match, apply their effects, and pay capped in-game royalties.
- **3D World** opens a procedurally generated nine-island archipelago: the explorable home island plus six rival-held islands and two neutral islands. Outer islands have distinct terrain, ownership borders, flags and finite resource deposits. Players can claim neutral islands, develop them with saved buildings, districts, local roads and harbors, and connect player-controlled ports with shipping routes. Remote extraction feeds a bounded local stockpile; convoys transport food, materials, ore, power or science to another claimed island or the national home port after a distance-based travel time. Harbor upgrades increase cargo capacity, active routes add logistics and charge upkeep, and Integrated Logistics shortens travel and reduces upkeep. Convoy vessels and route arcs are rendered in the 3D archipelago. Rival territorial claims respect active alliances; rival islands run bounded extraction and autonomous shipping, while full rival city and building placement remains future work. Active bilateral trade agreements grant port access for tariff-priced cargo routes in either direction.
- **3D construction and roads** let players place buildings, districts and local roads on any player-controlled island. Buildings use the existing national construction costs; districts cost 20 materials and 30 credits, and road segments cost 8 materials and 12 credits. Remote residential districts grow that island's population, while connected districts contribute national production and logistics. All placements persist in validated local saves.
- **Save export/import** moves a versioned JSON save between browsers.

All current game values are simulated and have no real-world or financial value. No cryptocurrency, token, wallet connection, real-money purchase, or on-chain ownership is currently implemented.

## Release 1.0 commitment

KINGMAKER now has a fixed Release 1.0 scope and evidence-based ship checklist. Work is prioritized against the playable web-game promise and release gates; new features do not take priority over failing tests, stability, browser verification, security, deployment, and playtesting. See the [KINGMAKER Release 1.0 plan](docs/RELEASE-1.0.md) for the must-ship scope, exclusions, launch gates, build order, and live-operations requirements.

## Product direction and milestones

1. **Foundation and quality:** stabilize the simulation, saves, controls, responsive web experience, and automated tests.
2. **Next-generation world:** establish the visual/technical foundation for high-fidelity environments, scalable terrain, realistic lighting, animation, population activity, and world streaming. Evaluate whether the current Three.js prototype remains suitable or whether a more capable 3D runtime is needed.
3. **AI world:** move from rule-based behavior toward clearly scoped AI agents and world systems, with deterministic safeguards and transparent player controls.
4. **Technology and civilization depth:** expand technology eras and make research visibly transform the world and its systems.
5. **Web3 architecture:** finalize the purpose and distinction of any coin and token, chain selection, wallet model, asset ownership rules, marketplace design, security review, and applicable legal/compliance requirements.
6. **Web3 implementation:** only after the design and security gates are approved, build and test wallet connection, on-chain features, and purchase flows. Never expose private keys or seed phrases to the game or its support systems.
7. **Web release:** prepare a secure, scalable web deployment and staged public launch.
8. **Mining app mobile release:** package only the CROWN Mining app for iOS and Android with Capacitor, validate the real mining/account flows, test real devices, and complete Apple/Google review gates.

## Run quality checks

```sh
npm run check
npm test
```

The engine is in `src/engine.js`; the browser interface is in `src/app.js`; automated rules tests are in `tests/engine.test.js`.

See [gameplay rules](docs/gameplay.md) and the [AI, 3D, and Web3 vision](docs/ai-3d-web3-vision.md). For the planned external-agent integration and current read-only discovery endpoints, see the [AI Agent Gateway](docs/AI-AGENT-GATEWAY.md).

## Save data

Current saves use schema version 14. The importer validates bounded creator publications, adoption and royalty ledgers, event records, response choices, campaign phase progress, placed 3D world objects, archipelago territories, ownership, harbor levels, per-island stockpiles, shipping routes and finite resource deposits before replacing the active game. It migrates original v0.3 saves and development schemas 1 through 13. Older campaigns receive deterministic island territories and remote deposits derived from their existing world seed, while existing home-island extraction progress is preserved. Active world effects, creator progression, processed event IDs, campaign progress, and structured history persist in saves. Automatic local saves keep a previous safe copy for recovery. Export backups regularly if you clear browser storage or change devices.

## Development status

The current development branch includes three playable local campaigns, six rival nations, a demand-driven Creator Studio economy, ten research technologies with prerequisites, a deterministic nine-island archipelago, neutral-territory claims, rival expansion behavior, finite resource extraction, versioned save migration, and automated engine tests. The 3D archipelago is an incremental prototype: full rival territorial economies, ground-level traversal and territorial conflict are still future work. Desktop and mobile browser acceptance, extended balance review, visual-performance validation, Web3 architecture, and release verification remain outstanding. KINGMAKER is in active development and is not declared a finished release.
