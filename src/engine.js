(function (root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.KingmakerEngine = engine;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SAVE_VERSION = 3;
  const RESOURCE_LIMIT = 1_000_000;
  const RESOURCE_KEYS = ["food", "materials", "ore", "goods", "credits", "science", "power", "influence"];
  const MARKET_RESOURCES = ["food", "materials", "ore", "goods"];
  const BUILDINGS = {
    farm: { name: "Farm", cost: { materials: 24, credits: 36 }, production: { food: 12 } },
    mine: { name: "Mine", cost: { materials: 32, credits: 52 }, production: { ore: 10 } },
    workshop: { name: "Workshop", cost: { materials: 30, credits: 48 }, production: { materials: 9 } },
    factory: { name: "Factory", cost: { materials: 48, credits: 86 }, production: { goods: 10 }, inputs: { materials: 5, ore: 3, power: 2 } },
    transport: { name: "Transport Hub", cost: { materials: 38, credits: 62 }, production: { logistics: 1 } },
    market: { name: "Market", cost: { materials: 28, credits: 52 }, production: { credits: 10 } },
    academy: { name: "Academy", cost: { materials: 36, credits: 68 }, production: { science: 5 } },
    power: { name: "Power Grid", cost: { materials: 42, credits: 74 }, production: { power: 4 } },
    housing: { name: "Housing", cost: { materials: 32, credits: 44 }, production: { capacity: 50 } }
  };
  const TECHNOLOGIES = {
    agriculture: { name: "Advanced Agriculture", cost: 28, effect: "farm", factor: 1.5 },
    industry: { name: "Industrial Methods", cost: 34, effect: "workshop", factor: 1.5 },
    manufacturing: { name: "Precision Manufacturing", cost: 55, effect: "factory", factor: 1.5 },
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
      market: { stock: { food: 400, materials: 300, ore: 240, goods: 180 }, basePrices: { food: 2, materials: 4, ore: 5, goods: 8 }, prices: { food: 2, materials: 4, ore: 5, goods: 8 }, lastFlow: { food: 0, materials: 0, ore: 0, goods: 0 } },
      rivals: Object.fromEntries(RIVAL_TEMPLATES.map((r, i) => [r.id, {
        id: r.id, name: r.name, traits: r.traits, population: r.population, stability: 70 + i * 5,
        resources: { food: 90 + i * 15, materials: 70 + i * 10, ore: 36 + i * 8, goods: 12, credits: 120, science: i * 6, power: 12, influence: 10 },
        buildings: { farm: 2, mine: 1, workshop: 1, factory: 0, transport: 0, market: 1, academy: i === 2 ? 1 : 0, power: 0, housing: 0 },
        technologies: [], relation: [15, 5, -5][i], stance: "Cautious", activity: "Maintaining reserves", treaties: []
      }])) ,
      diplomacy: { treaties: [], conflicts: [] },
      economy: { lastIncome: 0, lastExpenses: 0, lastBalance: 0, workforce: 0, employed: 0, production: { food: 0, materials: 0, ore: 0, goods: 0, credits: 0, science: 0, power: 0, capacity: 0, logistics: 0 }, consumption: { food: 0, materials: 0, ore: 0, power: 0 }, phase: "stable", deficitTurns: 0, recoveryTurns: 0 },
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
    state.resources.ore = 48;
    state.resources.goods = 8;
    state.buildings.mine = 1;
    state.buildings.factory = 0;
    state.buildings.transport = 0;
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
    for (const key of MARKET_RESOURCES) {
      if (!Number.isInteger(normalized.market.stock[key]) || normalized.market.stock[key] < 0 || normalized.market.stock[key] > RESOURCE_LIMIT) throw new Error("Market stock is invalid.");
      if (!Number.isFinite(normalized.market.prices[key]) || normalized.market.prices[key] < 1 || normalized.market.prices[key] > 100) throw new Error("Market price is invalid.");
      if (!Number.isFinite(normalized.market.basePrices[key]) || normalized.market.basePrices[key] < 1 || normalized.market.basePrices[key] > 100) throw new Error("Market base price is invalid.");
      if (!Number.isInteger(normalized.market.lastFlow[key]) || Math.abs(normalized.market.lastFlow[key]) > RESOURCE_LIMIT) throw new Error("Market flow is invalid.");
    }
    if (Object.keys(normalized.rivals).length > 50) throw new Error("Save contains too many rival nations.");
    for (const [rivalId, rival] of Object.entries(normalized.rivals)) {
      if (!rival || typeof rival.name !== "string" || rival.name.length > 48 || !Number.isInteger(rival.population) || rival.population < 1 || rival.population > RESOURCE_LIMIT || !rival.resources || !rival.buildings || typeof rival.stance !== "string" || typeof rival.activity !== "string" || rival.activity.length > 100 || !Array.isArray(rival.traits) || !Array.isArray(rival.treaties)) throw new Error("Rival nation data is invalid.");
      if (!Number.isInteger(rival.relation) || rival.relation < -100 || rival.relation > 100) throw new Error("Diplomatic relation is invalid.");
      for (const key of RESOURCE_KEYS) {
        if (!Number.isInteger(rival.resources[key]) || rival.resources[key] < 0 || rival.resources[key] > RESOURCE_LIMIT) throw new Error("Rival resource value is invalid.");
      }
      for (const id of Object.keys(BUILDINGS)) {
        if (!Number.isInteger(rival.buildings[id]) || rival.buildings[id] < 0 || rival.buildings[id] > 10_000) throw new Error("Rival building level is invalid.");
      }
      if (!Array.isArray(rival.technologies) || rival.technologies.some(id => !TECHNOLOGIES[id])) throw new Error("Rival technology list is invalid.");
      if (rival.id !== rivalId) throw new Error("Rival identity does not match its save key.");
    }
    if (!normalized.economy || !["lastIncome", "lastExpenses", "workforce", "employed", "deficitTurns", "recoveryTurns"].every(key => Number.isInteger(normalized.economy[key]) && normalized.economy[key] >= 0 && normalized.economy[key] <= RESOURCE_LIMIT) ||
        !Number.isInteger(normalized.economy.lastBalance) || Math.abs(normalized.economy.lastBalance) > RESOURCE_LIMIT ||
        !["stable", "growth", "recession", "recovery"].includes(normalized.economy.phase) || !normalized.economy.production || !normalized.economy.consumption) throw new Error("Economic ledger is invalid.");
    for (const key of ["food", "materials", "ore", "goods", "credits", "science", "power", "capacity", "logistics"]) {
      if (!Number.isInteger(normalized.economy.production[key]) || normalized.economy.production[key] < 0 || normalized.economy.production[key] > RESOURCE_LIMIT) throw new Error("Economic production ledger is invalid.");
    }
    for (const key of ["food", "materials", "ore", "power"]) {
      if (!Number.isInteger(normalized.economy.consumption[key]) || normalized.economy.consumption[key] < 0 || normalized.economy.consumption[key] > RESOURCE_LIMIT) throw new Error("Economic consumption ledger is invalid.");
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
    if (input && (input.schemaVersion === 1 || input.schemaVersion === 2)) {
      const state = copy(input);
      state.campaign = state.campaign || { id: "founding", completedObjectives: [], status: "active" };
      if (!CAMPAIGNS[state.campaign.id]) state.campaign.id = "founding";
      if (!Number.isInteger(state.campaign.buildingStart)) {
        state.campaign.buildingStart = ["farm", "workshop", "market", "academy", "power", "housing"]
          .reduce((sum, id) => sum + safeInt((state.buildings || {})[id], 0, 10_000), 0);
      }
      state.creations = Array.isArray(state.creations) ? state.creations : [];
      state.achievements = Array.isArray(state.achievements) ? state.achievements : [];
      state.schemaVersion = SAVE_VERSION;
      addIndustryDefaults(state);
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
      state.schemaVersion = SAVE_VERSION;
      addIndustryDefaults(state);
      return validateSave(state);
    }
    throw new Error("Save is corrupt or from an unsupported version.");
  }

  function addIndustryDefaults(state) {
    for (const key of ["ore", "goods"]) state.resources[key] = safeInt(state.resources[key], key === "ore" ? 48 : 8);
    for (const id of Object.keys(BUILDINGS)) state.buildings[id] = safeInt(state.buildings[id], 0, 10_000);
    state.market.stock = state.market.stock || {};
    state.market.basePrices = state.market.basePrices || {};
    state.market.prices = state.market.prices || {};
    state.market.lastFlow = state.market.lastFlow || {};
    for (const [key, stock, price] of [["ore", 240, 5], ["goods", 180, 8]]) {
      state.market.stock[key] = safeInt(state.market.stock[key], stock);
      state.market.basePrices[key] = Number.isFinite(state.market.basePrices[key]) ? state.market.basePrices[key] : price;
      state.market.prices[key] = Number.isFinite(state.market.prices[key]) ? state.market.prices[key] : price;
      state.market.lastFlow[key] = safeInt(state.market.lastFlow[key], 0);
    }
    state.economy = state.economy || { lastIncome: 0, lastExpenses: 0, lastBalance: 0, workforce: 0, employed: 0, production: { food: 0, materials: 0, ore: 0, goods: 0, credits: 0, science: 0, power: 0, capacity: 0, logistics: 0 }, consumption: { food: 0, materials: 0, ore: 0, power: 0 }, phase: "stable", deficitTurns: 0, recoveryTurns: 0 };
    state.economy.production = state.economy.production || { food: 0, materials: 0, ore: 0, goods: 0, credits: 0, science: 0, power: 0, capacity: 0, logistics: 0 };
    state.economy.consumption = state.economy.consumption || { food: 0, materials: 0, ore: 0, power: 0 };
    for (const key of ["food", "materials", "ore", "goods", "credits", "science", "power", "capacity", "logistics"]) state.economy.production[key] = safeInt(state.economy.production[key], 0);
    for (const key of ["food", "materials", "ore", "power"]) state.economy.consumption[key] = safeInt(state.economy.consumption[key], 0);
    state.economy.phase = ["stable", "growth", "recession", "recovery"].includes(state.economy.phase) ? state.economy.phase : "stable";
    state.economy.deficitTurns = safeInt(state.economy.deficitTurns, 0, RESOURCE_LIMIT);
    state.economy.recoveryTurns = safeInt(state.economy.recoveryTurns, 0, 100);
    for (const rival of Object.values(state.rivals || {})) {
      for (const key of ["ore", "goods", "influence"]) rival.resources[key] = safeInt(rival.resources[key], key === "ore" ? 36 : 10);
      for (const id of Object.keys(BUILDINGS)) rival.buildings[id] = safeInt(rival.buildings[id], 0, 10_000);
      rival.activity = typeof rival.activity === "string" ? rival.activity.slice(0, 100) : "Adapting industry";
    }
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
  function factorFor(id, technologies) {
    return Object.values(TECHNOLOGIES).filter(t => t.effect === id && technologies.includes(Object.keys(TECHNOLOGIES).find(k => TECHNOLOGIES[k] === t)))
      .reduce((factor, t) => factor * t.factor, 1);
  }
  function productionFor(buildings, technologies = []) {
    const production = { food: 0, materials: 0, ore: 0, goods: 0, credits: 0, science: 0, power: 0, capacity: 0, logistics: 0 };
    for (const [id, definition] of Object.entries(BUILDINGS)) {
      const level = Number.isFinite(buildings[id]) ? Math.max(0, Math.floor(buildings[id])) : 0;
      for (const [key, amount] of Object.entries(definition.production)) {
        production[key] += Math.floor(level * amount * factorFor(id, technologies));
      }
    }
    return production;
  }
  const JOBS_PER_LEVEL = { farm: 4, mine: 5, workshop: 5, factory: 8, transport: 4, market: 3, academy: 4, power: 4, housing: 1 };
  function workforceFor(buildings) { return Object.entries(JOBS_PER_LEVEL).reduce((sum, [id, jobs]) => sum + safeInt(buildings[id], 0, 10_000) * jobs, 0); }
  function industrialOutput(resources, buildings, technologies = [], population = RESOURCE_LIMIT) {
    const base = productionFor(buildings, technologies);
    const factories = safeInt(buildings.factory, 0, 10_000);
    const workforce = workforceFor(buildings);
    const staffing = workforce > 0 ? Math.min(1, Math.max(0, population) / workforce) : 1;
    for (const key of Object.keys(base)) base[key] = Math.floor(base[key] * staffing);
    const activeFactories = Math.min(Math.floor(factories * staffing), Math.floor(resources.materials / 5), Math.floor(resources.ore / 3), Math.floor(resources.power / 2));
    base.goods = Math.floor(activeFactories * 10 * factorFor("factory", technologies));
    const inputs = { materials: activeFactories * 5, ore: activeFactories * 3, power: activeFactories * 2 };
    return { production: base, inputs, activeFactories };
  }
  function economicSnapshot(state) {
    const jobs = workforceFor(state.buildings);
    const employed = Math.min(jobs, state.nation.population);
    const staffing = jobs > 0 ? Math.min(1, state.nation.population / jobs) : 1;
    const base = productionFor(state.buildings, state.technologies);
    const industry = industrialOutput({ ...state.resources,
      materials: clamp(state.resources.materials + Math.floor(base.materials * staffing), 0, RESOURCE_LIMIT),
      ore: clamp(state.resources.ore + Math.floor(base.ore * staffing), 0, RESOURCE_LIMIT),
      power: clamp(state.resources.power + Math.floor(base.power * staffing), 0, RESOURCE_LIMIT)
    }, state.buildings, state.technologies, state.nation.population);
    return { production: industry.production, consumption: { food: Math.ceil(state.nation.population / (12 + Math.min(8, industry.production.logistics))), ...industry.inputs },
      workforce: jobs, employed, requiredJobs: Math.ceil(state.nation.population / 10), activeFactories: industry.activeFactories };
  }
  function build(state, id) {
    const definition = BUILDINGS[id];
    if (!definition) throw new Error("Unknown building.");
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    if ((state.buildings[id] || 0) >= 10_000) throw new Error("Building level limit reached.");
    for (const [key, cost] of Object.entries(definition.cost)) if (state.resources[key] < cost) throw new Error("Not enough " + key + ".");
    for (const [key, cost] of Object.entries(definition.cost)) state.resources[key] -= cost;
    state.buildings[id] = (state.buildings[id] || 0) + 1;
    if (id === "factory" && !state.achievements.includes("industrialist")) state.achievements.push("industrialist");
    addEvent(state, definition.name + " upgraded to level " + state.buildings[id] + ".", "player");
    updateObjectives(state);
    return state;
  }
  function trade(state, resource, amount) {
    if (!MARKET_RESOURCES.includes(resource) || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000) throw new Error("Trade order is invalid.");
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    const price = state.market.prices[resource];
    if (amount > 0) {
      const cost = Math.ceil(amount * price);
      if (state.resources.credits < cost) throw new Error("Not enough credits.");
      if (state.market.stock[resource] < amount) throw new Error("The world market does not have enough stock.");
      if (state.resources[resource] + amount > RESOURCE_LIMIT) throw new Error(resource + " storage limit reached.");
      state.resources.credits -= cost;
      state.resources[resource] += amount;
      state.market.stock[resource] -= amount;
    } else {
      const quantity = -amount;
      if (state.resources[resource] < quantity) throw new Error("Not enough " + resource + ".");
      if (state.market.stock[resource] + quantity > RESOURCE_LIMIT) throw new Error("World market storage limit reached.");
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
    for (const resource of MARKET_RESOURCES) {
      const boundedFlow = clamp(Math.trunc(netFlow[resource] || 0), -RESOURCE_LIMIT, RESOURCE_LIMIT);
      state.market.stock[resource] = clamp(state.market.stock[resource] + boundedFlow, 0, RESOURCE_LIMIT);
      state.market.lastFlow[resource] = boundedFlow;
      const stock = state.market.stock[resource];
      const scarcity = 1.5 - stock / 800;
      const demandPressure = boundedFlow < 0 ? Math.min(0.75, Math.abs(boundedFlow) / 300) : -Math.min(0.45, boundedFlow / 400);
      state.market.prices[resource] = Math.round(clamp(state.market.basePrices[resource] * (scarcity + demandPressure), 1, 20) * 100) / 100;
    }
  }
  function rivalTrade(state, rival, resource, target, worldFlow) {
    const stock = rival.resources[resource], price = state.market.prices[resource];
    const available = clamp(state.market.stock[resource] + worldFlow[resource], 0, RESOURCE_LIMIT);
    if (stock < target && available > 0) {
      const quantity = Math.min(20, target - stock, available, Math.floor(rival.resources.credits / price));
      if (quantity > 0) {
        rival.resources[resource] += quantity;
        rival.resources.credits = Math.max(0, rival.resources.credits - Math.ceil(quantity * price));
        worldFlow[resource] -= quantity;
        rival.stance = "Importing " + resource;
        rival.activity = "Bought " + quantity + " " + resource + " from the regional market";
        if (price <= state.market.basePrices[resource]) rival.relation = clamp(rival.relation + 1, -100, 100);
        else if (price >= state.market.basePrices[resource] * 1.5) rival.relation = clamp(rival.relation - 1, -100, 100);
        return "import";
      }
    } else if (stock > target + 30) {
      const marketCapacity = Math.max(0, RESOURCE_LIMIT - state.market.stock[resource] - Math.max(0, worldFlow[resource]));
      const quantity = Math.min(16, stock - target - 15, marketCapacity);
      if (quantity <= 0) return "steady";
      rival.resources[resource] -= quantity;
      rival.resources.credits = Math.min(RESOURCE_LIMIT, rival.resources.credits + Math.floor(quantity * price));
      worldFlow[resource] += quantity;
      rival.stance = "Exporting " + resource;
        rival.activity = "Sold " + quantity + " " + resource + " into the regional market";
      return "export";
    }
    return "steady";
  }
  function rivalTechnologyChoice(rival) {
    const priorities = [];
    if (rival.traits.includes("industry")) priorities.push("manufacturing", "industry", "energy");
    if (rival.traits.includes("agriculture")) priorities.push("agriculture", "medicine", "governance");
    if (rival.traits.includes("research")) priorities.push("agriculture", "industry", "energy", "manufacturing", "medicine", "governance", "commerce");
    if (rival.traits.includes("security")) priorities.push("energy", "governance", "industry");
    if (rival.traits.includes("commerce")) priorities.push("commerce", "industry", "agriculture");
    return [...new Set(priorities)].map(id => [id, TECHNOLOGIES[id]])
      .find(([id, technology]) => technology && !rival.technologies.includes(id) &&
        (id !== "manufacturing" || rival.buildings.factory > 0) && rival.resources.science >= technology.cost);
  }
  function developRivals(state, worldFlow) {
    for (const rival of Object.values(state.rivals)) {
      const industry = industrialOutput(rival.resources, rival.buildings, rival.technologies, rival.population), output = industry.production;
      for (const resource of ["food", "materials", "ore", "goods", "science", "power"]) {
        rival.resources[resource] = clamp(rival.resources[resource] + output[resource], 0, RESOURCE_LIMIT);
      }
      rival.resources.materials = Math.max(0, rival.resources.materials - industry.inputs.materials);
      rival.resources.ore = Math.max(0, rival.resources.ore - industry.inputs.ore);
      rival.resources.power = Math.max(0, rival.resources.power - industry.inputs.power);
      rival.resources.credits = Math.min(RESOURCE_LIMIT, rival.resources.credits + output.credits + Math.floor(rival.population / 20));
      for (const resource of MARKET_RESOURCES) worldFlow[resource] += output[resource] - (industry.inputs[resource] || 0);
      const foodNeed = Math.ceil(rival.population / (12 + Math.min(8, output.logistics)));
      const foodTarget = Math.ceil(rival.population * 1.2);
      const tradeTargets = { food: Math.max(foodNeed + 8, foodTarget), materials: 55, ore: 32, goods: 24 };
      let importedFood = false, traded = false;
      for (const resource of MARKET_RESOURCES) {
        const result = rivalTrade(state, rival, resource, tradeTargets[resource], worldFlow);
        if (result !== "steady") traded = true;
        if (resource === "food" && result === "import") importedFood = true;
      }
      rival.resources.food -= foodNeed;
      worldFlow.food -= foodNeed;
      if (rival.resources.food < 0) {
        rival.resources.food = 0;
        rival.stability = Math.max(0, rival.stability - 7);
        rival.population = Math.max(10, rival.population - 3);
      } else {
        rival.stability = Math.min(100, rival.stability + 1);
        if (rival.resources.food > 25 && rival.stability > 50) rival.population = Math.min(RESOURCE_LIMIT, rival.population + 1 + (rival.technologies.includes("medicine") ? 1 : 0) + Math.floor((rival.buildings.housing || 0) / 2));
      }
      if (rival.resources.food < foodTarget && rival.resources.credits >= 35 && rival.buildings.farm < 10_000) {
        rival.buildings.farm++;
        rival.resources.credits -= 35;
        rival.stance = "Investing in food security";
        rival.activity = "Expanded agriculture by one farm";
      } else if (rival.resources.ore < 24 && rival.resources.credits >= 52 && rival.resources.materials >= 32 && rival.buildings.mine < 10_000) {
        rival.buildings.mine++;
        rival.resources.credits -= 52; rival.resources.materials -= 32;
        rival.stance = "Expanding mineral extraction";
        rival.activity = "Opened a mine to address ore shortages";
      } else if (rival.population >= 150 && rival.resources.food > foodTarget && rival.resources.credits >= 62 && rival.resources.materials >= 38 && rival.buildings.transport < 8) {
        rival.buildings.transport++;
        rival.resources.credits -= 62; rival.resources.materials -= 38;
        rival.stance = "Improving regional logistics";
        rival.activity = "Built a transport hub to lower food demand";
      } else if (rival.buildings.academy === 0 && rival.resources.credits >= 68 && rival.resources.materials >= 36) {
        rival.buildings.academy++;
        rival.resources.credits -= 68;
        rival.resources.materials -= 36;
        rival.stance = "Founding a research office";
        rival.activity = "Built an academy for research";
      } else if (rival.resources.materials < 35 && rival.resources.credits >= 45) {
        rival.buildings.workshop++;
        rival.resources.credits -= 45;
        rival.stance = "Expanding industry";
        rival.activity = "Expanded materials processing";
      } else if (rival.resources.power < Math.ceil(rival.population / 8) && rival.resources.credits >= 74 && rival.resources.materials >= 42 && rival.buildings.power < 10_000) {
        rival.buildings.power++;
        rival.resources.credits -= 74; rival.resources.materials -= 42;
        rival.stance = "Securing energy supply";
        rival.activity = "Built a power grid to support industry";
      } else if (rival.traits.includes("industry") && rival.resources.credits >= 86 && rival.resources.materials >= 48 && rival.buildings.factory < 10_000 && rival.resources.ore >= 3) {
        rival.buildings.factory++;
        rival.resources.credits -= 86; rival.resources.materials -= 48;
        rival.stance = "Investing in manufacturing";
        rival.activity = "Built a factory for manufactured goods";
      } else if (rivalTechnologyChoice(rival)) {
        const [technologyId, technology] = rivalTechnologyChoice(rival);
        rival.resources.science -= technology.cost; rival.technologies.push(technologyId);
        if (technologyId === "governance") rival.stability = Math.min(100, rival.stability + 10);
        rival.stance = "Advancing " + technology.name;
        rival.activity = "Researched " + technology.name;
      } else if ((rival.traits.includes("commerce") || rival.traits.includes("diplomacy")) && rival.resources.credits > 70 && nextRandom(state) > 0.62 && rival.buildings.market < 10_000) {
        rival.buildings.market++; rival.resources.credits -= 52; rival.stance = "Growing trade"; rival.activity = "Expanded market infrastructure";
      } else if (rival.traits.includes("diplomacy") && rival.relation >= 65 && !state.diplomacy.treaties.some(t => t.rivalId === rival.id && t.kind === "alliance" && t.status === "active") && nextRandom(state) > 0.75) {
        state.diplomacy.treaties.push({ id: rival.id + ":alliance", rivalId: rival.id, kind: "alliance", status: "active", startedTurn: state.turn, duration: 12 });
        rival.treaties.push("alliance"); rival.stance = "Proposing regional alliance";
        rival.activity = "Formed a strategic alliance";
        addEvent(state, rival.name + " proposed a strategic alliance.", "diplomacy");
      } else {
        rival.stance = rival.traits.includes("diplomacy") ? "Building partnerships" : rival.traits.includes("security") ? "Guarding borders" : "Developing at home";
        if (!traded) rival.activity = importedFood ? "Secured food imports" : "Maintained reserves and current industries";
      }
      if (importedFood && rival.stability < 60) rival.stability = Math.min(100, rival.stability + 2);
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
    const flow = Object.fromEntries(MARKET_RESOURCES.map(key => [key, 0]));
    const baseOutput = productionFor(state.buildings, state.technologies);
    const jobs = workforceFor(state.buildings), employed = Math.min(jobs, state.nation.population);
    const staffing = jobs > 0 ? Math.min(1, state.nation.population / jobs) : 1;
    const industry = industrialOutput({ ...state.resources,
      materials: clamp(state.resources.materials + Math.floor(baseOutput.materials * staffing), 0, RESOURCE_LIMIT),
      ore: clamp(state.resources.ore + Math.floor(baseOutput.ore * staffing), 0, RESOURCE_LIMIT),
      power: clamp(state.resources.power + Math.floor(baseOutput.power * staffing), 0, RESOURCE_LIMIT)
    }, state.buildings, state.technologies, state.nation.population);
    const output = industry.production;
    for (const resource of ["food", "materials", "ore", "goods", "science", "power"]) {
      state.resources[resource] = clamp(state.resources[resource] + output[resource], 0, RESOURCE_LIMIT);
    }
    state.resources.materials = Math.max(0, state.resources.materials - industry.inputs.materials);
    state.resources.ore = Math.max(0, state.resources.ore - industry.inputs.ore);
    state.resources.power = Math.max(0, state.resources.power - industry.inputs.power);
    const activeTreaties = state.diplomacy.treaties.filter(t => t.status === "active");
    const taxIncome = Math.floor(state.nation.population / 20);
    const tradeIncome = activeTreaties.filter(t => t.kind === "trade").length * 5;
    const income = clamp(output.credits + taxIncome + tradeIncome, 0, RESOURCE_LIMIT);
    state.resources.science = clamp(state.resources.science + activeTreaties.filter(t => t.kind === "research").length * 2, 0, RESOURCE_LIMIT);
    state.resources.influence = clamp(state.resources.influence + activeTreaties.filter(t => t.kind === "alliance").length, 0, RESOURCE_LIMIT);
    const wageExpense = Math.ceil(employed / 10);
    state.resources.credits = clamp(state.resources.credits + income - wageExpense, 0, RESOURCE_LIMIT);
    const previousPhase = state.economy.phase;
    let phase = previousPhase, deficitTurns = state.economy.deficitTurns, recoveryTurns = state.economy.recoveryTurns;
    const balance = income - wageExpense;
    if (balance < 0) {
      deficitTurns++;
      if (deficitTurns >= 2) phase = "recession";
      else if (phase !== "recovery") phase = "stable";
      recoveryTurns = 0;
    } else if (balance > 0) {
      deficitTurns = 0;
      if (previousPhase === "recession") { phase = "recovery"; recoveryTurns = 3; }
      else if (previousPhase === "recovery" && recoveryTurns > 0) { phase = "recovery"; recoveryTurns--; }
      else { phase = "growth"; recoveryTurns = 0; }
    } else {
      phase = "stable"; deficitTurns = 0; recoveryTurns = 0;
    }
    state.economy = { lastIncome: income, lastExpenses: wageExpense, lastBalance: balance,
      workforce: jobs, employed, requiredJobs: Math.ceil(state.nation.population / 10), production: output, consumption: { food: 0, ...industry.inputs }, phase, deficitTurns, recoveryTurns };
    if (phase !== previousPhase) addEvent(state, "The national economy entered a period of " + phase + ".", "economy");
    for (const resource of MARKET_RESOURCES) flow[resource] += output[resource] - (industry.inputs[resource] || 0);
    const foodNeed = Math.ceil(state.nation.population / (12 + Math.min(8, output.logistics)));
    state.economy.consumption.food = foodNeed;
    state.resources.food -= foodNeed;
    flow.food -= foodNeed;
    if (state.resources.food < 0) {
      state.resources.food = 0;
      state.nation.stability = Math.max(0, state.nation.stability - 10);
      state.nation.population = Math.max(1, state.nation.population - 5);
      addEvent(state, "Food shortages caused unrest and population loss.", "crisis");
    } else {
      state.nation.stability = Math.min(100, state.nation.stability + (jobs >= Math.ceil(state.nation.population / 10) ? (hasTech(state, "governance") ? 2 : 1) : 0));
      if (state.resources.food > foodNeed * 3 && state.nation.stability >= 45 && phase !== "recession" && jobs >= Math.ceil(state.nation.population / 10)) {
        const populationCap = Math.min(RESOURCE_LIMIT, 250 + (state.buildings.housing || 0) * 50 + (hasTech(state, "medicine") ? 100 : 0));
        state.nation.population = Math.min(populationCap, state.nation.population + 2 + (hasTech(state, "medicine") ? 1 : 0) + Math.floor((state.buildings.housing || 0) / 2));
      }
    }
    if (jobs < Math.ceil(state.nation.population / 10)) state.nation.stability = Math.max(0, state.nation.stability - 1);
    if (phase === "recession") state.nation.stability = Math.max(0, state.nation.stability - 2);
    else if (phase === "recovery") state.nation.stability = Math.min(100, state.nation.stability + 1);
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

  function saveWithRecovery(storage, state, primaryKey = "kingmaker_save_v1", backupKey = "kingmaker_save_recovery") {
    const serialized = JSON.stringify(validateSave(state));
    const prior = storage.getItem(primaryKey);
    if (prior) {
      try {
        migrateSave(JSON.parse(prior));
        storage.setItem(backupKey, prior);
      } catch (_) {
        // Keep the existing recovery copy when the primary save is damaged.
      }
    }
    storage.setItem(primaryKey, serialized);
    return serialized;
  }

  return {
    SAVE_VERSION, RESOURCE_LIMIT, BUILDINGS, TECHNOLOGIES, CAMPAIGNS,
    createInitialState, validateSave, migrateSave, productionFor, build, trade,
    research, sendGift, offerTreaty, declareConflict, makePeace, registerCreation,
    deleteCreation, advanceTurn, exportSave, saveWithRecovery, economicSnapshot, workforceFor, addEvent, hasTech
  };
});
