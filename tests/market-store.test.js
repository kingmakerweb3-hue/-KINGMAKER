"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createMarketplaceStore } = require("../src/market-store.js");

const seller = "0x1111111111111111111111111111111111111111";
const buyer = "0x2222222222222222222222222222222222222222";

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kingmaker-market-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return { store: createMarketplaceStore({ filePath: path.join(dir, "market.json") }), file: path.join(dir, "market.json") };
}

test("market listings persist across store instances", async t => {
  const { store, file } = await fixture(t);
  const listing = await store.create({ assetId: "founder-banner", seller, price: 250, durationTurns: 10 });
  assert.match(listing.id, /^listing-/);
  const restarted = createMarketplaceStore({ filePath: file });
  assert.equal((await restarted.list()).length, 1);
});

test("rejects duplicate active listings for the same seller and asset", async t => {
  const { store } = await fixture(t);
  await store.create({ assetId: "founder-banner", seller, price: 100, durationTurns: 5 });
  await assert.rejects(store.create({ assetId: "founder-banner", seller, price: 200, durationTurns: 5 }), /already have an active listing/);
});

test("seller can cancel; a different address cannot", async t => {
  const { store } = await fixture(t);
  const listing = await store.create({ assetId: "royal-blueprint", seller, price: 500, durationTurns: 5 });
  await assert.rejects(store.cancel(listing.id, buyer), /does not match/);
  const cancelled = await store.cancel(listing.id, seller);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal((await store.list()).length, 0);
});

test("validates listing input before persistence", async t => {
  const { store } = await fixture(t);
  await assert.rejects(store.create({ assetId: "not-real", seller, price: 1, durationTurns: 1 }));
  await assert.rejects(store.create({ assetId: "frontier-surveyor", seller, price: -5, durationTurns: 1 }));
  assert.equal((await store.list()).length, 0);
});
