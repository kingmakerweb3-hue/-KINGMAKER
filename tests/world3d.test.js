const test = require("node:test");
const assert = require("node:assert/strict");
require("../src/world3d.js");
const World = globalThis.KingmakerWorld3D;

test("procedural world generation is deterministic for a seed", () => {
  assert.deepEqual(World.generate(12345), World.generate(12345));
});

test("procedural world contains bounded regional and nation data", () => {
  const world = World.generate(481516);
  assert.equal(world.version, World.WORLD_VERSION);
  assert.equal(world.regions.length, 12);
  assert.equal(world.nations.length, 8);
  for (const region of world.regions) {
    assert.ok(region.name.length > 0);
    assert.ok(region.population >= 180000 && region.population <= 2380000);
    assert.ok(region.cities.length >= 2 && region.cities.length <= 5);
    assert.ok(region.cities.every(city => city.name && city.population > 0 && Number.isFinite(city.latitude) && Math.abs(city.latitude) <= 80 && Number.isFinite(city.longitude) && Math.abs(city.longitude) <= 180));\n    assert.equal(new Set(region.cities.map(city => city.id)).size, region.cities.length);\n    assert.ok(Number.isFinite(region.latitude) && Number.isFinite(region.longitude));
    assert.equal(region.resources.length, 3);
    assert.equal(new Set(region.resources).size, 3);
  }
});

test("generated cities have stable unique IDs and globe-safe coordinates", () => {\n  const world=World.generate(99);\n  const ids=world.regions.flatMap(region=>region.cities.map(city=>city.id));\n  assert.equal(new Set(ids).size,ids.length);\n  assert.ok(world.regions.every(region=>region.cities.every(city=>city.latitude>=-80&&city.latitude<=80&&city.longitude>=-180&&city.longitude<=180)));\n});\n\ntest("different seeds produce different world populations", () => {
  assert.notDeepEqual(World.generate(1).regions, World.generate(2).regions);
});
