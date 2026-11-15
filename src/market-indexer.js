"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { Interface } = require("ethers");

const EVENT_ABI = [
  "event ListingCreated(uint256 indexed listingId,address indexed seller,address indexed assetContract,uint256 tokenId,uint256 amount,uint256 price)",
  "event ListingCancelled(uint256 indexed listingId)",
  "event AssetPurchased(uint256 indexed listingId,address indexed buyer,address indexed seller,uint256 price)",
  "event ProceedsWithdrawn(address indexed seller,uint256 amount)"
];
const eventInterface = new Interface(EVENT_ABI);
const eventTopics = EVENT_ABI.map(fragment => eventInterface.getEvent(fragment.slice(6, fragment.indexOf("("))).topicHash);

function createMarketplaceIndexer(options = {}) {
  const rpcUrl = options.rpcUrl ?? process.env.KINGMAKER_MARKET_RPC_URL ?? "";
  const contractAddress = options.contractAddress ?? process.env.KINGMAKER_MARKETPLACE_CONTRACT ?? "";
  const chainId = String(options.chainId ?? process.env.KINGMAKER_MARKET_CHAIN_ID ?? "");
  const startBlock = Number(options.startBlock ?? process.env.KINGMAKER_MARKET_START_BLOCK ?? 0);
  const confirmations = Number(options.confirmations ?? process.env.KINGMAKER_MARKET_CONFIRMATIONS ?? 12);
  const maxRange = Number(options.maxRange ?? 2000);
  const filePath = options.filePath ?? path.join(process.cwd(), "data", "market-events.json");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  let state = null;
  let queue = Promise.resolve();

  function configured() {
    return Boolean(rpcUrl && /^0x[0-9a-fA-F]{40}$/.test(contractAddress) && /^[0-9]+$/.test(chainId)
      && Number.isSafeInteger(startBlock) && startBlock >= 0 && Number.isSafeInteger(confirmations) && confirmations >= 0);
  }
  async function load() {
    if (state) return state;
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (!parsed || !Number.isSafeInteger(parsed.lastBlock) || !Array.isArray(parsed.events)) throw new Error("Invalid event index file.");
      state = parsed;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      state = { version: 1, chainId, contractAddress: contractAddress.toLowerCase(), lastBlock: startBlock - 1, events: [] };
    }
    if (state.chainId !== chainId || state.contractAddress !== contractAddress.toLowerCase()) {
      state = { version: 1, chainId, contractAddress: contractAddress.toLowerCase(), lastBlock: startBlock - 1, events: [] };
    }
    return state;
  }
  async function save() {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temp = filePath + "." + process.pid + ".tmp";
    await fs.writeFile(temp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
    await fs.rename(temp, filePath);
  }
  async function rpc(method, params) {
    const response = await fetchImpl(rpcUrl, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error("Marketplace indexer RPC request failed.");
    const payload = await response.json();
    if (payload.id !== 1 || payload.error || !("result" in payload)) throw new Error("Marketplace indexer received an invalid RPC response.");
    return payload.result;
  }
  async function syncOnce() {
    if (!configured()) return { configured: false, indexed: 0, lastBlock: null };
    const current = await load();
    const actualChain = BigInt(await rpc("eth_chainId", []));
    if (actualChain !== BigInt(chainId)) throw new Error("Marketplace indexer RPC chain does not match configured chain.");
    const latest = Number(BigInt(await rpc("eth_blockNumber", [])));
    const target = latest - confirmations;
    if (target < startBlock) return { configured: true, indexed: 0, lastBlock: current.lastBlock };
    // Rewind a small safety window on every pass so short reorganizations are reconciled.
    const rewind = Math.max(startBlock - 1, current.lastBlock - 12);
    if (rewind < current.lastBlock) {
      current.events = current.events.filter(event => event.blockNumber <= rewind);
      current.lastBlock = rewind;
    }
    let indexed = 0;
    while (current.lastBlock < target) {
      const from = current.lastBlock + 1;
      const to = Math.min(target, from + maxRange - 1);
      const logs = await rpc("eth_getLogs", [{
        address: contractAddress,
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + to.toString(16),
        topics: [eventTopics]
      }]);
      if (!Array.isArray(logs)) throw new Error("Marketplace indexer received malformed logs.");
      for (const log of logs) {
        try {
          const parsed = eventInterface.parseLog({ topics: log.topics, data: log.data });
          if (!parsed) continue;
          const args = {};
          parsed.fragment.inputs.forEach((input, index) => {
            if (!input.name) return;
            const value = parsed.args[index];
            args[input.name] = typeof value === "bigint" ? value.toString() : value;
          });
          current.events.push({
            id: log.transactionHash + ":" + Number(BigInt(log.logIndex)),
            name: parsed.name, args, blockNumber: Number(BigInt(log.blockNumber)),
            blockHash: log.blockHash, transactionHash: log.transactionHash,
            transactionIndex: Number(BigInt(log.transactionIndex)), logIndex: Number(BigInt(log.logIndex))
          });
          indexed++;
        } catch { /* Ignore logs that do not match the supported event ABI. */ }
      }
      current.lastBlock = to;
    }
    current.events.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
    current.events = current.events.slice(0, 10000);
    await save();
    return { configured: true, indexed, lastBlock: current.lastBlock };
  }
  function sync() {
    const run = queue.then(syncOnce, syncOnce);
    queue = run.catch(() => {});
    return run;
  }
  async function list(limit = 20, cursor = "") {
    if (!configured()) return { configured: false, events: [], nextCursor: null };
    const current = await load();
    const safeLimit = Math.max(1, Math.min(100, Number.isInteger(limit) ? limit : 20));
    const offset = cursor && /^\d+$/.test(cursor) ? Number(cursor) : 0;
    const events = current.events.slice(offset, offset + safeLimit);
    return { configured: true, lastBlock: current.lastBlock, events, nextCursor: offset + safeLimit < current.events.length ? String(offset + safeLimit) : null };
  }
  return Object.freeze({ configured, sync, list });
}

module.exports = { createMarketplaceIndexer };
