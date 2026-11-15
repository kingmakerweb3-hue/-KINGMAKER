"use strict";

const BALANCE_OF_SELECTOR = "00fdd58e";

function createChainOwnership(options = {}) {
  const rpcUrl = options.rpcUrl ?? process.env.KINGMAKER_RPC_URL ?? "";
  const contractAddress = options.contractAddress ?? process.env.KINGMAKER_ASSET_CONTRACT ?? "";
  const chainId = String(options.chainId ?? process.env.KINGMAKER_CHAIN_ID ?? "");
  const assetTokenIds = options.assetTokenIds ?? (() => {
    try { return JSON.parse(process.env.KINGMAKER_ASSET_TOKEN_IDS || "{}"); }
    catch { return {}; }
  })();
  const fetchImpl = options.fetch || globalThis.fetch;

  function configError(message) {
    return Object.assign(new Error(message), { statusCode: 503 });
  }
  function validateConfig() {
    if (!rpcUrl || !/^https?:\/\//i.test(rpcUrl)) throw configError("Server-side chain verification is not configured. Set KINGMAKER_RPC_URL.");
    if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) throw configError("A valid KINGMAKER_ASSET_CONTRACT address is required.");
    if (!/^[0-9]+$/.test(chainId) || BigInt(chainId) <= 0n) throw configError("A valid KINGMAKER_CHAIN_ID is required.");
    if (!assetTokenIds || typeof assetTokenIds !== "object" || Array.isArray(assetTokenIds)) throw configError("KINGMAKER_ASSET_TOKEN_IDS must be a JSON object.");
    if (typeof fetchImpl !== "function") throw configError("This Node.js runtime does not provide fetch.");
  }
  async function rpc(method, params) {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw configError("Configured blockchain RPC is unavailable.");
    const payload = await response.json();
    if (payload.error || payload.id !== 1 || !("result" in payload)) throw configError("Blockchain RPC returned an invalid response.");
    return payload.result;
  }
  async function verifyOwnership(walletAddress, assetId, authenticatedChainId) {
    validateConfig();
    if (String(BigInt(authenticatedChainId)) !== chainId) {
      throw Object.assign(new Error("Your signed-in wallet is connected to a different network than the KINGMAKER asset contract."), { statusCode: 409 });
    }
    const tokenId = assetTokenIds[assetId];
    if (tokenId === undefined || !/^[0-9]+$/.test(String(tokenId))) {
      throw Object.assign(new Error("This asset has no verified on-chain token ID configured."), { statusCode: 409 });
    }
    const rpcChainId = BigInt(await rpc("eth_chainId", []));
    if (rpcChainId !== BigInt(chainId)) throw configError("Configured RPC network does not match KINGMAKER_CHAIN_ID.");
    const code = await rpc("eth_getCode", [contractAddress, "latest"]);
    if (typeof code !== "string" || code === "0x") throw configError("No deployed contract code exists at the configured asset contract address.");
    const owner = String(walletAddress).toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(owner)) throw Object.assign(new Error("Invalid authenticated wallet address."), { statusCode: 400 });
    const data = "0x" + BALANCE_OF_SELECTOR + owner.slice(2).padStart(64, "0") + BigInt(tokenId).toString(16).padStart(64, "0");
    const raw = await rpc("eth_call", [{ to: contractAddress, data }, "latest"]);
    if (typeof raw !== "string" || !/^0x[0-9a-fA-F]{64,}$/.test(raw)) throw configError("The asset contract returned an invalid balance response.");
    const balance = BigInt(raw);
    if (balance <= 0n) throw Object.assign(new Error("Your connected wallet does not own this on-chain asset."), { statusCode: 403 });
    return Object.freeze({ wallet: owner, assetId, tokenId: String(tokenId), balance: balance.toString(), chainId });
  }
  return Object.freeze({ verifyOwnership });
}

module.exports = { createChainOwnership };
