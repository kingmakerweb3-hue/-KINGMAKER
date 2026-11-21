const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../src/engine.js");

test("renewable power is available to factories in the same turn", () => {
  const state = Engine.createInitialState({ seed: 72 });
  for (const key of Object.keys(state.buildings)) state.buildings[key] = 0;
  state.buildings.factory = 1;
  state.resources.food = 500;
  state.resources.materials = 5;
  state.resources.ore = 3;
  state.resources.power = 0;
  assert.equal(Engine.economicSnapshot(state).activeFactories, 1);
  Engine.advanceTurn(state);
  assert.equal(state.economy.production.goods, 10);
  assert.equal(state.economy.consumption.power, 2);
  assert.equal(state.resources.power, 2);
});

test("factories scale down when renewable power cannot cover all demand", () => {
  const state = Engine.createInitialState({ seed: 73 });
  for (const key of Object.keys(state.buildings)) state.buildings[key] = 0;
  state.buildings.factory = 3;
  state.resources.food = 500;
  state.resources.materials = 15;
  state.resources.ore = 9;
  state.resources.power = 0;

  assert.equal(Engine.economicSnapshot(state).activeFactories, 2);
  Engine.advanceTurn(state);

  assert.equal(state.economy.production.goods, 20);
  assert.equal(state.economy.consumption.power, 4);
  assert.equal(state.resources.power, 0);
});

test("island wind and solar installations add renewable power to the production ledger", () => {
  const state = Engine.createInitialState({ seed: 71 });
  for (const key of Object.keys(state.buildings)) state.buildings[key] = 0;
  state.technologies = [];
  state.resources.power = 0;
  Engine.advanceTurn(state);
  assert.deepEqual(Engine.RENEWABLE_POWER_OUTPUT, { wind: 2, solar: 2 });
  assert.equal(state.economy.production.power, 4);
  assert.equal(state.resources.power, 4);
});

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

test("save recovery restores a valid backup when the primary save is missing", () => {
  const backupState = Engine.createInitialState({ seed: 91 });
  backupState.turn = 12;
  const values = new Map([["recovery", Engine.exportSave(backupState)]]);
  const storage = { getItem: key => values.get(key) ?? null };
  const result = Engine.loadWithRecovery(storage, "primary", "recovery");
  assert.equal(result.state.turn, 12);
  assert.equal(result.recovered, true);
  assert.equal(result.primaryError, false);
});

test("save recovery restores backup after primary corruption and rejects a corrupt backup", () => {
  const backupState = Engine.createInitialState({ seed: 92 });
  backupState.turn = 18;
  const values = new Map([
    ["primary", "{broken json"],
    ["recovery", Engine.exportSave(backupState)]
  ]);
  const storage = { getItem: key => values.get(key) ?? null };
  const recovered = Engine.loadWithRecovery(storage, "primary", "recovery");
  assert.equal(recovered.state.turn, 18);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.primaryError, true);

  values.set("recovery", "{also broken");
  const empty = Engine.loadWithRecovery(storage, "primary", "recovery");
  assert.equal(empty.state, null);
  assert.equal(empty.primaryError, true);
});

