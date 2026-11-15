"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
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
