# KINGMAKER

**KINGMAKER — Play the World. Build the Future. Own Your Creation.**

KINGMAKER is being developed as a **web-first, AI-enabled, Web3 civilization world**: a persistent-feeling living world where people build nations, shape economies, discover technologies, interact with intelligent systems, and—once safely designed and implemented—use blockchain assets and a player economy.

This is **not a project being built for the Google Play Store or Apple App Store**. The primary destination is the web: a rich browser experience that can evolve into a connected Web3 platform.

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
- **3D World** opens an explorable 3D island with high-density procedural terrain, varied elevation, expanded forests, detailed building facades, animated citizens and traffic, a moving ocean surface, atmospheric clouds, a day/night lighting cycle, orbit/zoom/pan controls, and live terrain-surface construction.
- **3D construction and roads** let players place buildings and connect districts. Positions and roads persist in local saves; connected districts gain logistics and credits.
- **Save export/import** moves a versioned JSON save between browsers.

All current game values are simulated and have no real-world or financial value. No cryptocurrency, token, wallet connection, real-money purchase, or on-chain ownership is currently implemented.

## Product direction and milestones

1. **Foundation and quality:** stabilize the simulation, saves, controls, responsive web experience, and automated tests.
2. **Next-generation world:** establish the visual/technical foundation for high-fidelity environments, scalable terrain, realistic lighting, animation, population activity, and world streaming. Evaluate whether the current Three.js prototype remains suitable or whether a more capable 3D runtime is needed.
3. **AI world:** move from rule-based behavior toward clearly scoped AI agents and world systems, with deterministic safeguards and transparent player controls.
4. **Technology and civilization depth:** expand technology eras and make research visibly transform the world and its systems.
5. **Web3 architecture:** finalize the purpose and distinction of any coin and token, chain selection, wallet model, asset ownership rules, marketplace design, security review, and applicable legal/compliance requirements.
6. **Web3 implementation:** only after the design and security gates are approved, build and test wallet connection, on-chain features, and purchase flows. Never expose private keys or seed phrases to the game or its support systems.
7. **Web release:** prepare a secure, scalable web deployment and staged public launch. App-store distribution is not the product target.

## Run quality checks

```sh
npm run check
npm test
```

The engine is in `src/engine.js`; the browser interface is in `src/app.js`; automated rules tests are in `tests/engine.test.js`.

See [gameplay rules](docs/gameplay.md) and the [AI, 3D, and Web3 vision](docs/ai-3d-web3-vision.md).

## Save data

Current saves use schema version 7. The importer validates bounded creator publications, adoption and royalty ledgers, event records, response choices, campaign phase progress, and required world data before replacing the active game. It migrates original v0.3 saves and development schemas 1 through 6. Active world effects, creator progression, processed event IDs, campaign progress, and structured history persist in saves. Automatic local saves keep a previous safe copy for recovery. Export backups regularly if you clear browser storage or change devices.

## Development status

The current development branch includes three playable local campaigns, six rival nations, a demand-driven Creator Studio economy, ten research technologies with prerequisites, versioned save migration, and automated engine tests. The existing 3D island and AI-like decision systems are prototypes, not the final world. Desktop and mobile browser acceptance, extended balance review, visual-performance validation, Web3 architecture, and release verification remain outstanding. KINGMAKER is in active development and is not declared a finished release.
