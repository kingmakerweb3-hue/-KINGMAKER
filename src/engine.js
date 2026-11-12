(function (root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.KingmakerEngine = engine;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SAVE_VERSION = 2;
  const RESOURCE_LIMIT = 1_000_000;
  const RESOURCE_KEYS = ["food", "materials", "credits", "science", "power", "influence"];
  const BUILDINGS = {
    farm: { name: "Farm", cost: { materials: 24, credits: 36 }, production: { food: 12 } },
    workshop: { name: "Workshop", cost: { materials: 30, credits: 48 }, production: { materials: 9 } },
    market: { name: "Market", cost: { materials: 28, credits: 52 }, production: { credits: 10 } },
    academy: { name: "Academy", cost: { materials: 36, credits: 68 }, production: { science: 5 } },
    power: { name: "Power Grid", cost: { materials: 42, credits: 74 }, production: { power: 4 } },
    housing: { name: "Housing", cost: { materials: 32, credits: 44 }, production: { capacity: 50 } }
  };
  const TECHNOLOGIES = {
    agriculture: { name: "Advanced Agriculture", cost: 28, effect: "farm", factor: 1.5 },
    industry: { name: "Industrial Methods", cost: 34, effect: "workshop", factor: 1.5 },
    commerce: { name: "Trade Networks", cost: 40, effect: "market", factor: 1.5 },
    governance: { name: "Civic Governance", cost: 38, effect: "stability", factor: 1 },
    energy: { name: "Energy Systems", cost: 48, effect: "power", factor: 1.5 },
    medicine: { name: "Public Health", cost: 44, effect: "growth", factor: 1 }
  };
  const CAMPAIGNS = {
    founding: {
      name: "A New Horizon",
      description: "Build a stable, self-sufficient nation and earn the trust of your neighbors.",
      objectives: [
        { id: "feed-the-people", text: "Reach 180 food", resource: "food", target: 180 },
        { id: "build-the-future", text: "Build 3 infrastructure levels", buildings: 3, target: 3 },
        { id: "earn-trust", text: "Reach 30 relations with any rival", relations: 30, target: 30 },
        { id: "research-age", text: "Research 2 technologies", technologies: 2, target: 2 }
      ]
    },
    longwinter: {
      name: "The Long Winter",
      description: "Protect your citizens through a lean season while keeping the nation stable.",
      objectives: [
        { id: "winter-survivor", text: "Reach turn 8", turn: 8, target: 8 },
        { id: "warm-granaries", text: "Hold 100 food", resource: "food", target: 100 },
        { id: "steady-hands", text: "Reach 75% stability", stability: 75, target: 75 },
        { id: "keep-growing", text: "Reach 110 population", population: 110, target: 110 }
      ]
    },
    council: {
      name: "A Seat at the Council",
      description: "Earn an alliance and establish your nation as the region's diplomatic center.",
      objectives: [
        { id: "trusted-voice", text: "Reach 50 relations with a rival", relations: 50, target: 50 },
        { id: "shared-future", text: "Sign an alliance", treaty: "alliance", target: 1 },
        { id: "regional-prosperity", text: "Build 3 infrastructure levels", buildings: 3, target: 3 },
        { id: "council-research", text: "Research 2 technologies", technologies: 2, target: 2 }
      ]
    }
  };
  const RIVAL_TEMPLATES = [
    { id: "aurelia", name: "Aurelia", population: 115, traits: ["commerce", "diplomacy"] },
    { id: "northreach", name: "Northreach", population: 92, traits: ["industry", "security"] },
    { id: "meridian", name: "Meridian", population: 104, traits: ["research", "agriculture"] }
  ];

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function safeInt(value, fallback = 0, max = RESOURCE_LIMIT) {
    if (!Number.isFinite(value)) return fallback;
    return clamp(Math.floor(value), 0, max);
  }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function createInitialState(options = {}) {
    const defaultSeed = Math.floor(Math.random() * 0xffffffff) || 1;
    const seed = safeInt(options.seed, defaultSeed, 0xffffffff) || defaultSeed;
    const campaignId = CAMPAIGNS[options.campaignId] ? options.campaignId : "founding";
    const state = {
      schemaVersion: SAVE_VERSION, turn: 1, seed,
      nation: { name: "New Horizon", government: "Republic", population: 100, stability: 80 },
      resources: { food: 120, materials: 105, credits: 180, science: 0, power: 20, influence: 20 },
      buildings: { farm: 2, workshop: 1, market: 1, academy: 1, power: 1, housing: 0 },
      technologies: [],
      market: { stock: { food: 400, materials: 300 }, basePrices: { food: 2, materials: 4 }, prices: { food: 2, materials: 4 }, lastFlow: { food: 0, materials: 0 } },
      rivals: Object.fromEntries(RIVAL_TEMPLATES.map((r, i) => [r.id, {
        id: r.id, name: r.name, traits: r.traits, population: r.population, stability: 70 + i * 5,
        resources: { food: 90 + i * 15, materials: 70 + i * 10, credits: 120, science: i * 6, power: 12 },
        buildings: { farm: 2, workshop: 1, market: 1, academy: i === 2 ? 1 : 0, power: 0, housing: 0 },
        technologies: [], relation: [15, 5, -5][i], stance: "Cautious", treaties: []
      }])) ,
      diplomacy: { treaties: [], conflicts: [] },
      campaign: { id: campaignId, completedObjectives: [], status: "active", buildingStart: 6 },
      achievements: [], creations: [], events: [{ turn: 1, text: "Your civilization was founded. The first chapter begins.", type: "milestone" }],
      status: "playing"
    };
    if (campaignId === "longwinter") {
      state.nation.population = 120; state.nation.stability = 58;
      state.resources.food = 66; state.resources.materials = 80; state.resources.credits = 210; state.resources.power = 18;
      state.buildings.farm = 1; state.buildings.workshop = 1; state.buildings.market = 1; state.buildings.academy = 0; state.buildings.power = 1;
      state.rivals.northreach.relation = -10;
    } else if (campaignId === "council") {
      state.nation.name = "New Horizon"; state.nation.population = 90;
      state.resources.food = 150; state.resources.materials = 135; state.resources.credits = 300; state.resources.science = 18;
      state.buildings.farm = 2; state.buildings.workshop = 2; state.buildings.market = 1; state.buildings.academy = 1; state.buildings.power = 1;
    }
    state.campaign.buildingStart = Object.values(state.buildings).reduce((a, b) => a + b, 0);
    state.events[0].text = campaignId === "founding" ? state.events[0].text : "Your nation entered the " + CAMPAIGNS[campaignId].name + " campaign.";
    return state;
  }

  function validateSave(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Save must be a JSON object.");
    if (input.schemaVersion !== SAVE_VERSION) throw new Error("This save version is not supported.");
    if (!Number.isInteger(input.turn) || input.turn < 1 || input.turn > 10_000_000) throw new Error("Turn count is invalid.");
    if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("World seed is invalid.");
    if (!input.nation || typeof input.nation !== "object" || !input.resources || !input.buildings) throw new Error("Save is missing nation, resources, or building data.");
    const normalized = copy(input);
    if (typeof normalized.nation.name !== "string" || normalized.nation.name.trim().length < 1 || normalized.nation.name.length > 48) throw new Error("Nation name must contain 1–48 characters.");
    if (typeof normalized.nation.government !== "string" || normalized.nation.government.length > 48) throw new Error("Government style is invalid.");
    if (!Number.isInteger(normalized.nation.population) || normalized.nation.population < 1 || normalized.nation.population > RESOURCE_LIMIT) throw new Error("Population is outside safe limits.");
    if (!Number.isInteger(normalized.nation.stability) || normalized.nation.stability < 0 || normalized.nation.stability > 100) throw new Error("Stability must be between 0 and 100.");
    for (const key of RESOURCE_KEYS) {
      if (!Number.isInteger(normalized.resources[key]) || normalized.resources[key] < 0 || normalized.resources[key] > RESOURCE_LIMIT) throw new Error("Resource value is invalid: " + key);
    }
    for (const id of Object.keys(BUILDINGS)) {
      const level = normalized.buildings[id];
      if (!Number.isInteger(level) || level < 0 || level > 10_000) throw new Error("Building level is invalid: " + id);
    }
    if (!Array.isArray(normalized.technologies) || normalized.technologies.some(id => !TECHNOLOGIES[id])) throw new Error("Technology list is invalid.");
    if (!normalized.market || !normalized.market.stock || !normalized.market.prices || !normalized.market.basePrices || !normalized.market.lastFlow || !normalized.rivals ||
        !normalized.diplomacy || !Array.isArray(normalized.diplomacy.treaties) || !Array.isArray(normalized.diplomacy.conflicts) ||
        !normalized.campaign || !Array.isArray(normalized.campaign.completedObjectives) ||
        !Array.isArray(normalized.achievements) || !Array.isArray(normalized.creations) || !Array.isArray(normalized.events)) {
      throw new Error("Save is missing world simulation data.");
    }
    for (const key of ["food", "materials"]) {
      if (!Number.isInteger(normalized.market.stock[key]) || normalized.market.stock[key] < 0 || normalized.market.stock[key] > RESOURCE_LIMIT) throw new Error("Market stock is invalid.");
      if (!Number.isFinite(normalized.market.prices[key]) || normalized.market.prices[key] < 1 || normalized.market.prices[key] > 100) throw new Error("Market price is invalid.");
      if (!Number.isFinite(normalized.market.basePrices[key]) || normalized.market.basePrices[key] < 1 || normalized.market.basePrices[key] > 100) throw new Error("Market base price is invalid.");
      if (!Number.isInteger(normalized.market.lastFlow[key]) || Math.abs(normalized.market.lastFlow[key]) > RESOURCE_LIMIT) throw new Error("Market flow is invalid.");
    }
    if (Object.keys(normalized.rivals).length > 50) throw new Error("Save contains too many rival nations.");
    for (const [rivalId, rival] of Object.entries(normalized.rivals)) {
      if (!rival || typeof rival.name !== "string" || rival.name.length > 48 || !Number.isInteger(rival.population) || rival.population < 1 || rival.population > RESOURCE_LIMIT || !rival.resources || !rival.buildings || typeof rival.stance !== "string" || !Array.isArray(rival.traits) || !Array.isArray(rival.treaties)) throw new Error("Rival nation data is invalid.");
      if (!Number.isInteger(rival.relation) || rival.relation < -100 || rival.relation > 100) throw new Error("Diplomatic relation is invalid.");
      for (const key of ["food", "materials", "credits", "science", "power"]) {
        if (!Number.isInteger(rival.resources[key]) || rival.resources[key] < 0 || rival.resources[key] > RESOURCE_LIMIT) throw new Error("Rival resource value is invalid.");
      }
      for (const id of Object.keys(BUILDINGS)) {
        if (!Number.isInteger(rival.buildings[id]) || rival.buildings[id] < 0 || rival.buildings[id] > 10_000) throw new Error("Rival building level is invalid.");
      }
      if (!Array.isArray(rival.technologies) || rival.technologies.some(id => !TECHNOLOGIES[id])) throw new Error("Rival technology list is invalid.");
      if (rival.id !== rivalId) throw new Error("Rival identity does not match its save key.");
    }
    if (!CAMPAIGNS[normalized.campaign.id] || !["active", "victory", "defeat"].includes(normalized.campaign.status)) throw new Error("Campaign status is invalid.");
    if (!Number.isInteger(normalized.campaign.buildingStart) || normalized.campaign.buildingStart < 0 || normalized.campaign.buildingStart > 100_000) throw new Error("Campaign infrastructure baseline is invalid.");
    const objectiveIds = new Set(CAMPAIGNS[normalized.campaign.id].objectives.map(o => o.id));
    if (normalized.campaign.completedObjectives.some(id => !objectiveIds.has(id))) throw new Error("Campaign objective list is invalid.");
    if (normalized.events.length > 200 || normalized.events.some(e => !e || !Number.isInteger(e.turn) || e.turn < 1 || e.turn > normalized.turn || typeof e.text !== "string" || e.text.length > 240)) throw new Error("World history is invalid.");
    if (normalized.achievements.length > 100 || normalized.achievements.some(a => typeof a !== "string" || a.length > 80)) throw new Error("Achievement list is invalid.");
    if (normalized.creations.length > 500 || normalized.creations.some(c => !c || typeof c.id !== "string" || typeof c.title !== "string" || c.title.length > 64 || typeof c.creator !== "string" || c.creator.length > 48 || typeof c.description !== "string" || c.description.length > 500)) throw new Error("Creator registry is invalid.");
    if (normalized.diplomacy.treaties.length > 500 || normalized.diplomacy.conflicts.length > 500) throw new Error("Diplomatic history is too large.");
    for (const treaty of normalized.diplomacy.treaties) {
      if (!treaty || !normalized.rivals[treaty.rivalId] || !["trade", "research", "alliance", "non-aggression"].includes(treaty.kind) ||
          !["active", "expired"].includes(treaty.status) || !Number.isInteger(treaty.startedTurn) || treaty.startedTurn > normalized.turn) throw new Error("Diplomatic agreement is invalid.");
    }
    for (const conflict of normalized.diplomacy.conflicts) {
      if (!conflict || !normalized.rivals[conflict.rivalId] || !["active", "peace", "resolved"].includes(conflict.status) ||
          !Number.isInteger(conflict.startedTurn) || conflict.startedTurn > normalized.turn ||
          !Number.isInteger(conflict.playerScore) || !Number.isInteger(conflict.rivalScore)) throw new Error("Conflict record is invalid.");
    }
    if (!["playing", "victory", "defeat"].includes(normalized.status)) throw new Error("Game status is invalid.");
    return normalized;
  }

  function migrateSave(input) {
    if (input && input.schemaVersion === SAVE_VERSION) return validateSave(input);
    if (input && input.schemaVersion === 1) {
      const state = copy(input);
      state.schemaVersion = SAVE_VERSION;
      state.campaign = state.campaign || { id: "founding", completedObjectives: [], status: "active" };
      if (!CAMPAIGNS[state.campaign.id]) state.campaign.id = "founding";
      state.campaign.buildingStart = Object.values(state.buildings || {}).reduce((a, b) => a + safeInt(b), 0);
      state.creations = Array.isArray(state.creations) ? state.creations : [];
      state.achievements = Array.isArray(state.achievements) ? state.achievements : [];
      return validateSave(state);
    }
    if (input && !("schemaVersion" in input) && input.buildings && input.events) {
      const state = createInitialState();
      state.turn = safeInt(input.turn, 1, 10_000_000) || 1;
      state.nation.name = typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 48) : state.nation.name;
      state.nation.government = typeof input.government === "string" ? input.government.slice(0, 48) : state.nation.government;
      state.nation.population = safeInt(input.population, state.nation.population, RESOURCE_LIMIT) || 1;
      state.nation.stability = safeInt(input.stability, state.nation.stability, 100);
      for (const key of RESOURCE_KEYS) state.resources[key] = safeInt(input[key], state.resources[key]);
      for (const key of Object.keys(BUILDINGS)) state.buildings[key] = safeInt(input.buildings[key], state.buildings[key], 10_000);
      state.resources.science = safeInt(input.research, state.resources.science);
      state.resources.influence = safeInt(input.influence, state.resources.influence);
      state.technologies = Array.isArray(input.tech) ? input.tech.filter(id => TECHNOLOGIES[id]) : [];
      if (input.relations && typeof input.relations === "object") {
        for (const rival of Object.values(state.rivals)) {
          const oldName = Object.keys(input.relations).find(name => name.toLowerCase() === rival.name.toLowerCase());
          if (oldName && Number.isFinite(input.relations[oldName])) rival.relation = clamp(Math.floor(input.relations[oldName]), -100, 100);
        }
      }
      state.events = input.events.filter(e => typeof e === "string").slice(-100).map((text, i) => ({ turn: Math.max(1, state.turn - i), text: text.slice(0, 240), type: "legacy" }));
      if (Array.isArray(input.creators)) state.creations = input.creators.filter(c => c && typeof c.title === "string").slice(0, 500).map((c, i) => ({
        id: "legacy-" + state.turn + "-" + i,
        creator: String(c.creator || "Unknown creator").slice(0, 48),
        title: c.title.slice(0, 64),
        category: String(c.category || "Design").slice(0, 32),
        description: String(c.description || "").slice(0, 500),
        createdTurn: state.turn
      }));
      return validateSave(state);
    }
    throw new Error("Save is corrupt or from an unsupported version.");
  }

  function nextRandom(state) {
    let value = state.seed >>> 0;
    value = (value * 1664525 + 1013904223) >>> 0;
    state.seed = value;
    return value / 4294967296;
  }
  function addEvent(state, text, type = "world") {
    state.events.unshift({ turn: state.turn, text: String(text).slice(0, 240), type });
    state.events = state.events.slice(0, 200);
  }
  function hasTech(state, id) { return state.technologies.includes(id); }
  function productionFor(buildings, technologies = []) {
    const production = { food: 0, materials: 0, credits: 0, science: 0, power: 0, capacity: 0 };
    for (const [id, definition] of Object.entries(BUILDINGS)) {
      const level = buildings[id] || 0;
      for (const [key, amount] of Object.entries(definition.production)) {
        const tech = Object.values(TECHNOLOGIES).find(t => t.effect === id && technologies.includes(Object.keys(TECHNOLOGIES).find(k => TECHNOLOGIES[k] === t)));
        production[key] += Math.floor(level * amount * (tech ? tech.factor : 1));
      }
    }
    return production;
  }
  function build(state, id) {
    const definition = BUILDINGS[id];
    if (!definition) throw new Error("Unknown building.");
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    if ((state.buildings[id] || 0) >= 10_000) throw new Error("Building level limit reached.");
    for (const [key, cost] of Object.entries(definition.cost)) if (state.resources[key] < cost) throw new Error("Not enough " + key + ".");
    for (const [key, cost] of Object.entries(definition.cost)) state.resources[key] -= cost;
    state.buildings[id] = (state.buildings[id] || 0) + 1;
    addEvent(state, definition.name + " upgraded to level " + state.buildings[id] + ".", "player");
    updateObjectives(state);
    return state;
  }
  function trade(state, resource, amount) {
    if (!["food", "materials"].includes(resource) || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000) throw new Error("Trade order is invalid.");
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    const price = state.market.prices[resource];
    if (amount > 0) {
      const cost = amount * price;
      if (state.resources.credits < cost) throw new Error("Not enough credits.");
      if (state.market.stock[resource] < amount) throw new Error("The world market does not have enough stock.");
      if (state.resources[resource] + amount > RESOURCE_LIMIT) throw new Error(resource + " storage limit reached.");
      state.resources.credits -= cost;
      state.resources[resource] += amount;
      state.market.stock[resource] -= amount;
    } else {
      const quantity = -amount;
      if (state.resources[resource] < quantity) throw new Error("Not enough " + resource + ".");
      state.resources[resource] -= quantity;
      state.resources.credits = Math.min(RESOURCE_LIMIT, state.resources.credits + Math.floor(quantity * price));
      state.market.stock[resource] = Math.min(RESOURCE_LIMIT, state.market.stock[resource] + quantity);
    }
    addEvent(state, (amount > 0 ? "Bought " : "Sold ") + Math.abs(amount) + " " + resource + " at " + price + " credits each.", "trade");
    updateObjectives(state);
    return state;
  }
  function research(state, id) {
    const technology = TECHNOLOGIES[id];
    if (!technology) throw new Error("Unknown technology.");
    if (state.technologies.includes(id)) throw new Error("Technology already researched.");
    if (state.resources.science < technology.cost) throw new Error("Not enough science.");
    state.resources.science -= technology.cost;
    state.technologies.push(id);
    if (id === "governance") state.nation.stability = Math.min(100, state.nation.stability + 10);
    addEvent(state, "Researched " + technology.name + ".", "research");
    updateObjectives(state);
    return state;
  }
  function sendGift(state, rivalId, credits = 20) {
    const rival = state.rivals[rivalId];
    if (!rival) throw new Error("Unknown nation.");
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    if (!Number.isInteger(credits) || credits < 10 || credits > 500 || state.resources.credits < credits) throw new Error("Gift amount is invalid or unaffordable.");
    state.resources.credits -= credits;
    rival.relation = clamp(rival.relation + Math.max(2, Math.floor(credits / 5)), -100, 100);
    state.resources.influence = Math.min(RESOURCE_LIMIT, state.resources.influence + Math.floor(credits / 10));
    addEvent(state, "Sent " + credits + " credits in aid to " + rival.name + ".", "diplomacy");
    updateObjectives(state);
    return state;
  }
  function offerTreaty(state, rivalId, kind) {
    const rival = state.rivals[rivalId];
    if (!rival || !["trade", "research", "alliance", "non-aggression"].includes(kind)) throw new Error("Treaty offer is invalid.");
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    if (rival.relation < (kind === "alliance" ? 50 : 20)) throw new Error(rival.name + " does not trust your nation enough.");
    const id = rivalId + ":" + kind;
    if (state.diplomacy.treaties.some(t => t.id === id && t.status === "active")) throw new Error("This agreement is already active.");
    state.diplomacy.treaties.push({ id, rivalId, kind, status: "active", startedTurn: state.turn, duration: kind === "alliance" ? 12 : 5 });
    rival.treaties.push(kind);
    addEvent(state, rival.name + " signed a " + kind + " agreement.", "diplomacy");
    updateObjectives(state);
    return state;
  }
  function declareConflict(state, rivalId) {
    const rival = state.rivals[rivalId];
    if (!rival) throw new Error("Unknown nation.");
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    if (rival.relation > -20) throw new Error("Relations must fall to -20 before conflict can be declared.");
    if (state.diplomacy.treaties.some(t => t.rivalId === rivalId && t.kind === "alliance" && t.status === "active")) throw new Error("An active alliance prevents conflict.");
    if (state.diplomacy.treaties.some(t => t.rivalId === rivalId && t.kind === "non-aggression" && t.status === "active")) throw new Error("An active non-aggression pact prevents conflict.");
    if (state.diplomacy.conflicts.some(c => c.rivalId === rivalId && c.status === "active")) throw new Error("Conflict is already active.");
    if (state.resources.credits < 25 || state.resources.power < 10) throw new Error("Conflict requires 25 credits and 10 power.");
    state.resources.credits -= 25;
    rival.relation = -100;
    for (const treaty of state.diplomacy.treaties) {
      if (treaty.rivalId === rivalId && treaty.status === "active") treaty.status = "expired";
    }
    addEvent(state, "Prior agreements with " + rival.name + " were voided by the conflict.", "diplomacy");
    state.diplomacy.conflicts.push({ rivalId, status: "active", startedTurn: state.turn, playerScore: 0, rivalScore: 0 });
    addEvent(state, "Conflict declared with " + rival.name + ". Armies are mobilizing.", "conflict");
    return state;
  }
  function makePeace(state, rivalId) {
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    const conflict = state.diplomacy.conflicts.find(c => c.rivalId === rivalId && c.status === "active");
    if (!conflict) throw new Error("There is no active conflict with that nation.");
    if (state.resources.credits < 35) throw new Error("A peace delegation requires 35 credits.");
    state.resources.credits -= 35;
    conflict.status = "peace";
    conflict.endedTurn = state.turn;
    state.rivals[rivalId].relation = Math.max(-25, state.rivals[rivalId].relation);
    addEvent(state, "A peace accord ended the conflict with " + state.rivals[rivalId].name + ".", "diplomacy");
    return state;
  }
  function registerCreation(state, creation) {
    if (!creation || typeof creation !== "object") throw new Error("Creation details are required.");
    const creator = String(creation.creator || "").trim().slice(0, 48);
    const title = String(creation.title || "").trim().slice(0, 64);
    const description = String(creation.description || "").trim().slice(0, 500);
    const category = String(creation.category || "Design").trim().slice(0, 32);
    if (!creator || !title) throw new Error("Creator and title are required.");
    if (state.creations.length >= 500) throw new Error("Creator registry limit reached.");
    const item = { id: "creation-" + state.turn + "-" + state.creations.length + "-" + state.seed, creator, title, description, category, createdTurn: state.turn };
    state.creations.unshift(item);
    addEvent(state, "Creator entry registered: " + title + ".", "creator");
    return item;
  }
  function deleteCreation(state, id) {
    const index = state.creations.findIndex(c => c.id === id);
    if (index < 0) throw new Error("Creation entry not found.");
    state.creations.splice(index, 1);
  }
  function resolveObjectives(state) {
    if (state.status !== "playing") return;
    const campaign = CAMPAIGNS[state.campaign.id];
    if (!campaign) return;
    for (const objective of campaign.objectives) {
      if (state.campaign.completedObjectives.includes(objective.id)) continue;
      let complete = false;
      if (objective.resource) complete = state.resources[objective.resource] >= objective.target;
      if (objective.buildings) complete = Object.values(state.buildings).reduce((a, b) => a + b, 0) - state.campaign.buildingStart >= objective.target;
      if (objective.relations) complete = Object.values(state.rivals).some(r => r.relation >= objective.target);
      if (objective.technologies) complete = state.technologies.length >= objective.target;
      if (objective.turn) complete = state.turn >= objective.turn;
      if (objective.stability) complete = state.nation.stability >= objective.stability;
      if (objective.population) complete = state.nation.population >= objective.population;
      if (objective.treaty) complete = state.diplomacy.treaties.some(t => t.kind === objective.treaty && t.status === "active");
      if (complete) {
        state.campaign.completedObjectives.push(objective.id);
        addEvent(state, "Campaign objective completed: " + objective.text + ".", "milestone");
      }
    }
    if (state.campaign.completedObjectives.length === campaign.objectives.length) {
      state.campaign.status = "victory";
      state.status = "victory";
      if (!state.achievements.includes("campaign-victory")) state.achievements.push("campaign-victory");
      addEvent(state, "Victory! Your nation has completed " + campaign.name + ".", "victory");
    }
  }
  function updateObjectives(state) { resolveObjectives(state); }
  function updateMarket(state, netFlow) {
    for (const resource of ["food", "materials"]) {
      const flow = netFlow[resource];
      state.market.stock[resource] = clamp(state.market.stock[resource] + flow, 0, RESOURCE_LIMIT);
      state.market.lastFlow[resource] = flow;
      const stock = state.market.stock[resource];
      const scarcity = 1.5 - stock / 800;
      const demandPressure = flow < 0 ? Math.min(0.75, Math.abs(flow) / 300) : -Math.min(0.45, flow / 400);
      state.market.prices[resource] = Math.round(clamp(state.market.basePrices[resource] * (scarcity + demandPressure), 1, 20) * 100) / 100;
    }
  }
  function developRivals(state, worldFlow) {
    for (const rival of Object.values(state.rivals)) {
      const output = productionFor(rival.buildings, rival.technologies);
      rival.resources.food = clamp(rival.resources.food + output.food, 0, RESOURCE_LIMIT);
      rival.resources.materials = clamp(rival.resources.materials + output.materials, 0, RESOURCE_LIMIT);
      rival.resources.credits = Math.min(RESOURCE_LIMIT, rival.resources.credits + output.credits + Math.floor(rival.population / 20));
      rival.resources.science = clamp(rival.resources.science + output.science, 0, RESOURCE_LIMIT);
      rival.resources.power = Math.min(RESOURCE_LIMIT, rival.resources.power + output.power);
      const foodNeed = Math.ceil(rival.population / 12);
      const foodTarget = Math.ceil(rival.population * 1.5);
      if (rival.resources.food < foodNeed + 10 && state.market.stock.food > 0) {
        const quantity = Math.min(30, state.market.stock.food, Math.max(0, foodNeed + 20 - rival.resources.food), Math.floor(rival.resources.credits / state.market.prices.food));
        if (quantity > 0) {
          rival.resources.food += quantity;
          rival.resources.credits -= Math.ceil(quantity * state.market.prices.food);
          state.market.stock.food -= quantity;
          rival.stance = "Importing food";
        }
      } else if (rival.resources.food > foodTarget + 45) {
        const quantity = Math.min(20, rival.resources.food - foodTarget - 25);
        rival.resources.food -= quantity;
        rival.resources.credits = Math.min(RESOURCE_LIMIT, rival.resources.credits + Math.floor(quantity * state.market.prices.food));
        state.market.stock.food = Math.min(RESOURCE_LIMIT, state.market.stock.food + quantity);
        rival.stance = "Exporting food";
      }
      if (rival.resources.materials < 24 && state.market.stock.materials > 0) {
        const quantity = Math.min(20, state.market.stock.materials, Math.floor(rival.resources.credits / state.market.prices.materials));
        if (quantity > 0) {
          rival.resources.materials += quantity;
          rival.resources.credits -= Math.ceil(quantity * state.market.prices.materials);
          state.market.stock.materials -= quantity;
        }
      } else if (rival.resources.materials > 65) {
        const quantity = Math.min(18, rival.resources.materials - 45);
        rival.resources.materials -= quantity;
        rival.resources.credits = Math.min(RESOURCE_LIMIT, rival.resources.credits + Math.floor(quantity * state.market.prices.materials));
        state.market.stock.materials = Math.min(RESOURCE_LIMIT, state.market.stock.materials + quantity);
      }
      rival.resources.food -= foodNeed;
      worldFlow.food += output.food - foodNeed;
      worldFlow.materials += output.materials;
      if (rival.resources.food < 0) {
        rival.resources.food = 0;
        rival.stability = Math.max(0, rival.stability - 7);
        rival.population = Math.max(10, rival.population - 3);
      } else {
        rival.stability = Math.min(100, rival.stability + 1);
        if (rival.resources.food > 25 && rival.stability > 50) rival.population = Math.min(RESOURCE_LIMIT, rival.population + 1 + Math.floor((rival.buildings.housing || 0) / 2));
      }
      if (rival.resources.food < foodTarget && rival.resources.credits >= 35 && rival.buildings.farm < 10_000) {
        rival.buildings.farm++;
        rival.resources.credits -= 35;
        rival.stance = "Investing in food security";
      } else if (rival.buildings.academy === 0 && rival.resources.credits >= 68 && rival.resources.materials >= 36) {
        rival.buildings.academy++;
        rival.resources.credits -= 68;
        rival.resources.materials -= 36;
        rival.stance = "Founding a research office";
      } else if (rival.resources.materials < 35 && rival.resources.credits >= 45) {
        rival.buildings.workshop++;
        rival.resources.credits -= 45;
        rival.stance = "Expanding industry";
      } else if (rival.resources.science >= 34 && !rival.technologies.includes("industry")) {
        rival.resources.science -= 34;
        rival.technologies.push("industry");
        rival.stance = "Advancing technology";
      } else if (rival.resources.credits > 70 && nextRandom(state) > 0.62 && rival.buildings.market < 10_000) {
        rival.buildings.market++;
        rival.resources.credits -= 52;
        rival.stance = "Growing trade";
      } else {
        rival.stance = rival.traits.includes("diplomacy") ? "Building partnerships" : rival.traits.includes("security") ? "Guarding borders" : "Developing at home";
      }
      if (rival.stability < 25) rival.stance = "Facing unrest";
    }
  }
  function advanceTurn(state) {
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    if (state.turn >= 10_000_000) throw new Error("Turn limit reached.");
    state.turn++;
    for (const treaty of state.diplomacy.treaties) {
      if (treaty.status === "active" && state.turn - treaty.startedTurn >= treaty.duration) {
        treaty.status = "expired";
        addEvent(state, treaty.kind + " agreement with " + state.rivals[treaty.rivalId].name + " expired.", "diplomacy");
      }
    }
    const flow = { food: 0, materials: 0 };
    const output = productionFor(state.buildings, state.technologies);
    state.resources.food = clamp(state.resources.food + output.food, 0, RESOURCE_LIMIT);
    state.resources.materials = clamp(state.resources.materials + output.materials, 0, RESOURCE_LIMIT);
    state.resources.credits = clamp(state.resources.credits + output.credits + Math.floor(state.nation.population / 20), 0, RESOURCE_LIMIT);
    state.resources.science = clamp(state.resources.science + output.science, 0, RESOURCE_LIMIT);
    state.resources.power = clamp(state.resources.power + output.power, 0, RESOURCE_LIMIT);
    const activeTreaties = state.diplomacy.treaties.filter(t => t.status === "active");
    state.resources.credits = clamp(state.resources.credits + activeTreaties.filter(t => t.kind === "trade").length * 5, 0, RESOURCE_LIMIT);
    state.resources.science = clamp(state.resources.science + activeTreaties.filter(t => t.kind === "research").length * 2, 0, RESOURCE_LIMIT);
    state.resources.influence = clamp(state.resources.influence + activeTreaties.filter(t => t.kind === "alliance").length, 0, RESOURCE_LIMIT);
    const foodNeed = Math.ceil(state.nation.population / 12);
    state.resources.food -= foodNeed;
    flow.food += output.food - foodNeed;
    flow.materials += output.materials;
    if (state.resources.food < 0) {
      state.resources.food = 0;
      state.nation.stability = Math.max(0, state.nation.stability - 10);
      state.nation.population = Math.max(1, state.nation.population - 5);
      addEvent(state, "Food shortages caused unrest and population loss.", "crisis");
    } else {
      state.nation.stability = Math.min(100, state.nation.stability + (hasTech(state, "governance") ? 2 : 1));
      if (state.resources.food > foodNeed * 3 && state.nation.stability >= 45) {
        const populationCap = Math.min(RESOURCE_LIMIT, 250 + (state.buildings.housing || 0) * 50 + (hasTech(state, "medicine") ? 100 : 0));
        state.nation.population = Math.min(populationCap, state.nation.population + 2 + (hasTech(state, "medicine") ? 1 : 0) + Math.floor((state.buildings.housing || 0) / 2));
      }
    }
    if (state.resources.power < state.nation.population / 10) state.nation.stability = Math.max(0, state.nation.stability - 2);
    developRivals(state, flow);
    for (const conflict of state.diplomacy.conflicts) {
      if (conflict.status !== "active") continue;
      const rival = state.rivals[conflict.rivalId];
      const playerStrength = Math.max(1, state.resources.power + (state.buildings.power || 0) * 12 + state.technologies.length * 5);
      const rivalStrength = Math.max(1, rival.resources.power + (rival.buildings.power || 0) * 12 + rival.technologies.length * 5);
      conflict.playerScore += playerStrength;
      conflict.rivalScore += rivalStrength;
      state.resources.power = Math.max(0, state.resources.power - 2);
      state.nation.stability = Math.max(0, state.nation.stability - 2);
      rival.stability = Math.max(0, rival.stability - 3);
      if (state.turn - conflict.startedTurn >= 3 || state.nation.stability < 30 || rival.stability < 30) {
        conflict.status = "resolved";
        conflict.endedTurn = state.turn;
        const won = conflict.playerScore >= conflict.rivalScore;
        if (won) {
          state.resources.credits = Math.min(RESOURCE_LIMIT, state.resources.credits + 30);
          rival.relation = -10;
          addEvent(state, "Your forces prevailed over " + rival.name + "; a settlement brings 30 credits.", "conflict");
        } else {
          state.resources.credits = Math.max(0, state.resources.credits - 30);
          state.nation.stability = Math.max(0, state.nation.stability - 12);
          rival.relation = -15;
          addEvent(state, rival.name + " prevailed. Your treasury and stability suffered.", "conflict");
        }
      }
    }
    if (nextRandom(state) < 0.22) {
      const events = [
        { text: "A harvest festival boosts public morale.", effect: () => { state.nation.stability = Math.min(100, state.nation.stability + 5); } },
        { text: "Seasonal storms damage food stores.", effect: () => { state.resources.food = Math.max(0, state.resources.food - 12); } },
        { text: "Travelers bring useful technical knowledge.", effect: () => { state.resources.science = Math.min(RESOURCE_LIMIT, state.resources.science + 8); } },
        { text: "A caravan arrives with building materials.", effect: () => { state.resources.materials = Math.min(RESOURCE_LIMIT, state.resources.materials + 10); } },
        { text: "A regional shortage tightens food supplies.", effect: () => { flow.food -= 18; } }
      ];
      const event = events[Math.floor(nextRandom(state) * events.length)];
      event.effect();
      addEvent(state, event.text, "world");
    }
    updateMarket(state, flow);
    if (state.nation.stability === 0 || state.nation.population <= 10) {
      state.status = "defeat";
      state.campaign.status = "defeat";
      addEvent(state, "Defeat. Your civilization could not recover from its crisis.", "defeat");
    }
    resolveObjectives(state);
    return state;
  }
  function exportSave(state) { return JSON.stringify(validateSave(state), null, 2); }

  return {
    SAVE_VERSION, RESOURCE_LIMIT, BUILDINGS, TECHNOLOGIES, CAMPAIGNS,
    createInitialState, validateSave, migrateSave, productionFor, build, trade,
    research, sendGift, offerTreaty, declareConflict, makePeace, registerCreation,
    deleteCreation, advanceTurn, exportSave, addEvent, hasTech
  };
});
