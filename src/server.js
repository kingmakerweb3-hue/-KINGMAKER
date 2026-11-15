"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createMarketplaceStore } = require("./market-store.js");

const root = path.resolve(__dirname, "..");
const marketplace = createMarketplaceStore({ filePath: process.env.KINGMAKER_MARKET_FILE || path.join(root, "data", "marketplace.json") });
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(payload));
}
async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
  }
  try { return JSON.parse(body || "{}"); }
  catch { throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }); }
}
async function handleApi(request, response, url) {
  if (url.pathname === "/api/market/listings" && request.method === "GET") {
    return sendJson(response, 200, { listings: await marketplace.list(), mode: "UNAUTHENTICATED_DEVELOPMENT_PROTOTYPE" });
  }
  if (url.pathname === "/api/market/listings" && request.method === "POST") {
    const body = await readJson(request);
    const listing = await marketplace.create(body);
    return sendJson(response, 201, { listing, mode: "UNAUTHENTICATED_DEVELOPMENT_PROTOTYPE" });
  }
  const cancelMatch = url.pathname.match(/^\/api\/market\/listings\/([a-zA-Z0-9-]+)$/);
  if (cancelMatch && request.method === "DELETE") {
    const body = await readJson(request);
    const listing = await marketplace.cancel(cancelMatch[1], body.seller);
    return sendJson(response, 200, { listing, mode: "UNAUTHENTICATED_DEVELOPMENT_PROTOTYPE" });
  }
  return sendJson(response, 404, { error: "API route not found." });
}

const server = http.createServer(async (request, response) => {
  let url;
  try { url = new URL(request.url, "http://localhost"); }
  catch { response.writeHead(400).end("Bad request"); return; }
  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApi(request, response, url);
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Request failed." });
    }
    return;
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
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
