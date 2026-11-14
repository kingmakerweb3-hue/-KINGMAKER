const test = require("node:test");
const assert = require("node:assert/strict");
const World = require("../src/world.js");

test("procedural world generation is deterministic for a campaign seed", () => {
  const a = World.generate(48291), b = World.generate(48291);
  assert.deepEqual(a, b);
  assert.equal(World.validate(a), a);
});

test("world contains a connected tile grid, spherical coordinates, nations and settlements", () => {
  const world = World.generate(7);
  assert.equal(world.tiles.length, World.WIDTH * World.HEIGHT);
  assert.equal(world.regions.length, world.tiles.length);
  assert.equal(world.neighbors.length, World.HEIGHT * (World.WIDTH - 1) + World.WIDTH * (World.HEIGHT - 1));
  assert.equal(world.nations.length, 8);
  assert.ok(world.cities.length >= 20);
  assert.ok(world.tiles.some(t => t.terrain === "ocean"));
  assert.ok(world.tiles.some(t => t.terrain !== "ocean"));
  for (const tile of world.tiles) {
    const length = Math.hypot(tile.position3d.x, tile.position3d.y, tile.position3d.z);
    assert.ok(Math.abs(length - 1) < 1e-9);
    if (tile.terrain !== "ocean") assert.ok(world.nations.some(n => n.id === tile.nationId));
  }
});

test("different seeds produce different geography while preserving valid world structure", () => {
  const a = World.generate(101), b = World.generate(102);
  assert.notDeepEqual(a.tiles.map(t => t.terrain), b.tiles.map(t => t.terrain));
  assert.doesNotThrow(() => World.validate(a));
  assert.doesNotThrow(() => World.validate(b));
});

test("world validator rejects malformed tile data", () => {
  const world = World.generate(9);
  world.tiles[0].position3d.x = NaN;
  assert.throws(() => World.validate(world), /invalid terrain or coordinates/);
});
