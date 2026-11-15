"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createChainOwnership } = require("../src/chain-ownership.js");

const wallet = "0x1111111111111111111111111111111111111111";
const contract = "0x2222222222222222222222222222222222222222";
function mockFetch({ chain = "0x89", code = "0x60006000", balance = "0x1" } = {}) {
  const calls = [];
  const fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    let result;
    if (body.method === "eth_chainId") result = chain;
    else if (body.method === "eth_getCode") result = code;
    else if (body.method === "eth_call") result = balance;
    else throw new Error("Unexpected RPC method");
    return { ok: true, json: async () => ({ jsonrpc: "2.0", id: body.id, result }) };
  };
  return { fetch, calls };
}

test("server verifies positive ERC-1155 balance against configured chain and contract", async () => {
  const mock = mockFetch();
  const ownership = createChainOwnership({
    rpcUrl: "https://rpc.example", contractAddress: contract, chainId: "137",
    assetTokenIds: { "founder-banner": "1" }, fetch: mock.fetch
  });
  const result = await ownership.verifyOwnership(wallet, "founder-banner", "137");
  assert.equal(result.balance, "1");
  assert.equal(result.tokenId, "1");
  assert.equal(mock.calls.map(call => call.method).join(","), "eth_chainId,eth_getCode,eth_call");
  assert.match(mock.calls[2].params[0].data, /^0x00fdd58e/);
});

test("server rejects wallets without an on-chain balance", async () => {
  const mock = mockFetch({ balance: "0x0" });
  const ownership = createChainOwnership({
    rpcUrl: "https://rpc.example", contractAddress: contract, chainId: "137",
    assetTokenIds: { "founder-banner": "1" }, fetch: mock.fetch
  });
  await assert.rejects(ownership.verifyOwnership(wallet, "founder-banner", "137"), /does not own/);
});

test("server rejects wrong wallet network, unknown assets, and mismatched RPC", async () => {
  const mock = mockFetch({ chain: "0x1" });
  const ownership = createChainOwnership({
    rpcUrl: "https://rpc.example", contractAddress: contract, chainId: "137",
    assetTokenIds: { "founder-banner": "1" }, fetch: mock.fetch
  });
  await assert.rejects(ownership.verifyOwnership(wallet, "founder-banner", "1"), /different network/);
  await assert.rejects(ownership.verifyOwnership(wallet, "unknown", "137"), /no verified on-chain token ID/);
  await assert.rejects(ownership.verifyOwnership(wallet, "founder-banner", "137"), /RPC network does not match/);
});

test("server fails closed when contract is not deployed or configuration is missing", async () => {
  const mock = mockFetch({ code: "0x" });
  const ownership = createChainOwnership({
    rpcUrl: "https://rpc.example", contractAddress: contract, chainId: "137",
    assetTokenIds: { "founder-banner": "1" }, fetch: mock.fetch
  });
  await assert.rejects(ownership.verifyOwnership(wallet, "founder-banner", "137"), /No deployed contract code/);
  const unconfigured = createChainOwnership({ fetch: mock.fetch });
  await assert.rejects(unconfigured.verifyOwnership(wallet, "founder-banner", "137"), /KINGMAKER_RPC_URL/);
});
