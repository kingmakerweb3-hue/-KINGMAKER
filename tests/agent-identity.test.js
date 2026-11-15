"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createServer } = require("../src/server.js");
const { createAgentIdentityService } = require("../src/agent-identity.js");

function makeKeyPair() {
  return crypto.generateKeyPairSync("ed25519");
}

function signChallenge(challenge, privateKey) {
  return crypto.sign(null, Buffer.from(challenge.signingMessage), privateKey).toString("base64url");
}

test("agent identity enrollment requires proof of Ed25519 private-key possession", async () => {
  const service = createAgentIdentityService();
  const { publicKey, privateKey } = makeKeyPair();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const challenge = service.issueChallenge({ publicKeyPem });

  assert.equal(typeof challenge.challengeId, "string");
  assert.equal(typeof challenge.challenge, "string");
  assert.match(challenge.signingMessage, /^KINGMAKER_AGENT_ENROLLMENT_V1\n/);

  const agent = service.completeEnrollment({
    challengeId: challenge.challengeId,
    signature: signChallenge(challenge, privateKey),
    displayName: "Civic Advisor",
    operatorName: "Test Operator",
    operatorContact: "operator@example.test"
  });

  assert.match(agent.id, /^agent_[a-f0-9]{24}$/);
  assert.equal(agent.status, "registered-untrusted");
  assert.deepEqual(agent.permissions, ["read:manifest", "read:status"]);
  assert.equal(agent.operator.verified, false);
  assert.equal(service.registeredCount, 1);
  assert.throws(
    () => service.completeEnrollment({
      challengeId: challenge.challengeId,
      signature: signChallenge(challenge, privateKey),
      displayName: "Replay",
      operatorName: "Test Operator",
      operatorContact: "operator@example.test"
    }),
    error => error.statusCode === 410
  );
});

test("agent identity enrollment rejects invalid keys, signatures and reused challenges", () => {
  const service = createAgentIdentityService();
  assert.throws(
    () => service.issueChallenge({ publicKeyPem: "not a public key" }),
    error => error.statusCode === 400
  );

  const { publicKey, privateKey } = makeKeyPair();
  const challenge = service.issueChallenge({
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" })
  });
  const other = makeKeyPair();
  assert.throws(
    () => service.completeEnrollment({
      challengeId: challenge.challengeId,
      signature: signChallenge(challenge, other.privateKey),
      displayName: "Wrong signer",
      operatorName: "Test Operator",
      operatorContact: "operator@example.test"
    }),
    error => error.statusCode === 401
  );
  assert.throws(
    () => service.completeEnrollment({
      challengeId: challenge.challengeId,
      signature: signChallenge(challenge, privateKey),
      displayName: "Retry",
      operatorName: "Test Operator",
      operatorContact: "operator@example.test"
    }),
    error => error.statusCode === 410
  );
});

test("HTTP agent enrollment returns read-only untrusted registration and rejects malformed requests", async t => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = "http://127.0.0.1:" + server.address().port;
  const { publicKey, privateKey } = makeKeyPair();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });

  const wrongType = await fetch(base + "/api/agent/v1/enrollment/challenge", {
    method: "POST",
    body: JSON.stringify({ publicKeyPem })
  });
  assert.equal(wrongType.status, 415);

  const challengeResponse = await fetch(base + "/api/agent/v1/enrollment/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ publicKeyPem })
  });
  assert.equal(challengeResponse.status, 201);
  assert.equal(challengeResponse.headers.get("cache-control"), "no-store");
  const challenge = await challengeResponse.json();

  const enrollmentResponse = await fetch(base + "/api/agent/v1/enrollment/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      signature: signChallenge(challenge, privateKey),
      displayName: "Island Planner",
      operatorName: "KINGMAKER test operator",
      operatorContact: "operator@example.test"
    })
  });
  assert.equal(enrollmentResponse.status, 201);
  const enrolled = await enrollmentResponse.json();
  assert.equal(enrolled.status, "registered-untrusted");
  assert.deepEqual(enrolled.permissions, ["read:manifest", "read:status"]);
  assert.equal(enrolled.operator.verified, false);
  assert.equal(Object.hasOwn(enrolled, "token"), false);

  const manifest = await (await fetch(base + "/api/agent/v1/manifest")).json();
  assert.equal(manifest.connection.writesEnabled, false);
  assert.deepEqual(manifest.actions, []);
});

test("HTTP agent enrollment rate-limits repeated challenge requests", async t => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = "http://127.0.0.1:" + server.address().port;
  const { publicKey } = makeKeyPair();
  const body = JSON.stringify({
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" })
  });

  for (let index = 0; index < 10; index += 1) {
    const response = await fetch(base + "/api/agent/v1/enrollment/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    });
    assert.equal(response.status, 201);
  }

  const limited = await fetch(base + "/api/agent/v1/enrollment/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body
  });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
});
