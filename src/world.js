(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KingmakerWorld = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const WIDTH = 24, HEIGHT = 14;
  const TERRAIN = ["ocean", "coast", "plains", "forest", "hills", "mountains", "desert", "tundra"];
  const RESOURCE_BY_TERRAIN = {
    ocean: ["fish", "salt"], coast: ["fish", "salt", "trade"], plains: ["grain", "livestock"],
    forest: ["timber", "game"], hills: ["stone", "copper", "iron"], mountains: ["iron", "gold", "stone"],
    desert: ["oil", "salt"], tundra: ["fur", "iron"]
  };
  const NAMES = ["Aster", "Boreal", "Cindervale", "Dawnreach", "Everdell", "Frostholm", "Goldhaven", "Highmere",
    "Ironwood", "Juniper", "Kingsfall", "Larkspur", "Mooncrest", "Northpass", "Oakheart", "Pinewatch",
    "Queensport", "Redwater", "Stonehaven", "Thornfield", "Umber", "Valewick", "Westmarch", "Yarrow"];
  const NATIONS = [
    { id: "player", name: "Your Nation", color: "#d8ad62" },
    { id: "aurelia", name: "Aurelia", color: "#69c9a2" },
    { id: "northreach", name: "Northreach", color: "#78a9e8" },
    { id: "meridian", name: "Meridian", color: "#b18de0" },
    { id: "solenne", name: "Solenne", color: "#d98b73" },
    { id: "ironmarch", name: "Ironmarch", color: "#df777d" },
    { id: "duneward", name: "Duneward", color: "#c9bd73" },
    { id: "free_territories", name: "Free Territories", color: "#8b9aab" }
  ];

  function random(seed) {
    let value = (seed >>> 0) || 1;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function spherical(x, y) {
    const longitude = (x / WIDTH) * Math.PI * 2 - Math.PI;
    const latitude = (0.5 - y / (HEIGHT - 1)) * Math.PI * 0.88;
    const cos = Math.cos(latitude);
    return { x: cos * Math.cos(longitude), y: Math.sin(latitude), z: cos * Math.sin(longitude) };
  }
  function generate(seed) {
    const rng = random(seed), seedValue = (Number(seed) >>> 0) || 1;
    const tiles = [];
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      const wave = Math.sin(x * 0.39 + seedValue * 0.0001) + Math.cos(y * 0.53 - seedValue * 0.00013)
        + Math.sin((x + y) * 0.19);
      const noise = (rng() - 0.5) * 1.45;
      const elevation = Math.max(-1, Math.min(1, (wave + noise) / 3.4));
      const latitude = Math.abs((y / (HEIGHT - 1)) * 2 - 1);
      let terrain = elevation < -0.22 ? "ocean" : elevation < -0.08 ? "coast"
        : elevation > 0.56 ? "mountains" : elevation > 0.34 ? "hills"
        : latitude > 0.78 ? "tundra" : elevation < 0.02 && latitude < 0.58 ? "desert"
        : rng() > 0.55 ? "forest" : "plains";
      const id = y * WIDTH + x;
      tiles.push({ id, x, y, terrain, elevation: Number(elevation.toFixed(3)), climate: latitude > 0.78 ? "polar" : latitude < 0.28 ? "warm" : "temperate",
        resource: RESOURCE_BY_TERRAIN[terrain][Math.floor(rng() * RESOURCE_BY_TERRAIN[terrain].length)],
        position3d: spherical(x, y), nationId: null, cityId: null });
    }
    const land = tiles.filter(t => t.terrain !== "ocean");
    const capitals = [];
    const used = new Set();
    for (let i = 0; i < NATIONS.length; i++) {
      const ideal = Math.floor((i + 0.5) * land.length / NATIONS.length);
      let chosen = land[Math.min(land.length - 1, ideal)];
      let best = -Infinity;
      for (let attempt = 0; attempt < land.length; attempt++) {
        const candidate = land[(ideal + attempt * 7) % land.length];
        if (used.has(candidate.id)) continue;
        const separation = capitals.length ? Math.min(...capitals.map(c => Math.hypot(c.x - candidate.x, c.y - candidate.y))) : 99;
        const score = separation - Math.abs(candidate.elevation - 0.18) * 0.35 + rng() * 0.2;
        if (score > best) { best = score; chosen = candidate; }
      }
      used.add(chosen.id);
      capitals.push({ nationId: NATIONS[i].id, tileId: chosen.id, x: chosen.x, y: chosen.y });
    }
    function nearestCapital(tile) {
      let best = capitals[0], distance = Infinity;
      for (const capital of capitals) {
        const d = Math.hypot(tile.x - capital.x, (tile.y - capital.y) * 1.25);
        if (d < distance) { distance = d; best = capital; }
      }
      return best;
    }
    for (const tile of land) tile.nationId = nearestCapital(tile).nationId;
    const cities = [];
    const nationCounts = Object.fromEntries(NATIONS.map(n => [n.id, 0]));
    for (const capital of capitals) {
      const tile = tiles[capital.tileId];
      const city = { id: "city-" + capital.nationId + "-capital", name: NAMES[(hash(String(seedValue) + capital.nationId) % NAMES.length)],
        nationId: capital.nationId, tileId: tile.id, population: 24000 + Math.floor(rng() * 90000), tier: "capital" };
      cities.push(city); tile.cityId = city.id; nationCounts[capital.nationId]++;
    }
    for (const nation of NATIONS) {
      const territory = land.filter(t => t.nationId === nation.id && !t.cityId);
      const count = nation.id === "free_territories" ? 1 : 2;
      for (let c = 0; c < count && territory.length; c++) {
        const tile = territory[Math.floor(rng() * territory.length)];
        const city = { id: "city-" + nation.id + "-" + c, name: NAMES[Math.floor(rng() * NAMES.length)],
          nationId: nation.id, tileId: tile.id, population: 6000 + Math.floor(rng() * 36000), tier: "city" };
        cities.push(city); tile.cityId = city.id; nationCounts[nation.id]++;
      }
    }
    const regions = tiles.map(tile => ({ id: "region-" + tile.id, tileId: tile.id, nationId: tile.nationId,
      terrain: tile.terrain, resource: tile.resource, cityId: tile.cityId }));
    const neighbors = [];
    for (const tile of tiles) {
      if (tile.x + 1 < WIDTH) neighbors.push([tile.id, tile.id + 1]);
      if (tile.y + 1 < HEIGHT) neighbors.push([tile.id, tile.id + WIDTH]);
    }
    const deposits = tiles.filter(t => t.terrain !== "ocean" && ["iron", "copper", "gold", "oil"].includes(t.resource))
      .map(t => ({ id: "deposit-" + t.id, tileId: t.id, nationId: t.nationId, resource: t.resource,
        richness: 1 + Math.floor(rng() * 5), discovered: false }));
    return { generatorVersion: 1, seed: seedValue, dimensions: { width: WIDTH, height: HEIGHT },
      nations: NATIONS.map(n => ({ ...n, capitalTileId: capitals.find(c => c.nationId === n.id).tileId, cityCount: nationCounts[n.id] })),
      tiles, regions, cities, deposits, neighbors };
  }
  function validate(world) {
    if (!world || world.generatorVersion !== 1 || !Array.isArray(world.tiles) || world.tiles.length !== WIDTH * HEIGHT)
      throw new Error("Invalid generated world.");
    const ids = new Set(world.tiles.map(t => t.id));
    if (ids.size !== world.tiles.length || world.tiles.some(t => !TERRAIN.includes(t.terrain) || !t.position3d ||
      !Number.isFinite(t.position3d.x) || !Number.isFinite(t.position3d.y) || !Number.isFinite(t.position3d.z)))
      throw new Error("Generated world contains invalid terrain or coordinates.");
    if (world.cities.some(c => !ids.has(c.tileId) || !world.nations.some(n => n.id === c.nationId)))
      throw new Error("Generated city references an unknown tile or nation.");
    return world;
  }
  return { WIDTH, HEIGHT, TERRAIN, generate, validate };
});
