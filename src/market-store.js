"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const economy = require("./asset-economy.js");

function createMarketplaceStore(options = {}) {
  const filePath = options.filePath || path.resolve(process.cwd(), "data", "marketplace.json");
  let queue = Promise.resolve();

  async function readAll() {
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
      return Array.isArray(parsed.listings) ? parsed.listings : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw new Error("Marketplace storage is unreadable.");
    }
  }

  async function persist(listings) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temp = filePath + "." + process.pid + ".tmp";
    await fs.writeFile(temp, JSON.stringify({ version: 1, listings }, null, 2), { mode: 0o600 });
    await fs.rename(temp, filePath);
  }

  function serialize(operation) {
    const result = queue.then(operation, operation);
    queue = result.catch(() => {});
    return result;
  }

  return Object.freeze({
    list() {
      return serialize(async () => (await readAll()).filter(item => item.status === "ACTIVE"));
    },
    create(input) {
      return serialize(async () => {
        const seller = economy.normalizeAccount(input?.seller);
        const listings = await readAll();
        const activeDuplicate = listings.some(item => item.status === "ACTIVE" && item.seller === seller && item.assetId === input.assetId);
        if (activeDuplicate) throw Object.assign(new Error("You already have an active listing for this asset."), { statusCode: 409 });
        const validated = economy.validateListing({ ...input, seller, id: "listing-" + crypto.randomUUID() }, 0);
        const listing = Object.freeze({ ...validated, createdAt: new Date().toISOString() });
        listings.push(listing);
        await persist(listings);
        return listing;
      });
    },
    cancel(id, sellerAddress) {
      return serialize(async () => {
        const seller = economy.normalizeAccount(sellerAddress);
        const listings = await readAll();
        const index = listings.findIndex(item => item.id === id);
        if (index < 0) throw Object.assign(new Error("Listing not found."), { statusCode: 404 });
        if (listings[index].seller !== seller) throw Object.assign(new Error("Seller address does not match listing."), { statusCode: 403 });
        if (listings[index].status !== "ACTIVE") throw Object.assign(new Error("Listing is not active."), { statusCode: 409 });
        listings[index] = economy.closeListing(listings[index], "CANCELLED", 0);
        await persist(listings);
        return listings[index];
      });
    }
  });
}

module.exports = { createMarketplaceStore };
