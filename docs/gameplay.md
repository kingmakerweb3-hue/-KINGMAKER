# Gameplay reference

## Turn order

Each world turn applies active agreement effects, collects production and taxes, pays wages, consumes food, advances the national economic phase, simulates rival industries and market decisions, resolves conflicts, refreshes commodity supply and prices, then rolls for a world event. The game stores its random seed, so a save continues the same world sequence.

## National economy

| Infrastructure | Cost per level | Effect per turn |
| --- | --- | --- |
| Farm | 24 materials, 36 credits | 12 food |
| Mine | 32 materials, 52 credits | 10 ore |
| Workshop | 30 materials, 48 credits | 9 materials |
| Factory | 48 materials, 86 credits | 10 goods per active factory; consumes 5 materials, 3 ore, and 2 power |
| Transport Hub | 38 materials, 62 credits | Raises the people served per food from 12 to 20, up to eight hubs |
| Market | 28 materials, 52 credits | 10 credits, plus population tax |
| Academy | 36 materials, 68 credits | 5 science |
| Power Grid | 42 materials, 74 credits | 4 power |
| Housing | 32 materials, 44 credits | 50 population capacity and gradual growth |

Food consumption is one unit per 12 citizens, rounded up; each transport hub adds one citizen to the divisor, up to eight. Food shortages reduce stability and population. Stability recovers while food is available. Power below one tenth of population reduces stability. Population grows when food is plentiful, stability is at least 45, there are at least ten job positions per 100 citizens, and housing and technology allow the population cap. Industrial output scales down when required workforce exceeds population. Factory output is limited by available materials, ore, and power; it will pause when staffing or inputs cannot support a full factory cycle.

Mines, workshops, factories, and power grids form an input chain: mines extract ore, workshops produce construction materials, and factories consume materials, ore, and power to make goods. Factory output and industrial methods are improved by Precision Manufacturing. Transport hubs lower food logistics demand. Market prices use world stock, base prices, and net turn supply. The player and each rival buy and sell food, materials, ore, and manufactured goods against shared finite market stock. Prices are bounded; buy costs round up to whole credits.

National income includes market building output, citizen taxes, and trade-agreement income. Wages scale with employed industrial jobs. The last turn's income, wage costs, balance, production, and consumption appear in the World and Economy panels. Two consecutive negative-balance turns cause a recession, which reduces stability and stops population growth. Positive cash flow after a recession starts a three-turn recovery period.

Rivals use the same production chains and shared commodity market. They consume food, consume factory inputs, trade to manage shortages and surpluses, expand farms, mines, workshops, academies, factories, power grids, transport hubs, and markets, and research industrial technologies. Their faction traits guide investment: industrial nations favor factories, security nations shore up energy, research and agriculture nations choose matching technologies, and commercial nations expand markets. Rival reports show their latest turn action, strategic stance, employed workforce, and treasury. Diplomatic rivals may form strategic alliances when relations are high.

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

Saves use versioned JSON with resource, economic ledger, history, rival, treaty, campaign, and creator-registry validation. Version 1 and 2 development saves and original v0.3 saves migrate into the current format. The browser retains a recovery copy before each autosave and before starting another campaign, and a corrupt primary save cannot replace the last validated recovery copy.
