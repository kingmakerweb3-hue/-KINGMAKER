"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const files = [
  "mining.html", "mobile-shell.js", "assets/kingmaker-app-icon.svg",
  "manifest.json", "sw.js",
  "mining.js", "mining-config.js",
  "mining-foundation.js", "mining-manifest.json", "mining-sw.js"
];
const dirs = ["src", "assets"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of files) {
  const source = path.join(root, file);
  if (fs.existsSync(source) && fs.statSync(source).isFile()) {
    const destination = path.join(out, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}
for (const dir of dirs) {
  const source = path.join(root, dir);
  if (fs.existsSync(source)) {
    fs.cpSync(source, path.join(out, dir), { recursive: true });
  }
}
if (!fs.existsSync(path.join(out, "index.html"))) {
  throw new Error("Mobile web bundle is missing index.html");
}
process.stdout.write("KINGMAKER mobile web bundle created at www/\n");
