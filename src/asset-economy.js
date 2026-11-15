(function (root) {
  "use strict";

  const ASSETS = Object.freeze([
    Object.freeze({ id: "founder-banner", name: "Founder Banner", category: "Identity", rarity: "Rare", description: "A ceremonial banner for your nation's founding.", tradable: true }),
    Object.freeze({ id: "frontier-surveyor", name: "Frontier Surveyor", category: "Land", rarity: "Uncommon", description: "A survey permit concept for future frontier expansion.", tradable: true }),
    Object.freeze({ id: "royal-blueprint", name: "Royal Blueprint", category: "Blueprint", rarity: "Epic", description: "An architectural blueprint concept for your capital.", tradable: true })
  ]);
  const ASSET_BY_ID = new Map(ASSETS.map(asset => [asset.id, asset]));
  const MAX_CREDITS = 1_000_000_000;
  const MAX_LISTING_TURNS = 500;

  function normalizeAccount(account) {
    if (typeof account !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(account)) {
      throw new TypeError("A valid wallet address is required.");
    }
    return account.toLowerCase();
  }

  function validateListing(input, currentTurn = 0) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Listing must be an object.");
    const asset = ASSET_BY_ID.get(input.assetId);
    if (!asset || !asset.tradable) throw new RangeError("This asset is not available for trading.");
    const seller = normalizeAccount(input.seller);
    const price = Number(input.price);
    const duration = Number(input.durationTurns);
    if (!Number.isSafeInteger(price) || price < 1 || price > MAX_CREDITS) {
      throw new RangeError("Price must be between 1 and 1,000,000,000 game credits.");
    }
    if (!Number.isSafeInteger(duration) || duration < 1 || duration > MAX_LISTING_TURNS) {
      throw new RangeError("Listing duration must be between 1 and 500 turns.");
    }
    if (!Number.isSafeInteger(currentTurn) || currentTurn < 0) throw new RangeError("Current turn is invalid.");
    return Object.freeze({
      id: typeof input.id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(input.id) ? input.id : "listing-" + currentTurn + "-" + asset.id,
      assetId: asset.id,
      seller,
      price,
      currency: "GAME_CREDITS",
      createdTurn: currentTurn,
      expiresTurn: currentTurn + duration,
      status: "ACTIVE",
      settlement: "LOCAL_SIMULATION_ONLY"
    });
  }

  function transferRecord(listing, buyer, currentTurn) {
    const normalizedBuyer = normalizeAccount(buyer);
    if (!listing || listing.status !== "ACTIVE") throw new Error("Listing is not active.");
    if (normalizedBuyer === listing.seller) throw new Error("You cannot buy your own listing.");
    if (!Number.isSafeInteger(currentTurn) || currentTurn < listing.createdTurn) throw new RangeError("Turn is invalid.");
    if (currentTurn >= listing.expiresTurn) throw new Error("Listing has expired.");
    return Object.freeze({
      id: "trade-" + listing.id + "-" + currentTurn,
      listingId: listing.id,
      assetId: listing.assetId,
      seller: listing.seller,
      buyer: normalizedBuyer,
      amount: listing.price,
      currency: "GAME_CREDITS",
      turn: currentTurn,
      status: "SIMULATED",
      settlement: "NO_BLOCKCHAIN_TRANSACTION"
    });
  }

  function closeListing(listing, status, currentTurn) {
    if (!listing || listing.status !== "ACTIVE") throw new Error("Listing is not active.");
    if (!["CANCELLED", "SOLD", "EXPIRED"].includes(status)) throw new RangeError("Unsupported listing status.");
    return Object.freeze({ ...listing, status, closedTurn: currentTurn });
  }

  const api = Object.freeze({ ASSETS, normalizeAccount, validateListing, transferRecord, closeListing });
  root.KingmakerAssetEconomy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
