"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createMarketplaceStore } = require("./market-store.js");
const { createWalletAuth } = require("./wallet-auth.js");

const root = path.resolve(__dirname, "..");
const marketplace = createMarketplaceStore({ filePath: process.env.KINGMAKER_MARKET_FILE || path.join(root, "data", "marketplace.json") });
const walletAuth = createWalletAuth();
const SESSION_COOKIE = "km_session";
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders });
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
function cookieValue(request, name) {
  const cookies = String(request.headers.cookie || "").split(";");
  for (const item of cookies) {
    const index = item.indexOf("=");
    if (index > 0 && item.slice(0, index).trim() === name) return decodeURIComponent(item.slice(index + 1).trim());
  }
  return "";
}
function expectedOrigin(request) {
  const host = request.headers.host;
  if (!host || /[\\s/\\\\]/.test(host)) throw Object.assign(new Error("Invalid request host."), { statusCode: 400 });
  return (request.socket.encrypted ? "https://" : "http://") + host;
}
function requireSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin || origin !== expectedOrigin(request)) throw Object.assign(new Error("Request origin is missing or does not match this server."), { statusCode: 403 });
  return origin;
}
function requireSession(request) {
  const session = walletAuth.getSession(cookieValue(request, SESSION_COOKIE));
  if (!session) throw Object.assign(new Error("Connect and sign in with your wallet before managing listings."), { statusCode: 401 });
  return session;
}
function sessionCookie(token, request) {
  const secure = request.socket.encrypted ? "; Secure" : "";
  return SESSION_COOKIE + "=" + encodeURIComponent(token) + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200" + secure;
}
function clearSessionCookie(request) {
  const secure = request.socket.encrypted ? "; Secure" : "";
  return SESSION_COOKIE + "=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" + secure;
}
async function handleApi(request, response, url) {
  if (url.pathname === "/api/auth/challenge" && request.method === "POST") {
    const origin = requireSameOrigin(request);
    const body = await readJson(request);
    return sendJson(response, 200, walletAuth.issueChallenge(body.address, body.chainId, origin));
  }
  if (url.pathname === "/api/auth/verify" && request.method === "POST") {
    const origin = requireSameOrigin(request);
    const body = await readJson(request);
    const result = walletAuth.verifyChallenge(body, origin);
    return sendJson(response, 200, { session: result.session }, { "Set-Cookie": sessionCookie(result.token, request) });
  }
  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    const session = walletAuth.getSession(cookieValue(request, SESSION_COOKIE));
    return sendJson(response, 200, { session });
  }
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    requireSameOrigin(request);
    walletAuth.revoke(cookieValue(request, SESSION_COOKIE));
    return sendJson(response, 200, { ok: true }, { "Set-Cookie": clearSessionCookie(request) });
  }
  if (url.pathname === "/api/market/listings" && request.method === "GET") {
    const session = walletAuth.getSession(cookieValue(request, SESSION_COOKIE));
    return sendJson(response, 200, { listings: await marketplace.list(), authenticated: Boolean(session), account: session?.address || null, mode: "SIGNED_WALLET_SESSION_DEVELOPMENT" });
  }
  if (url.pathname === "/api/market/listings" && request.method === "POST") {
    requireSameOrigin(request);
    const session = requireSession(request);
    const body = await readJson(request);
    const listing = await marketplace.create({ ...body, seller: session.address });
    return sendJson(response, 201, { listing, mode: "SIGNED_WALLET_SESSION_DEVELOPMENT" });
  }
  const cancelMatch = url.pathname.match(/^\\/api\\/market\\/listings\\/([a-zA-Z0-9-]+)$/);
  if (cancelMatch && request.method === "DELETE") {
    requireSameOrigin(request);
    const session = requireSession(request);
    const listing = await marketplace.cancel(cancelMatch[1], session.address);
    return sendJson(response, 200, { listing, mode: "SIGNED_WALLET_SESSION_DEVELOPMENT" });
  }
  return sendJson(response, 404, { error: "API route not found." });
}

const server = http.createServer(async (request, response) => {
  let url;
  try { url = new URL(request.url, "http://localhost"); }
  catch { response.writeHead(400).end("Bad request"); return; }
  if (url.pathname.startsWith("/api/")) {
    try { await handleApi(request, response, url); }
    catch (error) { sendJson(response, error.statusCode || 400, { error: error.message || "Request failed." }); }
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
  if (target !== root && !target.startsWith(root + path.sep)) { response.writeHead(403).end("Forbidden"); return; }
  fs.stat(target, (statError, stat) => {
    if (statError || !stat.isFile()) { response.writeHead(404).end("Not found"); return; }
    const headers = { "Content-Type": mime[path.extname(target)] || "application/octet-stream", "Content-Length": stat.size, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" };
    response.writeHead(200, headers);
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(target).pipe(response);
  });
});
const port = Number(process.env.PORT || 4173);
server.listen(port, "127.0.0.1", () => process.stdout.write("KINGMAKER local server at http://127.0.0.1:" + port + "\\n"));
