"use strict";

const crypto = require("node:crypto");

function createAgentIdentityService({ now = Date.now, ttlMs = 5 * 60 * 1000, maxPending = 100 } = {}) {
  const challenges = new Map();
  const agents = new Map();

  function pruneExpired() {
    const time = now();
    for (const [id, item] of challenges) {
      if (item.expiresAt <= time) challenges.delete(id);
    }
  }

  function issueChallenge({ publicKeyPem } = {}) {
    pruneExpired();
    if (challenges.size >= maxPending) {
      const error = new Error("Enrollment capacity reached; retry later");
      error.statusCode = 503;
      throw error;
    }
    if (typeof publicKeyPem !== "string" || publicKeyPem.length > 4096) {
      const error = new Error("A valid Ed25519 publicKeyPem is required");
      error.statusCode = 400;
      throw error;
    }

    let publicKey;
    try {
      publicKey = crypto.createPublicKey(publicKeyPem);
    } catch (_) {
      const error = new Error("Invalid public key");
      error.statusCode = 400;
      throw error;
    }
    if (publicKey.asymmetricKeyType !== "ed25519") {
      const error = new Error("Only Ed25519 public keys are supported");
      error.statusCode = 400;
      throw error;
    }

    const challengeId = crypto.randomBytes(18).toString("base64url");
    const challenge = crypto.randomBytes(32).toString("base64url");
    const expiresAt = now() + ttlMs;
    challenges.set(challengeId, { publicKey, challenge, expiresAt });
    return {
      challengeId,
      challenge,
      expiresAt: new Date(expiresAt).toISOString(),
      signingMessage: "KINGMAKER_AGENT_ENROLLMENT_V1\n" + challengeId + "\n" + challenge
    };
  }

  function completeEnrollment({ challengeId, signature, displayName, operatorName, operatorContact } = {}) {
    pruneExpired();
    const pending = challenges.get(challengeId);
    if (!pending) {
      const error = new Error("Enrollment challenge is missing, expired or already used");
      error.statusCode = 410;
      throw error;
    }
    // Consume before verification so a challenge cannot be used for repeated guesses.
    challenges.delete(challengeId);

    for (const [value, label, maxLength] of [
      [displayName, "displayName", 80],
      [operatorName, "operatorName", 80],
      [operatorContact, "operatorContact", 160]
    ]) {
      if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
        const error = new Error(label + " is required and must be at most " + maxLength + " characters");
        error.statusCode = 400;
        throw error;
      }
    }
    if (typeof signature !== "string" || !/^[A-Za-z0-9_-]{80,100}$/.test(signature)) {
      const error = new Error("A valid Ed25519 signature is required");
      error.statusCode = 400;
      throw error;
    }

    const message = Buffer.from(
      "KINGMAKER_AGENT_ENROLLMENT_V1\n" + challengeId + "\n" + pending.challenge,
      "utf8"
    );
    const signatureBytes = Buffer.from(signature, "base64url");
    if (signatureBytes.length !== 64 || !crypto.verify(null, message, pending.publicKey, signatureBytes)) {
      const error = new Error("Enrollment signature verification failed");
      error.statusCode = 401;
      throw error;
    }

    const publicKeyDer = pending.publicKey.export({ type: "spki", format: "der" });
    const fingerprint = crypto.createHash("sha256").update(publicKeyDer).digest("hex");
    const id = "agent_" + fingerprint.slice(0, 24);
    if (agents.has(id)) {
      const error = new Error("This public key is already enrolled");
      error.statusCode = 409;
      throw error;
    }

    const agent = {
      id,
      displayName: displayName.trim(),
      operator: {
        name: operatorName.trim(),
        contact: operatorContact.trim(),
        verified: false
      },
      publicKeyFingerprint: fingerprint,
      status: "registered-untrusted",
      permissions: ["read:manifest", "read:status"],
      createdAt: new Date(now()).toISOString()
    };
    agents.set(id, agent);
    return { ...agent, operator: { ...agent.operator }, permissions: [...agent.permissions] };
  }

  return {
    issueChallenge,
    completeEnrollment,
    get registeredCount() { return agents.size; }
  };
}

module.exports = { createAgentIdentityService };
