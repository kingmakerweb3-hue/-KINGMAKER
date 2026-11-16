"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "www");

test("native mining bundle includes the referenced app icon asset", () => {
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/build-mobile.js")], { cwd: root, stdio: "pipe" });
    const entry = fs.readFileSync(path.join(output, "index.html"), "utf8");
    const manifest = JSON.parse(fs.readFileSync(path.join(output, "mining-manifest.json"), "utf8"));
    const iconPath = path.join(output, "assets", "kingmaker-app-icon.svg");

    assert.ok(fs.existsSync(iconPath), "app icon must be copied into www/assets");
    assert.ok(entry.includes('href="mining-manifest.json"'), "native entry should retain the web manifest");
    assert.ok(manifest.icons.some((icon) => icon.src === "./assets/kingmaker-app-icon.svg"));
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
});
