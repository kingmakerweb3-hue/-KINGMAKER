"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const files = [
  "mining.js",
  "mining-config.js",
  "mining-foundation.js",
  "mining-manifest.json",
  "mining-sw.js",
  "mobile-shell.js"
];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error("Required KINGMAKER Mining asset is missing: " + file);
  }
  fs.copyFileSync(source, path.join(out, file));
}

const miningEntry = path.join(root, "mining.html");
if (!fs.existsSync(miningEntry)) {
  throw new Error("Required KINGMAKER Mining entry point is missing: mining.html");
}
let html = fs.readFileSync(miningEntry, "utf8");
const publicBase = "https://kingmakerweb3-hue.github.io/-KINGMAKER/";
for (const page of ["network.html", "whitepaper.html", "index.html"]) {
  html = html.replaceAll('href="' + page + '"', 'href="' + publicBase + page + '"');
}
html = html.replace("</head>", '  <script defer src="mobile-shell.js"></script>\n</head>');
fs.writeFileSync(path.join(out, "index.html"), html);
process.stdout.write("KINGMAKER Mining native app bundle created at www/\n");
