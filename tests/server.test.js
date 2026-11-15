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
