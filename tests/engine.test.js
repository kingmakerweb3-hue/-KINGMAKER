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
  state.turn += 8;
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
});

test("v0.3 saves with negative relations migrate without losing the sign", () => {
  const migrated = Engine.migrateSave({
    turn: 4, food: 70, materials: 40, credits: 90, influence: 12, population: 95, stability: 60,
    buildings: { farm: 2 }, events: ["Old story"], relations: { Meridian: -35 }
  });
  assert.equal(migrated.rivals.meridian.relation, -35);
  assert.equal(migrated.resources.influence, 12);
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
  assert.ok(state.achievements.includes("founding-victory"));
});
