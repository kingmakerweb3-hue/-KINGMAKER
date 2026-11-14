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
    assert.ok(region.cities.every(city => city.name && city.population > 0 && Number.isFinite(city.latitude) && Math.abs(city.latitude) <= 80 && Number.isFinite(city.longitude) && Math.abs(city.longitude) <= 180));
    assert.equal(new Set(region.cities.map(city => city.id)).size, region.cities.length);
    assert.ok(Number.isFinite(region.latitude) && Number.isFinite(region.longitude));
    assert.equal(region.resources.length, 3);
    assert.equal(new Set(region.resources).size, 3);
  }
});

test("generated cities have stable unique IDs and globe-safe coordinates", () => {
  const world=World.generate(99);
  const ids=world.regions.flatMap(region=>region.cities.map(city=>city.id));
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(world.regions.every(region=>region.cities.every(city=>city.latitude>=-80&&city.latitude<=80&&city.longitude>=-180&&city.longitude<=180)));
});

test("different seeds produce different world populations", () => {
  assert.notDeepEqual(World.generate(1).regions, World.generate(2).regions);
});


test("regions contain spatially placed resource deposits and settlements within their Voronoi borders", () => {
  const world = World.generate(481516);
  for (const region of world.regions) {
    assert.equal(region.resourceNodes.length, 3);
    for (const node of region.resourceNodes) {
      assert.ok(node.id && node.resource && node.quantity >= 40 && node.quantity <= 199);
      assert.equal(World.regionAt(world, node.latitude, node.longitude).id, region.id);
    }
    for (const city of region.cities) {
      assert.equal(World.regionAt(world, city.latitude, city.longitude).id, region.id);
    }
  }
});

test("spherical region borders produce finite line vertices", () => {
  const borders = World.buildBorders(World.generate(481516));
  assert.ok(borders.length > 100);
  assert.equal(borders.length % 6, 0);
  assert.ok(Array.from(borders).every(Number.isFinite));
});
