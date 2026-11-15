"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const economy = require("../src/asset-economy.js");

const seller = "0x1111111111111111111111111111111111111111";
const buyer = "0x2222222222222222222222222222222222222222";

test("catalog has stable unique asset identifiers", () => {
  const ids = economy.ASSETS.map(asset => asset.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 3);
});

test("creates bounded, explicitly simulated listings", () => {
  const listing = economy.validateListing({ assetId: "founder-banner", seller, price: 250, durationTurns: 12 }, 4);
  assert.equal(listing.seller, seller);
  assert.equal(listing.currency, "GAME_CREDITS");
  assert.equal(listing.expiresTurn, 16);
  assert.equal(listing.settlement, "LOCAL_SIMULATION_ONLY");
});

test("rejects invalid assets, wallet addresses, prices and durations", () => {
  assert.throws(() => economy.validateListing({ assetId: "unknown", seller, price: 1, durationTurns: 1 }));
  assert.throws(() => economy.validateListing({ assetId: "founder-banner", seller: "bad", price: 1, durationTurns: 1 }));
  assert.throws(() => economy.validateListing({ assetId: "founder-banner", seller, price: 0, durationTurns: 1 }));
  assert.throws(() => economy.validateListing({ assetId: "founder-banner", seller, price: 1, durationTurns: 501 }));
});

test("records a simulated trade and prevents self-purchase or expired purchase", () => {
  const listing = economy.validateListing({ assetId: "royal-blueprint", seller, price: 900, durationTurns: 3 }, 8);
  const trade = economy.transferRecord(listing, buyer, 9);
  assert.equal(trade.buyer, buyer);
  assert.equal(trade.status, "SIMULATED");
  assert.equal(trade.settlement, "NO_BLOCKCHAIN_TRANSACTION");
  assert.throws(() => economy.transferRecord(listing, seller, 9), /own listing/);
  assert.throws(() => economy.transferRecord(listing, buyer, 11), /expired/);
});

test("listing lifecycle can only close once with a supported state", () => {
  const listing = economy.validateListing({ assetId: "frontier-surveyor", seller, price: 50, durationTurns: 2 }, 1);
  const closed = economy.closeListing(listing, "CANCELLED", 2);
  assert.equal(closed.status, "CANCELLED");
  assert.throws(() => economy.closeListing(closed, "SOLD", 2));
  assert.throws(() => economy.closeListing(listing, "MAYBE", 2));
});