test("save recovery falls back when the primary save is structurally invalid or inaccessible", () => {
  const backupState = Engine.createInitialState({ seed: 93 });
  backupState.turn = 27;
  const backup = Engine.exportSave(backupState);
  const values = new Map([["primary", JSON.stringify({ schemaVersion: 999 })], ["recovery", backup]]);
  const storage = { getItem: key => values.get(key) ?? null };
  const invalid = Engine.loadWithRecovery(storage, "primary", "recovery");
  assert.equal(invalid.state.turn, 27);
  assert.equal(invalid.recovered, true);
  assert.equal(invalid.primaryError, true);

  const unavailablePrimary = {
    getItem(key) {
      if (key === "primary") throw new Error("Storage access denied");
      return backup;
    }
  };
  const inaccessible = Engine.loadWithRecovery(unavailablePrimary, "primary", "recovery");
  assert.equal(inaccessible.state.turn, 27);
  assert.equal(inaccessible.recovered, true);
  assert.equal(inaccessible.primaryError, true);
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
  assert.equal(economy.workforce, 420);
  assert.equal(economy.employed, state.nation.population);
  assert.equal(economy.production.food, 240);

  for (const id of Object.keys(state.buildings)) state.buildings[id] = 0;
  state.world.territories.find(item => item.id === "home").garrison = 0;
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
    state.world.territories.find(territory => territory.id === "home").population = 300;
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
    baseline.world.territories.find(territory => territory.id === "home").population = 250;
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
  state.world.territories.find(territory => territory.id === "home").population = 11;
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


test("district zoning is persisted, bounded, and rejects malformed district records", () => {
  const state = Engine.createInitialState({ seed: 101 });
  state.world.placedDistricts.push({ type: "residential", x: 2.5, z: -3, radius: 2.6 });
  const restored = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.deepEqual(restored.world.placedDistricts, state.world.placedDistricts.map(district => ({ ...district, territoryId: "home" })));
  restored.world.placedDistricts[0].type = "volcano";
  assert.throws(() => Engine.validateSave(restored), /District placement data is invalid/);
  restored.world.placedDistricts[0] = { type: "industrial", x: 12, z: 0, radius: 2.6 };
  assert.throws(() => Engine.validateSave(restored), /District placement data is invalid/);
});


test("zoned districts contribute balanced production and residential growth", () => {
  const state = Engine.createInitialState({ seed: 412 });
  state.world.placedDistricts = [
    { type: "agricultural", x: 0, z: 0, radius: 2.6 },
    { type: "industrial", x: 3, z: 0, radius: 2.6 },
    { type: "commercial", x: -3, z: 0, radius: 2.6 },
    { type: "residential", x: 0, z: 3, radius: 2.6 }
  ];
  const effects = Engine.districtEffects(state);
  assert.deepEqual(effects.counts, { residential: 1, commercial: 1, industrial: 1, agricultural: 1 });
  assert.deepEqual(effects.production, { food: 3, materials: 2, credits: 4 });
  assert.equal(effects.populationGrowth, 1);
  const snapshot = Engine.economicSnapshot(state);
  assert.ok(snapshot.production.food >= 3);
  assert.ok(snapshot.production.materials >= 2);
  assert.ok(snapshot.production.credits >= 4);
  const beforePopulation = state.nation.population;
  Engine.advanceTurn(state);
  assert.ok(state.nation.population >= beforePopulation);
  assert.ok(state.economy.production.credits >= 4);
});


test("road segments connect nearby districts and improve logistics and income", () => {
  const state = Engine.createInitialState({ seed: 733 });
  state.world.placedDistricts = [
    { type: "commercial", x: 0, z: 0, radius: 2.6 },
    { type: "agricultural", x: 7, z: 0, radius: 2.6 },
    { type: "industrial", x: 0, z: 8, radius: 2.6 }
  ];
  state.world.placedRoads = [
    { from: { x: -5, z: 0 }, to: { x: 5, z: 0 } },
    { from: { x: 5, z: 0 }, to: { x: 9, z: 0 } }
  ];
  const effects = Engine.roadEffects(state);
  assert.equal(effects.connectedDistricts, 2);
  assert.equal(effects.logistics, 2);
  assert.deepEqual(effects.production, { credits: 4 });
  const snapshot = Engine.economicSnapshot(state);
  assert.ok(snapshot.production.logistics >= 2);
  assert.ok(snapshot.production.credits >= 4);
  Engine.advanceTurn(state);
  assert.ok(state.economy.production.logistics >= 2);
  assert.ok(state.economy.production.credits >= 4);
});

test("world intelligence ranks nations and exposes transparent risk and rival intent", () => {
  const state = Engine.createInitialState({ seed: 914 });
  const report = Engine.worldIntelligence(state);
  assert.equal(report.turn, state.turn);
  assert.equal(report.regionalPower.length, Object.keys(state.rivals).length + 1);
  assert.equal(report.regionalPower[0].rank, 1);
  assert.equal(report.regionalPower.filter(n => n.id === "player").length, 1);
  assert.ok(report.player.foodRunway >= 0);
  assert.ok(report.player.powerCoverage >= 0);
  assert.ok(report.rivals.every(r => typeof r.activity === "string" && Array.isArray(r.risks)));
  state.rivals.northreach.relation = -60;
  state.rivals.northreach.resources.food = 0;
  const updated = Engine.worldIntelligence(state);
  assert.ok(updated.threats.some(t => t.id === "northreach"));
  assert.ok(updated.rivals.find(r => r.id === "northreach").risks.includes("critical food reserves"));
});


test("citizens are persistent agents with needs, jobs, goals, and bounded memories", () => {
  const state = Engine.createInitialState({ seed: 2026 });
  assert.ok(state.citizens.length >= 12 && state.citizens.length <= 48);
  const citizen = state.citizens[0];
  assert.ok(citizen.id && citizen.name && citizen.role && citizen.goal);
  assert.deepEqual(Object.keys(citizen.needs).sort(), ["belonging", "energy", "food", "safety"]);
  const before = citizen.needs.food;
  state.resources.food = 0;
  Engine.advanceTurn(state);
  assert.ok(citizen.needs.food < before);
  assert.ok(citizen.activity.length > 0);
  for (let i = 0; i < 45 && state.status === "playing"; i++) Engine.advanceTurn(state);
  assert.ok(citizen.memory.length <= 8);
  const restored = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.deepEqual(restored.citizens, state.citizens);
});

test("schema 7 saves migrate into the persistent citizen simulation", () => {
  const state = Engine.createInitialState({ seed: 77 });
  state.schemaVersion = 7;
  delete state.citizens;
  const migrated = Engine.migrateSave(state);
  assert.equal(migrated.schemaVersion, Engine.SAVE_VERSION);
  assert.ok(migrated.citizens.length > 0);
  assert.doesNotThrow(() => Engine.validateSave(migrated));
});


test("citizens form persistent reciprocal social bonds and strengthen friendships over turns", () => {
  const state = Engine.createInitialState({ seed: 19 });
  const citizen = state.citizens[0];
  assert.ok(citizen.relationships.length >= 2);
  const bond = citizen.relationships[0];
  const friend = state.citizens.find(c => c.id === bond.citizenId);
  assert.ok(friend.relationships.some(r => r.citizenId === citizen.id));
  const before = bond.affinity;
  state.turn = 2;
  Engine.advanceTurn(state);
  assert.ok(citizen.relationships[0].affinity >= before);
  const saved = Engine.validateSave(state);
  assert.deepEqual(saved.citizens[0].relationships, state.citizens[0].relationships);
});

test("legacy citizens receive safe relationship defaults during save migration", () => {
  const state = Engine.createInitialState({ seed: 20 });
  state.schemaVersion = Engine.SAVE_VERSION - 1;
  state.citizens.forEach(c => { delete c.relationships; });
  const migrated = Engine.migrateSave(state);
  assert.ok(Array.isArray(migrated.citizens[0].relationships));
});


test("new worlds generate stable finite resource deposits across seeded campaigns", () => {
  const first = Engine.createInitialState({ seed: 42001 });
  const repeat = Engine.createInitialState({ seed: 42001 });
  const alternate = Engine.createInitialState({ seed: 42002 });
  assert.equal(first.world.resourceNodes.length, 16);
  assert.deepEqual(first.world.resourceNodes, repeat.world.resourceNodes);
  assert.notDeepEqual(first.world.resourceNodes, alternate.world.resourceNodes);
  assert.equal(new Set(first.world.resourceNodes.map(node => node.id)).size, 16);
  for (const node of first.world.resourceNodes) {
    assert.ok(Engine.RESOURCE_SITE_TYPES.includes(node.resource));
    assert.ok(node.quantity >= 80 && node.quantity <= 250);
    const territory = first.world.territories.find(item => item.id === node.territoryId);
    assert.ok(territory);
    assert.ok(Math.hypot(node.x - territory.x, node.z - territory.z) <= territory.radius);
    assert.equal(node.operational, false);
    assert.equal(node.depleted, false);
  }
});

test("resource extraction sites charge the treasury and report their real production", () => {
  const state = Engine.createInitialState({ seed: 42003 });
  const node = state.world.resourceNodes[0];
  const beforeMaterials = state.resources.materials;
  const beforeCredits = state.resources.credits;
  const yields = Engine.RESOURCE_SITE_OUTPUT[node.resource];
  const [resource, rate] = Object.entries(yields)[0];
  Engine.developResourceSite(state, node.id);
  assert.equal(node.operational, true);
  assert.equal(node.operatedSinceTurn, state.turn);
  assert.equal(state.resources.materials, beforeMaterials - Engine.RESOURCE_SITE_COST.materials);
  assert.equal(state.resources.credits, beforeCredits - Engine.RESOURCE_SITE_COST.credits);
  assert.equal(Engine.resourceSiteEffects(state)[resource], rate);
  assert.ok(Engine.economicSnapshot(state).production[resource] >= rate);
  assert.throws(() => Engine.developResourceSite(state, node.id), /already operational/);
  const restored = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.deepEqual(restored.world.resourceNodes, state.world.resourceNodes);
});

test("rare-crystal extraction contributes science and finite deposits deplete", () => {
  const state = Engine.createInitialState({ seed: 42004 });
  const control = Engine.createInitialState({ seed: 42004 });
  state.world.resourceNodes = [{
    id: "rare-test", resource: "Rare crystals", quantity: 1, x: 0, z: 0,
    operational: true, depleted: false, operatedSinceTurn: state.turn
  }];
  const beforeScience = state.resources.science;
  Engine.advanceTurn(state);
  Engine.advanceTurn(control);
  assert.equal(state.resources.science - control.resources.science, 1);
  assert.equal(state.world.resourceNodes[0].quantity, 0);
  assert.equal(state.world.resourceNodes[0].depleted, true);
  assert.equal(Engine.resourceSiteEffects(state).science, 0);
});

test("schema 8 saves migrate to version 17 with deterministic archipelago deposits", () => {
  const state = Engine.createInitialState({ seed: 42005 });
  state.schemaVersion = 8;
  delete state.world.resourceNodes;
  const migrated = Engine.migrateSave(state);
  assert.equal(migrated.schemaVersion, 17);
  assert.deepEqual(migrated.world.resourceNodes, Engine.createResourceDeposits(state.seed, state.world.territories));
  const roundTrip = Engine.migrateSave(JSON.parse(Engine.exportSave(migrated)));
  assert.deepEqual(roundTrip.world.resourceNodes, migrated.world.resourceNodes);
});

test("save validation rejects malformed island resource deposits", () => {
  const state = Engine.createInitialState({ seed: 42006 });
  state.world.resourceNodes[0].x = 99;
  assert.throws(() => Engine.validateSave(state), /Resource deposit data is invalid/);
  const invalidType = Engine.createInitialState({ seed: 42007 });
  invalidType.world.resourceNodes[0].resource = "Unobtainium";
  assert.throws(() => Engine.validateSave(invalidType), /Resource deposit data is invalid/);
});

test("depleted operational extraction sites remain valid in saves and produce no further output", () => {
  const state = Engine.createInitialState({ seed: 17 });
  const node = state.world.resourceNodes[0];
  node.quantity = 1;
  node.depleted = false;
  node.operational = true;
  node.operatedSinceTurn = state.turn;
  Engine.advanceTurn(state);
  assert.equal(node.quantity, 0);
  assert.equal(node.depleted, true);
  assert.equal(node.operational, true);
  assert.doesNotThrow(() => Engine.validateSave(state));
  const saved = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.equal(saved.world.resourceNodes.find(item => item.id === node.id).depleted, true);
  assert.doesNotThrow(() => Engine.validateSave(saved));
});


test("seeded archipelagos contain a home island, six rival holdings and two neutral islands", () => {
  const first = Engine.createInitialState({ seed: 52001 });
  const repeat = Engine.createInitialState({ seed: 52001 });
  const alternate = Engine.createInitialState({ seed: 52002 });
  assert.equal(first.world.territories.length, 9);
  assert.deepEqual(first.world.territories, repeat.world.territories);
  assert.notDeepEqual(first.world.territories, alternate.world.territories);
  assert.equal(first.world.territories.find(item => item.id === "home").owner, "player");
  assert.equal(first.world.territories.filter(item => item.owner === "unclaimed").length, 2);
  assert.equal(first.world.territories.filter(item => Object.hasOwn(first.rivals, item.owner)).length, 6);
  assert.equal(new Set(first.world.territories.map(item => item.id)).size, 9);
});

test("claiming a neutral island charges resources and adds recurring regional income", () => {
  const state = Engine.createInitialState({ seed: 52003 });
  const territory = state.world.territories.find(item => item.owner === "unclaimed");
  const cost = Engine.territoryClaimCost(state);
  const before = { ...state.resources };
  const beforeDevelopment = territory.development;
  const baselineCredits = Engine.economicSnapshot(state).production.credits;
  const claimed = Engine.claimTerritory(state, territory.id);
  assert.equal(claimed.owner, "player");
  assert.equal(claimed.claimedTurn, state.turn);
  assert.equal(claimed.development, Math.min(100, beforeDevelopment + 5));
  assert.equal(state.resources.materials, before.materials - cost.materials);
  assert.equal(state.resources.credits, before.credits - cost.credits);
  assert.equal(state.resources.influence, before.influence - cost.influence);
  assert.equal(Engine.territoryEffects(state).controlled, 1);
  assert.equal(Engine.economicSnapshot(state).production.credits, baselineCredits + 3);
  assert.equal(Engine.economicSnapshot(state).territoryInfluence, 1);
  assert.throws(() => Engine.claimTerritory(state, territory.id), /already controlled/);
});

test("Logistics and Commerce research reduce territorial claim costs", () => {
  const state = Engine.createInitialState({ seed: 52004 });
  assert.deepEqual(Engine.territoryClaimCost(state), { materials: 60, credits: 100, influence: 12 });
  state.technologies.push("logistics", "commerce");
  assert.deepEqual(Engine.territoryClaimCost(state), { materials: 50, credits: 85, influence: 12 });
});

test("Duneward expands into a neutral island unless an active alliance protects the relationship", () => {
  const state = Engine.createInitialState({ seed: 52005 });
  const rival = state.rivals.duneward;
  const targetBefore = state.world.territories.filter(item => item.owner === "unclaimed");
  rival.resources.materials = 100;
  rival.resources.credits = 150;
  rival.resources.influence = 15;
  const claimed = Engine.expandRivals(state);
  assert.ok(claimed);
  assert.equal(claimed.owner, "duneward");
  assert.equal(state.world.territories.filter(item => item.owner === "unclaimed").length, targetBefore.length - 1);
  assert.match(rival.activity, /Expanded into/);

  const protectedState = Engine.createInitialState({ seed: 52006 });
  protectedState.rivals.duneward.relation = 80;
  protectedState.diplomacy.treaties.push({ id: "duneward:alliance", rivalId: "duneward", kind: "alliance", status: "active", startedTurn: 1, duration: 12 });
  assert.equal(Engine.expandRivals(protectedState), null);
  assert.equal(protectedState.world.territories.filter(item => item.owner === "unclaimed").length, 2);
});

test("version 9 saves migrate to schema 16 without losing existing extraction progress", () => {
  const legacy = Engine.createInitialState({ seed: 52007 });
  legacy.schemaVersion = 9;
  delete legacy.world.territories;
  legacy.world.resourceNodes = legacy.world.resourceNodes.filter(node => node.territoryId === "home").map(node => {
    const copy = { ...node };
    delete copy.territoryId;
    return copy;
  });
  legacy.world.resourceNodes[0].operational = true;
  legacy.world.resourceNodes[0].operatedSinceTurn = 1;
  const migrated = Engine.migrateSave(legacy);
  assert.equal(migrated.schemaVersion, 17);
  assert.equal(migrated.world.territories.length, 9);
  assert.equal(migrated.world.resourceNodes.length, 16);
  assert.equal(migrated.world.resourceNodes[0].operational, true);
  assert.equal(migrated.world.resourceNodes[0].territoryId, "home");
  const restored = Engine.migrateSave(JSON.parse(Engine.exportSave(migrated)));
  assert.deepEqual(restored.world.territories, migrated.world.territories);
  assert.deepEqual(restored.world.resourceNodes, migrated.world.resourceNodes);
});

test("territory save validation rejects unknown owners and invalid coordinates", () => {
  const state = Engine.createInitialState({ seed: 52008 });
  const invalidOwner = JSON.parse(JSON.stringify(state));
  invalidOwner.world.territories[1].owner = "unknown-empire";
  assert.throws(() => Engine.validateSave(invalidOwner), /Territory data is invalid/);
  invalidOwner.world.territories[1].owner = "__proto__";
  assert.throws(() => Engine.validateSave(invalidOwner), /Territory data is invalid/);
  const invalidDeposit = JSON.parse(JSON.stringify(state));
  invalidDeposit.world.resourceNodes[8].x = 90;
  assert.throws(() => Engine.validateSave(invalidDeposit), /Resource deposit data is invalid/);
});


test("resource extraction on a remote island requires player territorial control", () => {
  const state = Engine.createInitialState({ seed: 52009 });
  const territory = state.world.territories.find(item => item.owner === "unclaimed");
  const deposit = state.world.resourceNodes.find(node => node.territoryId === territory.id);
  assert.ok(deposit);
  assert.throws(() => Engine.developResourceSite(state, deposit.id), /must control this island/);
  Engine.claimTerritory(state, territory.id);
  Engine.developResourceSite(state, deposit.id);
  assert.equal(deposit.operational, true);
  assert.equal(deposit.territoryId, territory.id);
});


test("the normal world turn runs rival territorial expansion", () => {
  const state = Engine.createInitialState({ seed: 52010 });
  Engine.advanceTurn(state);
  assert.ok(state.world.territories.some(territory => territory.owner === "duneward" && territory.id !== "isle-duneward"));
  assert.ok(state.events.some(event => event.text.includes("Duneward expanded into")));
});


test("claimed outer islands support saved buildings, districts, roads and local production", () => {
  const state = Engine.createInitialState({ seed: 62001 });
  const territory = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1200;
  state.resources.credits = 1800;
  state.resources.influence = 120;
  Engine.claimTerritory(state, territory.id);

  const beforeFarm = state.buildings.farm;
  const building = Engine.placeWorldBuilding(state, "farm", {
    territoryId: territory.id, x: territory.x, z: territory.z
  });
  assert.equal(building.territoryId, territory.id);
  assert.equal(state.buildings.farm, beforeFarm + 1);

  const foodBefore = Engine.districtEffects(state).production.food;
  const agriculture = Engine.placeWorldDistrict(state, "agricultural", {
    territoryId: territory.id, x: territory.x, z: territory.z, radius: 2.6
  });
  assert.equal(agriculture.territoryId, territory.id);
  assert.equal(Engine.districtEffects(state).production.food, foodBefore + 3);

  const residential = Engine.placeWorldDistrict(state, "residential", {
    territoryId: territory.id, x: territory.x + 0.25, z: territory.z, radius: 2.6
  });
  const populationBefore = territory.population;
  const road = Engine.placeWorldRoad(state,
    { x: territory.x - 1.8, z: territory.z },
    { x: territory.x + 1.8, z: territory.z },
    territory.id
  );
  assert.equal(road.territoryId, territory.id);
  assert.equal(Engine.roadEffects(state).logistics, 2);
  assert.equal(Engine.roadEffects(state).production.credits, 4);
  assert.equal(Engine.districtEffects(state).regionalGrowth[territory.id], 1);
  assert.equal(residential.territoryId, territory.id);

  Engine.advanceTurn(state);
  assert.equal(territory.population, populationBefore + 1);
  const saved = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.deepEqual(saved.world.placedBuildings, state.world.placedBuildings);
  assert.deepEqual(saved.world.placedDistricts, state.world.placedDistricts);
  assert.deepEqual(saved.world.placedRoads, state.world.placedRoads);
});

test("outer-island construction rejects unowned land and positions outside its coast", () => {
  const state = Engine.createInitialState({ seed: 62002 });
  const neutral = state.world.territories.find(item => item.owner === "unclaimed");
  assert.throws(() => Engine.placeWorldBuilding(state, "farm", {
    territoryId: neutral.id, x: neutral.x, z: neutral.z
  }), /must control this island/);

  state.resources.materials = 1000;
  state.resources.credits = 1000;
  state.resources.influence = 100;
  Engine.claimTerritory(state, neutral.id);
  assert.throws(() => Engine.placeWorldBuilding(state, "farm", {
    territoryId: neutral.id, x: neutral.x + neutral.radius, z: neutral.z
  }), /outside your buildable territory/);
  assert.throws(() => Engine.placeWorldRoad(state,
    { x: neutral.x - 1, z: neutral.z },
    { x: neutral.x + 1, z: neutral.z },
    "home"
  ), /outside your buildable territory/);
  assert.throws(() => Engine.placeWorldDistrict(state, "residential", {
    territoryId: neutral.id, x: neutral.x + 3, z: neutral.z, radius: 2.6
  }), /shore/);
});

test("version 10 home placements migrate into schema 16 without changing their location", () => {
  const legacy = Engine.createInitialState({ seed: 62003 });
  legacy.schemaVersion = 10;
  legacy.world.placedBuildings.push({ type: "farm", x: 3, z: 4 });
  legacy.world.placedRoads.push({ from: { x: -2, z: 0 }, to: { x: 2, z: 0 } });
  legacy.world.placedDistricts.push({ type: "residential", x: 1, z: 1, radius: 2.6 });
  const migrated = Engine.migrateSave(legacy);
  assert.equal(migrated.schemaVersion, 17);
  assert.equal(migrated.world.placedBuildings[0].territoryId, "home");
  assert.equal(migrated.world.placedRoads[0].territoryId, "home");
  assert.equal(migrated.world.placedDistricts[0].territoryId, "home");
  assert.deepEqual(Engine.migrateSave(JSON.parse(Engine.exportSave(migrated))).world.placedBuildings, migrated.world.placedBuildings);
});


test("version 11 saves migrate with default harbor levels, local stockpiles and no shipping routes", () => {
  const legacy = Engine.createInitialState({ seed: 72001 });
  legacy.schemaVersion = 11;
  delete legacy.world.shippingRoutes;
  for (const territory of legacy.world.territories) {
    delete territory.harborLevel;
    delete territory.stockpile;
  }
  const migrated = Engine.migrateSave(legacy);
  assert.equal(migrated.schemaVersion, 17);
  assert.equal(migrated.world.shippingRoutes.length, 0);
  assert.equal(migrated.world.territories.find(item => item.id === "home").harborLevel, 1);
  assert.ok(migrated.world.territories.filter(item => item.id !== "home").every(item => item.harborLevel === 0));
  for (const territory of migrated.world.territories) {
    assert.deepEqual(Object.keys(territory.stockpile).sort(), Engine.SHIPPING_RESOURCES.slice().sort());
    assert.ok(Object.values(territory.stockpile).every(amount => amount === 0));
  }
  assert.deepEqual(Engine.migrateSave(JSON.parse(Engine.exportSave(migrated))).world.territories, migrated.world.territories);
});

test("harbor upgrades increase route capacity and require a controlled island", () => {
  const state = Engine.createInitialState({ seed: 72002 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  assert.throws(() => Engine.upgradeHarbor(state, island.id), /must control this island/);
  state.resources.materials = 1000;
  state.resources.credits = 1000;
  state.resources.influence = 100;
  Engine.claimTerritory(state, island.id);
  const beforeMaterials = state.resources.materials;
  const beforeCredits = state.resources.credits;
  const harbor = Engine.upgradeHarbor(state, island.id);
  assert.equal(harbor.harborLevel, 1);
  assert.equal(state.resources.materials, beforeMaterials - 40);
  assert.equal(state.resources.credits, beforeCredits - 65);
  const route = Engine.createShippingRoute(state, island.id, "home", "materials");
  assert.equal(route.capacity, 10);
  assert.equal(route.travelTurns, Math.max(1, Math.min(5, Math.ceil(Math.hypot(island.x, island.z) / 18))));
  Engine.upgradeHarbor(state, island.id);
  assert.equal(harbor.harborLevel, 2);
  assert.equal(route.capacity, 15);
  Engine.upgradeHarbor(state, island.id);
  assert.equal(harbor.harborLevel, 3);
  assert.equal(route.capacity, 20);
  assert.throws(() => Engine.upgradeHarbor(state, island.id), /maximum level/);
});

test("remote extraction is stored locally and shipping convoys deliver cargo to the national economy", () => {
  const state = Engine.createInitialState({ seed: 72003 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1500;
  state.resources.credits = 1500;
  state.resources.influence = 100;
  Engine.claimTerritory(state, island.id);
  Engine.upgradeHarbor(state, island.id);
  const node = state.world.resourceNodes.find(item => item.territoryId === island.id);
  node.resource = "Timber";
  node.quantity = 100;
  Engine.developResourceSite(state, node.id);
  const route = Engine.createShippingRoute(state, island.id, "home", "materials");
  const nationalBefore = state.resources.materials;

  Engine.advanceTurn(state);
  assert.equal(island.stockpile.materials, 0);
  assert.equal(route.inTransit.amount, 3);
  assert.equal(route.loadedTotal, 3);
  assert.equal(route.status, "active");
  const snapshot = Engine.economicSnapshot(state);
  assert.equal(snapshot.shipping.activeRoutes, 1);
  assert.equal(snapshot.shipping.upkeep, 2);
  assert.equal(snapshot.shipping.cargoInTransit, 3);

  for (let i = 0; i < route.travelTurns; i++) Engine.advanceTurn(state);
  assert.equal(route.deliveredTotal, 3);
  assert.ok(route.lastDeliveredTurn > route.createdTurn);
  assert.ok(state.resources.materials > nationalBefore);
  assert.equal(route.inTransit, null);
  const saved = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.deepEqual(saved.world.shippingRoutes, state.world.shippingRoutes);
  assert.deepEqual(saved.world.territories.find(item => item.id === island.id).stockpile, island.stockpile);
});

test("shipping routes reject unowned ports, invalid cargo and duplicate lanes", () => {
  const state = Engine.createInitialState({ seed: 72004 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1000;
  state.resources.credits = 1000;
  state.resources.influence = 100;
  assert.throws(() => Engine.createShippingRoute(state, island.id, "home", "materials"), /Both shipping ports/);
  Engine.claimTerritory(state, island.id);
  assert.throws(() => Engine.createShippingRoute(state, island.id, "home", "materials"), /Build a harbor/);
  Engine.upgradeHarbor(state, island.id);
  const route = Engine.createShippingRoute(state, island.id, "home", "materials");
  assert.throws(() => Engine.createShippingRoute(state, island.id, "home", "materials"), /already exists/);
  assert.throws(() => Engine.createShippingRoute(state, island.id, "home", "credits"), /cannot be shipped/);
  const invalid = JSON.parse(Engine.exportSave(state));
  invalid.world.shippingRoutes[0].inTransit = { amount: 11, remainingTurns: 1 };
  assert.throws(() => Engine.validateSave(invalid), /Shipping route data is invalid/);
  assert.equal(route.status, "active");
});

test("shipping pauses without losing cargo when a port leaves player control", () => {
  const state = Engine.createInitialState({ seed: 72005 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1000;
  state.resources.credits = 1000;
  state.resources.influence = 100;
  Engine.claimTerritory(state, island.id);
  Engine.upgradeHarbor(state, island.id);
  const route = Engine.createShippingRoute(state, island.id, "home", "food");
  route.inTransit = { amount: 5, remainingTurns: 2 };
  island.owner = "duneward";
  Engine.advanceTurn(state);
  assert.equal(route.status, "paused");
  assert.deepEqual(route.inTransit, { amount: 5, remainingTurns: 2 });
  assert.equal(Engine.economicSnapshot(state).shipping.activeRoutes, 0);
});


test("Integrated Logistics shortens existing shipping voyages and halves route upkeep", () => {
  const state = Engine.createInitialState({ seed: 72007 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1000;
  state.resources.credits = 1000;
  state.resources.influence = 100;
  state.resources.science = 100;
  Engine.claimTerritory(state, island.id);
  Engine.upgradeHarbor(state, island.id);
  const route = Engine.createShippingRoute(state, island.id, "home", "ore");
  const beforeTravel = route.travelTurns;
  route.inTransit = { amount: 4, remainingTurns: beforeTravel };
  state.technologies.push("commerce");
  Engine.research(state, "logistics");
  assert.equal(route.travelTurns, Math.max(1, beforeTravel - 1));
  assert.equal(route.inTransit.remainingTurns, Math.max(1, beforeTravel - 1));
  assert.equal(Engine.shippingEffects(state).upkeep, 1);
});

test("a full remote stockpile pauses extraction without consuming the finite deposit", () => {
  const state = Engine.createInitialState({ seed: 72008 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1000;
  state.resources.credits = 1000;
  state.resources.influence = 100;
  Engine.claimTerritory(state, island.id);
  const node = state.world.resourceNodes.find(item => item.territoryId === island.id);
  node.resource = "Timber";
  node.quantity = 40;
  node.operational = true;
  node.operatedSinceTurn = state.turn;
  island.stockpile.materials = Engine.STOCKPILE_LIMIT;
  Engine.advanceTurn(state);
  assert.equal(node.quantity, 40);
  assert.equal(island.stockpile.materials, Engine.STOCKPILE_LIMIT);
});


test("shipping retains undelivered cargo until a remote destination has stockpile room", () => {
  const state = Engine.createInitialState({ seed: 72009 });
  const islands = state.world.territories.filter(item => item.owner === "unclaimed");
  state.resources.materials = 2000;
  state.resources.credits = 2000;
  state.resources.influence = 100;
  for (const island of islands) {
    Engine.claimTerritory(state, island.id);
    Engine.upgradeHarbor(state, island.id);
  }
  const [source, destination] = islands;
  const route = Engine.createShippingRoute(state, source.id, destination.id, "materials");
  source.stockpile.materials = 10;
  destination.stockpile.materials = Engine.STOCKPILE_LIMIT;
  route.inTransit = { amount: 10, remainingTurns: 1 };

  Engine.advanceTurn(state);
  assert.deepEqual(route.inTransit, { amount: 10, remainingTurns: 1 });
  assert.equal(route.deliveredTotal, 0);
  destination.stockpile.materials -= 10;
  Engine.advanceTurn(state);
  assert.equal(route.inTransit, null);
  assert.equal(route.deliveredTotal, 10);
  assert.equal(destination.stockpile.materials, Engine.STOCKPILE_LIMIT);
});


test("rival nations build island harbors and operate finite local extraction sites", () => {
  const state = Engine.createInitialState({ seed: 73001 });
  const rival = state.rivals.northreach;
  const territory = state.world.territories.find(item => item.owner === rival.id);
  const nodes = state.world.resourceNodes.filter(item => item.territoryId === territory.id);
  const node = nodes[0];
  for (const deposit of nodes) {
    deposit.quantity = 0;
    deposit.depleted = true;
    deposit.operational = false;
    deposit.operatedSinceTurn = null;
  }
  node.resource = "Iron";
  node.quantity = 12;
  node.depleted = false;
  rival.resources.materials = 1000;
  rival.resources.credits = 1000;

  const built = Engine.developRivalTerritories(state);
  assert.equal(territory.harborLevel, 1);
  assert.equal(node.operational, true);
  assert.equal(node.operatedSinceTurn, state.turn);
  assert.ok(built.harborsBuilt >= 1);
  assert.ok(built.extractionSitesOpened >= 1);

  territory.stockpile.ore = Engine.STOCKPILE_LIMIT - 1;
  Engine.processRivalResourceSites(state);
  assert.equal(territory.stockpile.ore, Engine.STOCKPILE_LIMIT);
  assert.equal(node.quantity, 11);
  Engine.processRivalResourceSites(state);
  assert.equal(node.quantity, 11);

  const restored = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.equal(restored.world.territories.find(item => item.id === territory.id).harborLevel, 1);
  assert.equal(restored.world.resourceNodes.find(item => item.id === node.id).quantity, 11);
});

test("autonomous rival shipping delivers cargo to rival reserves and is excluded from player upkeep", () => {
  const state = Engine.createInitialState({ seed: 73002 });
  const rival = state.rivals.duneward;
  const source = state.world.territories.find(item => item.owner === rival.id);
  const destination = state.world.territories.find(item => item.owner === "unclaimed");
  destination.owner = rival.id;
  destination.claimedTurn = state.turn;
  source.harborLevel = 1;
  destination.harborLevel = 1;
  const ownedIds = new Set([source.id, destination.id]);
  const nodes = state.world.resourceNodes.filter(node => ownedIds.has(node.territoryId));
  for (const deposit of nodes) {
    deposit.quantity = 0;
    deposit.depleted = true;
    deposit.operational = false;
    deposit.operatedSinceTurn = null;
  }
  const node = nodes.find(item => item.territoryId === source.id);
  node.resource = "Iron";
  node.quantity = 80;
  node.depleted = false;
  node.operational = true;
  node.operatedSinceTurn = state.turn;
  source.stockpile.ore = 20;
  rival.resources.materials = 1000;
  rival.resources.credits = 1000;
  rival.resources.ore = 100;

  const built = Engine.developRivalTerritories(state);
  const route = state.world.shippingRoutes.find(item => item.ownerId === rival.id);
  assert.ok(built.routesOpened >= 1);
  assert.ok(route);
  assert.equal(route.sourceId, source.id);
  assert.equal(route.destinationId, destination.id);
  assert.equal(route.resource, "ore");

  route.inTransit = { amount: 5, remainingTurns: 1 };
  route.loadedTotal = 5;
  route.lastLoadedTurn = state.turn;
  const rivalOreBefore = rival.resources.ore;
  const shipping = Engine.processShippingRoutes(state);
  assert.equal(route.status, "active");
  assert.equal(route.deliveredTotal, 5);
  assert.equal(route.inTransit, null);
  assert.equal(rival.resources.ore, rivalOreBefore + 5);
  assert.equal(shipping.activeRoutes, 0);
  assert.equal(shipping.rivalActiveRoutes, 1);
  assert.equal(shipping.upkeep, 0);
  assert.equal(Engine.shippingEffects(state).activeRoutes, 0);
  assert.equal(Engine.shippingEffects(state).upkeep, 0);

  const saved = JSON.parse(Engine.exportSave(state));
  assert.equal(saved.world.shippingRoutes[0].ownerId, rival.id);
  const invalid = structuredClone(saved);
  invalid.world.shippingRoutes[0].ownerId = "northreach";
  assert.throws(() => Engine.validateSave(invalid), /Shipping route data is invalid/);

  route.inTransit = { amount: 3, remainingTurns: 1 };
  source.owner = "northreach";
  Engine.processShippingRoutes(state);
  assert.equal(route.status, "paused");
  assert.deepEqual(route.inTransit, { amount: 3, remainingTurns: 1 });
});

test("schema 12 player shipping routes migrate with explicit player ownership", () => {
  const state = Engine.createInitialState({ seed: 73003 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1000;
  state.resources.credits = 1000;
  state.resources.influence = 100;
  Engine.claimTerritory(state, island.id);
  Engine.upgradeHarbor(state, island.id);
  Engine.createShippingRoute(state, island.id, "home", "materials");
  const legacy = JSON.parse(Engine.exportSave(state));
  legacy.schemaVersion = 12;
  delete legacy.world.shippingRoutes[0].ownerId;
  const migrated = Engine.migrateSave(legacy);
  assert.equal(migrated.schemaVersion, 17);
  assert.equal(migrated.world.shippingRoutes[0].ownerId, "player");
});


test("international shipping requires an active trade agreement and ports controlled by the two signatories", () => {
  const state = Engine.createInitialState({ seed: 74001 });
  const rivalId = "aurelia";
  const rival = state.rivals[rivalId];
  rival.relation = 35;
  const rivalPort = state.world.territories.find(item => item.owner === rivalId);
  rivalPort.harborLevel = 1;

  assert.throws(() => Engine.createInternationalTradeRoute(state, rivalId, "home", rivalPort.id, "food", 10), /active trade agreement/);
  Engine.offerTreaty(state, rivalId, "trade");
  const beforeMaterials = state.resources.materials;
  const beforeCredits = state.resources.credits;
  const route = Engine.createInternationalTradeRoute(state, rivalId, "home", rivalPort.id, "food", 10);

  assert.equal(route.ownerId, "player");
  assert.equal(route.partnerId, rivalId);
  assert.equal(route.sourceId, "home");
  assert.equal(route.destinationId, rivalPort.id);
  assert.equal(route.tariffPercent, 10);
  assert.equal(route.unitPrice, 3);
  assert.equal(route.status, "active");
  assert.equal(state.resources.materials, beforeMaterials - 20);
  assert.equal(state.resources.credits, beforeCredits - 35);
  assert.throws(() => Engine.createInternationalTradeRoute(state, rivalId, "home", rivalPort.id, "food", 10), /already exists/);
  const otherRivalPort = state.world.territories.find(item => item.owner === "northreach");
  otherRivalPort.harborLevel = 1;
  assert.throws(() => Engine.createInternationalTradeRoute(state, rivalId, "home", otherRivalPort.id, "food", 10), /one player port/);
  assert.throws(() => Engine.createInternationalTradeRoute(state, rivalId, "home", rivalPort.id, "science", 10), /not available/);
  assert.throws(() => Engine.createInternationalTradeRoute(state, rivalId, "home", rivalPort.id, "food", 12), /Choose a tariff/);
  assert.doesNotThrow(() => Engine.validateSave(state));
});

test("international exports settle payment on delivery and count toward campaign trade objectives", () => {
  const state = Engine.createInitialState({ seed: 74002 });
  const rivalId = "aurelia";
  const rival = state.rivals[rivalId];
  rival.relation = 35;
  const rivalPort = state.world.territories.find(item => item.owner === rivalId);
  rivalPort.harborLevel = 1;
  Engine.offerTreaty(state, rivalId, "trade");
  const route = Engine.createInternationalTradeRoute(state, rivalId, "home", rivalPort.id, "food", 10);

  state.resources.food = 50;
  state.resources.food -= 5;
  rival.resources.credits = 1000;
  const playerCreditsBefore = state.resources.credits;
  const rivalCreditsBefore = rival.resources.credits;
  const rivalFoodBefore = rival.resources.food;
  route.inTransit = { amount: 5, remainingTurns: 1 };
  route.loadedTotal = 5;
  route.lastLoadedTurn = state.turn;

  const shipping = Engine.processShippingRoutes(state);
  assert.equal(route.status, "active");
  assert.equal(route.inTransit, null);
  assert.equal(route.deliveredTotal, 5);
  assert.equal(rival.resources.food, rivalFoodBefore + 5);
  assert.equal(rival.resources.credits, rivalCreditsBefore - 15);
  assert.equal(state.resources.credits, playerCreditsBefore + 15);
  assert.equal(rival.relation, 35);
  assert.equal(state.campaign.progress.tradeVolume, 5);
  assert.equal(shipping.activeRoutes, 1);
  assert.equal(Engine.shippingEffects(state).activeRoutes, 1);

  const restored = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.deepEqual(restored.world.shippingRoutes, state.world.shippingRoutes);
  assert.equal(restored.world.shippingRoutes[0].unitPrice, 3);
});

test("international imports debit the player, pay the rival and apply high-tariff diplomatic consequences", () => {
  const state = Engine.createInitialState({ seed: 74003 });
  const rivalId = "northreach";
  const rival = state.rivals[rivalId];
  rival.relation = 35;
  const rivalPort = state.world.territories.find(item => item.owner === rivalId);
  rivalPort.harborLevel = 1;
  rivalPort.stockpile.ore = 4;
  Engine.offerTreaty(state, rivalId, "trade");
  const route = Engine.createInternationalTradeRoute(state, rivalId, rivalPort.id, "home", "ore", 20);

  assert.equal(route.unitPrice, 6);
  const playerCreditsBefore = state.resources.credits;
  const playerOreBefore = state.resources.ore;
  const rivalCreditsBefore = rival.resources.credits;
  rivalPort.stockpile.ore -= 4;
  route.inTransit = { amount: 4, remainingTurns: 1 };
  route.loadedTotal = 4;
  route.lastLoadedTurn = state.turn;

  Engine.processShippingRoutes(state);
  assert.equal(state.resources.ore, playerOreBefore + 4);
  assert.equal(state.resources.credits, playerCreditsBefore - 24);
  assert.equal(rival.resources.credits, rivalCreditsBefore + 24);
  assert.equal(rival.relation, 34);
  assert.equal(route.deliveredTotal, 4);
  assert.equal(route.inTransit, null);
  assert.ok(rival.memory.some(item => item.kind === "tariff" && item.relationDelta === -1));
});

test("international routes pause with cargo preserved when a trade agreement expires and resume when renewed", () => {
  const state = Engine.createInitialState({ seed: 74004 });
  const rivalId = "aurelia";
  const rival = state.rivals[rivalId];
  rival.relation = 35;
  const rivalPort = state.world.territories.find(item => item.owner === rivalId);
  rivalPort.harborLevel = 1;
  state.turn = 5;
  Engine.offerTreaty(state, rivalId, "trade");
  const treaty = state.diplomacy.treaties.find(item => item.rivalId === rivalId && item.kind === "trade" && item.status === "active");
  treaty.startedTurn = 1;
  const route = Engine.createInternationalTradeRoute(state, rivalId, "home", rivalPort.id, "materials", 5);
  route.inTransit = { amount: 7, remainingTurns: 2 };
  route.loadedTotal = 7;
  route.lastLoadedTurn = state.turn;
  state.resources.materials -= 7;

  Engine.advanceTurn(state);
  assert.equal(treaty.status, "expired");
  assert.equal(route.status, "paused");
  assert.deepEqual(route.inTransit, { amount: 7, remainingTurns: 2 });
  const pausedSave = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.deepEqual(pausedSave.world.shippingRoutes[0].inTransit, route.inTransit);

  Engine.offerTreaty(state, rivalId, "trade");
  const resumed = Engine.processShippingRoutes(state);
  assert.equal(route.status, "active");
  assert.deepEqual(route.inTransit, { amount: 7, remainingTurns: 1 });
  assert.equal(resumed.activeRoutes, 1);

  rival.relation = -25;
  Engine.declareConflict(state, rivalId);
  Engine.processShippingRoutes(state);
  assert.equal(route.status, "paused");
  assert.deepEqual(route.inTransit, { amount: 7, remainingTurns: 1 });
  assert.doesNotThrow(() => Engine.validateSave(state));
});

test("international route validation rejects malformed contracts but retains paused routes after port ownership changes", () => {
  const state = Engine.createInitialState({ seed: 74005 });
  const rivalId = "solenne";
  state.rivals[rivalId].relation = 35;
  const rivalPort = state.world.territories.find(item => item.owner === rivalId);
  rivalPort.harborLevel = 1;
  Engine.offerTreaty(state, rivalId, "trade");
  const route = Engine.createInternationalTradeRoute(state, rivalId, "home", rivalPort.id, "power", 15);

  const invalidPartner = JSON.parse(Engine.exportSave(state));
  invalidPartner.world.shippingRoutes[0].partnerId = "unknown";
  assert.throws(() => Engine.validateSave(invalidPartner), /Shipping route data is invalid/);
  const invalidTariff = JSON.parse(Engine.exportSave(state));
  invalidTariff.world.shippingRoutes[0].tariffPercent = 7;
  assert.throws(() => Engine.validateSave(invalidTariff), /Shipping route data is invalid/);
  const invalidPrototypePartner = JSON.parse(Engine.exportSave(state));
  invalidPrototypePartner.world.shippingRoutes[0].partnerId = "__proto__";
  assert.throws(() => Engine.validateSave(invalidPrototypePartner), /Shipping route data is invalid/);
  const invalidPrice = JSON.parse(Engine.exportSave(state));
  invalidPrice.world.shippingRoutes[0].unitPrice = 0;
  assert.throws(() => Engine.validateSave(invalidPrice), /Shipping route data is invalid/);

  rivalPort.owner = "northreach";
  Engine.processShippingRoutes(state);
  assert.equal(route.status, "paused");
  assert.doesNotThrow(() => Engine.validateSave(state));
  const restored = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.equal(restored.world.shippingRoutes[0].status, "paused");
});

test("schema 13 saves migrate to version 17 while preserving domestic shipping routes and regional population", () => {
  const state = Engine.createInitialState({ seed: 74006 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1000;
  state.resources.credits = 1000;
  state.resources.influence = 100;
  Engine.claimTerritory(state, island.id);
  Engine.upgradeHarbor(state, island.id);
  Engine.createShippingRoute(state, island.id, "home", "materials");
  const legacy = JSON.parse(Engine.exportSave(state));
  legacy.nation.population = legacy.world.territories.find(item => item.id === "home").population;
  legacy.schemaVersion = 13;
  const migrated = Engine.migrateSave(legacy);
  assert.equal(migrated.schemaVersion, 17);
  assert.equal(migrated.nation.population, migrated.world.territories.filter(item => item.owner === "player").reduce((sum, item) => sum + item.population, 0));
  assert.deepEqual(migrated.world.shippingRoutes, legacy.world.shippingRoutes);
});

test("schema 14 saves add existing player-island residents to the national population", () => {
  const state = Engine.createInitialState({ seed: 74007 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1000; state.resources.credits = 1000; state.resources.influence = 100;
  Engine.claimTerritory(state, island.id);
  const legacy = JSON.parse(Engine.exportSave(state));
  const home = legacy.world.territories.find(item => item.id === "home");
  legacy.nation.population = home.population;
  legacy.schemaVersion = 14;
  const migrated = Engine.migrateSave(legacy);
  assert.equal(migrated.schemaVersion, 17);
  assert.equal(migrated.nation.population, home.population + island.population);
  assert.equal(migrated.world.territories.find(item => item.id === island.id).population, island.population);
});

test("national population save validation rejects totals that omit or double-count owned residents", () => {
  const state = Engine.createInitialState({ seed: 74009 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1000; state.resources.credits = 1000; state.resources.influence = 100;
  Engine.claimTerritory(state, island.id);
  const invalid = JSON.parse(Engine.exportSave(state));
  invalid.nation.population -= 1;
  assert.throws(() => Engine.validateSave(invalid), /National population does not match/);
});


test("international cargo waits safely for buyer funds and destination storage", () => {
  const state = Engine.createInitialState({ seed: 74008 });
  const rivalId = "aurelia";
  const rival = state.rivals[rivalId];
  rival.relation = 35;
  const rivalPort = state.world.territories.find(item => item.owner === rivalId);
  rivalPort.harborLevel = 1;
  Engine.offerTreaty(state, rivalId, "trade");
  const route = Engine.createInternationalTradeRoute(state, rivalId, "home", rivalPort.id, "food", 10);
  state.resources.food -= 5;
  const sellerCreditsBefore = state.resources.credits;
  rival.resources.food = Engine.RESOURCE_LIMIT - 2;
  rival.resources.credits = 0;
  route.inTransit = { amount: 5, remainingTurns: 1 };
  route.loadedTotal = 5;
  route.lastLoadedTurn = state.turn;

  Engine.processShippingRoutes(state);
  assert.equal(route.deliveredTotal, 0);
  assert.deepEqual(route.inTransit, { amount: 5, remainingTurns: 1 });
  assert.equal(rival.resources.credits, 0);

  rival.resources.credits = 100;
  Engine.processShippingRoutes(state);
  assert.equal(route.deliveredTotal, 2);
  assert.deepEqual(route.inTransit, { amount: 3, remainingTurns: 1 });
  assert.equal(rival.resources.food, Engine.RESOURCE_LIMIT);
  assert.equal(rival.resources.credits, 94);

  rival.resources.food = Engine.RESOURCE_LIMIT - 3;
  Engine.processShippingRoutes(state);
  assert.equal(route.deliveredTotal, 5);
  assert.equal(route.inTransit, null);
  assert.equal(rival.resources.food, Engine.RESOURCE_LIMIT);
  assert.equal(rival.resources.credits, 85);
  assert.equal(state.resources.credits, sellerCreditsBefore + 15);
});


test("claimed island residents join national workforce, food demand and saved population", () => {
  const state = Engine.createInitialState({ seed: 74101 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  const localResidents = island.population;
  state.resources.materials = 1000; state.resources.credits = 1000; state.resources.influence = 100;
  Engine.claimTerritory(state, island.id);
  assert.equal(state.nation.population, 100 + localResidents);
  const snapshot = Engine.economicSnapshot(state);
  assert.equal(snapshot.population, state.nation.population);
  assert.equal(snapshot.requiredJobs, Math.ceil(state.nation.population / 10));
  assert.equal(snapshot.consumption.food, Math.ceil(state.nation.population / (12 + Math.min(8, snapshot.production.logistics))));
  const restored = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.equal(restored.nation.population, state.nation.population);
  assert.equal(restored.world.territories.find(item => item.id === island.id).population, localResidents);
});

test("regional district jobs and output are staffed by residents on their own island", () => {
  const state = Engine.createInitialState({ seed: 74102 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1000; state.resources.credits = 1000; state.resources.influence = 100;
  Engine.claimTerritory(state, island.id);
  Engine.placeWorldDistrict(state, "agricultural", { territoryId: island.id, x: island.x + 0.25, z: island.z, radius: 2.6 });
  const districts = Engine.districtEffects(state);
  assert.equal(districts.workforce, 4);
  assert.equal(districts.employed, 4);
  assert.equal(districts.production.food, 3);
  const snapshot = Engine.economicSnapshot(state);
  assert.equal(snapshot.workforce, Engine.workforceFor(state.buildings) + 4 + Engine.militaryEffects(state).manpower);
  island.population = 1;
  const underpopulated = Engine.districtEffects(state);
  assert.equal(underpopulated.employed, 1);
  assert.equal(underpopulated.production.food, 0);
});

test("remote residential growth updates national population and food shortages keep totals synchronized", () => {
  const state = Engine.createInitialState({ seed: 74103 });
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  state.resources.materials = 1000; state.resources.credits = 1000; state.resources.influence = 100;
  Engine.claimTerritory(state, island.id);
  Engine.placeWorldDistrict(state, "residential", { territoryId: island.id, x: island.x + 0.25, z: island.z, radius: 2.6 });
  state.resources.food = 1000;
  state.nation.stability = 100;
  const localBefore = island.population, nationalBefore = state.nation.population;
  Engine.advanceTurn(state);
  assert.equal(island.population, localBefore + 1);
  assert.equal(state.nation.population, nationalBefore + 3);
  assert.equal(state.nation.population, Engine.nationalPopulationFor(state));

  state.buildings.farm = 0;
  state.resources.food = 0;
  const remoteBeforeShortage = island.population;
  Engine.advanceTurn(state);
  assert.equal(island.population, remoteBeforeShortage);
  assert.equal(state.nation.population, Engine.nationalPopulationFor(state));
});


test("remote residents do not staff home-island factories without local employment", () => {
  const state = Engine.createInitialState({ seed: 74104 });
  const home = state.world.territories.find(item => item.id === "home");
  const island = state.world.territories.find(item => item.owner === "unclaimed");
  home.population = 20;
  home.garrison = 0;
  state.nation.population = 20;
  state.resources.materials = 1000;
  state.resources.ore = 30;
  state.resources.power = 20;
  state.resources.food = 1000;
  state.resources.influence = 100;
  state.resources.credits = 1000;
  Engine.claimTerritory(state, island.id);
  for (const id of Object.keys(state.buildings)) state.buildings[id] = 0;
  state.buildings.factory = 10;
  state.resources.materials = 50;
  state.resources.ore = 30;
  state.resources.power = 20;
  assert.ok(state.nation.population > home.population);
  assert.equal(Engine.economicSnapshot(state).activeFactories, 2);
});


test("territorial campaigns require a rival-owned target and preserve the target in saves", () => {
  const state = Engine.createInitialState({ seed: 74201 });
  const target = state.world.territories.find(territory => territory.owner === "aurelia");
  const neutral = state.world.territories.find(territory => territory.owner === "unclaimed");
  state.rivals.aurelia.relation = -20;
  state.resources.credits = 1000;
  state.resources.power = 1000;
  assert.throws(() => Engine.declareConflict(state, "aurelia", neutral.id), /controlled by Aurelia/);
  assert.throws(() => Engine.declareConflict(state, "aurelia", "missing-island"), /controlled by Aurelia/);
  Engine.declareConflict(state, "aurelia", target.id);
  assert.equal(state.diplomacy.conflicts[0].targetTerritoryId, target.id);
  const restored = Engine.migrateSave(JSON.parse(Engine.exportSave(state)));
  assert.equal(restored.diplomacy.conflicts[0].targetTerritoryId, target.id);
  const invalid = JSON.parse(Engine.exportSave(state));
  invalid.diplomacy.conflicts[0].targetTerritoryId = "missing-island";
  assert.throws(() => Engine.validateSave(invalid), /Conflict record is invalid/);
});

test("winning a territorial campaign transfers the island, residents and infrastructure to the player", () => {
  const state = Engine.createInitialState({ seed: 74202 });
  const rival = state.rivals.aurelia;
  const target = state.world.territories.find(territory => territory.owner === rival.id);
  const targetPopulation = target.population;
  const rivalPopulation = 750;
  state.resources.credits = 1000;
  state.resources.food = 1000;
  state.resources.materials = 1000;
  state.resources.ore = 1000;
  state.resources.power = 1000;
  state.resources.science = 100;
  state.resources.influence = 100;
  state.nation.stability = 100;
  rival.stability = 100;
  rival.relation = -20;
  rival.resources = { food: 1000, materials: 0, ore: 0, goods: 0, credits: 1000, science: 0, power: 0, influence: 0 };
  for (const id of Object.keys(rival.buildings)) rival.buildings[id] = 0;
  rival.population = rivalPopulation;
  rival.buildings.housing = 10;
  rival.technologies = [];
  target.harborLevel = 1;
  target.stockpile.materials = 17;
  const secondPort = state.world.territories.find(territory => territory.owner === "unclaimed");
  secondPort.owner = rival.id;
  secondPort.claimedTurn = state.turn;
  secondPort.harborLevel = 1;
  const rivalRoute = {
    id: "rival-aurelia-campaign-test", ownerId: rival.id, sourceId: target.id, destinationId: secondPort.id,
    resource: "ore", capacity: 10, travelTurns: 5, status: "active",
    inTransit: { amount: 8, remainingTurns: 5 }, createdTurn: state.turn,
    loadedTotal: 8, deliveredTotal: 0, lastLoadedTurn: state.turn, lastDeliveredTurn: null
  };
  state.world.shippingRoutes.push(rivalRoute);
  state.world.placedDistricts.push({ type: "agricultural", x: target.x + 0.2, z: target.z, radius: 2.6, territoryId: target.id });
  const deposit = state.world.resourceNodes.find(node => node.territoryId === target.id);
  deposit.resource = "Iron";
  deposit.quantity = 100;
  deposit.operational = true;
  deposit.depleted = false;
  deposit.operatedSinceTurn = state.turn;
  Engine.declareConflict(state, rival.id, target.id);
  for (let turn = 0; turn < 3; turn++) Engine.advanceTurn(state);
  const conflict = state.diplomacy.conflicts[0];
  assert.equal(conflict.status, "resolved");
  assert.ok(conflict.playerScore > conflict.rivalScore);
  assert.equal(target.owner, "player");
  assert.equal(target.claimedTurn, state.turn);
  assert.equal(target.harborLevel, 1);
  assert.equal(target.stockpile.materials, 17);
  assert.equal(rivalRoute.status, "paused");
  assert.deepEqual(rivalRoute.inTransit, { amount: 8, remainingTurns: 2 });
  assert.equal(state.world.placedDistricts[0].territoryId, target.id);
  const homeAfterCampaign = state.world.territories.find(territory => territory.id === "home").population;
  assert.equal(state.nation.population, homeAfterCampaign + targetPopulation);
  assert.equal(state.nation.population, Engine.nationalPopulationFor(state));
  assert.equal(rival.population, Math.max(1, rivalPopulation - targetPopulation));
  assert.ok(Engine.districtEffects(state).workforce >= 4);
  const beforeExtraction = target.stockpile.ore;
  Engine.advanceTurn(state);
  assert.ok(target.stockpile.ore > beforeExtraction);
  assert.doesNotThrow(() => Engine.validateSave(JSON.parse(Engine.exportSave(state))));
});

test("losing a territorial campaign does not transfer the targeted island", () => {
  const state = Engine.createInitialState({ seed: 74203 });
  const rival = state.rivals.northreach;
  const target = state.world.territories.find(territory => territory.owner === rival.id);
  state.resources.credits = 1000;
  state.resources.food = 1000;
  state.resources.power = 10;
  state.resources.materials = 100;
  state.nation.stability = 100;
  rival.stability = 100;
  rival.resources.power = 1000;
  rival.buildings.power = 0;
  rival.technologies = [];
  state.rivals.northreach.relation = -20;
  Engine.declareConflict(state, rival.id, target.id);
  for (let turn = 0; turn < 3; turn++) Engine.advanceTurn(state);
  assert.equal(state.diplomacy.conflicts[0].status, "resolved");
  assert.ok(state.diplomacy.conflicts[0].rivalScore > state.diplomacy.conflicts[0].playerScore);
  assert.equal(target.owner, rival.id);
  assert.equal(state.nation.population, Engine.nationalPopulationFor(state));
});


test("conquest never creates residents when the rival has fewer people than the target island", () => {
  const state = Engine.createInitialState({ seed: 74205 });
  const rival = state.rivals.aurelia;
  const target = state.world.territories.find(territory => territory.owner === rival.id);
  target.population = 100;
  state.resources.credits = 1000;
  state.resources.food = 1000;
  state.resources.power = 1000;
  state.resources.materials = 1000;
  state.resources.ore = 1000;
  state.nation.stability = 100;
  rival.population = 50;
  rival.stability = 100;
  rival.relation = -20;
  rival.resources = { food: 1000, materials: 0, ore: 0, goods: 0, credits: 1000, science: 0, power: 0, influence: 0 };
  for (const id of Object.keys(rival.buildings)) rival.buildings[id] = 0;
  rival.technologies = [];
  Engine.declareConflict(state, rival.id, target.id);
  for (let turn = 0; turn < 3; turn++) Engine.advanceTurn(state);
  assert.equal(target.owner, "player");
  assert.equal(rival.population, 1);
  assert.ok(target.population < 100);
  assert.equal(state.nation.population, Engine.nationalPopulationFor(state));
});


test("new territories receive deterministic local garrisons and Ironmarch starts fortified", () => {
  const state = Engine.createInitialState({ seed: 75501 });
  const home = state.world.territories.find(item => item.id === "home");
  const ironmarch = state.world.territories.find(item => item.owner === "ironmarch");
  const neutral = state.world.territories.find(item => item.owner === "unclaimed");
  assert.equal(home.garrison, 2);
  assert.equal(home.fortificationLevel, 0);
  assert.equal(ironmarch.garrison, 3);
  assert.equal(ironmarch.fortificationLevel, 1);
  assert.equal(neutral.garrison, 0);
  assert.equal(Engine.militaryEffects(state).units, 2);
  assert.equal(Engine.militaryEffects(state).manpower, 20);
  assert.equal(Engine.militaryEffects(state).upkeep, 2);
});

test("recruiting a garrison spends resources and respects local manpower capacity", () => {
  const state = Engine.createInitialState({ seed: 75502 });
  const home = state.world.territories.find(item => item.id === "home");
  state.resources.materials = 500;
  state.resources.ore = 500;
  state.resources.credits = 500;
  const before = { ...state.resources };
  Engine.recruitGarrison(state, "home", 2);
  assert.equal(home.garrison, 4);
  assert.equal(state.resources.materials, before.materials - 24);
  assert.equal(state.resources.ore, before.ore - 12);
  assert.equal(state.resources.credits, before.credits - 40);
  assert.deepEqual(Engine.militaryEffects(state), { units: 4, manpower: 40, upkeep: 4, fortifications: 0 });
  assert.throws(() => Engine.recruitGarrison(state, "isle-aurelia"), /territory you control/);
  home.garrison = Engine.garrisonCapacity(home);
  assert.throws(() => Engine.recruitGarrison(state, "home"), /Local manpower supports/);
});

test("fortification upgrades consume escalating resources and add territorial defense", () => {
  const state = Engine.createInitialState({ seed: 75503 });
  const home = state.world.territories.find(item => item.id === "home");
  state.resources.materials = 1000;
  state.resources.credits = 1000;
  const beforeDefense = Engine.territoryDefenseStrength(home);
  const beforeMaterials = state.resources.materials;
  const beforeCredits = state.resources.credits;
  Engine.buildFortification(state, "home");
  assert.equal(home.fortificationLevel, 1);
  Engine.buildFortification(state, "home");
  assert.equal(home.fortificationLevel, 2);
  Engine.buildFortification(state, "home");
  assert.equal(home.fortificationLevel, 3);
  assert.equal(state.resources.materials, beforeMaterials - 150);
  assert.equal(state.resources.credits, beforeCredits - 120);
  assert.equal(Engine.territoryDefenseStrength(home), beforeDefense + 36);
  assert.throws(() => Engine.buildFortification(state, "home"), /maximum level/);
  assert.throws(() => Engine.buildFortification(state, "isle-aurelia"), /territory you control/);
});

test("schema 15 saves migrate to local garrisons and validated fortification levels", () => {
  const state = Engine.createInitialState({ seed: 75504 });
  state.schemaVersion = 15;
  for (const territory of state.world.territories) {
    delete territory.garrison;
    delete territory.fortificationLevel;
  }
  const migrated = Engine.migrateSave(state);
  const home = migrated.world.territories.find(item => item.id === "home");
  const ironmarch = migrated.world.territories.find(item => item.owner === "ironmarch");
  const neutral = migrated.world.territories.find(item => item.owner === "unclaimed");
  assert.equal(migrated.schemaVersion, 17);
  assert.equal(home.garrison, 2);
  assert.equal(ironmarch.garrison, 3);
  assert.equal(ironmarch.fortificationLevel, 1);
  assert.equal(neutral.garrison, 0);
  const invalid = JSON.parse(Engine.exportSave(migrated));
  invalid.world.territories.find(item => item.id === "home").garrison = 99;
  assert.throws(() => Engine.validateSave(invalid), /Territory data is invalid/);
});

test("territorial combat includes the home garrison and target island defenses", () => {
  const unfortified = Engine.createInitialState({ seed: 75505 });
  const fortified = structuredClone(unfortified);
  const targetA = unfortified.world.territories.find(item => item.owner === "aurelia");
  const targetB = fortified.world.territories.find(item => item.id === targetA.id);
  for (const state of [unfortified, fortified]) {
    state.resources.credits = 1000;
    state.resources.power = 1000;
    const rival = state.rivals.aurelia;
    rival.relation = -20;
    rival.resources.materials = 0;
    rival.resources.ore = 0;
    rival.resources.credits = 0;
    rival.resources.power = 0;
    rival.buildings.power = 0;
    rival.technologies = [];
  }
  targetA.garrison = 0;
  targetA.fortificationLevel = 0;
  targetB.garrison = 3;
  targetB.fortificationLevel = 2;
  Engine.declareConflict(unfortified, "aurelia", targetA.id);
  Engine.declareConflict(fortified, "aurelia", targetB.id);
  Engine.advanceTurn(unfortified);
  Engine.advanceTurn(fortified);
  assert.equal(fortified.diplomacy.conflicts[0].playerScore, unfortified.diplomacy.conflicts[0].playerScore);
  assert.equal(fortified.diplomacy.conflicts[0].rivalScore - unfortified.diplomacy.conflicts[0].rivalScore, 48);
});

test("rivals fortify a targeted island and recruit local defenders during a territorial campaign", () => {
  const state = Engine.createInitialState({ seed: 75506 });
  const rival = state.rivals.aurelia;
  const target = state.world.territories.find(item => item.owner === rival.id);
  target.harborLevel = 1;
  for (const territory of state.world.territories.filter(item => item.owner === rival.id)) territory.harborLevel = 1;
  for (const node of state.world.resourceNodes.filter(item => item.territoryId === target.id)) {
    node.quantity = 0;
    node.depleted = true;
    node.operational = false;
  }
  rival.resources.materials = 1000;
  rival.resources.ore = 1000;
  rival.resources.credits = 1000;
  rival.resources.power = 0;
  rival.buildings.power = 0;
  rival.technologies = [];
  rival.relation = -20;
  state.resources.credits = 1000;
  state.resources.power = 1000;
  Engine.declareConflict(state, rival.id, target.id);
  for (let turn = 0; turn < 3; turn++) Engine.advanceTurn(state);
  assert.equal(target.fortificationLevel, 2);
  assert.equal(target.garrison, 0);
  assert.equal(target.counterattackForce, 2);
  assert.equal(target.counterattackStatus, "available");
  assert.equal(target.owner, "player");
  assert.ok(state.events.some(event => event.text.includes("reinforced " + target.name)));
  assert.ok(state.events.some(event => event.text.includes("mobilized additional defenders on " + target.name)));
});


test("schema 16 campaigns migrate without inventing former-owner counterattack history", () => {
  const state = Engine.createInitialState({ seed: 76101 });
  state.schemaVersion = 16;
  const migrated = Engine.migrateSave(state);
  assert.equal(migrated.schemaVersion, 17);
  assert.ok(migrated.world.territories.every(territory => territory.counterattackStatus === undefined));
  assert.doesNotThrow(() => Engine.validateSave(JSON.parse(Engine.exportSave(migrated))));
});

test("a hostile former owner launches one counterattack with its escaped garrison", () => {
  const state = Engine.createInitialState({ seed: 76102 });
  state.turn = 5;
  const rival = state.rivals.aurelia;
  const target = state.world.territories.find(territory => territory.owner === rival.id);
  target.owner = "player";
  target.claimedTurn = state.turn;
  target.population = 50;
  target.garrison = 0;
  target.lastLostOwnerId = rival.id;
  target.lastLostTurn = state.turn - 1;
  target.counterattackStatus = "available";
  target.counterattackForce = 2;
  Engine.syncNationalPopulation(state);
  rival.relation = -65;
  rival.stability = 100;
  rival.resources.credits = 200;
  rival.resources.power = 100;
  rival.buildings.power = 1;
  const creditsBefore = rival.resources.credits;
  const powerBefore = rival.resources.power;

  const result = Engine.planRivalCounterattacks(state);
  assert.equal(result.launched, 1);
  assert.equal(state.diplomacy.conflicts.length, 1);
  const conflict = state.diplomacy.conflicts[0];
  assert.equal(conflict.initiator, "rival");
  assert.equal(conflict.targetTerritoryId, target.id);
  assert.equal(conflict.assaultGarrison, 2);
  assert.equal(target.counterattackStatus, "active");
  assert.equal(target.counterattackForce, 0);
  assert.equal(rival.resources.credits, creditsBefore - Engine.COUNTERATTACK_COST.credits);
  assert.equal(rival.resources.power, powerBefore - Engine.COUNTERATTACK_COST.power);
  assert.doesNotThrow(() => Engine.validateSave(JSON.parse(Engine.exportSave(state))));
});

test("a rival counterattack can retake an island and transfer residents back without losing cargo", () => {
  const state = Engine.createInitialState({ seed: 76103 });
  state.turn = 4;
  const rival = state.rivals.aurelia;
  const target = state.world.territories.find(territory => territory.owner === rival.id);
  target.owner = "player";
  target.claimedTurn = state.turn;
  target.population = 50;
  target.harborLevel = 1;
  target.garrison = 0;
  target.fortificationLevel = 0;
  target.lastLostOwnerId = rival.id;
  target.lastLostTurn = state.turn - 1;
  target.counterattackStatus = "available";
  target.counterattackForce = 3;
  Engine.syncNationalPopulation(state);
  const populationBefore = rival.population;
  rival.relation = -65;
  rival.stability = 100;
  rival.resources.credits = 1000;
  rival.resources.power = 1000;
  rival.resources.materials = 500;
  rival.resources.ore = 500;
  rival.buildings.power = 0;
  rival.technologies = [];
  state.resources.credits = 1000;
  state.resources.food = 1000;
  state.resources.power = 0;
  state.buildings.power = 0;
  state.nation.stability = 100;
  const route = {
    id: "counterattack-cargo-test", ownerId: "player", sourceId: target.id, destinationId: "home",
    resource: "food", capacity: 10, travelTurns: 5, status: "active",
    inTransit: { amount: 5, remainingTurns: 5 }, createdTurn: state.turn,
    loadedTotal: 5, deliveredTotal: 0, lastLoadedTurn: state.turn, lastDeliveredTurn: null
  };
  state.world.shippingRoutes.push(route);

  for (let turn = 0; turn < 4; turn++) Engine.advanceTurn(state);
  const conflict = state.diplomacy.conflicts.find(item => item.initiator === "rival");
  assert.ok(conflict);
  assert.equal(conflict.status, "resolved");
  assert.ok(conflict.rivalScore > conflict.playerScore);
  assert.equal(target.owner, rival.id);
  assert.equal(target.counterattackStatus, "retaken");
  assert.equal(target.garrison, 1);
  assert.ok(rival.population > populationBefore);
  assert.equal(state.nation.population, Engine.nationalPopulationFor(state));
  assert.equal(route.status, "paused");
  assert.ok(route.inTransit && route.inTransit.amount === 5 && route.inTransit.remainingTurns === 1);
  assert.doesNotThrow(() => Engine.validateSave(JSON.parse(Engine.exportSave(state))));
});

test("strong island garrisons repel a rival counterattack and consume the escaped assault force", () => {
  const state = Engine.createInitialState({ seed: 76104 });
  state.turn = 4;
  const rival = state.rivals.aurelia;
  const target = state.world.territories.find(territory => territory.owner === rival.id);
  target.owner = "player";
  target.claimedTurn = state.turn;
  target.population = 80;
  target.garrison = 4;
  target.fortificationLevel = 3;
  target.lastLostOwnerId = rival.id;
  target.lastLostTurn = state.turn - 1;
  target.counterattackStatus = "available";
  target.counterattackForce = 1;
  Engine.syncNationalPopulation(state);
  rival.relation = -65;
  rival.stability = 100;
  rival.resources.credits = 1000;
  rival.resources.power = 100;
  rival.resources.materials = 500;
  rival.resources.ore = 500;
  rival.buildings.power = 0;
  rival.technologies = [];
  state.resources.credits = 1000;
  state.resources.food = 1000;
  state.resources.power = 1000;
  state.buildings.power = 10;
  state.nation.stability = 100;

  for (let turn = 0; turn < 4; turn++) Engine.advanceTurn(state);
  const conflict = state.diplomacy.conflicts.find(item => item.initiator === "rival");
  assert.ok(conflict);
  assert.equal(conflict.status, "resolved");
  assert.ok(conflict.playerScore > conflict.rivalScore);
  assert.equal(target.owner, "player");
  assert.equal(target.counterattackStatus, "repelled");
  assert.equal(target.counterattackForce, 0);
  assert.doesNotThrow(() => Engine.validateSave(JSON.parse(Engine.exportSave(state))));
});

test("counterattack windows expire and invalid former-owner records are rejected", () => {
  const state = Engine.createInitialState({ seed: 76105 });
  state.turn = 8;
  const rival = state.rivals.aurelia;
  const target = state.world.territories.find(territory => territory.owner === rival.id);
  target.owner = "player";
  target.claimedTurn = state.turn;
  target.lastLostOwnerId = rival.id;
  target.lastLostTurn = 1;
  target.counterattackStatus = "available";
  target.counterattackForce = 2;
  Engine.syncNationalPopulation(state);
  const result = Engine.planRivalCounterattacks(state);
  assert.equal(result.launched, 0);
  assert.equal(result.expired, 1);
  assert.equal(target.counterattackStatus, "expired");
  assert.equal(target.counterattackForce, 0);
  const invalid = JSON.parse(Engine.exportSave(state));
  invalid.world.territories.find(item => item.id === target.id).lastLostOwnerId = "unknown-faction";
  assert.throws(() => Engine.validateSave(invalid), /Territory data is invalid/);
  const invalidConflict = JSON.parse(Engine.exportSave(state));
  invalidConflict.diplomacy.conflicts.push({
    rivalId: rival.id, status: "active", startedTurn: state.turn, playerScore: 0, rivalScore: 0,
    targetTerritoryId: target.id, initiator: "rival", assaultGarrison: 0
  });
  assert.throws(() => Engine.validateSave(invalidConflict), /Conflict record is invalid/);
});


test("a peace accord withdraws an active rival counterattack without changing island ownership", () => {
  const state = Engine.createInitialState({ seed: 76107 });
  const rival = state.rivals.aurelia;
  const target = state.world.territories.find(territory => territory.owner === rival.id);
  target.owner = "player";
  target.claimedTurn = state.turn;
  target.lastLostOwnerId = rival.id;
  target.lastLostTurn = state.turn;
  target.counterattackStatus = "active";
  target.counterattackForce = 0;
  Engine.syncNationalPopulation(state);
  state.resources.credits = 100;
  state.diplomacy.conflicts.push({
    rivalId: rival.id, status: "active", startedTurn: state.turn,
    playerScore: 12, rivalScore: 18, targetTerritoryId: target.id,
    initiator: "rival", assaultGarrison: 2
  });
  Engine.makePeace(state, rival.id);
  assert.equal(state.diplomacy.conflicts[0].status, "peace");
  assert.equal(target.owner, "player");
  assert.equal(target.counterattackStatus, "withdrawn");
  assert.equal(target.counterattackForce, 0);
  assert.doesNotThrow(() => Engine.validateSave(JSON.parse(Engine.exportSave(state))));
});
