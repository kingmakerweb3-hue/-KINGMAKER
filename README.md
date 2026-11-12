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
- **Economy** lets you buy and sell food and materials against finite world-market stock.
- **Diplomacy** lets you send aid, recall an envoy, offer agreements, and manage conflict.
- **Research** spends science to unlock production and resilience effects.
- **Campaign** tracks the founding objectives, achievements, victory, and defeat.
- **World Director** gives local rule-based advice based on current game state.
- **Creator Studio** stores local creation records in the save.
- **Export save / Import save** move a versioned JSON save between browsers.
- **New nation** starts over while retaining the prior game as a recovery backup.

All game values are simulated and have no real-world or financial value.

## Quality checks

```sh
npm run check
npm test
```

The engine is in `src/engine.js`; the browser interface is in `src/app.js`; automated rules tests are in `tests/engine.test.js`.

## Save data

Current saves use schema version 1. The importer validates bounds and required objects before replacing the active game, and it migrates saves from the original v0.3 prototype. Automatic local saves keep a previous safe copy for recovery. Export backups regularly if you clear browser storage or change devices.

## Development status

The current build is an in-progress v1 foundation. It includes a founding campaign and local simulation; additional balancing, broader content, and release verification remain before calling v1.0 complete.
