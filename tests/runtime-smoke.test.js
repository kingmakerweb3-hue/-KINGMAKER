"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("published entry page references real local assets in safe load order", () => {
  const html = read("index.html");
  assert.match(html, /<title>KINGMAKER/);
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(scripts, ["src/engine.js", "src/app.js"]);
  for (const asset of [...scripts, "styles.css"]) {
    assert.ok(fs.existsSync(path.join(root, asset)), "missing asset: " + asset);
  }
});

test("every app DOM lookup exists in the entry page", () => {
  const html = read("index.html");
  const app = read("src/app.js");
  const ids = new Set([...html.matchAll(/\\bid="([^"]+)"/g)].map(match => match[1]));
  const lookups = new Set([...app.matchAll(/\\$\\("([^"]+)"\\)/g)].map(match => match[1]));
  const missing = [...lookups].filter(id => !ids.has(id));
  assert.deepEqual(missing, [], "app references missing DOM nodes");
});

test("engine exports every action called by the interface", () => {
  const engine = read("src/engine.js");
  const app = read("src/app.js");
  const required = ["createInitialState", "migrateSave", "saveWithRecovery", "exportSave",
    "advanceTurn", "build", "trade", "research", "sendGift", "offerTreaty",
    "declareConflict", "makePeace", "registerCreation", "commissionCreation",
    "withdrawCreation", "deleteCreation", "economicSnapshot", "addEvent"];
  for (const name of required) {
    assert.match(engine, new RegExp("\\b" + name + "\\b"), "engine missing " + name);
    assert.match(app, new RegExp("\\bE\\." + name + "\\b"), "interface does not use " + name);
  }
});

test("startup failures have a visible recovery screen instead of a silent blank page", () => {
  const app = read("src/app.js");
  const css = read("styles.css");
  assert.match(app, /function showBootFailure/);
  assert.match(app, /KINGMAKER startup failed/);
  assert.match(app, /boot-reload/);
  assert.match(css, /\\.boot-error/);
});
