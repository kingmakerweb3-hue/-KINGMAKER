# KINGMAKER

KINGMAKER is a local, single-player nation-building game. It is built with plain browser JavaScript and a small Node.js development server; the game does not need a database, paid service, account, crypto wallet, or external AI service.

## Run locally

Requirements: Node.js 20 or newer.

```sh
npm run dev
```

Open <http://127.0.0.1:4173>. The server only binds to loopback.

## Controls

- **Advance World** resolves production and consumption, rival decisions, market supply and prices, diplomacy, agreements, conflicts, and world events.
- **Nation** lets you rename the nation, set its government, and build infrastructure.
- **Economy** lets you build mines, factories, transport hubs, and other industries; buy and sell food, materials, ore, and goods against shared finite world-market stock; and review the national income and wage ledger.
- **Diplomacy** lets you send aid, recall an envoy, offer agreements, and manage conflict. Each rival turn reports its latest market, investment, or research action.
- **Research** spends science to unlock production and resilience effects.
- **Campaign** offers three scenarios with objectives, achievements, victory, and defeat.
- **World Director** gives local rule-based advice based on current game state.
- **Creator Studio** lets you publish designs into a bounded local market. Rival nations can adopt designs when their needs match, apply their effects, and pay one capped royalty after successful use. Authors gain persistent experience and reputation; you can also commission up to three designs for your nation.
- **3D World** opens an explorable island with orbit, zoom, pan, animated citizens, forests, a capital, and live building placement.
- **3D construction** lets you select a building, place it at an exact island location, and pay the normal in-game resource cost. Building positions persist in your save.
- **Road construction** lets you choose two island points to create road segments. Your road network is validated and saved with your nation. Up to 60 small vehicles animate along player-built road segments in the 3D view. Roads crossing district zones connect them, improving logistics and adding credits each turn.
- **Export save / Import save** move a versioned JSON save between browsers.
- **New nation** starts over while retaining the prior game as a recovery backup.

All game values are simulated and have no real-world or financial value.

## Quality checks

```sh
npm run check
npm test
```

The engine is in `src/engine.js`; the browser interface is in `src/app.js`; automated rules tests are in `tests/engine.test.js`.

See [`docs/gameplay.md`](docs/gameplay.md) for economy, technology, diplomacy, campaign, and save rules.

## Save data

Current saves use schema version 7. The importer validates bounded creator publications, adoption and royalty ledgers, event records, response choices, campaign phase progress, and required world data before replacing the active game. It migrates original v0.3 saves and development schemas 1 through 6. Active world effects, creator progression, processed event IDs, campaign progress, and structured history persist in saves. Automatic local saves keep a previous safe copy for recovery. Export backups regularly if you clear browser storage or change devices.

## Development status

The current development branch includes three playable local campaigns, six rival nations, a demand-driven Creator Studio economy, ten research technologies with prerequisites, versioned save migration, and 50 automated engine tests. GitHub Actions checks syntax and the test suite on Node.js 20 and 22. Desktop and mobile browser acceptance, extended balance review, and release verification remain outstanding; this is not yet declared a finished v1.0 release.
