# Gameplay reference

## Turn order

Each world turn resolves an unchosen event with its conservative default, applies active world modifiers, expires agreements, collects national and local production, advances shipping convoys, charges wages, shipping and military upkeep, consumes food, simulates rival industries and market decisions, resolves conflicts, refreshes commodity supply and prices, then may introduce one new event. The game stores its random seed, so a save continues the same world sequence. Players can respond to a pending event before advancing; if they leave it unanswered, a safe default response is recorded on the next turn.

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

Mines, workshops, factories, and power grids form an input chain: mines extract ore, workshops produce construction materials, and factories consume materials, ore, and power to make goods. Factory output and industrial methods are improved by Precision Manufacturing. Transport hubs lower food logistics demand. Market prices use world stock, base prices, and net turn supply. The player and each rival buy and sell food, materials, ore, manufactured goods, and power against shared finite market stock. Prices are bounded; buy costs round up to whole credits.

National income includes market building output, citizen taxes, and trade-agreement income. Wages scale with employed industrial jobs. The last turn's income, wage costs, balance, production, and consumption appear in the World and Economy panels. Two consecutive negative-balance turns cause a recession, which reduces stability and stops population growth. Positive cash flow after a recession starts a three-turn recovery period.

Six rivals use the same production chains and shared commodity market: Aurelia, Northreach, Meridian, Solenne, Ironmarch, and Duneward. Each has a distinct economic, political, and military priority, risk tolerance, and long-term objective. Rivals consume food and factory inputs, trade against finite shared stock, and maintain a three-turn investment or research plan. They compare food, energy, ore, materials, technology, and faction priorities before choosing what to develop. Their reports show the current action, plan, objective, employed workforce, treasury, and recent interaction history. Player investment, trade, research, aid, agreements, and conflict are remembered; recent aggression can block an alliance. Diplomatic rivals may form strategic alliances when relations are high and their current priorities permit it.

## National population and regional workforce

Population is tracked locally on each island. When an unclaimed island joins the player nation, its existing residents are added to the national population. National workforce requirements, employment, wages, food consumption, taxes, power coverage, campaign thresholds and population-based intelligence use the combined population of every player-controlled territory. Rival and unclaimed residents remain outside the player total.

Home-island buildings are staffed by home residents. Districts add local job positions: residential 1, commercial 3, industrial 5 and agricultural 4. District output is staffed by residents on the same island, so a small or underpopulated region cannot operate unlimited district production. Remote residential districts grow their own island when the national food reserve is healthy, stability is at least 45, the economy is not in recession, and employed workers meet national job demand. Home-island housing, medicine and residential districts determine the home population cap; remote residential districts provide a local capacity and growth allowance. A food shortage reduces home residents first, then other player-held islands, while keeping the national total synchronized.

The current economy uses a pooled national food reserve for all owned territories; local food stockpiles remain cargo storage for shipping rather than separate household reserves. Schema 16 stores national population as the sum of player-owned territory populations, plus validated local garrisons and fortification levels. Older saves preserve the previous national figure as home-island population, then add saved populations of other player-owned islands; schema-15 saves receive deterministic local defense defaults.

## Archipelago, harbors and shipping

The home island begins with a level-1 national receiving harbor. A player must claim an outer island before building its harbor. Harbor level 1 costs 40 materials and 65 credits; upgrades to level 2 cost 50 materials and 85 credits, and level 3 costs 60 materials and 105 credits. The national receiving harbor is fixed at level 1.

Remote resource extraction is stored locally instead of appearing immediately in the national treasury. Each island holds up to 500 units of each shippable resource. Home-island extraction continues to feed national production directly. The shipping resource list is food, materials, ore, power and science.

Open a one-way route from a claimed outer island to another player-controlled island with an operational harbor. A route costs 20 materials and 35 credits. It loads up to 10 units per convoy at level-1 ports; each additional harbor level above 1 at either endpoint adds 5 capacity, up to 30. Travel time is based on island distance (one to five turns); Integrated Logistics reduces the journey by one turn, to a minimum of one. Each active route adds one logistics and costs 2 credits per turn; Integrated Logistics reduces route upkeep to 1 credit.

Convoys load from the source stockpile, then deliver after the travel timer. Delivery to the home port enters national reserves; delivery to another outer island enters that island's stockpile and can be forwarded on a separate route. If either port is no longer player-controlled or loses its harbor, the route pauses and cargo remains in transit. Route state, cargo, stockpiles, harbor levels and bilateral trade contracts persist in schema-16 saves. Schema 15 and earlier saves migrate automatically.

Rival nations also develop their own maritime infrastructure. They build level-1 harbors on controlled islands, open finite resource extraction sites, store output in local island stockpiles, and establish up to three autonomous shipping lanes between their own ports. Rival convoys deliver cargo into that rival's national reserves, pay upkeep from the rival treasury (reduced by its Logistics research), and pause without losing cargo when a port changes ownership or the rival cannot afford upkeep. Rival routes are rendered in the 3D world using their nation's route color and appear in the selected island's maritime intelligence panel. Rival shipping never charges the player's treasury or contributes to the player's logistics ledger.
## International maritime trade

