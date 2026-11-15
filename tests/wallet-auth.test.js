"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Wallet } = require("ethers");
const { createWalletAuth } = require("../src/wallet-auth.js");

test("wallet challenge verifies a signature and issues a session", async () => {
  const wallet = Wallet.createRandom();
  const auth = createWalletAuth();
  const origin = "http://127.0.0.1:4173";
  const challenge = auth.issueChallenge(wallet.address, "0x1", origin);
  const signature = await wallet.signMessage(challenge.message);
  const result = auth.verifyChallenge({ address: wallet.address, nonce: challenge.nonce, message: challenge.message, signature }, origin);
  assert.equal(auth.getSession(result.token).address, wallet.address.toLowerCase());
});

test("challenge is single-use and rejects a different signer", async () => {
  const wallet = Wallet.createRandom();
  const other = Wallet.createRandom();
  const auth = createWalletAuth();
  const origin = "https://game.example";
  const challenge = auth.issueChallenge(wallet.address, "1", origin);
  const signature = await other.signMessage(challenge.message);
  assert.throws(() => auth.verifyChallenge({ address: wallet.address, nonce: challenge.nonce, message: challenge.message, signature }, origin), /does not match/);
  assert.throws(() => auth.verifyChallenge({ address: wallet.address, nonce: challenge.nonce, message: challenge.message, signature }, origin), /missing, expired, or already used/);
});

test("challenge is bound to origin and session can be revoked", async () => {
  const wallet = Wallet.createRandom();
  const auth = createWalletAuth();
  const challenge = auth.issueChallenge(wallet.address, "0x89", "https://game.example");
  const signature = await wallet.signMessage(challenge.message);
  assert.throws(() => auth.verifyChallenge({ address: wallet.address, nonce: challenge.nonce, message: challenge.message, signature }, "https://evil.example"), /origin/);
  const next = auth.issueChallenge(wallet.address, "137", "https://game.example");
  const nextSignature = await wallet.signMessage(next.message);
  const result = auth.verifyChallenge({ address: wallet.address, nonce: next.nonce, message: next.message, signature: nextSignature }, "https://game.example");
  auth.revoke(result.token);
  assert.equal(auth.getSession(result.token), null);
});

test("invalid address and chain are rejected", () => {
  const auth = createWalletAuth();
  assert.throws(() => auth.issueChallenge("not-an-address", "1", "http://localhost"), /valid wallet address/);
  assert.throws(() => auth.issueChallenge("0x0000000000000000000000000000000000000001", "0", "http://localhost"), /chain ID/);
});
