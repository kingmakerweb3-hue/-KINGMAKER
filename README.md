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

The current playable prototype is a browser game built with JavaScript and a small Node.js development server. The nation simulation remains local single-player. The development marketplace now supports signed EVM-wallet sessions for listing management; this does not make the nation simulation multiplayer or enable real asset trading.

### Run locally

Requirements: Node.js 20 or newer.

```sh
npm run dev
```

Open <http://127.0.0.1:4173>. The server only binds to loopback.

### Current systems

- **Advance World** resolves production and consumption, rival decisions, market supply and prices, diplomacy, agreements, conflicts, and world events.
- **Nation** lets you rename the nation, set its government, build infrastructure, and enact four temporary national policies: food assistance, research funding, public health, and industrial incentives.
- **Economy** lets you build industries; buy and sell food, materials, ore, and goods against shared finite world-market stock; and review the national income and wage ledger.
- **Diplomacy** lets you send aid, recall an envoy, offer agreements, and manage conflict.
- **Research** unlocks production and resilience effects.
- **Campaign** offers three scenarios with objectives, achievements, victory, and defeat.
- **World Director** provides local rule-based advice based on current game state. Citizens gain career experience and levels, pursue aspirations, adjust civic trust based on wellbeing and active policies, and retain career milestones in memory. This is deterministic simulation logic, not external LLM agents. A civic mandate report derives public approval, average trust, governing mandate strength, and the population's leading unmet need directly from citizen state. Governments publish measurable party manifestos; delivery is assessed at election time and fulfilled or broken promises change the incumbent's next vote forecast. National elections run every 12 turns: citizen needs, trust, national stability, and incumbent status shape transparent party vote forecasts and results. Election outcomes affect national stability and are recorded in world history. A political-pressure model converts low approval and unmet needs into an unrest index, public protests on a four-turn cooldown, stability penalties, and a sustained government-crisis status. Elected parties implement distinct governing agendas: Civic Alliance improves belonging and trust, Prosperity League boosts food and credit output, and National Security Front improves safety and reduces protest disruption. Each party discounts aligned policy costs by 15%. A cabinet reviews national needs every four turns and can automatically fund a matching policy when affordable, while protecting a 20-credit treasury reserve; cabinet decisions and spending are recorded in the save and world history. These are deterministic simulation rules, not real-world political polling.
- **Creator Studio** lets you publish designs into a bounded local market. Rival nations can adopt designs when their needs match, apply their effects, and pay capped in-game royalties.
- **3D World** opens an explorable 3D island with high-density procedural terrain, varied elevation, expanded forests, detailed building facades, animated citizens and traffic, a moving ocean surface, atmospheric clouds, a day/night lighting cycle, orbit/zoom/pan controls, and live terrain-surface construction.
- **3D construction and roads** let players place buildings and connect districts. Positions and roads persist in local saves; connected districts gain logistics and credits.
- **Save export/import** moves a versioned JSON save between browsers.

All current game values are simulated and have no real-world or financial value. Wallet signature sign-in is implemented for development marketplace identity only. No cryptocurrency payment, real-money purchase, token transfer, or production on-chain ownership flow is enabled.

## Product direction and milestones

1. **Foundation and quality:** stabilize the simulation, saves, controls, responsive web experience, and automated tests.
2. **Next-generation world:** establish the visual/technical foundation for high-fidelity environments, scalable terrain, realistic lighting, animation, population activity, and world streaming. Evaluate whether the current Three.js prototype remains suitable or whether a more capable 3D runtime is needed.
3. **AI world:** move from rule-based behavior toward clearly scoped AI agents and world systems, with deterministic safeguards and transparent player controls.
4. **Technology and civilization depth:** expand technology eras and make research visibly transform the world and its systems.
5. **Web3 architecture:** finalize the purpose and distinction of any coin and token, chain selection, wallet model, asset ownership rules, marketplace design, security review, and applicable legal/compliance requirements.
6. **Web3 implementation:** only after the design and security gates are approved, build and test wallet connection, on-chain features, and purchase flows. Never expose private keys or seed phrases to the game or its support systems.
7. **Web release:** prepare a secure, scalable web deployment and staged public launch. App-store distribution is not the product target.


### Shared marketplace development API

Run `npm install` and `npm run dev`, then open the game through the local server. The Web3 & Assets tab uses a one-time EVM wallet signature to establish a server-side session before publishing or cancelling listings. The server verifies the signature, consumes the challenge nonce, stores the session in an HttpOnly SameSite=Strict cookie, and derives the listing seller from that verified session. Listing records are persisted in `data/marketplace.json`, so browser sessions using the same server see the same feed.

This remains a development prototype: wallet sign-in proves control of an address, not ownership of the locally recorded asset. Inventory is still browser-local. Prices are simulated game credits; there are no purchases, payments, escrow, asset transfers, or blockchain settlement. Sessions are in-memory and reset when the server restarts. The server binds to loopback by default and accepts only `http://127.0.0.1:4173` and `http://localhost:4173` origins by default; configure `KINGMAKER_APP_ORIGINS` explicitly if the local port changes. It must not be exposed publicly.