An active five-turn trade agreement grants reciprocal port access between the player and that rival. Either nation can be the seller: choose one player harbor and one partner harbor, then choose the source and destination direction. The home harbor can ship directly from national reserves; outer-island ports use their local stockpiles. A route costs 20 materials and 35 credits, shares the 50-route network limit, and uses the same harbor-based capacity, distance-based travel time and route upkeep as domestic shipping.

International cargo is limited to food, materials, ore and power. The contract locks a unit price at creation using the current world-market price plus the selected 0%, 5%, 10%, 15% or 20% tariff. The buyer pays the seller on delivery. If the buyer cannot afford the cargo or the destination lacks storage, the undelivered amount waits in transit rather than being lost. Deliveries count toward campaign trade-volume objectives.

A 0% tariff improves relations by one point per delivered convoy; 5% and 10% are neutral; 15% and 20% reduce relations by one point per delivered convoy. A conflict voids the trade agreement and pauses the route; an expired agreement also pauses it until renewed. Cargo remains in transit while access is suspended. International lanes are shown in gold in the 3D archipelago and in the diplomacy and island inspectors.



## Territorial campaigns

A hostile rival can be challenged for a specific island it controls. Relations must be -20 or lower, and declaring a campaign costs 25 credits and 10 power. Active alliances and non-aggression pacts prevent the declaration; any other active agreement with that rival expires when conflict begins. Choose the target island in the Diplomacy panel before declaring the campaign.

The existing three-turn conflict simulation compares the player's power, power-grid infrastructure and researched technologies against the rival's corresponding strength. A targeted island adds a defensive bonus based on its residents, development and harbor level. Both nations pay the existing wartime power and stability costs during the campaign.

If the player wins, the selected island transfers to the player nation. Its residents join national population, the rival loses those residents (without dropping below one), and the island retains its harbor, local stockpile, extraction deposits, buildings, districts and roads. Routes that touch the captured island pause immediately; cargo already in transit is preserved. Captured extraction sites continue producing into the island's local stockpile on subsequent turns. A failed campaign does not change territorial ownership. Peace negotiations can end an active campaign before its automatic resolution.

Targeted conflicts are saved and validated. Older conflict records without a territorial target continue to resolve as non-territorial conflicts.

## Living world events

The world can produce international energy crises, food shortages, industrial revolutions, technological breakthroughs, financial crises, trade disruptions, natural disasters, political instability, diplomatic disputes, international conflicts, resource discoveries, and infrastructure opportunities. Event effects alter power reserves and prices, factory output, market supply, treasury income, stability, diplomatic relations, research, or infrastructure. Temporary effects have a bounded duration and are applied once per turn. An event cannot be processed twice after its response is stored.

Events that need a player decision display their affected nations and response costs in the World panel. Responses use fixed, validated choices; purchases draw from the same finite market stock used by trade. If a player advances without choosing, the engine records a conservative default. Rivals respond through their existing production, trade, strategic plans, and faction-specific priorities. Notable events and responses appear in saved world history with context and affected nations.

## Technologies

| Technology | Science cost | Effect |
| --- | ---: | --- |
| Advanced Agriculture | 28 | Farm output +50% |
| Industrial Methods | 34 | Workshop output +50% |
| Trade Networks | 40 | Market output +50% |
| Precision Manufacturing | 55 | Factory output +50% (requires Industrial Methods and Energy Systems) |
| Civic Governance | 38 | Stability +10 immediately and +2 recovery per turn |
| Energy Systems | 48 | Power Grid output +50% |
| Public Health | 44 | Raises population growth and population capacity |
| Advanced Extraction | 42 | Mine output +50% |
| Integrated Logistics | 46 | Transport Hub logistics output +50%, reducing food demand |
| Sustainable Urbanism | 50 | Housing capacity output +50%; national wage upkeep −10% |

## Creator Studio

Publish a design in one of six supported disciplines: City Design, Building, Technology, Business, Artwork, or World Lore. Creator Studio shows live category demand and why nations may want a design. Demand responds to population capacity, material and food pressure, science reserves, treasury health, stability, influence, diplomatic relations, and relevant active events. Rival nations independently adopt a published design when its category meets their demand, apply its real effect during their economy turn, and record that use. A creator receives one success royalty per rival-design pairing, capped at 10 credits; this is a bounded in-game reward, not a recurring or real-money payment.

