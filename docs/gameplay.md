# Gameplay reference

## Turn order

Each world turn applies active agreement effects, collects national production and taxes, consumes food, adjusts population and stability, simulates rival economies and decisions, resolves conflicts, refreshes market supply and prices, then rolls for a world event. The game stores its random seed, so a save continues the same world sequence.

## National economy

| Infrastructure | Cost per level | Effect per turn |
| --- | --- | --- |
| Farm | 24 materials, 36 credits | 12 food |
| Workshop | 30 materials, 48 credits | 9 materials |
| Market | 28 materials, 52 credits | 10 credits, plus population tax |
| Academy | 36 materials, 68 credits | 5 science |
| Power Grid | 42 materials, 74 credits | 4 power |
| Housing | 32 materials, 44 credits | 50 population capacity and gradual growth |

Food consumption is one unit per 12 citizens, rounded up. Food shortages reduce stability and population. Stability recovers while food is available. Power below one tenth of population reduces stability. Population grows when food is plentiful, stability is at least 45, and housing and technology allow the population cap.

Market prices use the world's available stock, base prices, and net production flow. Player trades and rival imports or exports change market stock. Prices are bounded. Each trade quotes the current price and has a finite market inventory.

## Technologies

| Technology | Science cost | Effect |
| --- | ---: | --- |
| Advanced Agriculture | 28 | Farm output +50% |
| Industrial Methods | 34 | Workshop output +50% |
| Trade Networks | 40 | Market output +50% |
| Civic Governance | 38 | Stability +10 immediately and +2 recovery per turn |
| Energy Systems | 48 | Power Grid output +50% |
| Public Health | 44 | Raises population growth and population capacity |

## Diplomacy

Aid costs credits and improves relations. Recalling an envoy costs influence and strains relations. Trade agreements add credits each turn; research agreements add science; alliances add influence and prevent conflict; non-aggression pacts prevent conflict. Trade and research agreements last five turns; alliances last twelve. Conflicts require hostile relations, credits, and power. They resolve after three turns based on national power, infrastructure, and research; fighting drains power and stability. Peace can be negotiated for credits.

## Campaigns and saves

The campaign screen has three scenarios: **A New Horizon** (balanced nation-building), **The Long Winter** (stability and survival), and **A Seat at the Council** (diplomacy and alliance). Each has four tracked objectives. Completing all four wins; stability at zero or population at ten or lower causes defeat.

Saves use versioned JSON with resource, history, rival, treaty, campaign, and creator-registry validation. Version 1 development saves and original v0.3 saves migrate into the current format. The browser retains a recovery copy before each autosave and before starting another campaign.
