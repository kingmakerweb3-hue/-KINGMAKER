const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../src/engine.js");

test("new game has a complete, validated state", () => {
  const state = Engine.createInitialState({ seed: 2 });
  assert.equal(state.schemaVersion, Engine.SAVE_VERSION);
  assert.equal(Engine.validateSave(state).nation.name, "New Horizon");
  assert.deepEqual(Object.keys(state.rivals).sort(), ["aurelia", "meridian", "northreach"]);
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

test("version 2 saves migrate to industrial schema without losing the scenario baseline", () => {
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
  }
  const migrated = Engine.migrateSave(old);
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.campaign.buildingStart, buildingStart);
  assert.equal(migrated.resources.ore, 48);
  assert.equal(migrated.rivals.aurelia.activity, "Adapting industry");
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
  assert.match(scarce.rivals.aurelia.activity, /Bought|mine|shortage/i);
  assert.ok(scarce.rivals.aurelia.relation > 15);
});

test("a trusted diplomatic rival can independently form a strategic alliance", () => {
  const state = Engine.createInitialState({ seed: 1327 });
  const rival = state.rivals.aurelia;
  rival.relation = 80;
  rival.resources.credits = 0;
  rival.buildings.academy = 1;
  for (const id of Object.keys(rival.buildings)) if (id !== "academy") rival.buildings[id] = 0;
  Engine.advanceTurn(state);
  assert.ok(state.diplomacy.treaties.some(t => t.rivalId === rival.id && t.kind === "alliance" && t.status === "active"));
  assert.ok(rival.treaties.includes("alliance"));
  assert.equal(rival.activity, "Formed a strategic alliance");
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
  const state = Engine.createInitialState();
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
  assert.equal(state.creations.length, 0);
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
  state.buildings.farm += 3;
  state.rivals.aurelia.relation = 30;
  state.resources.science = 66;
  Engine.research(state, "agriculture");
  Engine.research(state, "governance");
  assert.equal(state.status, "victory");
  assert.equal(state.campaign.status, "victory");
  assert.equal(state.campaign.completedObjectives.length, 4);
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
