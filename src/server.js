"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
const server = http.createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch (_) { response.writeHead(400).end("Bad request"); return; }
  if (pathname === "/") pathname = "/index.html";
  const target = path.resolve(root, "." + pathname);
  if (target !== root && !target.startsWith(root + path.sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  fs.stat(target, (statError, stat) => {
    if (statError || !stat.isFile()) { response.writeHead(404).end("Not found"); return; }
    const headers = {
      "Content-Type": mime[path.extname(target)] || "application/octet-stream",
      "Content-Length": stat.size,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store"
    };
    response.writeHead(200, headers);
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(target).pipe(response);
  });
});
const port = Number(process.env.PORT || 4173);
server.listen(port, "127.0.0.1", () => process.stdout.write("KINGMAKER local server at http://127.0.0.1:" + port + "\n"));
