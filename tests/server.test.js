"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("../src/server.js");

test("web server serves the game shell and static assets", async t => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

  const base = "http://127.0.0.1:" + server.address().port;
  const page = await fetch(base + "/");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.match(await page.text(), /KINGMAKER/);

  const manifestResponse = await fetch(base + "/api/agent/v1/manifest");
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get("content-type"), /application\/json/);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.game, "KINGMAKER");
  assert.equal(manifest.connection.writesEnabled, false);
  assert.deepEqual(manifest.actions, []);
  assert.equal(manifest.safety.directSaveAccess, false);
  assert.equal(manifestResponse.headers.get("cache-control"), "no-store");
  assert.equal(manifestResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(manifestResponse.headers.get("referrer-policy"), "no-referrer");
  assert.match(manifestResponse.headers.get("content-security-policy"), /default-src 'none'/);

  const manifestHead = await fetch(base + "/api/agent/v1/manifest", { method: "HEAD" });
  assert.equal(manifestHead.status, 200);
  assert.equal(manifestHead.headers.get("content-length"), String(Buffer.byteLength(JSON.stringify(manifest))));
  assert.equal(await manifestHead.text(), "");

  const agentWriteAttempt = await fetch(base + "/api/agent/v1/manifest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "submit_turn_plan" })
  });
  assert.equal(agentWriteAttempt.status, 405);
  assert.equal(agentWriteAttempt.headers.get("allow"), "GET, HEAD");

  const agentStatus = await fetch(base + "/api/agent/v1/status");
  assert.equal(agentStatus.status, 200);
  assert.deepEqual(await agentStatus.json(), {
    game: "KINGMAKER",
    status: "prototype",
    productStage: "local-single-player-prototype",
    agentConnections: 0,
    writesEnabled: false
  });

  const script = await fetch(base + "/src/engine.js");
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type"), /javascript/);
  assert.match(await script.text(), /createInitialState/);

  const head = await fetch(base + "/styles.css", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.ok(Number(head.headers.get("content-length")) > 0);
  assert.equal(await head.text(), "");
});

test("web server rejects unsupported methods and traversal", async t => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

  const base = "http://127.0.0.1:" + server.address().port;
  const post = await fetch(base + "/", { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");

  const traversal = await fetch(base + "/%2e%2e%2fpackage.json");
  assert.equal(traversal.status, 403);

  const missing = await fetch(base + "/missing-release-file.js");
  assert.equal(missing.status, 404);
});


test("web server blocks symlinks that point outside the game directory", async t => {
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "kingmaker-outside-"));
  const secret = path.join(outside, "secret.txt");
  const linkName = ".kingmaker-server-test-" + process.pid + "-" + Date.now();
  const linkPath = path.join(__dirname, "..", linkName);
  await fs.writeFile(secret, "outside private file");
  await fs.symlink(outside, linkPath, "dir");
  t.after(async () => {
    await fs.rm(linkPath, { force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

  const response = await fetch("http://127.0.0.1:" + server.address().port + "/" + linkName + "/secret.txt");
  assert.equal(response.status, 403);
  assert.equal(await response.text(), "Forbidden");
});


test("CROWN mining status is explicit and enrollment stays closed before launch", async t => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

  const base = "http://127.0.0.1:" + server.address().port;
  const statusResponse = await fetch(base + "/api/mining/v1/status");
  assert.equal(statusResponse.status, 200);
  assert.equal(statusResponse.headers.get("cache-control"), "no-store");
  const status = await statusResponse.json();
  assert.equal(status.status, "pre-launch");
  assert.equal(status.enrollmentOpen, false);
  assert.equal(status.miningEnabled, false);
  assert.equal(status.rewardIssuanceEnabled, false);
  assert.equal(status.sessionDurationSeconds, 86400);
  assert.equal(status.sponsorshipRevenueSharedWithMiners, false);
  assert.equal(status.rewardFormula.securityCircleBonusPerVerifiedMember, 0.20);
  assert.equal(status.rewardFormula.maximumSecurityCircleMembers, 5);
  assert.equal(status.rewardFormula.activeDirectReferralBonus, 0.25);

  const enrollment = await fetch(base + "/api/mining/v1/enrollment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  assert.equal(enrollment.status, 503);
  assert.match((await enrollment.json()).error, /not open/i);
});
