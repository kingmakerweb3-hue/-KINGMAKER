(function (root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.KingmakerEngine = engine;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SAVE_VERSION = 7;
  const CREATOR_EFFECTS = {
    "City Design": { label: "+25 population capacity", capacity: 25 },
    Building: { label: "+2 materials per turn", production: { materials: 2 } },
    Technology: { label: "+2 science per turn", production: { science: 2 } },
    Business: { label: "+4 credits income per turn", production: { credits: 4 } },
    Artwork: { label: "+1 stability per turn", stability: 1 },
    "World Lore": { label: "+1 influence per turn", influence: 1 }
  };
  const CREATOR_COMMISSION_COST = { credits: 30, materials: 12 };
  const MAX_COMMISSIONED_CREATIONS = 3;
  const MAX_CREATOR_PUBLICATIONS = 500;
  const MAX_CREATOR_ADOPTIONS = MAX_CREATOR_PUBLICATIONS * 6;
  const MAX_CREATOR_ROYALTY_PER_USE = 10;
  const MAX_CREATOR_ROYALTIES = MAX_CREATOR_ADOPTIONS * MAX_CREATOR_ROYALTY_PER_USE;
  const RESOURCE_LIMIT = 1_000_000;
  const RESOURCE_KEYS = ["food", "materials", "ore", "goods", "credits", "science", "power", "influence"];
  const MARKET_RESOURCES = ["food", "materials", "ore", "goods", "power"];
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
    industry: { name: "Industrial Methods", cost: 34, effect: "workshop", factor: 1.5, requires: ["agriculture"] },
    manufacturing: { name: "Precision Manufacturing", cost: 55, effect: "factory", factor: 1.5, requires: ["industry", "energy"] },
    commerce: { name: "Trade Networks", cost: 40, effect: "market", factor: 1.5 },
    governance: { name: "Civic Governance", cost: 38, effect: "stability", factor: 1 },
    energy: { name: "Energy Systems", cost: 48, effect: "power", factor: 1.5, requires: ["industry"] },
    medicine: { name: "Public Health", cost: 44, effect: "growth", factor: 1, requires: ["agriculture", "governance"] },
    extraction: { name: "Advanced Extraction", cost: 42, effect: "mine", factor: 1.5, requires: ["industry"] },
    logistics: { name: "Integrated Logistics", cost: 46, effect: "transport", factor: 1.5, requires: ["commerce"] },
    urbanism: { name: "Sustainable Urbanism", cost: 50, effect: "housing", factor: 1.5, requires: ["medicine", "logistics"] }
  };
  const CAMPAIGNS = {
    founding: {
      name: "A New Horizon",
      description: "Build a stable, self-sufficient nation and earn the trust of your neighbors.",
      phases: ["Foundations", "National development", "Regional leadership"],
      objectives: [
        { id: "feed-the-people", phase: 0, text: "Reach 180 food", resource: "food", target: 180 },
        { id: "build-the-future", phase: 0, text: "Build 3 infrastructure levels", buildings: 3, target: 3 },
        { id: "earn-trust", phase: 1, text: "Reach 30 relations with any rival", relations: 30, target: 30 },
        { id: "research-age", phase: 1, text: "Research 2 technologies", technologies: 2, target: 2 },
        { id: "lead-industry", phase: 2, text: "Operate 2 factories", building: "factory", target: 2 },
        { id: "regional-trade", phase: 2, text: "Trade 40 units with the world market", progress: "tradeVolume", target: 40 }
      ]
    },
    longwinter: {
      name: "The Long Winter",
      description: "Protect your citizens through a lean season while keeping the nation stable.",
      phases: ["Survival", "Recovery", "Resilience"],
      objectives: [
        { id: "winter-survivor", phase: 0, text: "Reach turn 8", turn: 8, target: 8 },
        { id: "warm-granaries", phase: 0, text: "Hold 100 food", resource: "food", target: 100 },
        { id: "steady-hands", phase: 1, text: "Reach 75% stability", stability: 75, target: 75 },
        { id: "keep-growing", phase: 1, text: "Reach 110 population", population: 110, target: 110 },
        { id: "weather-crises", phase: 2, text: "Survive 2 world crises", progress: "crisesSurvived", target: 2 },
        { id: "winter-power", phase: 2, text: "Build 2 power grids", building: "power", target: 2 }
      ]
    },
    council: {
      name: "A Seat at the Council",
      description: "Earn an alliance and establish your nation as the region's diplomatic center.",
      phases: ["Build trust", "Forge agreements", "Lead the council"],
      objectives: [
        { id: "trusted-voice", phase: 0, text: "Reach 50 relations with a rival", relations: 50, target: 50 },
        { id: "shared-future", phase: 0, text: "Sign an alliance", treaty: "alliance", target: 1 },
        { id: "regional-prosperity", phase: 1, text: "Build 3 infrastructure levels", buildings: 3, target: 3 },
        { id: "council-research", phase: 1, text: "Research 2 technologies", technologies: 2, target: 2 },
        { id: "lasting-agreements", phase: 2, text: "Sign 3 regional agreements", progress: "agreementsSigned", target: 3 },
        { id: "mediate-crisis", phase: 2, text: "Resolve a diplomatic dispute peacefully", progress: "peacefulDisputes", target: 1 }
      ]
    }
  };
  const WORLD_EVENT_CATALOG = {
    energy_crisis: { title: "International energy crisis", description: "A fuel shortage strains power grids. Factories lose access to energy and world power prices rise.", duration: 3, crisis: true, choices: [{ id: "ration", label: "Ration national power", detail: "Protect the treasury; factories may pause while reserves recover." }, { id: "import", label: "Import emergency power", detail: "Buy 10 power from finite world stock for 25 credits." }] },
    food_shortage: { title: "Regional food shortage", description: "A poor harvest across the region tightens food supply and increases market prices.", duration: 2, crisis: true, choices: [{ id: "buy_grain", label: "Buy 20 grain", detail: "Pay 30 credits and use 20 units of available market food." }, { id: "ration", label: "Start rationing", detail: "Reduce food demand for the next two turns; stability may suffer." }] },
    industrial_revolution: { title: "Industrial revolution", description: "New production methods spread through the region, temporarily lifting factory output.", duration: 3 },
    tech_breakthrough: { title: "Technological breakthrough", description: "Researchers share a major discovery. Nations gain science in line with their research capacity.", duration: 0 },
    financial_crisis: { title: "Regional financial crisis", description: "Credit tightens and household confidence falls, reducing income and stability.", duration: 2, crisis: true },
    trade_disruption: { title: "Trade route disruption", description: "A key shipping corridor closes. Commodity supply falls until routes are secured.", duration: 2, choices: [{ id: "escort", label: "Fund convoy escorts", detail: "Pay 18 credits to reduce the supply shock." }, { id: "wait", label: "Wait for routes to reopen", detail: "Keep funds, accepting higher prices and weaker supply." }] },
    natural_disaster: { title: "Natural disaster", description: "Severe weather damages stores and infrastructure in one nation.", duration: 0, crisis: true },
    political_instability: { title: "Political instability", description: "Public confidence falls as institutions struggle to respond to regional pressures.", duration: 1, crisis: true },
    diplomatic_dispute: { title: "Diplomatic dispute", description: "A public disagreement strains relations with a neighboring nation.", duration: 0, choices: [{ id: "envoys", label: "Send conciliatory envoys", detail: "Spend 20 credits to restore relations." }, { id: "stand_firm", label: "Stand firm", detail: "Keep the treasury; relations worsen." }] },
    international_conflict: { title: "International conflict", description: "A border incident raises tensions between two rival powers and shifts regional trade.", duration: 2 },
    resource_discovery: { title: "Resource discovery", description: "Surveyors locate a new deposit and bring a limited ore shipment to market.", duration: 0 },
    infrastructure_opportunity: { title: "Infrastructure opportunity", description: "A regional consortium offers matching support for a transport link.", duration: 0, choices: [{ id: "cofund", label: "Build the transport link", detail: "Invest 20 materials and 30 credits to build one Transport Hub." }, { id: "decline", label: "Decline the offer", detail: "Preserve resources for another priority." }] }
  };
  const RIVAL_TEMPLATES = [
    { id: "aurelia", name: "Aurelia", population: 115, traits: ["commerce", "diplomacy"], personality: "Merchant Republic", economicPriority: "commerce", politicalPriority: "diplomacy", militaryPriority: "defense", riskTolerance: 0.35, longTermObjective: "Control regional trade", buildings: { market: 2 }, resources: { credits: 210, goods: 18 } },
    { id: "northreach", name: "Northreach", population: 92, traits: ["industry", "security"], personality: "Forge Directorate", economicPriority: "industry", politicalPriority: "cautious", militaryPriority: "energy defense", riskTolerance: 0.55, longTermObjective: "Build a self-reliant industrial base", buildings: { workshop: 2, mine: 2 }, resources: { materials: 120, ore: 80, power: 18 } },
    { id: "meridian", name: "Meridian", population: 104, traits: ["research", "agriculture"], personality: "Scholastic League", economicPriority: "research", politicalPriority: "cooperation", militaryPriority: "defense", riskTolerance: 0.3, longTermObjective: "Lead the region in technology", buildings: { academy: 2, farm: 2 }, resources: { science: 28, food: 160 } },
    { id: "solenne", name: "Solenne", population: 128, traits: ["agriculture", "diplomacy"], personality: "Granary Federation", economicPriority: "agriculture", politicalPriority: "diplomacy", militaryPriority: "defense", riskTolerance: 0.25, longTermObjective: "Secure regional food abundance", buildings: { farm: 4, transport: 1 }, resources: { food: 260, materials: 90 } },
    { id: "ironmarch", name: "Ironmarch", population: 110, traits: ["military", "industry", "security"], personality: "Shield Compact", economicPriority: "defense", politicalPriority: "hardline", militaryPriority: "readiness", riskTolerance: 0.75, longTermObjective: "Maintain the strongest defensive force", buildings: { workshop: 2, power: 2, factory: 1 }, resources: { materials: 120, ore: 80, power: 38, credits: 180 } },
    { id: "duneward", name: "Duneward", population: 98, traits: ["expansionist", "commerce"], personality: "Frontier Dominion", economicPriority: "extraction", politicalPriority: "opportunistic", militaryPriority: "expansion", riskTolerance: 0.8, longTermObjective: "Expand mineral output and influence", buildings: { mine: 3, farm: 1 }, resources: { ore: 150, materials: 90 } }
  ];

  function createRival(template, index = 0) {
    return {
      id: template.id, name: template.name, traits: template.traits.slice(), personality: template.personality,
      economicPriority: template.economicPriority, politicalPriority: template.politicalPriority,
      militaryPriority: template.militaryPriority, riskTolerance: template.riskTolerance,
      longTermObjective: template.longTermObjective, plan: null, memory: [],
      population: template.population, stability: 70 + index * 3,
      resources: { food: 90 + index * 15, materials: 70 + index * 10, ore: 36 + index * 8, goods: 12, credits: 120, science: index * 6, power: 12, influence: 10, ...template.resources },
      buildings: { farm: 2, mine: 1, workshop: 1, factory: 0, transport: 0, market: 1, academy: 0, power: 0, housing: 0, ...template.buildings },
      technologies: [], relation: [15, 5, -5, 10, -5, 0][index] ?? 0, stance: "Cautious", activity: "Maintaining reserves", treaties: []
    };
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function safeInt(value, fallback = 0, max = RESOURCE_LIMIT) {
    if (!Number.isFinite(value)) return fallback;
    return clamp(Math.floor(value), 0, max);
  }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function creatorIdFor(name) { return String(name || "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " "); }
  function normalizeCreatorRecords(state, preserveCommissions = false) {
    const seen = new Set();
    state.creations = (Array.isArray(state.creations) ? state.creations : []).filter(creation => creation && typeof creation === "object" && typeof creation.title === "string").slice(0, 500);
    state.creations.forEach((creation, index) => {
      creation.creator = typeof creation.creator === "string" ? creation.creator.slice(0, 48) : "Unknown creator";
      creation.creatorId = creatorIdFor(creation.creator);
      creation.title = creation.title.slice(0, 64);
      creation.description = typeof creation.description === "string" ? creation.description.slice(0, 500) : "";
      creation.category = typeof creation.category === "string" ? creation.category.slice(0, 32) : "Design";
      if (!Number.isInteger(creation.createdTurn) || creation.createdTurn < 1 || creation.createdTurn > state.turn) creation.createdTurn = state.turn;
      if (typeof creation.id !== "string" || !creation.id || creation.id.length > 96 || seen.has(creation.id)) creation.id = "migrated-creation-" + state.turn + "-" + index;
      while (seen.has(creation.id)) creation.id += "-" + index;
      seen.add(creation.id);
      creation.archived = !CREATOR_EFFECTS[creation.category];
      if (!preserveCommissions || typeof creation.commissioned !== "boolean") creation.commissioned = false;
      if (!creation.commissioned || !Number.isInteger(creation.commissionedTurn)) creation.commissionedTurn = null;
    });
  }
  function migrateCreatorEconomy(state) {
    const byId = new Map(state.creations.map(creation => [creation.id, creation]));
    state.creatorEconomy = { nextAdoptionId: 1, publications: state.creations.map(creation => ({ id: creation.id, creatorId: creation.creatorId, creator: creation.creator, title: creation.title, category: creation.category, turn: creation.createdTurn })),
      commissions: state.creations.filter(creation => creation.commissioned).map(creation => ({ designId: creation.id, creatorId: creation.creatorId, turn: creation.commissionedTurn })),
      adoptions: [], totalRoyalties: 0, royaltyTurn: state.turn, lastTurnRoyalties: 0 };
    for (const commission of state.creatorEconomy.commissions) if (!byId.has(commission.designId)) throw new Error("Creator migration is invalid.");
  }
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
      market: { stock: { food: 400, materials: 300, ore: 240, goods: 180, power: 260 }, basePrices: { food: 2, materials: 4, ore: 5, goods: 8, power: 4 }, prices: { food: 2, materials: 4, ore: 5, goods: 8, power: 4 }, lastFlow: { food: 0, materials: 0, ore: 0, goods: 0, power: 0 } },
      rivals: Object.fromEntries(RIVAL_TEMPLATES.map((r, i) => [r.id, createRival(r, i)])),
      diplomacy: { treaties: [], conflicts: [] },
      economy: { lastIncome: 0, lastExpenses: 0, lastBalance: 0, workforce: 0, employed: 0, production: { food: 0, materials: 0, ore: 0, goods: 0, credits: 0, science: 0, power: 0, capacity: 0, logistics: 0 }, consumption: { food: 0, materials: 0, ore: 0, power: 0 }, phase: "stable", deficitTurns: 0, recoveryTurns: 0 },
      campaign: { id: campaignId, completedObjectives: [], status: "active", phaseIndex: 0, buildingStart: 6, progress: { tradeVolume: 0, agreementsSigned: 0, crisesSurvived: 0, peacefulDisputes: 0 } },
      achievements: [], creations: [], events: [{ id: "history-1-0", turn: 1, text: "Your civilization was founded. The first chapter begins.", type: "milestone", details: { summary: "A new campaign begins with a developing economy and six neighboring nations.", affectedNationIds: ["player"] } }],
      creatorEconomy: { nextAdoptionId: 1, publications: [], commissions: [], adoptions: [], totalRoyalties: 0, royaltyTurn: 1, lastTurnRoyalties: 0 },
      world: { nextEventId: 1, activeEvents: [], processedEventIds: [] },
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
        !Array.isArray(normalized.achievements) || !Array.isArray(normalized.creations) || !Array.isArray(normalized.events) || !normalized.creatorEconomy) {
      throw new Error("Save is missing world simulation data.");
    }
    for (const key of MARKET_RESOURCES) {
      if (!Number.isInteger(normalized.market.stock[key]) || normalized.market.stock[key] < 0 || normalized.market.stock[key] > RESOURCE_LIMIT) throw new Error("Market stock is invalid.");
      if (!Number.isFinite(normalized.market.prices[key]) || normalized.market.prices[key] < 1 || normalized.market.prices[key] > 100) throw new Error("Market price is invalid.");
      if (!Number.isFinite(normalized.market.basePrices[key]) || normalized.market.basePrices[key] < 1 || normalized.market.basePrices[key] > 100) throw new Error("Market base price is invalid.");
      if (!Number.isInteger(normalized.market.lastFlow[key]) || Math.abs(normalized.market.lastFlow[key]) > RESOURCE_LIMIT) throw new Error("Market flow is invalid.");
    }
    if (!normalized.world || !Number.isInteger(normalized.world.nextEventId) || normalized.world.nextEventId < 1 || normalized.world.nextEventId > 10_000_000 ||
        !Array.isArray(normalized.world.activeEvents) || normalized.world.activeEvents.length > 8 ||
        !Array.isArray(normalized.world.processedEventIds) || normalized.world.processedEventIds.length > 500 ||
        new Set(normalized.world.processedEventIds).size !== normalized.world.processedEventIds.length ||
        normalized.world.processedEventIds.some(id => typeof id !== "string" || id.length > 64)) throw new Error("World event state is invalid.");
    for (const event of normalized.world.activeEvents) {
      const definition = event && WORLD_EVENT_CATALOG[event.key];
      if (!definition || typeof event.id !== "string" || event.id.length > 64 ||
          !Number.isInteger(event.startedTurn) || event.startedTurn < 1 || event.startedTurn > normalized.turn ||
          !Number.isInteger(event.remainingTurns) || event.remainingTurns < 0 || event.remainingTurns > 10 ||
          !["pending", "active"].includes(event.status) || !Array.isArray(event.affectedNationIds) || event.affectedNationIds.length > 7 ||
          event.affectedNationIds.some(id => id !== "player" && !normalized.rivals[id]) ||
          (event.status === "pending" && (!definition.choices || event.choiceId !== null)) ||
          (event.choiceId !== null && (!definition.choices || !definition.choices.some(choice => choice.id === event.choiceId))) ||
          (event.lastAppliedTurn !== undefined && (!Number.isInteger(event.lastAppliedTurn) || event.lastAppliedTurn < event.startedTurn || event.lastAppliedTurn > normalized.turn))) throw new Error("World event record is invalid.");
    }
    const eventIds = new Set();
    if (normalized.events.length > 500 || normalized.events.some(e => {
      if (!e || !Number.isInteger(e.turn) || e.turn < 1 || e.turn > normalized.turn || typeof e.text !== "string" || e.text.length > 240 || typeof e.type !== "string" || e.type.length > 32) return true;
      if (e.id !== undefined && (typeof e.id !== "string" || e.id.length > 64 || eventIds.has(e.id))) return true;
      if (e.id) eventIds.add(e.id);
      if (e.details !== undefined && (!e.details || typeof e.details !== "object" || typeof e.details.summary !== "string" || e.details.summary.length > 300 || !Array.isArray(e.details.affectedNationIds) || e.details.affectedNationIds.length > 7 || e.details.affectedNationIds.some(id => id !== "player" && !normalized.rivals[id]))) return true;
      return false;
    })) throw new Error("World history is invalid.");
    if (Object.keys(normalized.rivals).length > 50) throw new Error("Save contains too many rival nations.");
    for (const [rivalId, rival] of Object.entries(normalized.rivals)) {
      if (!rival || typeof rival.name !== "string" || rival.name.length > 48 || !Number.isInteger(rival.population) || rival.population < 1 || rival.population > RESOURCE_LIMIT || !rival.resources || !rival.buildings || typeof rival.stance !== "string" || typeof rival.activity !== "string" || rival.activity.length > 100 || !Array.isArray(rival.traits) || !Array.isArray(rival.treaties) || typeof rival.personality !== "string" || rival.personality.length > 48 || typeof rival.economicPriority !== "string" || rival.economicPriority.length > 48 || typeof rival.politicalPriority !== "string" || rival.politicalPriority.length > 48 || typeof rival.militaryPriority !== "string" || rival.militaryPriority.length > 48 || !Number.isFinite(rival.riskTolerance) || rival.riskTolerance < 0 || rival.riskTolerance > 1 || typeof rival.longTermObjective !== "string" || rival.longTermObjective.length > 128 || !Array.isArray(rival.memory) || rival.memory.length > 30) throw new Error("Rival nation data is invalid.");
      if (rival.plan !== null && (!rival.plan || !["build", "research"].includes(rival.plan.action) || typeof rival.plan.target !== "string" || rival.plan.target.length > 48 || typeof rival.plan.reason !== "string" || rival.plan.reason.length > 180 || !Number.isInteger(rival.plan.createdTurn) || rival.plan.createdTurn < 1 || rival.plan.createdTurn > normalized.turn || !Number.isInteger(rival.plan.reviewTurn) || rival.plan.reviewTurn < rival.plan.createdTurn || rival.plan.reviewTurn > normalized.turn + 4 ||
          (rival.plan.action === "build" && (!BUILDINGS[rival.plan.target] || !Number.isInteger(rival.plan.targetLevel) || rival.plan.targetLevel < 1 || rival.plan.targetLevel > 10_000)) ||
          (rival.plan.action === "research" && !TECHNOLOGIES[rival.plan.target]))) throw new Error("Rival strategic plan is invalid.");
      if (rival.memory.some(item => !item || !Number.isInteger(item.turn) || item.turn < 1 || item.turn > normalized.turn || typeof item.kind !== "string" || item.kind.length > 32 || typeof item.text !== "string" || item.text.length > 180 || !Number.isInteger(item.relationDelta) || Math.abs(item.relationDelta) > 200)) throw new Error("Rival historical memory is invalid.");
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
    if (!Number.isInteger(normalized.campaign.buildingStart) || normalized.campaign.buildingStart < 0 || normalized.campaign.buildingStart > 100_000 ||
        !Number.isInteger(normalized.campaign.phaseIndex) || normalized.campaign.phaseIndex < 0 || normalized.campaign.phaseIndex > CAMPAIGNS[normalized.campaign.id].phases.length ||
        !normalized.campaign.progress || !["tradeVolume", "agreementsSigned", "crisesSurvived", "peacefulDisputes"].every(key => Number.isInteger(normalized.campaign.progress[key]) && normalized.campaign.progress[key] >= 0 && normalized.campaign.progress[key] <= RESOURCE_LIMIT)) throw new Error("Campaign progression is invalid.");
    const objectiveIds = new Set(CAMPAIGNS[normalized.campaign.id].objectives.map(o => o.id));
    if (normalized.campaign.completedObjectives.some(id => !objectiveIds.has(id))) throw new Error("Campaign objective list is invalid.");
    if (normalized.achievements.length > 100 || normalized.achievements.some(a => typeof a !== "string" || a.length > 80)) throw new Error("Achievement list is invalid.");
    if (normalized.creations.length > MAX_CREATOR_PUBLICATIONS || normalized.creations.some(c => !c || typeof c.id !== "string" || !c.id || c.id.length > 96 || typeof c.title !== "string" || c.title.length > 64 || typeof c.creator !== "string" || c.creator.length < 1 || c.creator.length > 48 || c.creatorId !== creatorIdFor(c.creator) || typeof c.description !== "string" || c.description.length > 500 || typeof c.category !== "string" || c.category.length > 32 || (!CREATOR_EFFECTS[c.category] && !c.archived) || !Number.isInteger(c.createdTurn) || c.createdTurn < 1 || c.createdTurn > normalized.turn || typeof c.archived !== "boolean" || typeof c.commissioned !== "boolean" || (c.commissionedTurn !== null && (!Number.isInteger(c.commissionedTurn) || c.commissionedTurn < c.createdTurn || c.commissionedTurn > normalized.turn)) || (c.commissioned && (!CREATOR_EFFECTS[c.category] || !Number.isInteger(c.commissionedTurn))))) throw new Error("Creator registry is invalid.");
    if (new Set(normalized.creations.map(c => c.id)).size !== normalized.creations.length || normalized.creations.filter(c => c.commissioned).length > MAX_COMMISSIONED_CREATIONS) throw new Error("Creator registry is invalid.");
    const creatorEconomy = normalized.creatorEconomy;
    if (!Number.isInteger(creatorEconomy.nextAdoptionId) || creatorEconomy.nextAdoptionId < 1 || creatorEconomy.nextAdoptionId > 10_000_000 || !Array.isArray(creatorEconomy.publications) || creatorEconomy.publications.length > MAX_CREATOR_PUBLICATIONS || !Array.isArray(creatorEconomy.commissions) || creatorEconomy.commissions.length > MAX_CREATOR_PUBLICATIONS || !Array.isArray(creatorEconomy.adoptions) || creatorEconomy.adoptions.length > MAX_CREATOR_ADOPTIONS || !Number.isInteger(creatorEconomy.totalRoyalties) || creatorEconomy.totalRoyalties < 0 || creatorEconomy.totalRoyalties > MAX_CREATOR_ROYALTIES || !Number.isInteger(creatorEconomy.royaltyTurn) || creatorEconomy.royaltyTurn < 1 || creatorEconomy.royaltyTurn > normalized.turn || !Number.isInteger(creatorEconomy.lastTurnRoyalties) || creatorEconomy.lastTurnRoyalties < 0 || creatorEconomy.lastTurnRoyalties > 60) throw new Error("Creator economy state is invalid.");
    const publicationIds = new Set(), publicationById = new Map();
    for (const publication of creatorEconomy.publications) {
      if (!publication || typeof publication.id !== "string" || !publication.id || publicationIds.has(publication.id) || typeof publication.creatorId !== "string" || publication.creatorId.length < 1 || publication.creatorId.length > 48 || typeof publication.creator !== "string" || creatorIdFor(publication.creator) !== publication.creatorId || typeof publication.title !== "string" || publication.title.length < 1 || publication.title.length > 64 || typeof publication.category !== "string" || publication.category.length > 32 || (!CREATOR_EFFECTS[publication.category] && !normalized.creations.some(creation => creation.id === publication.id && creation.archived)) || !Number.isInteger(publication.turn) || publication.turn < 1 || publication.turn > normalized.turn) throw new Error("Creator publication record is invalid.");
      publicationIds.add(publication.id); publicationById.set(publication.id, publication);
    }
    if (normalized.creations.some(creation => {
      const publication = publicationById.get(creation.id);
      return !publication || publication.creatorId !== creation.creatorId || publication.title !== creation.title || publication.category !== creation.category || publication.turn !== creation.createdTurn;
    })) throw new Error("Creator publication index is invalid.");
    const commissionedIds = new Set();
    for (const commission of creatorEconomy.commissions) {
      const publication = commission && publicationById.get(commission.designId);
      if (!publication || commissionedIds.has(commission.designId) || commission.creatorId !== publication.creatorId || !Number.isInteger(commission.turn) || commission.turn < publication.turn || commission.turn > normalized.turn) throw new Error("Creator commission record is invalid.");
      commissionedIds.add(commission.designId);
    }
    if (normalized.creations.some(creation => creation.commissioned && !commissionedIds.has(creation.id))) throw new Error("Creator commission state is invalid.");
    const adoptionIds = new Set(), adoptionPairs = new Set(), activeAdopters = new Set();
    let maxAdoptionSequence = 0, calculatedRoyalties = 0, lastTurnRoyalties = 0;
    for (const adoption of creatorEconomy.adoptions) {
      const publication = adoption && publicationById.get(adoption.designId), pair = adoption && adoption.designId + ":" + adoption.rivalId;
      const sequence = adoption && /^creator-adoption-(\d+)$/.exec(adoption.id);
      if (!adoption || !sequence || adoptionIds.has(adoption.id) || adoptionPairs.has(pair) || !publication || adoption.creatorId !== publication.creatorId || !normalized.rivals[adoption.rivalId] || !Number.isInteger(adoption.firstAdoptedTurn) || adoption.firstAdoptedTurn < publication.turn || adoption.firstAdoptedTurn > normalized.turn || !Number.isInteger(adoption.lastAdoptedTurn) || adoption.lastAdoptedTurn < adoption.firstAdoptedTurn || adoption.lastAdoptedTurn > normalized.turn || typeof adoption.active !== "boolean" || !Number.isInteger(adoption.usageTurns) || adoption.usageTurns < 0 || adoption.usageTurns > normalized.turn || (adoption.lastUsedTurn !== null && (!Number.isInteger(adoption.lastUsedTurn) || adoption.lastUsedTurn < adoption.firstAdoptedTurn || adoption.lastUsedTurn > normalized.turn)) || (adoption.successfulUseTurn !== null && (!Number.isInteger(adoption.successfulUseTurn) || adoption.successfulUseTurn < adoption.firstAdoptedTurn || adoption.successfulUseTurn > normalized.turn)) || typeof adoption.rewardClaimed !== "boolean" || !Number.isInteger(adoption.rewardDemand) || adoption.rewardDemand < 0 || adoption.rewardDemand > 100 || !Number.isInteger(adoption.rewardCredits) || adoption.rewardCredits < 0 || adoption.rewardCredits > MAX_CREATOR_ROYALTY_PER_USE || (adoption.rewardClaimed !== (adoption.successfulUseTurn !== null)) || (adoption.rewardClaimed && adoption.rewardCredits > 5 + Math.floor(adoption.rewardDemand / 20)) || (!adoption.rewardClaimed && adoption.rewardCredits !== 0) || (adoption.active && (!publicationById.has(adoption.designId) || !normalized.creations.some(creation => creation.id === adoption.designId && !creation.archived) || activeAdopters.has(adoption.rivalId)))) throw new Error("Creator design usage record is invalid.");
      adoptionIds.add(adoption.id); adoptionPairs.add(pair); maxAdoptionSequence = Math.max(maxAdoptionSequence, Number(sequence[1]));
      if (adoption.active) activeAdopters.add(adoption.rivalId);
      if (adoption.rewardClaimed) { calculatedRoyalties += adoption.rewardCredits; if (adoption.successfulUseTurn === creatorEconomy.royaltyTurn) lastTurnRoyalties += adoption.rewardCredits; }
    }
    if (creatorEconomy.nextAdoptionId <= maxAdoptionSequence || calculatedRoyalties !== creatorEconomy.totalRoyalties || lastTurnRoyalties !== creatorEconomy.lastTurnRoyalties) throw new Error("Creator reward ledger is invalid.");
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
    if (input && [1, 2, 3, 4, 5, 6].includes(input.schemaVersion)) {
      const state = copy(input);
      state.campaign = state.campaign || { id: "founding", completedObjectives: [], status: "active" };
      if (!CAMPAIGNS[state.campaign.id]) state.campaign.id = "founding";
      if (!Number.isInteger(state.campaign.buildingStart)) {
        state.campaign.buildingStart = ["farm", "workshop", "market", "academy", "power", "housing"]
          .reduce((sum, id) => sum + safeInt((state.buildings || {})[id], 0, 10_000), 0);
      }
      normalizeCreatorRecords(state, input.schemaVersion === 6);
      migrateCreatorEconomy(state);
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
        createdTurn: state.turn, commissioned: false, commissionedTurn: null
      }));
      normalizeCreatorRecords(state);
      migrateCreatorEconomy(state);
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
    for (const [key, stock, price] of [["ore", 240, 5], ["goods", 180, 8], ["power", 260, 4]]) {
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
    state.campaign = state.campaign || { id: "founding", completedObjectives: [], status: "active", buildingStart: 0 };
    state.campaign.progress = state.campaign.progress || {};
    for (const key of ["tradeVolume", "agreementsSigned", "crisesSurvived", "peacefulDisputes"]) state.campaign.progress[key] = safeInt(state.campaign.progress[key], 0);
    const campaign = CAMPAIGNS[state.campaign.id] || CAMPAIGNS.founding;
    state.campaign.completedObjectives = Array.isArray(state.campaign.completedObjectives) ? state.campaign.completedObjectives : [];
    let migratedPhase = 0;
    while (migratedPhase < campaign.phases.length && campaign.objectives.filter(o => o.phase === migratedPhase).every(o => state.campaign.completedObjectives.includes(o.id))) migratedPhase++;
    state.campaign.phaseIndex = Math.max(migratedPhase, Number.isInteger(state.campaign.phaseIndex) ? clamp(state.campaign.phaseIndex, 0, campaign.phases.length) : 0);
    state.world = state.world && typeof state.world === "object" ? state.world : { nextEventId: 1, activeEvents: [], processedEventIds: [] };
    state.world.nextEventId = safeInt(state.world.nextEventId, 1, 10_000_000) || 1;
    state.world.activeEvents = Array.isArray(state.world.activeEvents) ? state.world.activeEvents.filter(event => event && WORLD_EVENT_CATALOG[event.key]).slice(0, 8) : [];
    state.world.processedEventIds = Array.isArray(state.world.processedEventIds) ? [...new Set(state.world.processedEventIds.filter(id => typeof id === "string" && id.length <= 64))].slice(-500) : [];
    state.events = Array.isArray(state.events) ? state.events.slice(0, 500) : [];
    state.events.forEach((event, index) => { if (event && typeof event === "object" && !event.id) event.id = "legacy-history-" + state.turn + "-" + index; });
    state.rivals = state.rivals || {};
    RIVAL_TEMPLATES.forEach((template, index) => {
      if (!state.rivals[template.id]) state.rivals[template.id] = createRival(template, index);
    });
    for (const rival of Object.values(state.rivals)) {
      for (const key of ["ore", "goods", "influence"]) rival.resources[key] = safeInt(rival.resources[key], key === "ore" ? 36 : 10);
      for (const id of Object.keys(BUILDINGS)) rival.buildings[id] = safeInt(rival.buildings[id], 0, 10_000);
      rival.activity = typeof rival.activity === "string" ? rival.activity.slice(0, 100) : "Adapting industry";
      const template = RIVAL_TEMPLATES.find(r => r.id === rival.id) || RIVAL_TEMPLATES[0];
      rival.personality = typeof rival.personality === "string" ? rival.personality.slice(0, 48) : template.personality;
      rival.economicPriority = typeof rival.economicPriority === "string" ? rival.economicPriority.slice(0, 48) : template.economicPriority;
      rival.politicalPriority = typeof rival.politicalPriority === "string" ? rival.politicalPriority.slice(0, 48) : template.politicalPriority;
      rival.militaryPriority = typeof rival.militaryPriority === "string" ? rival.militaryPriority.slice(0, 48) : template.militaryPriority;
      rival.riskTolerance = Number.isFinite(rival.riskTolerance) ? clamp(rival.riskTolerance, 0, 1) : template.riskTolerance;
      rival.longTermObjective = typeof rival.longTermObjective === "string" ? rival.longTermObjective.slice(0, 128) : template.longTermObjective;
      rival.plan = rival.plan && typeof rival.plan === "object" ? rival.plan : null;
      rival.memory = Array.isArray(rival.memory) ? rival.memory.slice(0, 30) : [];
    }
  }

  function nextRandom(state) {
    let value = state.seed >>> 0;
    value = (value * 1664525 + 1013904223) >>> 0;
    state.seed = value;
    return value / 4294967296;
  }
  function addEvent(state, text, type = "world", details) {
    const world = state.world || (state.world = { nextEventId: 1, activeEvents: [], processedEventIds: [] });
    const id = "history-" + state.turn + "-" + world.nextEventId++;
    const entry = { id, turn: state.turn, text: String(text).slice(0, 240), type };
    if (details) entry.details = { summary: String(details.summary || "").slice(0, 300), affectedNationIds: Array.isArray(details.affectedNationIds) ? details.affectedNationIds.slice(0, 7) : [] };
    state.events.unshift(entry);
    state.events = state.events.slice(0, 500);
  }
  function hasTech(state, id) { return state.technologies.includes(id); }
  function worldEventInfo(key) { return WORLD_EVENT_CATALOG[key] ? copy(WORLD_EVENT_CATALOG[key]) : null; }
  function campaignProgress(state, key, amount = 1) {
    if (!state.campaign.progress) state.campaign.progress = { tradeVolume: 0, agreementsSigned: 0, crisesSurvived: 0, peacefulDisputes: 0 };
    state.campaign.progress[key] = clamp((state.campaign.progress[key] || 0) + amount, 0, RESOURCE_LIMIT);
  }
  function createWorldEvent(state, key, flow) {
    const definition = WORLD_EVENT_CATALOG[key];
    if (!definition || state.world.activeEvents.some(event => event.key === key) || state.world.activeEvents.filter(event => event.status === "pending").length) return null;
    const rivalIds = Object.keys(state.rivals);
    let affectedNationIds = ["player"];
    if (!["natural_disaster", "diplomatic_dispute", "international_conflict"].includes(key)) affectedNationIds = ["player", ...rivalIds];
    if (key === "natural_disaster") affectedNationIds = [nextRandom(state) < 0.5 ? "player" : rivalIds[Math.floor(nextRandom(state) * rivalIds.length)]];
    if (key === "diplomatic_dispute") affectedNationIds = [rivalIds.slice().sort((a, b) => state.rivals[a].relation - state.rivals[b].relation)[0]];
    if (key === "international_conflict") {
      const first = Math.floor(nextRandom(state) * rivalIds.length), second = (first + 1 + Math.floor(nextRandom(state) * (rivalIds.length - 1))) % rivalIds.length;
      affectedNationIds = [rivalIds[first], rivalIds[second]];
    }
    const id = "world-" + state.turn + "-" + state.world.nextEventId++;
    const event = { id, key, startedTurn: state.turn, remainingTurns: definition.duration, status: definition.choices ? "pending" : "active", choiceId: null, affectedNationIds, lastAppliedTurn: state.turn };
    state.world.activeEvents.unshift(event);
    if (state.world.activeEvents.length > 8) state.world.activeEvents.pop();
    if (key === "food_shortage") { flow.food -= 30; state.nation.stability = Math.max(0, state.nation.stability - 4); }
    if (key === "tech_breakthrough") {
      state.resources.science = clamp(state.resources.science + 18, 0, RESOURCE_LIMIT);
      for (const rival of Object.values(state.rivals)) rival.resources.science = clamp(rival.resources.science + (rival.traits.includes("research") ? 18 : 6), 0, RESOURCE_LIMIT);
    }
    if (key === "financial_crisis") {
      state.resources.credits = Math.floor(state.resources.credits * 0.85);
      for (const rival of Object.values(state.rivals)) rival.resources.credits = Math.floor(rival.resources.credits * 0.85);
    }
    if (key === "trade_disruption") for (const resource of MARKET_RESOURCES) flow[resource] -= 15;
    if (key === "natural_disaster") {
      const target = affectedNationIds[0];
      if (target === "player") { state.resources.food = Math.max(0, state.resources.food - 25); state.nation.stability = Math.max(0, state.nation.stability - 5); }
      else { const rival = state.rivals[target]; rival.resources.food = Math.max(0, rival.resources.food - 25); rival.stability = Math.max(0, rival.stability - 5); rememberRival(rival, state.turn, "disaster", "A natural disaster damaged regional food stores"); }
    }
    if (key === "political_instability") {
      state.nation.stability = Math.max(0, state.nation.stability - 8);
      for (const rival of Object.values(state.rivals)) rival.stability = Math.max(0, rival.stability - 4);
    }
    if (key === "diplomatic_dispute") {
      const rival = state.rivals[affectedNationIds[0]]; rival.relation = clamp(rival.relation - 12, -100, 100);
      rememberRival(rival, state.turn, "dispute", "A public dispute strained relations", -12);
    }
    if (key === "international_conflict") {
      for (const rivalId of affectedNationIds) { const rival = state.rivals[rivalId]; rival.relation = clamp(rival.relation - 18, -100, 100); rival.stance = rival.traits.includes("military") ? "Reassessing strategic risk" : "Monitoring regional conflict"; rememberRival(rival, state.turn, "international-conflict", "International conflict raised regional tensions", -18); }
      for (const resource of MARKET_RESOURCES) flow[resource] -= 6;
    }
    if (key === "resource_discovery") state.resources.ore = clamp(state.resources.ore + 18, 0, RESOURCE_LIMIT);
    if (definition.crisis && definition.duration === 0) campaignProgress(state, "crisesSurvived");
    const response = definition.choices ? "A response is required before the next turn." : definition.duration ? "Effects continue for " + definition.duration + " turns." : "The immediate effects have been recorded.";
    addEvent(state, definition.title + ". " + response, definition.crisis ? "crisis" : "world", { summary: definition.description, affectedNationIds });
    for (const rival of Object.values(state.rivals)) {
      if (key === "energy_crisis" && (rival.traits.includes("industry") || rival.traits.includes("security"))) rival.stance = "Securing alternative energy";
      if (key === "food_shortage" && rival.traits.includes("agriculture")) rival.stance = "Expanding food exports";
      if (key === "tech_breakthrough" && rival.traits.includes("research")) rival.stance = "Investing in new research";
      if (key === "trade_disruption" && rival.traits.includes("commerce")) rival.stance = "Negotiating alternate trade routes";
      rememberRival(rival, state.turn, "world-event", definition.title);
    }
    return event;
  }
  function resolveWorldEvent(state, eventId, choiceId) {
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    const event = state.world.activeEvents.find(item => item.id === eventId);
    const definition = event && WORLD_EVENT_CATALOG[event.key];
    if (!event || event.status !== "pending" || !definition || state.world.processedEventIds.includes(eventId)) throw new Error("World event is no longer awaiting a response.");
    const choice = definition.choices.find(item => item.id === choiceId);
    if (!choice) throw new Error("World event response is invalid.");
    if (event.key === "energy_crisis" && choiceId === "import") {
      if (state.resources.credits < 25 || state.market.stock.power < 10 || state.resources.power + 10 > RESOURCE_LIMIT) throw new Error("Emergency power import is unavailable or unaffordable.");
      state.resources.credits -= 25; state.market.stock.power -= 10; state.resources.power += 10;
    }
    if (event.key === "food_shortage" && choiceId === "buy_grain") {
      if (state.resources.credits < 30 || state.market.stock.food < 20 || state.resources.food + 20 > RESOURCE_LIMIT) throw new Error("Emergency grain purchase is unavailable or unaffordable.");
      state.resources.credits -= 30; state.market.stock.food -= 20; state.resources.food += 20;
    }
    if (event.key === "food_shortage" && choiceId === "ration") event.remainingTurns = Math.max(event.remainingTurns, 2);
    if (event.key === "trade_disruption" && choiceId === "escort") {
      if (state.resources.credits < 18) throw new Error("Convoy escorts require 18 credits.");
      state.resources.credits -= 18;
    }
    if (event.key === "diplomatic_dispute") {
      const rival = state.rivals[event.affectedNationIds[0]];
      if (choiceId === "envoys") { if (state.resources.credits < 20) throw new Error("Conciliatory envoys require 20 credits."); state.resources.credits -= 20; rival.relation = clamp(rival.relation + 10, -100, 100); campaignProgress(state, "peacefulDisputes"); }
      else rival.relation = clamp(rival.relation - 5, -100, 100);
      rememberRival(rival, state.turn, "dispute-response", choiceId === "envoys" ? "The player sent conciliatory envoys" : "The player stood firm during a dispute", choiceId === "envoys" ? 10 : -5);
    }
    if (event.key === "infrastructure_opportunity" && choiceId === "cofund") {
      if (state.resources.materials < 20 || state.resources.credits < 30 || state.buildings.transport >= 8) throw new Error("The transport project is unaffordable or already at capacity.");
      state.resources.materials -= 20; state.resources.credits -= 30; state.buildings.transport++;
    }
    event.choiceId = choiceId; event.status = "active";
    state.world.processedEventIds.push(eventId);
    state.world.processedEventIds = state.world.processedEventIds.slice(-500);
    addEvent(state, "Response to " + definition.title + ": " + choice.label + ".", "decision", { summary: choice.detail, affectedNationIds: event.affectedNationIds });
    updateObjectives(state);
    return state;
  }
  function autoResolvePendingWorldEvents(state) {
    const defaults = { energy_crisis: "ration", food_shortage: "ration", trade_disruption: "wait", diplomatic_dispute: "stand_firm", infrastructure_opportunity: "decline" };
    for (const event of state.world.activeEvents.filter(item => item.status === "pending")) resolveWorldEvent(state, event.id, defaults[event.key]);
  }
  function applyOngoingWorldEvents(state, flow) {
    for (const event of state.world.activeEvents) {
      if (event.status !== "active" || event.remainingTurns <= 0 || event.lastAppliedTurn === state.turn) continue;
      if (event.key === "energy_crisis") {
        const draw = event.choiceId === "ration" ? 2 : 4;
        state.resources.power = Math.max(0, state.resources.power - draw);
        for (const rival of Object.values(state.rivals)) rival.resources.power = Math.max(0, rival.resources.power - 4);
        flow.power -= draw + 4 * Object.keys(state.rivals).length;
      }
      if (event.key === "food_shortage") { flow.food -= 18; state.nation.stability = Math.max(0, state.nation.stability - 2); }
      if (event.key === "trade_disruption") for (const resource of MARKET_RESOURCES) flow[resource] -= event.choiceId === "escort" ? 4 : 15;
      if (event.key === "financial_crisis") state.nation.stability = Math.max(0, state.nation.stability - 1);
      if (event.key === "political_instability") { state.nation.stability = Math.max(0, state.nation.stability - 2); for (const rival of Object.values(state.rivals)) rival.stability = Math.max(0, rival.stability - 1); }
      if (event.key === "international_conflict") for (const resource of MARKET_RESOURCES) flow[resource] -= 6;
      if (event.key === "industrial_revolution") state.world.industrialBoostTurn = state.turn;
      event.remainingTurns--; event.lastAppliedTurn = state.turn;
      if (event.remainingTurns === 0) {
        if (WORLD_EVENT_CATALOG[event.key].crisis) campaignProgress(state, "crisesSurvived");
        addEvent(state, WORLD_EVENT_CATALOG[event.key].title + " has ended.", "world", { summary: "The temporary world modifier has expired.", affectedNationIds: event.affectedNationIds });
      }
    }
  }
  function worldEventActiveThisTurn(state, key) {
    return state.world.activeEvents.some(event => event.key === key && event.status === "active" && (event.remainingTurns > 0 || event.lastAppliedTurn === state.turn));
  }
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
    const creator = creatorEffects(state);
    const base = productionFor(state.buildings, state.technologies);
    const industry = industrialOutput({ ...state.resources,
      materials: clamp(state.resources.materials + Math.floor(base.materials * staffing), 0, RESOURCE_LIMIT),
      ore: clamp(state.resources.ore + Math.floor(base.ore * staffing), 0, RESOURCE_LIMIT),
      power: clamp(state.resources.power + Math.floor(base.power * staffing), 0, RESOURCE_LIMIT)
    }, state.buildings, state.technologies, state.nation.population);
    for (const [resource, amount] of Object.entries(creator.production)) industry.production[resource] += amount;
    return { production: industry.production, consumption: { food: Math.ceil(state.nation.population / (12 + Math.min(8, industry.production.logistics))), ...industry.inputs },
      workforce: jobs, employed, requiredJobs: Math.ceil(state.nation.population / 10), activeFactories: industry.activeFactories };
  }
  function build(state, id) {
    const definition = BUILDINGS[id];
    if (!definition) throw new Error("Unknown building.");
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    if (id === "transport" && state.buildings.transport >= 8) throw new Error("Transport hub limit reached.");
    if ((state.buildings[id] || 0) >= 10_000) throw new Error("Building level limit reached.");
    for (const [key, cost] of Object.entries(definition.cost)) if (state.resources[key] < cost) throw new Error("Not enough " + key + ".");
    for (const [key, cost] of Object.entries(definition.cost)) state.resources[key] -= cost;
    state.buildings[id] = (state.buildings[id] || 0) + 1;
    if (id === "factory" && !state.achievements.includes("industrialist")) state.achievements.push("industrialist");
    for (const rival of Object.values(state.rivals)) rememberRival(rival, state.turn, "player-investment", "The player expanded " + definition.name.toLowerCase());
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
    campaignProgress(state, "tradeVolume", Math.abs(amount));
    addEvent(state, (amount > 0 ? "Bought " : "Sold ") + Math.abs(amount) + " " + resource + " at " + price + " credits each.", "trade");
    for (const rival of Object.values(state.rivals)) rememberRival(rival, state.turn, "player-trade", "The player " + (amount > 0 ? "imported " : "exported ") + Math.abs(amount) + " " + resource);
    updateObjectives(state);
    return state;
  }
  function research(state, id) {
    const technology = TECHNOLOGIES[id];
    if (!technology) throw new Error("Unknown technology.");
    if (state.technologies.includes(id)) throw new Error("Technology already researched.");
    const missing = (technology.requires || []).filter(required => !state.technologies.includes(required));
    if (missing.length) throw new Error("Research prerequisite missing: " + missing.map(required => TECHNOLOGIES[required].name).join(", ") + ".");
    if (state.resources.science < technology.cost) throw new Error("Not enough science.");
    state.resources.science -= technology.cost;
    state.technologies.push(id);
    if (id === "governance") state.nation.stability = Math.min(100, state.nation.stability + 10);
    addEvent(state, "Researched " + technology.name + ".", "research");
    for (const rival of Object.values(state.rivals)) rememberRival(rival, state.turn, "player-research", "The player researched " + technology.name);
    updateObjectives(state);
    return state;
  }
  function sendGift(state, rivalId, credits = 20) {
    const rival = state.rivals[rivalId];
    if (!rival) throw new Error("Unknown nation.");
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    if (!Number.isInteger(credits) || credits < 10 || credits > 500 || state.resources.credits < credits) throw new Error("Gift amount is invalid or unaffordable.");
    state.resources.credits -= credits;
    const relationGain = Math.max(2, Math.floor(credits / 5));
    rival.relation = clamp(rival.relation + relationGain, -100, 100);
    state.resources.influence = Math.min(RESOURCE_LIMIT, state.resources.influence + Math.floor(credits / 10));
    addEvent(state, "Sent " + credits + " credits in aid to " + rival.name + ".", "diplomacy");
    rememberRival(rival, state.turn, "player-aid", "The player sent " + credits + " credits in aid", relationGain);
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
    campaignProgress(state, "agreementsSigned");
    addEvent(state, rival.name + " signed a " + kind + " agreement.", "diplomacy");
    rememberRival(rival, state.turn, "agreement", "Signed a " + kind + " agreement with the player");
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
    rememberRival(rival, state.turn, "player-conflict", "The player declared conflict and voided prior agreements", -80);
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
    rememberRival(state.rivals[rivalId], state.turn, "peace", "The player negotiated an end to conflict");
    return state;
  }
  function registerCreation(state, creation) {
    if (!creation || typeof creation !== "object") throw new Error("Creation details are required.");
    const creator = String(creation.creator || "").trim().slice(0, 48);
    const title = String(creation.title || "").trim().slice(0, 64);
    const description = String(creation.description || "").trim().slice(0, 500);
    const category = String(creation.category || "Design").trim().slice(0, 32);
    if (!creator || !title) throw new Error("Creator and title are required.");
    if (!CREATOR_EFFECTS[category]) throw new Error("Choose a supported Creator Studio category.");
    if (state.creatorEconomy.publications.length >= MAX_CREATOR_PUBLICATIONS) throw new Error("Creator lifetime publication limit reached.");
    let id = "creation-" + state.turn + "-" + state.seed + "-" + state.creations.length, suffix = 0;
    while (state.creations.some(existing => existing.id === id)) id = "creation-" + state.turn + "-" + state.seed + "-" + state.creations.length + "-" + (++suffix);
    const item = { id, creator, creatorId: creatorIdFor(creator), title, description, category, createdTurn: state.turn, archived: false, commissioned: false, commissionedTurn: null };
    state.creations.unshift(item);
    state.creatorEconomy.publications.push({ id, creatorId: item.creatorId, creator, title, category, turn: state.turn });
    addEvent(state, "Creator entry registered: " + title + ".", "creator");
    return item;
  }
  function commissionCreation(state, id) {
    if (state.status !== "playing") throw new Error("This campaign has ended.");
    const creation = state.creations.find(item => item.id === id);
    if (!creation) throw new Error("Creation entry not found.");
    if (creation.archived) throw new Error("Archived designs cannot be commissioned.");
    if (!CREATOR_EFFECTS[creation.category]) throw new Error("This creation category cannot be commissioned.");
    if (creation.commissioned) throw new Error("This creation is already commissioned.");
    if (state.creations.filter(item => item.commissioned).length >= MAX_COMMISSIONED_CREATIONS) throw new Error("Creator Studio supports three active commissions.");
    const firstCommission = !state.creatorEconomy.commissions.some(item => item.designId === id);
    if (firstCommission) {
      for (const [resource, cost] of Object.entries(CREATOR_COMMISSION_COST)) if (state.resources[resource] < cost) throw new Error("Not enough " + resource + " to commission this design.");
      for (const [resource, cost] of Object.entries(CREATOR_COMMISSION_COST)) state.resources[resource] -= cost;
      state.creatorEconomy.commissions.push({ designId: id, creatorId: creation.creatorId, turn: state.turn });
    }
    creation.commissioned = true;
    creation.commissionedTurn = state.turn;
    addEvent(state, (firstCommission ? "Commissioned" : "Reactivated") + " creator design: " + creation.title + " (" + CREATOR_EFFECTS[creation.category].label + ").", "creator");
    return creation;
  }
  function withdrawCreation(state, id) {
    const creation = state.creations.find(item => item.id === id);
    if (!creation) throw new Error("Creation entry not found.");
    if (!creation.commissioned) throw new Error("This creation is not commissioned.");
    creation.commissioned = false;
    creation.commissionedTurn = null;
    addEvent(state, "Withdrew creator design: " + creation.title + ". Its ongoing effect has ended.", "creator");
    return creation;
  }
  function creatorEffects(state) {
    const effects = { production: { materials: 0, science: 0, credits: 0 }, capacity: 0, stability: 0, influence: 0 };
    for (const creation of state.creations) {
      if (!creation.commissioned || creation.archived) continue;
      const effect = creatorEffectFor(creation.category, creatorProgress(state, creation.creatorId).level);
      for (const [resource, amount] of Object.entries(effect.production || {})) effects.production[resource] += amount;
      effects.capacity += effect.capacity || 0;
      effects.stability += effect.stability || 0;
      effects.influence += effect.influence || 0;
    }
    return effects;
  }
  function creatorEffectFor(category, level = 1) {
    const base = CREATOR_EFFECTS[category];
    if (!base) return null;
    const effect = copy(base), tier = Math.floor((clamp(Number.isFinite(level) ? Math.floor(level) : 1, 1, 20) - 1) / 5);
    if (effect.production) for (const resource of Object.keys(effect.production)) effect.production[resource] += tier;
    if (effect.capacity) effect.capacity += tier * 5;
    if (effect.stability) effect.stability += Math.floor((clamp(level, 1, 20) - 1) / 10);
    if (effect.influence) effect.influence += Math.floor((clamp(level, 1, 20) - 1) / 10);
    return effect;
  }
  function creatorProgress(state, creatorId) {
    const publications = state.creatorEconomy.publications.filter(item => item.creatorId === creatorId);
    const commissions = state.creatorEconomy.commissions.filter(item => item.creatorId === creatorId);
    const adoptions = state.creatorEconomy.adoptions.filter(item => item.creatorId === creatorId);
    const successfulUses = adoptions.filter(item => item.successfulUseTurn !== null).length;
    const experience = successfulUses * 10;
    return { creatorId, creator: publications[0]?.creator || "Unknown creator", published: publications.length, commissioned: commissions.length,
      activeUses: adoptions.filter(item => item.active).length, successfulUses, experience,
      reputation: Math.min(100, successfulUses * 5), level: Math.min(20, 1 + Math.floor(experience / 50)) };
  }
  function creatorProfiles(state) {
    return [...new Set(state.creatorEconomy.publications.map(item => item.creatorId))].map(id => creatorProgress(state, id));
  }
  function designDemandForNation(state, nation, category) {
    const player = nation === state.nation, resources = player ? state.resources : nation.resources, buildings = nation.buildings;
    const population = nation.population, stability = nation.stability, active = key => state.world.activeEvents.some(event => event.key === key && (event.status === "pending" || (event.status === "active" && (event.remainingTurns > 0 || event.lastAppliedTurn === state.turn))));
    const avgRelation = player ? Object.values(state.rivals).reduce((sum, rival) => sum + rival.relation, 0) / Math.max(1, Object.keys(state.rivals).length) : nation.relation;
    let score = 0, reason = "Current national conditions create little need for this design.";
    if (category === "City Design") {
      const cap = 250 + safeInt(buildings.housing, 0, 10_000) * 50 + (nation.technologies?.includes("medicine") ? 100 : 0);
      score = clamp(Math.floor((population / cap - 0.7) * 300), 0, 100);
      reason = score ? "Population is approaching available city capacity." : "Population can still grow within existing city capacity.";
    } else if (category === "Building") {
      score = clamp(100 - resources.materials * 2, 0, 100);
      const foodNeed = Math.ceil(population / 12), foodLow = resources.food < foodNeed * 3;
      if (foodLow || active("food_shortage")) { score = clamp(score + 35, 0, 100); reason = "Food pressure makes farm construction a priority; construction materials support that expansion."; }
      else if (active("infrastructure_opportunity")) { score = clamp(score + 25, 0, 100); reason = "A regional infrastructure opportunity increases demand for construction inputs."; }
      else if (buildings.factory > 0 && resources.materials < 70) reason = "Factories compete for scarce materials with construction projects.";
      else reason = score ? "Low material reserves constrain new infrastructure." : "Construction reserves are currently healthy.";
    } else if (category === "Technology") {
      const science = resources.science, researchTrait = nation.traits?.includes("research");
      score = clamp(90 - science * 2 + (researchTrait ? 10 : 0), 0, 100);
      reason = researchTrait ? "Research-focused nations need science to stay ahead in the technology race." : "Available science is below the cost of the next research breakthrough.";
    } else if (category === "Business") {
      const lastBalance = player ? state.economy.lastBalance : (resources.credits < 60 ? -1 : 0);
      score = clamp((180 - resources.credits) / 2 + (lastBalance < 0 ? 35 : 0) + (player && state.economy.phase === "recession" ? 25 : 0), 0, 100);
      reason = lastBalance < 0 || (player && state.economy.phase === "recession") ? "A weak treasury or recession raises demand for reliable income." : "Treasury reserves set the current demand for new businesses.";
    } else if (category === "Artwork") {
      score = clamp(100 - stability, 0, 100);
      if (active("political_instability") || active("natural_disaster")) score = clamp(score + 20, 0, 100);
      reason = stability < 70 ? "Low stability makes public confidence and civic cohesion valuable." : "National stability is high, so civic support is less urgent.";
    } else if (category === "World Lore") {
      score = clamp(60 - resources.influence * 3 + Math.max(0, 25 - avgRelation), 0, 100);
      reason = avgRelation < 15 ? "Weak diplomatic relationships increase the value of influence." : "Current influence and relations set diplomatic demand.";
    }
    return { score: Math.round(score), reason };
  }
  function creatorDemand(state) {
    return Object.keys(CREATOR_EFFECTS).map(category => {
      const nations = [{ id: "player", name: state.nation.name, nation: { ...state.nation, resources: state.resources, buildings: state.buildings, technologies: state.technologies, relation: 0 } }, ...Object.values(state.rivals).map(nation => ({ id: nation.id, name: nation.name, nation }))];
      const ranked = nations.map(item => ({ ...item, ...designDemandForNation(state, item.nation, category) })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      const leader = ranked[0];
      return { category, score: leader.score, reason: leader.reason, nations: ranked.filter(item => item.score >= Math.max(35, leader.score - 15)).map(item => ({ id: item.id, name: item.name, score: item.score })) };
    });
  }
  function selectRivalDesign(state, rival) {
    let current = state.creatorEconomy.adoptions.find(item => item.rivalId === rival.id && item.active);
    if (current) {
      const design = state.creations.find(item => item.id === current.designId && !item.archived);
      const demand = design && designDemandForNation(state, rival, design.category);
      if (design && demand.score >= 30) return { adoption: current, design, demand };
      current.active = false;
    }
    const lastChoice = state.creatorEconomy.adoptions.filter(item => item.rivalId === rival.id).reduce((latest, item) => Math.max(latest, item.lastAdoptedTurn), 0);
    if (lastChoice && state.turn - lastChoice < 3) return null;
    const candidates = state.creations.filter(item => !item.archived).map(design => ({ design, demand: designDemandForNation(state, rival, design.category) }))
      .filter(item => item.demand.score >= 45)
      .sort((a, b) => b.demand.score - a.demand.score || a.design.id.localeCompare(b.design.id));
    const choice = candidates.find(item => {
      const existing = state.creatorEconomy.adoptions.find(adoption => adoption.designId === item.design.id && adoption.rivalId === rival.id);
      return !existing || !existing.active;
    });
    if (!choice) return null;
    let adoption = state.creatorEconomy.adoptions.find(item => item.designId === choice.design.id && item.rivalId === rival.id);
    if (!adoption) {
      adoption = { id: "creator-adoption-" + state.creatorEconomy.nextAdoptionId++, designId: choice.design.id, creatorId: choice.design.creatorId, rivalId: rival.id,
        firstAdoptedTurn: state.turn, lastAdoptedTurn: state.turn, active: true, lastUsedTurn: null, usageTurns: 0, successfulUseTurn: null,
        rewardClaimed: false, rewardDemand: 0, rewardCredits: 0 };
      state.creatorEconomy.adoptions.push(adoption);
    } else { adoption.lastAdoptedTurn = state.turn; adoption.active = true; }
    rival.activity = "Adopted " + choice.design.title + " for " + choice.demand.reason.toLowerCase();
    rival.stance = "Using creator design: " + choice.design.title;
    rememberRival(rival, state.turn, "design-adoption", rival.activity);
    addEvent(state, rival.name + " adopted " + choice.design.title + ".", "creator", { summary: choice.demand.reason, affectedNationIds: ["player", rival.id] });
    return { adoption, design: choice.design, demand: choice.demand };
  }
  function completeCreatorUse(state, adoption, demandScore) {
    adoption.lastUsedTurn = state.turn;
    adoption.usageTurns = Math.min(RESOURCE_LIMIT, adoption.usageTurns + 1);
    if (adoption.successfulUseTurn !== null) return 0;
    adoption.successfulUseTurn = state.turn;
    adoption.rewardClaimed = true;
    adoption.rewardDemand = clamp(Math.floor(demandScore), 0, 100);
    const reward = Math.min(5 + Math.floor(adoption.rewardDemand / 20), RESOURCE_LIMIT - state.resources.credits);
    adoption.rewardCredits = reward;
    state.resources.credits += reward;
    state.creatorEconomy.totalRoyalties += reward;
    state.creatorEconomy.lastTurnRoyalties += reward;
    addEvent(state, "Successful use of " + (state.creations.find(item => item.id === adoption.designId)?.title || "a creator design") + " earned " + reward + " credits.", "creator", { summary: "A rival used the design while category demand was " + adoption.rewardDemand + "/100.", affectedNationIds: ["player", adoption.rivalId] });
    return reward;
  }
  function deleteCreation(state, id) {
    const index = state.creations.findIndex(c => c.id === id);
    if (index < 0) throw new Error("Creation entry not found.");
    if (state.creations[index].commissioned) throw new Error("Withdraw an active commission before removing its design.");
    if (state.creatorEconomy.adoptions.some(adoption => adoption.designId === id && adoption.active)) throw new Error("A rival is actively using this design. Wait for that use to end before archiving it.");
    state.creations[index].archived = true;
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
      if (objective.building) complete = state.buildings[objective.building] >= objective.target;
      if (objective.relations) complete = Object.values(state.rivals).some(r => r.relation >= objective.target);
      if (objective.technologies) complete = state.technologies.length >= objective.target;
      if (objective.turn) complete = state.turn >= objective.turn;
      if (objective.stability) complete = state.nation.stability >= objective.stability;
      if (objective.population) complete = state.nation.population >= objective.population;
      if (objective.treaty) complete = state.diplomacy.treaties.some(t => t.kind === objective.treaty && t.status === "active");
      if (objective.progress) complete = state.campaign.progress[objective.progress] >= objective.target;
      if (complete) {
        state.campaign.completedObjectives.push(objective.id);
        addEvent(state, "Campaign objective completed: " + objective.text + ".", "milestone", { summary: "This objective advanced your " + campaign.phases[objective.phase] + " campaign phase.", affectedNationIds: ["player"] });
      }
    }
    const previousPhase = state.campaign.phaseIndex;
    while (state.campaign.phaseIndex < campaign.phases.length && campaign.objectives.filter(o => o.phase === state.campaign.phaseIndex).every(o => state.campaign.completedObjectives.includes(o.id))) state.campaign.phaseIndex++;
    if (state.campaign.phaseIndex > previousPhase && state.campaign.phaseIndex < campaign.phases.length) addEvent(state, "Campaign phase advanced: " + campaign.phases[state.campaign.phaseIndex] + ".", "milestone", { summary: "The next set of short, medium, and long-term objectives is now active.", affectedNationIds: ["player"] });
    if (state.campaign.completedObjectives.length === campaign.objectives.length) {
      state.campaign.status = "victory";
      state.campaign.phaseIndex = campaign.phases.length;
      state.status = "victory";
      if (!state.achievements.includes("campaign-victory")) state.achievements.push("campaign-victory");
      addEvent(state, "Victory! Your nation has completed " + campaign.name + ".", "victory", { summary: "Every campaign phase and strategic objective is complete.", affectedNationIds: ["player"] });
    }
  }
  function campaignObjectiveValue(state, objective) {
    if (objective.resource) return state.resources[objective.resource];
    if (objective.buildings) return Math.max(0, Object.values(state.buildings).reduce((a, b) => a + b, 0) - state.campaign.buildingStart);
    if (objective.building) return state.buildings[objective.building] || 0;
    if (objective.relations) return Math.max(0, ...Object.values(state.rivals).map(r => r.relation));
    if (objective.technologies) return state.technologies.length;
    if (objective.turn) return state.turn;
    if (objective.stability) return state.nation.stability;
    if (objective.population) return state.nation.population;
    if (objective.treaty) return state.diplomacy.treaties.filter(t => t.kind === objective.treaty && t.status === "active").length;
    if (objective.progress) return state.campaign.progress[objective.progress] || 0;
    return 0;
  }
  function updateObjectives(state) { resolveObjectives(state); }
  function updateMarket(state, netFlow) {
    for (const resource of MARKET_RESOURCES) {
      const boundedFlow = clamp(Math.trunc(netFlow[resource] || 0), -RESOURCE_LIMIT, RESOURCE_LIMIT);
      state.market.stock[resource] = clamp(state.market.stock[resource] + boundedFlow, 0, RESOURCE_LIMIT);
      state.market.lastFlow[resource] = boundedFlow;
      const stock = state.market.stock[resource];
      const scarcity = 1.5 - stock / 800;
      // Stock is the dominant price signal. Flow adds a smaller short-term
      // adjustment so one large import turn cannot make an abundant market
      // more expensive than a genuinely depleted one.
      const demandPressure = boundedFlow < 0 ? Math.min(0.3, Math.abs(boundedFlow) / 500) : -Math.min(0.2, boundedFlow / 500);
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
        if (price <= state.market.basePrices[resource]) { rival.relation = clamp(rival.relation + 1, -100, 100); rememberRival(rival, state.turn, "fair-market", "Affordable " + resource + " imports eased regional pressure", 1); }
        else if (price >= state.market.basePrices[resource] * 1.5) { rival.relation = clamp(rival.relation - 1, -100, 100); rememberRival(rival, state.turn, "price-pressure", "High " + resource + " prices strained the relationship", -1); }
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
    if (rival.traits.includes("industry")) priorities.push("manufacturing", "industry", "energy", "extraction");
    if (rival.traits.includes("agriculture")) priorities.push("agriculture", "medicine", "governance", "logistics", "urbanism");
    if (rival.traits.includes("research")) priorities.push("agriculture", "industry", "energy", "manufacturing", "medicine", "governance", "commerce", "extraction", "logistics", "urbanism");
    if (rival.traits.includes("security")) priorities.push("energy", "governance", "industry", "urbanism");
    if (rival.traits.includes("commerce")) priorities.push("commerce", "industry", "agriculture", "logistics", "extraction");
    return [...new Set(priorities)].map(id => [id, TECHNOLOGIES[id]])
      .find(([id, technology]) => technology && !rival.technologies.includes(id) &&
        (id !== "manufacturing" || rival.buildings.factory > 0) &&
        (technology.requires || []).every(required => rival.technologies.includes(required)) && rival.resources.science >= technology.cost);
  }
  function rememberRival(rival, turn, kind, text, relationDelta = 0) {
    rival.memory.unshift({ turn, kind: String(kind).slice(0, 32), text: String(text).slice(0, 180), relationDelta: safeInt(relationDelta, 0, 200) * (relationDelta < 0 ? -1 : 1) });
    rival.memory = rival.memory.slice(0, 30);
  }
  function planRival(state, rival, foodNeed, foodTarget) {
    const current = rival.plan;
    const currentComplete = current && (current.action === "build"
      ? rival.buildings[current.target] >= current.targetLevel
      : rival.technologies.includes(current.target));
    const urgentFood = rival.resources.food < foodNeed + 8;
    const urgentPower = rival.resources.power < 3 && rival.buildings.power === 0;
    if (current && !currentComplete && state.turn <= current.reviewTurn && !urgentFood && !urgentPower) return current;
    const candidates = [];
    const addBuild = (building, score, reason) => {
      if (score > 0 && rival.buildings[building] < 10_000) candidates.push({ action: "build", target: building, targetLevel: rival.buildings[building] + 1, score, reason });
    };
    if (rival.resources.food < foodNeed + 8) addBuild("farm", 110, "Prevent food shortage and unrest");
    else if (rival.resources.food < foodTarget) addBuild("farm", 82, "Rebuild the strategic food reserve");
    else if (rival.traits.includes("agriculture") && rival.buildings.farm < 5) addBuild("farm", 43, "Use the agricultural specialization");
    if (rival.resources.ore < 12) addBuild("mine", 100, "Secure ore for industry");
    else if (rival.resources.ore < 24) addBuild("mine", 78, "Reduce dependence on scarce ore imports");
    else if (rival.traits.includes("expansionist") && rival.buildings.mine < 6) addBuild("mine", 48 + Math.round(rival.riskTolerance * 10), "Expand strategic mineral reserves");
    const energyTarget = Math.ceil(rival.population / 8) + (rival.buildings.factory || 0) * 2;
    if (rival.resources.power < 3) addBuild("power", 100, "Restore energy supply");
    else if (rival.resources.power < energyTarget) addBuild("power", 80, "Protect industry from energy shortages");
    else if (rival.traits.includes("security") && rival.buildings.power < 3) addBuild("power", 42, "Strengthen defensive energy reserves");
    if (rival.resources.materials < 20) addBuild("workshop", 95, "Restore construction and manufacturing inputs");
    else if (rival.resources.materials < 35) addBuild("workshop", 77, "Rebuild construction material reserves");
    else if (rival.traits.includes("industry") && rival.buildings.workshop < 5) addBuild("workshop", 38, "Expand domestic materials processing");
    if (rival.traits.includes("industry") && rival.resources.ore >= 3 && rival.buildings.factory < 5) addBuild("factory", 52 + Math.round(rival.riskTolerance * 12), "Develop the industrial specialization");
    if (rival.traits.includes("research") && rival.buildings.academy < 4) addBuild("academy", rival.buildings.academy === 0 ? 72 : 40, "Build long-term research capacity");
    if ((rival.traits.includes("commerce") || rival.traits.includes("diplomacy")) && rival.buildings.market < 5) addBuild("market", 40, "Expand regional trade capacity");
    if (rival.population >= 150 && rival.resources.food >= foodTarget && rival.buildings.transport < 8) addBuild("transport", 62, "Lower future food demand through logistics");
    const technology = rivalTechnologyChoice(rival);
    if (technology) candidates.push({ action: "research", target: technology[0], score: rival.traits.includes("research") ? 76 : 55, reason: "Convert accumulated science into a lasting advantage" });
    candidates.sort((a, b) => b.score - a.score || a.target.localeCompare(b.target));
    const chosen = candidates[0];
    if (!chosen) { rival.plan = null; return null; }
    const { score, ...plan } = chosen;
    rival.plan = { ...plan, createdTurn: state.turn, reviewTurn: state.turn + 3 };
    rememberRival(rival, state.turn, "plan", "Plan: " + plan.reason + " (review turn " + (state.turn + 3) + ")");
    return rival.plan;
  }
  function executeRivalPlan(state, rival, plan) {
    if (!plan) return false;
    if (plan.action === "build") {
      const building = BUILDINGS[plan.target];
      if (!building || rival.buildings[plan.target] >= plan.targetLevel) return false;
      if (Object.entries(building.cost).some(([resource, cost]) => rival.resources[resource] < cost)) {
        rival.stance = "Stockpiling for " + building.name;
        rival.activity = "Saving materials and credits for " + building.name;
        return true;
      }
      for (const [resource, cost] of Object.entries(building.cost)) rival.resources[resource] -= cost;
      rival.buildings[plan.target]++;
      rival.stance = "Investing in " + building.name.toLowerCase();
      rival.activity = "Built " + building.name + " to advance its long-term plan";
      rememberRival(rival, state.turn, "investment", rival.activity);
      return true;
    }
    const technology = TECHNOLOGIES[plan.target];
    if (!technology || rival.technologies.includes(plan.target)) return false;
    if (rival.resources.science < technology.cost) {
      rival.stance = "Saving science for " + technology.name;
      rival.activity = "Accumulating science for " + technology.name;
      return true;
    }
    rival.resources.science -= technology.cost;
    rival.technologies.push(plan.target);
    if (plan.target === "governance") rival.stability = Math.min(100, rival.stability + 10);
    rival.stance = "Advancing " + technology.name;
    rival.activity = "Researched " + technology.name;
    rememberRival(rival, state.turn, "research", rival.activity);
    return true;
  }
  function developRivals(state, worldFlow) {
    for (const rival of Object.values(state.rivals)) {
      const selectedDesign = selectRivalDesign(state, rival);
      const designEffect = selectedDesign ? creatorEffectFor(selectedDesign.design.category, creatorProgress(state, selectedDesign.design.creatorId).level) : null;
      let successfulDesignUse = false;
      const industry = industrialOutput(rival.resources, rival.buildings, rival.technologies, rival.population), output = industry.production;
      const normalPopulationCap = Math.min(RESOURCE_LIMIT, 250 + safeInt(rival.buildings.housing, 0, 10_000) * 50 + (rival.technologies.includes("medicine") ? 100 : 0));
      if (designEffect?.production) for (const [resource, amount] of Object.entries(designEffect.production)) {
        if (rival.resources[resource] < RESOURCE_LIMIT) successfulDesignUse = true;
        output[resource] = Math.min(RESOURCE_LIMIT, output[resource] + amount);
      }
      if (worldEventActiveThisTurn(state, "industrial_revolution")) output.goods = Math.floor(output.goods * 1.3);
      for (const resource of ["food", "materials", "ore", "goods", "science", "power"]) {
        rival.resources[resource] = clamp(rival.resources[resource] + output[resource], 0, RESOURCE_LIMIT);
      }
      rival.resources.materials = Math.max(0, rival.resources.materials - industry.inputs.materials);
      rival.resources.ore = Math.max(0, rival.resources.ore - industry.inputs.ore);
      rival.resources.power = Math.max(0, rival.resources.power - industry.inputs.power);
      const rivalIncome = output.credits + Math.floor(rival.population / 20);
      rival.resources.credits = Math.min(RESOURCE_LIMIT, rival.resources.credits + (worldEventActiveThisTurn(state, "financial_crisis") ? Math.floor(rivalIncome * 0.75) : rivalIncome));
      for (const resource of MARKET_RESOURCES) worldFlow[resource] += output[resource] - (industry.inputs[resource] || 0);
      const foodNeed = Math.ceil(rival.population / (12 + Math.min(8, output.logistics)));
      const foodTarget = Math.ceil(rival.population * 1.2);
      const foodTradeTarget = worldEventActiveThisTurn(state, "food_shortage") && rival.traits.includes("agriculture") ? Math.floor(foodTarget * 0.72) : foodTarget;
      const powerTradeTarget = Math.ceil(rival.population / 8) + (worldEventActiveThisTurn(state, "energy_crisis") && (rival.traits.includes("industry") || rival.traits.includes("security")) ? 8 : 0);
      const tradeTargets = { food: Math.max(foodNeed + 8, foodTradeTarget), materials: 55, ore: 32, goods: 24, power: powerTradeTarget };
      if (worldEventActiveThisTurn(state, "trade_disruption") && rival.traits.includes("commerce")) { tradeTargets.materials = 70; tradeTargets.goods = 40; }
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
        if (rival.resources.food > 25 && rival.stability > 50) {
          const previousPopulation = rival.population;
          rival.population = Math.min(normalPopulationCap + (designEffect?.capacity || 0), rival.population + 1 + (rival.technologies.includes("medicine") ? 1 : 0) + Math.floor((rival.buildings.housing || 0) / 2));
      if (designEffect?.capacity && previousPopulation <= normalPopulationCap && rival.population > normalPopulationCap) successfulDesignUse = true;
        }
      }
      if (designEffect?.stability) {
        if (rival.stability < 100) successfulDesignUse = true;
        rival.stability = Math.min(100, rival.stability + designEffect.stability);
      }
      if (designEffect?.influence) {
        if (rival.resources.influence < RESOURCE_LIMIT) successfulDesignUse = true;
        rival.resources.influence = Math.min(RESOURCE_LIMIT, rival.resources.influence + designEffect.influence);
      }
      if (selectedDesign) {
        if (successfulDesignUse) completeCreatorUse(state, selectedDesign.adoption, selectedDesign.demand.score);
        else { selectedDesign.adoption.lastUsedTurn = state.turn; selectedDesign.adoption.usageTurns = Math.min(RESOURCE_LIMIT, selectedDesign.adoption.usageTurns + 1); }
      }
      const plan = planRival(state, rival, foodNeed, foodTarget);
      const executedPlan = executeRivalPlan(state, rival, plan);
      const rememberedConflict = rival.memory.some(m => m.kind === "player-conflict" && state.turn - m.turn < 24);
      if (!executedPlan && rival.traits.includes("diplomacy") && rival.resources.influence >= 5 && !rememberedConflict && rival.relation >= 65 && !state.diplomacy.treaties.some(t => t.rivalId === rival.id && t.kind === "alliance" && t.status === "active") && nextRandom(state) > (0.82 - rival.riskTolerance * 0.18)) {
        rival.resources.influence -= 5;
        state.diplomacy.treaties.push({ id: rival.id + ":alliance", rivalId: rival.id, kind: "alliance", status: "active", startedTurn: state.turn, duration: 12 });
        rival.treaties.push("alliance"); rival.stance = "Proposing regional alliance";
        rival.activity = "Formed a strategic alliance";
        rememberRival(rival, state.turn, "alliance", "Formed a strategic alliance with the player");
        addEvent(state, rival.name + " proposed a strategic alliance.", "diplomacy");
      } else if (!executedPlan) {
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
    autoResolvePendingWorldEvents(state);
    if (state.status !== "playing") return state;
    state.turn++;
    state.creatorEconomy.royaltyTurn = state.turn;
    state.creatorEconomy.lastTurnRoyalties = 0;
    state.world.activeEvents = state.world.activeEvents.filter(event => event.status === "pending" || event.remainingTurns > 0);
    for (const treaty of state.diplomacy.treaties) {
      if (treaty.status === "active" && state.turn - treaty.startedTurn >= treaty.duration) {
        treaty.status = "expired";
        addEvent(state, treaty.kind + " agreement with " + state.rivals[treaty.rivalId].name + " expired.", "diplomacy");
      }
    }
    const flow = Object.fromEntries(MARKET_RESOURCES.map(key => [key, 0]));
    applyOngoingWorldEvents(state, flow);
    const creator = creatorEffects(state);
    const baseOutput = productionFor(state.buildings, state.technologies);
    const jobs = workforceFor(state.buildings), employed = Math.min(jobs, state.nation.population);
    const staffing = jobs > 0 ? Math.min(1, state.nation.population / jobs) : 1;
    const industry = industrialOutput({ ...state.resources,
      materials: clamp(state.resources.materials + Math.floor(baseOutput.materials * staffing), 0, RESOURCE_LIMIT),
      ore: clamp(state.resources.ore + Math.floor(baseOutput.ore * staffing), 0, RESOURCE_LIMIT),
      power: clamp(state.resources.power + Math.floor(baseOutput.power * staffing), 0, RESOURCE_LIMIT)
    }, state.buildings, state.technologies, state.nation.population);
    const output = industry.production;
    for (const [resource, amount] of Object.entries(creator.production)) output[resource] += amount;
    if (worldEventActiveThisTurn(state, "industrial_revolution")) output.goods = Math.floor(output.goods * 1.3);
    for (const resource of ["food", "materials", "ore", "goods", "science", "power"]) {
      state.resources[resource] = clamp(state.resources[resource] + output[resource], 0, RESOURCE_LIMIT);
    }
    state.resources.materials = Math.max(0, state.resources.materials - industry.inputs.materials);
    state.resources.ore = Math.max(0, state.resources.ore - industry.inputs.ore);
    state.resources.power = Math.max(0, state.resources.power - industry.inputs.power);
    const activeTreaties = state.diplomacy.treaties.filter(t => t.status === "active");
    const taxIncome = Math.floor(state.nation.population / 20);
    const tradeIncome = activeTreaties.filter(t => t.kind === "trade").length * 5;
    let income = clamp(output.credits + taxIncome + tradeIncome, 0, RESOURCE_LIMIT);
    if (worldEventActiveThisTurn(state, "financial_crisis")) income = Math.floor(income * 0.75);
    state.resources.science = clamp(state.resources.science + activeTreaties.filter(t => t.kind === "research").length * 2, 0, RESOURCE_LIMIT);
    state.resources.influence = clamp(state.resources.influence + activeTreaties.filter(t => t.kind === "alliance").length + creator.influence, 0, RESOURCE_LIMIT);
    const wageExpense = Math.ceil(employed / 10 * (worldEventActiveThisTurn(state, "financial_crisis") ? 1.15 : 1) * (hasTech(state, "urbanism") ? 0.9 : 1));
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
    let foodNeed = Math.ceil(state.nation.population / (12 + Math.min(8, output.logistics)));
    if (state.world.activeEvents.some(event => event.key === "food_shortage" && event.status === "active" && event.choiceId === "ration" && (event.remainingTurns > 0 || event.lastAppliedTurn === state.turn))) foodNeed = Math.ceil(foodNeed * 0.75);
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
        const populationCap = Math.min(RESOURCE_LIMIT, 250 + (state.buildings.housing || 0) * 50 + (hasTech(state, "medicine") ? 100 : 0) + creator.capacity);
        state.nation.population = Math.min(populationCap, state.nation.population + 2 + (hasTech(state, "medicine") ? 1 : 0) + Math.floor((state.buildings.housing || 0) / 2));
      }
    }
    if (jobs < Math.ceil(state.nation.population / 10)) state.nation.stability = Math.max(0, state.nation.stability - 1);
    if (phase === "recession") state.nation.stability = Math.max(0, state.nation.stability - 2);
    else if (phase === "recovery") state.nation.stability = Math.min(100, state.nation.stability + 1);
    state.nation.stability = Math.min(100, state.nation.stability + creator.stability);
    if (state.resources.power < state.nation.population / 10) state.nation.stability = Math.max(0, state.nation.stability - 2);
    const royaltiesBeforeRivals = state.creatorEconomy.lastTurnRoyalties;
    developRivals(state, flow);
    const creatorRoyalties = state.creatorEconomy.lastTurnRoyalties - royaltiesBeforeRivals;
    if (creatorRoyalties > 0) {
      state.economy.lastIncome = Math.min(RESOURCE_LIMIT, state.economy.lastIncome + creatorRoyalties);
      state.economy.lastBalance = Math.min(RESOURCE_LIMIT, state.economy.lastBalance + creatorRoyalties);
    }
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
    if (nextRandom(state) < 0.22 && !state.world.activeEvents.some(event => event.status === "pending")) {
      const eventKeys = Object.keys(WORLD_EVENT_CATALOG);
      createWorldEvent(state, eventKeys[Math.floor(nextRandom(state) * eventKeys.length)], flow);
    }
    updateMarket(state, flow);
    state.world.activeEvents = state.world.activeEvents.filter(event => event.status === "pending" || event.remainingTurns > 0);
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
    SAVE_VERSION, RESOURCE_LIMIT, BUILDINGS, TECHNOLOGIES, CAMPAIGNS, CREATOR_EFFECTS, CREATOR_COMMISSION_COST, MAX_COMMISSIONED_CREATIONS,
    MAX_CREATOR_PUBLICATIONS, MAX_CREATOR_ROYALTY_PER_USE,
    createInitialState, validateSave, migrateSave, productionFor, build, trade,
    research, sendGift, offerTreaty, declareConflict, makePeace, registerCreation, commissionCreation, withdrawCreation, creatorEffects, creatorEffectFor,
    creatorProgress, creatorProfiles, creatorDemand,
    deleteCreation, advanceTurn, resolveWorldEvent, worldEventInfo, campaignObjectiveValue,
    exportSave, saveWithRecovery, economicSnapshot, workforceFor, addEvent, hasTech
  };
});
