# KINGMAKER: AI, 3D, and Web3 Vision

## Product identity

KINGMAKER is a web-first civilization world and Web3 ecosystem—not a mobile app-store game. The intended experience combines a high-fidelity 3D world, deep nation simulation, AI-driven systems, evolving technology, creator tools, and carefully designed blockchain utility.

This document records the product direction. It is not a claim that future systems are already built or live.

## 1. The world

The world should feel like a place, not a flat management screen or a toy diorama.

### Visual and spatial goals
- Large continuous or seamlessly streamed world spaces, with meaningful scale and distance.
- Believable terrain: mountains, valleys, rivers, coastlines, oceans, forests, and climate regions.
- Modern and historical/futuristic built environments: districts, roads, bridges, rail, ports, airports, factories, energy networks, and landmarks.
- High-quality materials, lighting, shadows, reflections, atmospheric effects, weather, and day/night transitions.
- Citizens, traffic, construction activity, public services, and visible consequences of economic decisions.
- A consistent art direction aimed at realism and a premium next-generation simulation—not cartoon-like placeholder assets.

### Technical approach
The existing Three.js island is a prototype. It should not dictate the final quality ceiling. Evaluate the world requirements against browser-native 3D options and higher-fidelity runtimes, including the cost of deployment, performance, asset streaming, mobile-browser constraints, and Web3 integration. Choose the technology based on the target experience rather than convenience or familiarity.

## 2. AI-native world

AI should make the world responsive and surprising while keeping the simulation understandable and fair.

Potential systems:
- World Director that interprets the state of the world and proposes meaningful events and challenges.
- Rival nation agents with goals, constraints, diplomacy, trade, research priorities, and long-term strategies.
- Citizens and organizations with roles, needs, routines, and reactions to local conditions.
- Dynamic world events that respond to player choices rather than appearing only as random pop-ups.
- AI-assisted creator tools for eligible buildings, designs, narratives, and world content.

Implementation principles:
- Start with bounded agent roles, explicit goals, tool permissions, and auditable decisions.
- Keep core economic and competitive outcomes validated by deterministic game rules.
- Protect against prompt injection, abusive generated content, runaway agent actions, and unpredictable costs.
- Clearly label AI-generated content and provide player controls.
- Do not describe rule-based systems as live generative AI. The current World Director and rival logic are rule-based prototypes.

## 3. Technology evolution

Research should visibly change civilization. Technology progression can span foundational infrastructure through industrial, digital, advanced, and speculative future eras. Each era should unlock meaningful systems, not just larger numerical bonuses.

Examples of possible domains:
- Energy and materials
- Agriculture, water, and climate resilience
- Transport and logistics
- Computing, communications, robotics, and automation
- Medicine, education, and quality of life
- Space infrastructure and advanced manufacturing

The final era structure, balance, and fictional technologies remain to be designed.

## 4. Web3 economy

The Web3 layer must have clear utility and must not be confused with ordinary in-game resources.

Before implementation, define:
- Whether KINGMAKER has one asset or distinct coin and token instruments, and what each is for.
- Whether assets are used for access, governance, creator rewards, marketplace settlement, cosmetics, or other concrete utility.
- The chain and standards, transaction costs, bridging policy (if any), and supported wallets.
- Custody model, treasury controls, admin permissions, upgrade policy, and emergency pause procedures.
- Marketplace rules, creator royalties, fees, dispute handling, and prohibited content.
- Security audits, threat modeling, monitoring, and incident response.
- Applicable legal, consumer-protection, tax, sanctions, and financial-promotion requirements in relevant jurisdictions.

No token supply, token price, promised return, exchange listing, or investment outcome is assumed by this roadmap. Do not market game assets as guaranteed investments.

### Purchase and wallet safety
- Never ask users to provide seed phrases or private keys.
- Wallet connection must use established wallet standards and explicit transaction signing.
- Show network, asset, amount, fees, destination, and transaction consequences before confirmation.
- Do not take custody of user funds unless a separately reviewed and legally approved custody model is intentionally adopted.
- No live purchase, token sale, or transfer should be enabled before legal review, independent security review, testnet validation, and explicit product approval.

## 5. Delivery sequence

1. Stabilize the playable game and verify the existing systems.
2. Define the target 3D world and benchmark candidate rendering/runtime technology.
3. Build a high-quality vertical slice: one polished region with terrain, city, citizens, vehicles, lighting, weather, and meaningful simulation.
4. Expand the AI architecture in bounded, testable stages.
5. Design technology eras and connect them to visible world transformation.
6. Complete Web3 product, economic, legal, and security design.
7. Implement wallet and on-chain features on a test network, audit them, then consider a controlled production launch.
8. Scale the web platform, operations, moderation, support, and marketplace.

## Current status

The current project is a local browser prototype with a rule-based simulation and an early Three.js island. It has no live AI service, blockchain integration, wallet connection, cryptocurrency payments, token issuance, or real-money marketplace. Those are future milestones. The intended destination remains a high-quality AI-enabled Web3 world on the web.
