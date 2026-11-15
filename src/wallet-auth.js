"use strict";

const crypto = require("node:crypto");
const { getAddress, verifyMessage } = require("ethers");

function createWalletAuth(options = {}) {
  const now = options.now || (() => Date.now());
  const challengeTtlMs = options.challengeTtlMs || 5 * 60 * 1000;
  const sessionTtlMs = options.sessionTtlMs || 12 * 60 * 60 * 1000;
  const challenges = new Map();
  const sessions = new Map();

  function normalizeAddress(value) {
    try { return getAddress(String(value || "")).toLowerCase(); }
    catch { throw Object.assign(new Error("A valid wallet address is required."), { statusCode: 400 }); }
  }
  function issueChallenge(address, chainId, origin) {
    const account = normalizeAddress(address);
    let chain;
    try { chain = BigInt(chainId); } catch { chain = 0n; }
    if (chain <= 0n || chain > 0xffffffffn) throw Object.assign(new Error("A valid wallet chain ID is required."), { statusCode: 400 });
    let parsedOrigin;
    try { parsedOrigin = new URL(origin); } catch { throw Object.assign(new Error("A valid application origin is required."), { statusCode: 400 }); }
    if (!["http:", "https:"].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) throw Object.assign(new Error("Invalid application origin."), { statusCode: 400 });
    for (const [key, value] of challenges) if (value.expiresAt <= now()) challenges.delete(key);
    if (challenges.size >= 5000) throw Object.assign(new Error("Too many pending wallet sign-ins. Try again shortly."), { statusCode: 429 });
    const nonce = crypto.randomBytes(16).toString("hex");
    const issuedAt = new Date(now()).toISOString();
    const expiresAt = now() + challengeTtlMs;
    const message = [
      "KINGMAKER Wallet Sign-In",
      "",
      "Sign this message to prove control of your wallet. This does not approve a transaction.",
      "",
      "Domain: " + parsedOrigin.host,
      "Address: " + account,
      "Chain ID: " + chain.toString(),
      "Nonce: " + nonce,
      "Issued At: " + issuedAt,
      "Expiration Time: " + new Date(expiresAt).toISOString()
    ].join("\n");
    challenges.set(nonce, { account, chainId: chain.toString(), origin, message, expiresAt });
    return { message, nonce, expiresAt: new Date(expiresAt).toISOString() };
  }
  function verifyChallenge(input, origin) {
    const nonce = String(input?.nonce || "");
    const challenge = challenges.get(nonce);
    challenges.delete(nonce);
    if (!challenge || challenge.expiresAt <= now()) throw Object.assign(new Error("Sign-in challenge is missing, expired, or already used."), { statusCode: 401 });
    if (challenge.origin !== origin) throw Object.assign(new Error("Sign-in origin does not match the challenge."), { statusCode: 403 });
    const address = normalizeAddress(input?.address);
    if (address !== challenge.account || input?.message !== challenge.message) throw Object.assign(new Error("Wallet sign-in details do not match the challenge."), { statusCode: 401 });
    let recovered;
    try { recovered = verifyMessage(challenge.message, String(input?.signature || "")).toLowerCase(); }
    catch { throw Object.assign(new Error("Wallet signature is invalid."), { statusCode: 401 }); }
    if (recovered !== challenge.account) throw Object.assign(new Error("Wallet signature does not match the address."), { statusCode: 401 });
    for (const [key, value] of sessions) if (value.expiresAt <= now()) sessions.delete(key);
    if (sessions.size >= 10000) throw Object.assign(new Error("Session capacity reached. Try again later."), { statusCode: 503 });
    const token = crypto.randomBytes(32).toString("hex");
    const session = { address: challenge.account, chainId: challenge.chainId, expiresAt: now() + sessionTtlMs };
    sessions.set(token, session);
    return { token, session: { address: session.address, chainId: session.chainId, expiresAt: new Date(session.expiresAt).toISOString() } };
  }
  function getSession(token) {
    const session = sessions.get(String(token || ""));
    if (!session) return null;
    if (session.expiresAt <= now()) { sessions.delete(String(token)); return null; }
    return { address: session.address, chainId: session.chainId, expiresAt: new Date(session.expiresAt).toISOString() };
  }
  function revoke(token) { sessions.delete(String(token || "")); }
  return Object.freeze({ issueChallenge, verifyChallenge, getSession, revoke });
}

module.exports = { createWalletAuth };
