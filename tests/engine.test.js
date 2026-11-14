const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../src/engine.js");

test("new game has a complete, validated state", () => {
  const state = Engine.createInitialState({ seed: 2 });
  assert.equal(state.schemaVersion, Engine.SAVE_VERSION);
  assert.equal(Engine.validateSave(state).nation.name, "New Horizon");
  assert.deepEqual(Object.keys(state.rivals).sort(), ["aurelia", "duneward", "ironmarch", "meridian", "northreach", "solenne"]);
  assert.equal(state.rivals.ironmarch.personality, "Shield Compact");
});

test("save validation rejects unsafe resource values and unsupported versions", () => {
  const state = Engine.createInitialState();
  state.resources.food = -1;
  assert.throws(() => Engine.validateSave(state), /Resource value is invalid/);
  state.resources.food = 1;
  state.schemaVersion = 999;
  assert.throws(() => Engine.validateSave(state), /version is not supported/);
  state.schemaVersion = Engine.SAVE_VERSION;
  state.economy.production.ore = Engine.RESOURCE_LIMIT + 1;
  assert.throws(() => Engine.validateSave(state), /production ledger/);
});

test("save rotation backs up only a validated prior save", () => {
  const state = Engine.createInitialState({ seed: 1 });
  const prior = Engine.exportSave(state);
  const values = new Map([["primary", prior], ["recovery", "older recovery"]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  state.turn++;
  Engine.saveWithRecovery(storage, state, "primary", "recovery");
  assert.equal(Engine.migrateSave(JSON.parse(values.get("recovery"))).turn, 1);
  assert.equal(Engine.migrateSave(JSON.parse(values.get("primary"))).turn, 2);

  values.set("primary", "{corrupt");
  values.set("recovery", prior);
  state.turn++;
  Engine.saveWithRecovery(storage, state, "primary", "recovery");
  assert.equal(values.get("recovery"), prior);
  assert.equal(Engine.migrateSave(JSON.parse(values.get("primary"))).turn, 3);
});

test("version 2 saves migrate to strategic AI schema without losing the scenario baseline", () => {
  const old = Engine.createInitialState({ seed: 6 });
  old.schemaVersion = 2;
  const buildingStart = old.campaign.buildingStart;
  delete old.resources.ore; delete old.resources.goods;
  delete old.economy;
  for (const key of ["ore", "goods"]) {
    delete old.market.stock[key]; delete old.market.basePrices[key]; delete old.market.prices[key]; delete old.market.lastFlow[key];
  }
  for (const rival of Object.values(old.rivals)) {
    delete rival.resources.ore; delete rival.resources.goods; delete rival.resources.influence;
    delete rival.buildings.mine; delete rival.buildings.factory; delete rival.buildings.transport;
    delete rival.activity;
    delete rival.personality; delete rival.economicPriority; delete rival.politicalPriority; delete rival.militaryPriority;
    delete rival.riskTolerance; delete rival.longTermObjective; delete rival.plan; delete rival.memory;
  }
  delete old.rivals.solenne; delete old.rivals.ironmarch; delete old.rivals.duneward;
  const migrated = Engine.migrateSave(old);
  assert.equal(migrated.schemaVersion, Engine.SAVE_VERSION);
  assert.equal(migrated.campaign.buildingStart, buildingStart);
  assert.equal(migrated.resources.ore, 48);
  assert.equal(migrated.rivals.aurelia.activity, "Adapting industry");
  assert.equal(Object.keys(migrated.rivals).length, 6);
  assert.equal(migrated.rivals.duneward.economicPriority, "extraction");
});

test("version 3 saves migrate strategic personalities without losing interaction history", () => {
  const old = Engine.createInitialState({ seed: 18 });
  old.schemaVersion = 3;
  const rival = old.rivals.aurelia;
  delete rival.personality; delete rival.economicPriority; delete rival.politicalPriority; delete rival.militaryPriority;
  delete rival.riskTolerance; delete rival.longTermObjective; delete rival.plan; delete rival.memory;
  const migrated = Engine.migrateSave(old);
  assert.equal(migrated.schemaVersion, Engine.SAVE_VERSION);
  assert.equal(migrated.rivals.aurelia.personality, "Merchant Republic");
  assert.deepEqual(migrated.rivals.aurelia.memory, []);
});

test("version 4 saves gain living-world defaults without losing campaign progress", () => {
  const old = Engine.createInitialState({ seed: 19 });
  old.schemaVersion = 4;
  old.campaign.completedObjectives = ["feed-the-people", "build-the-future"];
  delete old.campaign.phaseIndex; delete old.campaign.progress; delete old.world;
  delete old.market.stock.power; delete old.market.basePrices.power; delete old.market.prices.power; delete old.market.lastFlow.power;
  const migrated = Engine.migrateSave(old);
  assert.equal(migrated.schemaVersion, Engine.SAVE_VERSION);
  assert.equal(migrated.campaign.phaseIndex, 1);
  assert.equal(migrated.market.stock.power, 260);
  assert.deepEqual(migrated.world.activeEvents, []);
  assert.deepEqual(migrated.campaign.completedObjectives, ["feed-the-people", "build-the-future"]);
  assert.ok(Engine.validateSave(migrated));
});

test("world event responses are enumerated, atomic, one-time, and survive save reloads", () => {
  const state = Engine.createInitialState({ seed: 20 });
  const event = { id: "world-test-energy", key: "energy_crisis", startedTurn: 1, remainingTurns: 3, status: "pending", choiceId: null, affectedNationIds: ["player"], lastAppliedTurn: 1 };
  state.world.activeEvents.push(event);
  state.resources.credits = 100;
  state.market.stock.power = 9;
  assert.throws(() => Engine.resolveWorldEvent(state, event.id, "import"), /unavailable or unaffordable/);
  assert.equal(state.resources.credits, 100);
  assert.equal(state.resources.power, 20);
  assert.throws(() => Engine.resolveWorldEvent(state, event.id, "grant-power"), /response is invalid/);
  state.market.stock.power = 10;
  Engine.resolveWorldEvent(state, event.id, "import");
  assert.equal(state.resources.credits, 75);
  assert.equal(state.resources.power, 30);
  assert.equal(state.market.stock.power, 0);
  assert.ok(state.world.processedEventIds.includes(event.id));
  assert.throws(() => Engine.resolveWorldEvent(state, event.id, "import"), /no longer awaiting/);
  const loaded = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.equal(loaded.world.activeEvents[0].choiceId, "import");
  assert.ok(loaded.events.some(entry => entry.type === "decision" && entry.details.summary.includes("10 power")));
  loaded.world.activeEvents[0].choiceId = "free-power";
  assert.throws(() => Engine.validateSave(loaded), /World event record is invalid/);
});

test("an international energy crisis pauses factories, raises power prices, and redirects rival investment", () => {
  const makeState = seed => {
    const state = Engine.createInitialState({ seed });
    state.buildings = { farm: 0, mine: 0, workshop: 0, factory: 1, transport: 0, market: 0, academy: 0, power: 0, housing: 0 };
    state.resources.food = 500; state.resources.materials = 20; state.resources.ore = 10; state.resources.power = 3; state.resources.goods = 0;
    state.market.stock.power = 0;
    for (const rival of Object.values(state.rivals)) {
      rival.buildings = { farm: 0, mine: 0, workshop: 0, factory: 0, transport: 0, market: 0, academy: 0, power: 0, housing: 0 };
      rival.resources.food = 500; rival.resources.materials = 100; rival.resources.ore = 50; rival.resources.power = 0; rival.resources.credits = 0;
    }
    state.rivals.northreach.resources.credits = 200;
    return state;
  };
  const normal = makeState(225), crisis = makeState(225);
  crisis.world.activeEvents.push({ id: "world-test-crisis", key: "energy_crisis", startedTurn: 1, remainingTurns: 2, status: "active", choiceId: "ration", affectedNationIds: ["player"], lastAppliedTurn: 1 });
  crisis.world.processedEventIds.push("world-test-crisis");
  Engine.advanceTurn(normal); Engine.advanceTurn(crisis);
  assert.ok(crisis.economy.production.goods < normal.economy.production.goods);
  assert.ok(crisis.market.prices.power > normal.market.prices.power);
  assert.ok(crisis.rivals.northreach.buildings.power > 0);
});

test("world event catalog explains major crisis, diplomatic, industrial, and discovery systems", () => {
  for (const key of ["energy_crisis", "food_shortage", "industrial_revolution", "tech_breakthrough", "financial_crisis", "trade_disruption", "natural_disaster", "political_instability", "diplomatic_dispute", "international_conflict", "resource_discovery", "infrastructure_opportunity"]) {
    const info = Engine.worldEventInfo(key);
    assert.ok(info && info.title && info.description, key);
  }
  assert.equal(Engine.worldEventInfo("credit_grant"), null);
});

test("legacy v0.3 saves migrate while keeping player progress", () => {
  const migrated = Engine.migrateSave({
    turn: 9, name: "Test Nation", food: 66, materials: 51, credits: 88,
    population: 120, stability: 73, research: 11, buildings: { farm: 3 },
    tech: ["agriculture", "unknown"], events: ["Old event"]
  });
  assert.equal(migrated.turn, 9);
  assert.equal(migrated.nation.name, "Test Nation");
  assert.equal(migrated.resources.food, 66);
  assert.equal(migrated.buildings.farm, 3);
  assert.deepEqual(migrated.technologies, ["agriculture"]);
  assert.equal(migrated.events.at(-1).text, "Old event");
});

test("building costs are atomic and successful construction changes production", () => {
  const state = Engine.createInitialState();
  state.resources.materials = 0;
  const oldCredits = state.resources.credits;
  assert.throws(() => Engine.build(state, "farm"), /Not enough materials/);
  assert.equal(state.resources.credits, oldCredits);
  state.resources.materials = 50;
  const oldOutput = Engine.productionFor(state.buildings).food;
  Engine.build(state, "farm");
  assert.equal(Engine.productionFor(state.buildings).food, oldOutput + 12);
});

test("market buys and sells respect affordability, stock and inventory", () => {
  const state = Engine.createInitialState();
  const oldStock = state.market.stock.food;
  Engine.trade(state, "food", 10);
  assert.equal(state.resources.food, 130);
  assert.equal(state.market.stock.food, oldStock - 10);
  assert.throws(() => Engine.trade(state, "food", 1000), /Not enough credits|not have enough stock/);
  Engine.trade(state, "food", -5);
  assert.equal(state.resources.food, 125);
  assert.equal(state.market.stock.food, oldStock - 5);
});

test("ore and manufactured goods can be traded with integer-safe currency", () => {
  const state = Engine.createInitialState();
  state.market.prices.ore = 1.25;
  const before = state.resources.credits;
  Engine.trade(state, "ore", 1);
  assert.equal(state.resources.credits, before - 2);
  assert.equal(state.resources.ore, 49);
  Engine.trade(state, "goods", -1);
  assert.equal(state.resources.goods, 7);
  assert.ok(Number.isInteger(state.resources.credits));
});

test("factories convert materials, ore, and power into goods and award industrial progress", () => {
  const state = Engine.createInitialState({ seed: 31 });
  Engine.build(state, "factory");
  assert.ok(state.achievements.includes("industrialist"));
  const before = { ...state.resources };
  Engine.advanceTurn(state);
  assert.equal(state.resources.goods, before.goods + 10);
  assert.equal(state.economy.consumption.materials, 5);
  assert.equal(state.economy.consumption.ore, 3);
  assert.equal(state.economy.consumption.power, 2);
  assert.equal(state.economy.production.goods, 10);
  assert.ok(state.resources.materials < before.materials + 9);
});

test("precision manufacturing increases working factory output", () => {
  const state = Engine.createInitialState({ seed: 33 });
  state.buildings.factory = 1;
  state.technologies.push("agriculture", "industry", "energy");
  state.resources.science = Engine.TECHNOLOGIES.manufacturing.cost;
  const baseOutput = Engine.economicSnapshot(state).production.goods;
  Engine.research(state, "manufacturing");
  assert.equal(baseOutput, 10);
  assert.equal(Engine.economicSnapshot(state).production.goods, 15);
});

test("factories pause when any required input is unavailable and transport reduces food demand", () => {
  const state = Engine.createInitialState({ seed: 32 });
  state.buildings.factory = 2;
  state.buildings.mine = 0; state.buildings.workshop = 0;
  state.resources.ore = 2;
  state.resources.materials = 0;
  const beforeGoods = state.resources.goods;
  assert.equal(Engine.economicSnapshot(state).activeFactories, 0);
  state.buildings.transport = 4;
  assert.equal(Engine.economicSnapshot(state).consumption.food, Math.ceil(state.nation.population / 16));
  Engine.advanceTurn(state);
  assert.equal(state.resources.goods, beforeGoods);
});

test("persistent wage deficits cause recession and positive cash flow starts recovery", () => {
  const state = Engine.createInitialState({ seed: 14 });
  for (const id of Object.keys(state.buildings)) state.buildings[id] = 0;
  state.buildings.academy = 15;
  state.resources.credits = 0;
  Engine.advanceTurn(state);
  assert.equal(state.economy.phase, "stable");
  Engine.advanceTurn(state);
  assert.equal(state.economy.phase, "recession");
  const stabilityDuringRecession = state.nation.stability;
  Engine.advanceTurn(state);
  assert.ok(state.nation.stability < stabilityDuringRecession);
  state.buildings.market = 1;
  Engine.advanceTurn(state);
  assert.equal(state.economy.phase, "recovery");
  assert.equal(Engine.validateSave(state).economy.phase, "recovery");
});

test("workforce shortages reduce industrial output and restrict population growth", () => {
  const state = Engine.createInitialState({ seed: 22 });
  for (const id of Object.keys(state.buildings)) state.buildings[id] = 0;
  state.buildings.farm = 100;
  const economy = Engine.economicSnapshot(state);
  assert.equal(economy.workforce, 400);
  assert.equal(economy.employed, state.nation.population);
  assert.equal(economy.production.food, 300);

  for (const id of Object.keys(state.buildings)) state.buildings[id] = 0;
  state.resources.food = 100;
  const population = state.nation.population;
  const stability = state.nation.stability;
  Engine.advanceTurn(state);
  assert.equal(state.nation.population, population);
  assert.ok(state.nation.stability < stability);
});

test("scarce ore costs more than abundant ore and rival imports compete for finite stock", () => {
  const scarce = Engine.createInitialState({ seed: 9 });
  const abundant = Engine.createInitialState({ seed: 9 });
  for (const state of [scarce, abundant]) {
    state.buildings.mine = 0;
    for (const rival of Object.values(state.rivals)) {
      for (const id of Object.keys(rival.buildings)) rival.buildings[id] = 0;
      rival.resources.ore = 0; rival.resources.food = 500; rival.resources.materials = 0; rival.resources.credits = 150;
    }
    state.resources.ore = 0;
    state.market.stock.ore = state === scarce ? 20 : 300;
  }
  Engine.advanceTurn(scarce);
  Engine.advanceTurn(abundant);
  assert.ok(scarce.market.prices.ore > abundant.market.prices.ore);
  assert.ok(scarce.rivals.aurelia.resources.ore > scarce.rivals.northreach.resources.ore);
  assert.match(scarce.rivals.aurelia.activity, /Bought|mine|shortage|Saving/i);
  assert.ok(scarce.rivals.aurelia.relation > 15);
});

test("a trusted diplomatic rival can independently form a strategic alliance", () => {
  const state = Engine.createInitialState({ seed: 1327 });
  const rival = state.rivals.aurelia;
  rival.relation = 80;
  rival.riskTolerance = 1;
  rival.resources.credits = 0;
  rival.resources.food = 500; rival.resources.ore = 100; rival.resources.materials = 200; rival.resources.power = 50;
  for (const id of Object.keys(rival.buildings)) if (id !== "academy") rival.buildings[id] = 0;
  rival.buildings.farm = 5; rival.buildings.mine = 6; rival.buildings.workshop = 5; rival.buildings.power = 3; rival.buildings.market = 5;
  rival.buildings.academy = 1;
  Engine.advanceTurn(state);
  assert.ok(state.diplomacy.treaties.some(t => t.rivalId === rival.id && t.kind === "alliance" && t.status === "active"));
  assert.ok(rival.treaties.includes("alliance"));
  assert.equal(rival.activity, "Formed a strategic alliance");
});

test("rival strategic plans persist across turns while they stockpile inputs", () => {
  const state = Engine.createInitialState({ seed: 26 });
  const rival = state.rivals.aurelia;
  rival.resources.credits = 0; rival.resources.food = 500; rival.resources.ore = 100;
  rival.resources.materials = 0; rival.resources.power = 60;
  rival.buildings.workshop = 0;
  state.market.stock.materials = 0;
  Engine.advanceTurn(state);
  assert.equal(rival.plan.action, "build");
  assert.equal(rival.plan.target, "workshop");
  assert.match(rival.activity, /Saving materials/);
  const originalPlan = { ...rival.plan };
  Engine.advanceTurn(state);
  assert.equal(rival.plan.createdTurn, originalPlan.createdTurn);
  assert.equal(rival.plan.target, originalPlan.target);
  assert.ok(rival.memory.some(m => m.kind === "plan"));
});

test("a rival remembers player aggression and withholds a strategic alliance", () => {
  const state = Engine.createInitialState({ seed: 1327 });
  const rival = state.rivals.aurelia;
  rival.relation = 80; rival.resources.credits = 0; rival.resources.food = 500;
  rival.resources.ore = 100; rival.resources.materials = 200; rival.resources.power = 50;
  for (const id of Object.keys(rival.buildings)) rival.buildings[id] = 0;
  rival.buildings.farm = 5; rival.buildings.mine = 6; rival.buildings.workshop = 5; rival.buildings.power = 3; rival.buildings.market = 5; rival.buildings.academy = 1;
  rival.memory.push({ turn: 1, kind: "player-conflict", text: "Player declared conflict", relationDelta: -80 });
  state.turn = 2;
  Engine.advanceTurn(state);
  assert.ok(!state.diplomacy.treaties.some(t => t.rivalId === rival.id && t.kind === "alliance" && t.status === "active"));
});

test("faction traits steer rivals toward industry, energy, research, and commerce", () => {
  const industrial = Engine.createInitialState({ seed: 7 });
  const northreach = industrial.rivals.northreach;
  northreach.resources.food = 500; northreach.resources.ore = 100; northreach.resources.materials = 200;
  northreach.resources.credits = 1000; northreach.resources.power = 50; northreach.buildings.academy = 1;
  Engine.advanceTurn(industrial);
  assert.equal(northreach.buildings.factory, 1);
  assert.match(northreach.activity, /factory/i);

  const energy = Engine.createInitialState({ seed: 8 });
  const guard = energy.rivals.northreach;
  guard.resources.food = 500; guard.resources.ore = 100; guard.resources.materials = 200;
  guard.resources.credits = 1000; guard.resources.power = 0; guard.buildings.academy = 1;
  const powerBefore = guard.buildings.power;
  Engine.advanceTurn(energy);
  assert.ok(guard.buildings.power > powerBefore || guard.resources.power > 0);

  const research = Engine.createInitialState({ seed: 9 });
  const meridian = research.rivals.meridian;
  meridian.resources.food = 500; meridian.resources.ore = 100; meridian.resources.materials = 200;
  meridian.resources.power = 30; meridian.resources.science = 50; meridian.buildings.academy = 1;
  Engine.advanceTurn(research);
  assert.ok(meridian.technologies.includes("agriculture"));
  assert.match(meridian.activity, /agriculture/i);

  const commerce = Engine.createInitialState({ seed: 991 });
  const aurelia = commerce.rivals.aurelia;
  aurelia.resources.food = 500; aurelia.resources.ore = 100; aurelia.resources.materials = 200;
  aurelia.resources.credits = 1000; aurelia.resources.power = 100; aurelia.buildings.power = 3; aurelia.buildings.academy = 1;
  const marketsBefore = aurelia.buildings.market;
  Engine.advanceTurn(commerce);
  assert.equal(aurelia.buildings.market, marketsBefore + 1);
  assert.match(aurelia.activity, /market/i);
});

test("storage caps reject trades without partially charging the player", () => {
  const state = Engine.createInitialState();
  state.resources.food = Engine.RESOURCE_LIMIT;
  const credits = state.resources.credits;
  assert.throws(() => Engine.trade(state, "food", 10), /storage limit/);
  assert.equal(state.resources.credits, credits);
  state.resources.food = 120;
  state.market.stock.food = Engine.RESOURCE_LIMIT;
  assert.throws(() => Engine.trade(state, "food", -10), /market storage limit/);
  assert.equal(state.resources.food, 120);
});

test("power can be imported and exported through finite energy-market stock", () => {
  const state = Engine.createInitialState();
  state.resources.credits = 100;
  state.resources.power = 4;
  state.market.stock.power = 30;
  const price = state.market.prices.power;
  Engine.trade(state, "power", 10);
  assert.equal(state.resources.power, 14);
  assert.equal(state.market.stock.power, 20);
  assert.equal(state.resources.credits, 100 - Math.ceil(price * 10));
  Engine.trade(state, "power", -5);
  assert.equal(state.resources.power, 9);
  assert.equal(state.market.stock.power, 25);
});

test("a trade action can immediately complete a campaign supply objective", () => {
  const state = Engine.createInitialState();
  state.resources.food = 179;
  Engine.trade(state, "food", 1);
  assert.ok(state.campaign.completedObjectives.includes("feed-the-people"));
});

test("technology effects alter production and require science", () => {
  const state = Engine.createInitialState();
  const base = Engine.productionFor(state.buildings, state.technologies).food;
  assert.throws(() => Engine.research(state, "agriculture"), /Not enough science/);
  state.resources.science = 28;
  Engine.research(state, "agriculture");
  assert.ok(Engine.productionFor(state.buildings, state.technologies).food > base);
});

test("all ten innovation families enforce prerequisites and produce their advertised effects", () => {
  const state = Engine.createInitialState({ seed: 91 });
  assert.equal(Object.keys(Engine.TECHNOLOGIES).length, 10);
  assert.throws(() => Engine.research(state, "industry"), /prerequisite missing/);
  const cases = [
    ["agriculture", "farm", "food"],
    ["industry", "workshop", "materials"],
    ["energy", "power", "power"],
    ["manufacturing", "factory", "goods"],
    ["commerce", "market", "credits"],
    ["extraction", "mine", "ore"],
    ["logistics", "transport", "logistics"]
  ];
  for (const [id, building, output] of cases) {
    const buildings = { [building]: 2 };
    const base = Engine.productionFor(buildings, [])[output];
    const technology = Engine.TECHNOLOGIES[id];
    state.resources.science = technology.cost;
    Engine.research(state, id);
    const improved = Engine.productionFor(buildings, state.technologies)[output];
    assert.ok(improved > base, id + " must improve its advertised production effect");
  }
  state.resources.science = Engine.TECHNOLOGIES.governance.cost;
  const stability = state.nation.stability;
  Engine.research(state, "governance");
  assert.equal(state.nation.stability, Math.min(100, stability + 10));
  state.resources.science = Engine.TECHNOLOGIES.medicine.cost;
  Engine.research(state, "medicine");
  state.resources.science = Engine.TECHNOLOGIES.urbanism.cost;
  const housingBase = Engine.productionFor({ housing: 2 }, [])[ "capacity" ];
  Engine.research(state, "urbanism");
  assert.ok(Engine.productionFor({ housing: 2 }, state.technologies).capacity > housingBase);
  assert.equal(state.technologies.length, 10);
  assert.equal(Engine.validateSave(state).technologies.length, 10);
});

test("Sustainable Urbanism increases housing capacity and reduces national wage upkeep", () => {
  const standard = Engine.createInitialState({ seed: 77 });
  const efficient = Engine.createInitialState({ seed: 77 });
  for (const state of [standard, efficient]) {
    state.nation.population = 300;
    state.buildings = { farm: 5, mine: 5, workshop: 5, factory: 5, transport: 5, market: 5, academy: 5, power: 5, housing: 5 };
  }
  efficient.technologies = ["agriculture", "industry", "energy", "commerce", "governance", "medicine", "logistics", "urbanism"];
  assert.ok(Engine.productionFor(efficient.buildings, efficient.technologies).capacity >
    Engine.productionFor(efficient.buildings, []).capacity);
  Engine.advanceTurn(standard);
  Engine.advanceTurn(efficient);
  assert.ok(efficient.economy.lastExpenses < standard.economy.lastExpenses);
});

test("turns simulate rivals, market flow and deterministic events", () => {
  const a = Engine.createInitialState({ seed: 44 });
  const b = Engine.createInitialState({ seed: 44 });
  Engine.advanceTurn(a);
  Engine.advanceTurn(b);
  assert.deepEqual(a, b);
  assert.equal(a.turn, 2);
  assert.ok(a.rivals.aurelia.buildings.farm >= 2);
  assert.notEqual(a.market.prices.food, 2);
});

test("diplomatic gifts improve standing and treaty thresholds are enforced", () => {
  const state = Engine.createInitialState();
  assert.throws(() => Engine.offerTreaty(state, "meridian", "alliance"), /does not trust/);
  Engine.sendGift(state, "aurelia", 180);
  assert.equal(state.rivals.aurelia.relation, 51);
  Engine.offerTreaty(state, "aurelia", "alliance");
  assert.equal(state.diplomacy.treaties[0].status, "active");
});

test("trade and research agreements pay benefits while an alliance strengthens influence", () => {
  const state = Engine.createInitialState({ seed: 44 });
  const rival = state.rivals.aurelia;
  rival.relation = 50;
  Engine.offerTreaty(state, "aurelia", "trade");
  Engine.offerTreaty(state, "aurelia", "research");
  Engine.offerTreaty(state, "aurelia", "alliance");
  const before = {...state.resources};
  Engine.advanceTurn(state);
  assert.ok(state.economy.lastIncome >= 20);
  assert.equal(state.economy.lastBalance, state.economy.lastIncome - state.economy.lastExpenses);
  assert.equal(state.resources.science, before.science + 7);
  assert.equal(state.resources.influence, before.influence + 1);
});

test("envoy actions, conflict, peace, and treaty expiry have gameplay effects", () => {
  const state = Engine.createInitialState({ seed: 7 });
  assert.throws(() => Engine.declareConflict(state, "aurelia"), /Relations must fall/);
  state.resources.influence = 10;
  state.rivals.aurelia.relation = -20;
  state.diplomacy.treaties.push({ id: "aurelia:non-aggression", rivalId: "aurelia", kind: "non-aggression", status: "active", startedTurn: 1, duration: 5 });
  assert.throws(() => Engine.declareConflict(state, "aurelia"), /non-aggression pact/);
  state.diplomacy.treaties[0].status = "expired";
  Engine.declareConflict(state, "aurelia");
  assert.equal(state.diplomacy.conflicts[0].status, "active");
  assert.equal(state.resources.credits, 155);
  Engine.makePeace(state, "aurelia");
  assert.equal(state.diplomacy.conflicts[0].status, "peace");
  state.rivals.aurelia.relation = 50;
  Engine.offerTreaty(state, "aurelia", "alliance");
  state.turn += 12;
  Engine.advanceTurn(state);
  assert.equal(state.diplomacy.treaties[0].status, "expired");
});

test("creator registry entries are bounded and save validation checks their shape", () => {
  const state = Engine.createInitialState();
  Engine.registerCreation(state, { creator: "Ada", title: "Sky city", category: "City Design", description: "A vertical garden." });
  assert.equal(state.creations[0].title, "Sky city");
  assert.equal(Engine.validateSave(state).creations.length, 1);
  state.creations[0].description = "<".repeat(501);
  assert.throws(() => Engine.validateSave(state), /Creator registry is invalid/);
  state.creations[0].description = "A vertical garden.";
  Engine.deleteCreation(state, state.creations[0].id);
  assert.equal(state.creations.length, 1);
  assert.equal(state.creations[0].archived, true);
});

test("creator commissions cost resources once, produce real income, and can be withdrawn", () => {
  const state = Engine.createInitialState({ seed: 41 });
  const design = Engine.registerCreation(state, { creator: "Ada", title: "Foundry Co-op", category: "Business" });
  const credits = state.resources.credits, materials = state.resources.materials;
  Engine.commissionCreation(state, design.id);
  assert.equal(state.resources.credits, credits - 30);
  assert.equal(state.resources.materials, materials - 12);
  assert.equal(Engine.validateSave(state).creations[0].commissioned, true);
  Engine.advanceTurn(state);
  assert.equal(state.economy.production.credits, Engine.productionFor(state.buildings, state.technologies).credits + 4);
  assert.equal(state.economy.lastIncome, state.economy.production.credits + Math.floor(state.nation.population / 20));
  assert.throws(() => Engine.deleteCreation(state, design.id), /Withdraw an active commission/);
  Engine.withdrawCreation(state, design.id);
  Engine.advanceTurn(state);
  assert.equal(state.economy.production.credits, Engine.productionFor(state.buildings, state.technologies).credits);
  assert.equal(Engine.validateSave(state).creations[0].commissioned, false);
});

test("creator commission slots, affordability, and category effects are bounded", () => {
  const state = Engine.createInitialState({ seed: 42 });
  const designs = ["Building", "Technology", "Artwork", "World Lore"].map((category, index) => Engine.registerCreation(state, { creator: "Maker", title: "Design " + index, category }));
  for (const design of designs.slice(0, 3)) Engine.commissionCreation(state, design.id);
  const before = { credits: state.resources.credits, materials: state.resources.materials };
  assert.throws(() => Engine.commissionCreation(state, designs[3].id), /three active commissions/);
  assert.deepEqual({ credits: state.resources.credits, materials: state.resources.materials }, before);
  const effects = Engine.creatorEffects(state);
  assert.deepEqual(effects.production, { materials: 2, science: 2, credits: 0 });
  assert.equal(effects.stability, 1);
  assert.equal(effects.influence, 0);
  state.resources.credits = 0;
  Engine.withdrawCreation(state, designs[0].id);
  const materials = state.resources.materials;
  assert.throws(() => Engine.commissionCreation(state, designs[3].id), /Not enough credits/);
  assert.equal(state.resources.materials, materials);
  assert.throws(() => Engine.registerCreation(state, { creator: "Maker", title: "Unknown", category: "Unsupported" }), /supported Creator Studio category/);
});

test("every commissioned Creator Studio category changes its advertised game system", () => {
  for (const category of ["City Design", "Building", "Technology", "Business", "Artwork", "World Lore"]) {
    const baseline = Engine.createInitialState({ seed: 71 });
    baseline.nation.population = 250;
    baseline.resources.food = 1000;
    const designed = JSON.parse(JSON.stringify(baseline));
    const creation = Engine.registerCreation(designed, { creator: "Maker", title: category, category });
    Engine.commissionCreation(designed, creation.id);
    Engine.advanceTurn(baseline);
    Engine.advanceTurn(designed);
    if (category === "City Design") assert.equal(designed.nation.population, baseline.nation.population + 2);
    if (category === "Building") assert.equal(designed.economy.production.materials, baseline.economy.production.materials + 2);
    if (category === "Technology") assert.equal(designed.economy.production.science, baseline.economy.production.science + 2);
    if (category === "Business") assert.equal(designed.economy.production.credits, baseline.economy.production.credits + 4);
    if (category === "Artwork") assert.equal(designed.nation.stability, baseline.nation.stability + 1);
    if (category === "World Lore") assert.equal(designed.resources.influence, baseline.resources.influence + 1);
  }
});

test("creator publications respond to world demand and food crises", () => {
  const state = Engine.createInitialState({ seed: 57 });
  state.resources.materials = 100;
  state.resources.food = 1000;
  const normal = Engine.creatorDemand(state).find(item => item.category === "Building");
  state.world.activeEvents.push({ id: "food-demand-test", key: "food_shortage", startedTurn: state.turn, remainingTurns: 2, status: "active", choiceId: null, affectedNationIds: ["player"] });
  const crisis = Engine.creatorDemand(state).find(item => item.category === "Building");
  assert.ok(crisis.score > normal.score);
  assert.match(crisis.reason, /Food pressure/);
  assert.equal(Engine.MAX_CREATOR_PUBLICATIONS, 500);
  assert.ok(Engine.MAX_CREATOR_ROYALTY_PER_USE <= 10);
});

test("rivals adopt demanded creator designs, grant one bounded royalty, and preserve usage in saves", () => {
  const state = Engine.createInitialState({ seed: 58 });
  const design = Engine.registerCreation(state, { creator: "Ada Maker", title: "Research Exchange", category: "Technology" });
  Engine.advanceTurn(state);
  assert.ok(state.creatorEconomy.adoptions.some(adoption => adoption.designId === design.id && adoption.successfulUseTurn === state.turn));
  assert.ok(state.creatorEconomy.totalRoyalties > 0);
  assert.ok(state.creatorEconomy.totalRoyalties <= Object.keys(state.rivals).length * Engine.MAX_CREATOR_ROYALTY_PER_USE);
  const before = state.creatorEconomy.totalRoyalties;
  const saved = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.equal(saved.creatorEconomy.totalRoyalties, before);
  assert.equal(saved.creatorEconomy.adoptions.length, state.creatorEconomy.adoptions.length);
  const paid = new Set(saved.creatorEconomy.adoptions.filter(item => item.rewardClaimed).map(item => item.id));
  Engine.advanceTurn(saved);
  for (const id of paid) assert.equal(saved.creatorEconomy.adoptions.find(item => item.id === id).rewardClaimed, true);
  assert.equal(new Set(saved.creatorEconomy.adoptions.map(item => item.id)).size, saved.creatorEconomy.adoptions.length);
  assert.equal(new Set(saved.creatorEconomy.adoptions.map(item => item.designId + ":" + item.rivalId)).size, saved.creatorEconomy.adoptions.length);
  assert.doesNotThrow(() => Engine.validateSave(saved));
});

test("creator progress is derived from successful rival uses and commissioning reactivation is not charged twice", () => {
  const state = Engine.createInitialState({ seed: 59 });
  const design = Engine.registerCreation(state, { creator: "Ada  Maker", title: "Research Exchange", category: "Technology" });
  Engine.commissionCreation(state, design.id);
  Engine.withdrawCreation(state, design.id);
  const balance = { credits: state.resources.credits, materials: state.resources.materials };
  Engine.commissionCreation(state, design.id);
  assert.deepEqual({ credits: state.resources.credits, materials: state.resources.materials }, balance);
  assert.equal(state.creatorEconomy.commissions.filter(item => item.designId === design.id).length, 1);
  Engine.withdrawCreation(state, design.id);
  Engine.advanceTurn(state);
  const profile = Engine.creatorProfiles(state).find(item => item.creatorId === "ada maker");
  assert.ok(profile && profile.successfulUses > 0);
  assert.ok(profile.experience >= profile.successfulUses * 10);
  if (profile.experience >= 50) assert.ok(profile.level >= 2);
});

test("schema 6 commissions migrate into the validated creator economy ledger", () => {
  const state = Engine.createInitialState({ seed: 60 });
  const design = Engine.registerCreation(state, { creator: "Ada", title: "Old commissioned plan", category: "Building" });
  Engine.commissionCreation(state, design.id);
  state.schemaVersion = 6;
  delete state.creatorEconomy;
  state.creations.forEach(item => { delete item.creatorId; delete item.archived; });
  const migrated = Engine.migrateSave(state);
  assert.equal(migrated.schemaVersion, Engine.SAVE_VERSION);
  assert.equal(migrated.creations[0].commissioned, true);
  assert.equal(migrated.creatorEconomy.publications.length, 1);
  assert.equal(migrated.creatorEconomy.commissions.length, 1);
  assert.doesNotThrow(() => Engine.validateSave(migrated));
});

test("version 5 saves migrate creator designs as uncommissioned schema 7 records", () => {
  const state = Engine.createInitialState({ seed: 43 });
  Engine.registerCreation(state, { creator: "Ada", title: "Town plan", category: "City Design" });
  Engine.registerCreation(state, { creator: "Ada", title: "Second plan", category: "Building" });
  state.creations[1].id = state.creations[0].id;
  state.schemaVersion = 5;
  state.creations.forEach(creation => { delete creation.commissioned; delete creation.commissionedTurn; });
  const migrated = Engine.migrateSave(state);
  assert.equal(migrated.schemaVersion, Engine.SAVE_VERSION);
  assert.equal(migrated.creations[0].commissioned, false);
  assert.equal(migrated.creations[0].commissionedTurn, null);
  assert.equal(new Set(migrated.creations.map(creation => creation.id)).size, 2);
  assert.ok(Engine.validateSave(migrated).creations.some(creation => creation.title === "Town plan"));
});

test("a rival with empty stores reacts to scarcity and invests in food security", () => {
  const state = Engine.createInitialState({ seed: 5 });
  const rival = state.rivals.northreach;
  rival.buildings.farm = 0;
  rival.resources.food = 0;
  rival.resources.credits = 200;
  state.market.stock.food = 0;
  Engine.advanceTurn(state);
  assert.ok(rival.buildings.farm > 0);
  assert.ok(rival.stability < 80);
});

test("v0.3 saves with negative relations migrate without losing the sign", () => {
  const migrated = Engine.migrateSave({
    turn: 4, food: 70, materials: 40, credits: 90, influence: 12, population: 95, stability: 60,
    buildings: { farm: 2 }, events: ["Old story"], relations: { Meridian: -35 }
  });
  assert.equal(migrated.rivals.meridian.relation, -35);
  assert.equal(migrated.resources.influence, 12);
});

test("version 1 saves migrate forward and preserve a safe campaign baseline", () => {
  const old = Engine.createInitialState();
  delete old.resources.ore; delete old.resources.goods;
  delete old.buildings.mine; delete old.buildings.factory; delete old.buildings.transport;
  for (const rival of Object.values(old.rivals)) {
    delete rival.resources.ore; delete rival.resources.goods; delete rival.resources.influence;
    delete rival.buildings.mine; delete rival.buildings.factory; delete rival.buildings.transport;
  }
  for (const key of ["ore", "goods"]) {
    delete old.market.stock[key]; delete old.market.basePrices[key]; delete old.market.prices[key]; delete old.market.lastFlow[key];
  }
  old.schemaVersion = 1;
  delete old.campaign.buildingStart;
  const migrated = Engine.migrateSave(old);
  assert.equal(migrated.schemaVersion, Engine.SAVE_VERSION);
  assert.equal(migrated.campaign.buildingStart, 6);
  assert.equal(migrated.nation.name, "New Horizon");
  assert.equal(migrated.resources.ore, 48);
  assert.equal(migrated.buildings.mine, 0);
});

test("campaign scenarios start with distinct playable objectives and valid saves", () => {
  const winter = Engine.createInitialState({ campaignId: "longwinter", seed: 11 });
  const council = Engine.createInitialState({ campaignId: "council", seed: 12 });
  assert.equal(winter.campaign.id, "longwinter");
  assert.equal(winter.nation.stability, 58);
  assert.equal(council.campaign.id, "council");
  assert.equal(council.nation.population, 90);
  assert.equal(Engine.validateSave(winter).campaign.id, "longwinter");
  assert.equal(Engine.validateSave(council).campaign.id, "council");
});

test("large values are capped and campaign defeat triggers at collapse", () => {
  const state = Engine.createInitialState({ seed: 1 });
  state.resources.food = Engine.RESOURCE_LIMIT;
  state.buildings.farm = 100_000;
  assert.ok(Engine.productionFor(state.buildings).food > Engine.RESOURCE_LIMIT);
  state.nation.population = 11;
  state.nation.stability = 1;
  state.resources.food = 0;
  state.buildings.farm = 0;
  Engine.advanceTurn(state);
  assert.equal(state.status, "defeat");
});

test("world turn limit prevents overflow", () => {
  const state = Engine.createInitialState();
  state.turn = 10_000_000;
  assert.throws(() => Engine.advanceTurn(state), /Turn limit/);
  assert.equal(state.turn, 10_000_000);
});

test("the founding campaign records objectives and declares victory when all goals are met", () => {
  const state = Engine.createInitialState();
  state.resources.food = 180;
  state.resources.materials = 240; state.resources.credits = 1000;
  for (let i = 0; i < 3; i++) Engine.build(state, "farm");
  state.rivals.aurelia.relation = 30;
  state.resources.science = 66;
  Engine.research(state, "agriculture");
  Engine.research(state, "governance");
  assert.equal(state.campaign.phaseIndex, 2);
  for (let i = 0; i < 2; i++) Engine.build(state, "factory");
  Engine.trade(state, "ore", -40);
  assert.equal(state.status, "victory");
  assert.equal(state.campaign.status, "victory");
  assert.equal(state.campaign.completedObjectives.length, 6);
  assert.equal(state.campaign.phaseIndex, 3);
  assert.ok(state.achievements.includes("campaign-victory"));
});

test("a long-running deterministic world remains inside the save schema", () => {
  const state = Engine.createInitialState({ seed: 237 });
  for (let turn = 0; turn < 250 && state.status === "playing"; turn++) {
    Engine.advanceTurn(state);
    Engine.validateSave(state);
  }
  assert.ok(state.turn > 100);
  assert.ok(Object.values(state.rivals).every(r => r.resources.food >= 0 && r.resources.materials >= 0 && r.resources.credits >= 0));
});

test("military recruitment, training and fortification enforce costs", () => {
  const state = Engine.createInitialState({ seed: 91 });
  const credits = state.resources.credits, materials = state.resources.materials;
  Engine.recruitTroops(state, 10);
  assert.equal(state.military.troops, 34);
  assert.equal(state.resources.credits, credits - 30);
  assert.equal(state.resources.materials, materials - 2);
  Engine.trainArmy(state);
  assert.equal(state.military.training, 2);
  state.resources.credits += 10;
  Engine.fortifyNation(state);
  assert.equal(state.military.fortification, 2);
  assert.throws(() => Engine.recruitTroops(state, 0), /Recruit between/);
  assert.doesNotThrow(() => Engine.validateSave(state));
});

test("battle resolution requires active conflict and applies casualties and rewards", () => {
  const state = Engine.createInitialState({ seed: 92 });
  assert.throws(() => Engine.resolveBattle(state, "aurelia"), /active conflict/);
  state.rivals.aurelia.relation = -30;
  Engine.declareConflict(state, "aurelia");
  state.resources.power = 30;
  state.military.troops = 120;
  const result = Engine.resolveBattle(state, "aurelia");
  assert.equal(result.won, true);
  assert.equal(state.military.battlesWon, 1);
  assert.ok(state.military.troops < 120);
  assert.equal(state.resources.influence, 24);
  assert.doesNotThrow(() => Engine.validateSave(state));
});

test("schema 7 saves migrate with a starter army", () => {
  const state = Engine.createInitialState({ seed: 93 });
  delete state.military;
  state.schemaVersion = 7;
  const migrated = Engine.migrateSave(state);
  assert.equal(migrated.schemaVersion, Engine.SAVE_VERSION);
  assert.equal(migrated.military.troops, 24);
  assert.doesNotThrow(() => Engine.validateSave(migrated));
});