Creator profiles are derived from validated records: each successful rival use grants 10 experience, reputation rises by 5 to a cap of 100, and each 50 experience advances one level up to level 20. Higher levels modestly scale commissioned effects. Publishing is limited to 500 lifetime entries per save, and the total adoption history is bounded. Archiving prevents new use; a design currently commissioned by the player or actively used by a rival cannot be archived. Withdraw an active national commission to stop its effect. Its first commissioning costs 30 credits and 12 materials; reactivating a previously commissioned design does not charge again. A nation can maintain up to three active commissions. Publications, demand-driven adoptions, successful uses, experience, royalties, and commission history are local to the save and have no external marketplace, real-money value, or token integration.

## Diplomacy

Aid costs credits and improves relations. Recalling an envoy costs influence and strains relations. Trade agreements add credits each turn; research agreements add science; alliances add influence and prevent conflict; non-aggression pacts prevent conflict. Trade and research agreements last five turns; alliances last twelve. Conflicts require hostile relations, credits, and power. They resolve after three turns based on national power, infrastructure, and research; fighting drains power and stability. Peace can be negotiated for credits. An active trade agreement also grants reciprocal port access for international shipping. Conflict voids trade access and pauses those routes; expired agreements pause them until renewed.

## Campaigns and saves

The campaign screen has three scenarios: **A New Horizon** (balanced nation-building), **The Long Winter** (stability and survival), and **A Seat at the Council** (diplomacy and alliance). Each campaign advances through short-term, medium-term, and long-term phases with six objectives tied to resources, infrastructure, research, trade, treaties, or surviving crises. Completing all six wins that scenario. Stability at zero or population at ten or lower causes defeat. Campaign progress, world event responses, trade volume, and peaceful dispute resolutions are tracked in the save.

Saves use versioned JSON with resource, economic ledger, structured event history, active event and duplicate-processing state, rival plan and memory, treaty, campaign phase and progress, and validated creator publication, adoption, commission, progression, and reward ledgers. Version 1 through 6 development saves and original v0.3 saves migrate into schema 7. Older creator entries remain in the archive and migrate as uncommissioned unless they were active commissions in schema 6. The browser retains a recovery copy before each autosave and before starting another campaign, and a corrupt primary save cannot replace the last validated recovery copy.


## Island garrisons and fortifications

Every island tracks a local garrison and fortification level. New campaigns begin with two garrison units on the home island, one on most rival islands, and three plus level-one fortifications on Ironmarch. Unclaimed islands begin undefended. Older saves migrate to these defaults while retaining their existing territory ownership and infrastructure.

A garrison unit reserves ten local residents, so an island's manpower limit is one unit per ten residents. Reserved residents count as military employment in the national workforce ledger but are removed from civilian staffing for home buildings and local districts. Recruiting one unit costs 12 materials, 6 ore and 20 credits. Each player garrison unit adds eight offensive strength when the home island participates in a territorial campaign and costs one credit per turn in separate military upkeep; it is not charged a second civilian wage. Local garrisons also contribute eight points each to the defense of their own island.

Fortifications can be upgraded through three levels. The costs are 25 materials and 20 credits for level one, 50 materials and 40 credits for level two, and 75 materials and 60 credits for level three. Each level adds twelve defensive strength and one point of local development. Fortifications are represented by visible defensive walls and watchtowers in the 3D archipelago; garrison buildings and unit markers appear on defended islands.

Rivals pay upkeep for their local garrisons. When relations are hostile or a territorial campaign targets one of their islands, a rival can spend its own materials and credits to fortify the threatened territory, then recruit additional defenders using local manpower, ore and its own treasury. Territorial campaign scoring includes the target island's population, development, harbor, garrison and fortification strength. Rival defense decisions are deterministic for a given save and turn sequence.


## Territorial counterattacks

When a player wins a targeted territorial campaign, part of the former garrison may escape by sea. The captured island records its former owner, the loss turn, and the surviving expeditionary force. The remaining local garrison transfers with the island; escaped units are held separately for one possible counterattack.

A former owner may launch a counterattack within six turns when relations remain at or below -50, its stability is at least 30, and it can pay 40 credits and 10 power. An active alliance or non-aggression pact prevents the attack. The AI consumes the escaped force when it launches, so the same force cannot be reused.

Counterattacks resolve over three battle rounds. The rival's assault strength uses its power reserve, power infrastructure, research and escaped garrison. The player's defence includes national power, power infrastructure, research, and the target island's population, development, harbor, garrison and fortifications. Island garrisons and fortifications therefore matter directly when defending an exposed acquisition.

If the rival wins, the island and the transferable local population return to the former owner, its garrison is re-established from the surviving assault force, and shipping routes touching the island pause without discarding cargo in transit. If the player wins, the counterattack is marked repelled and its escaped force is exhausted. The player may also negotiate peace for 35 credits; this withdraws an active counterattack without changing ownership.

Counterattack history is stored on the territory and active battles record their initiator and assault size. Save schema 17 validates these fields. Schema 16 and earlier campaigns migrate without inventing historical losses or counterattack forces.
