"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Interface } = require("ethers");
const { createMarketplaceIndexer } = require("../src/market-indexer.js");

const contract = "0x2222222222222222222222222222222222222222";
const seller = "0x1111111111111111111111111111111111111111";
const iface = new Interface([
  "event ListingCreated(uint256 indexed listingId,address indexed seller,address indexed assetContract,uint256 tokenId,uint256 amount,uint256 price)"
]);

function rpcFixture() {
  const encoded = iface.encodeEventLog(iface.getEvent("ListingCreated"), [7n, seller, contract, 2n, 3n, 10000000000000000n]);
  const log = {
    address: contract, topics: encoded.topics, data: encoded.data,
    blockNumber: "0xa", blockHash: "0x" + "a".repeat(64),
    transactionHash: "0x" + "b".repeat(64), transactionIndex: "0x0", logIndex: "0x1"
  };
  const methods = [];
  const fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    methods.push(body.method);
    let result;
    if (body.method === "eth_chainId") result = "0x7a69";
    else if (body.method === "eth_blockNumber") result = "0x14";
    else if (body.method === "eth_getLogs") result = [log];
    else throw new Error("Unexpected RPC method " + body.method);
    return { ok: true, json: async () => ({ jsonrpc: "2.0", id: body.id, result }) };
  };
  return { fetch, methods };
}

test("persistent indexer stores decoded confirmed marketplace events and serves pages", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "km-index-"));
  const filePath = path.join(dir, "events.json");
  const mock = rpcFixture();
  const options = {
    rpcUrl: "https://rpc.example", contractAddress: contract, chainId: "31337",
    startBlock: 1, confirmations: 0, filePath, fetch: mock.fetch
  };
  try {
    const indexer = createMarketplaceIndexer(options);
    const result = await indexer.sync();
    assert.deepEqual(result, { configured: true, indexed: 1, lastBlock: 20 });
    const page = await indexer.list(10);
    assert.equal(page.configured, true);
    assert.equal(page.events.length, 1);
    assert.equal(page.events[0].name, "ListingCreated");
    assert.equal(page.events[0].args.listingId, "7");
    assert.equal(page.events[0].args.price, "10000000000000000");
    assert.equal(page.events[0].transactionHash, "0x" + "b".repeat(64));
    const restarted = createMarketplaceIndexer(options);
    assert.equal((await restarted.list(10)).events.length, 1);
    assert.ok(mock.methods.includes("eth_getLogs"));
    assert.ok((await fs.stat(filePath)).size > 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("indexer remains explicitly disabled without deployment configuration", async () => {
  const indexer = createMarketplaceIndexer({ filePath: path.join(os.tmpdir(), "km-unconfigured-events.json") });
  assert.equal(indexer.configured(), false);
  assert.deepEqual(await indexer.sync(), { configured: false, indexed: 0, lastBlock: null });
  assert.deepEqual(await indexer.list(20), { configured: false, events: [], nextCursor: null });
});
