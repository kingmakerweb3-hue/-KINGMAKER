"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function createServer() {
  return http.createServer((request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD", "X-Content-Type-Options": "nosniff" }).end("Method not allowed");
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch (_) {
      response.writeHead(400, { "X-Content-Type-Options": "nosniff" }).end("Bad request");
      return;
    }

    const agentApi = {
      "/api/agent/v1/manifest": {
        protocolVersion: "1.0",
        game: "KINGMAKER",
        productStage: "local-single-player-prototype",
        authentication: "not-enabled",
        capabilities: ["read:manifest", "read:status"],
        actions: [],
        connection: { mode: "read-only-preview", writesEnabled: false },
        safety: {
          engineAuthoritative: true,
          externalInstructionsAreUntrusted: true,
          directSaveAccess: false,
          directFilesystemAccess: false
        },
        notice: "External agents cannot join or control a live game yet. Write actions are intentionally disabled until identity, permissions, validation, audit logging and hosted multiplayer are implemented."
      },
      "/api/agent/v1/status": {
        game: "KINGMAKER",
        status: "prototype",
        productStage: "local-single-player-prototype",
        agentConnections: 0,
        writesEnabled: false
      }
    };
    if (Object.prototype.hasOwnProperty.call(agentApi, pathname)) {
      const body = JSON.stringify(agentApi[pathname]);
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "Cache-Control": "no-store"
      });
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }

    if (pathname === "/") pathname = "/index.html";
    const target = path.resolve(root, "." + pathname);
    if (target !== root && !target.startsWith(root + path.sep)) {
      response.writeHead(403, { "X-Content-Type-Options": "nosniff" }).end("Forbidden");
      return;
    }

    fs.realpath(target, (realpathError, realTarget) => {
      if (realpathError || (realTarget !== root && !realTarget.startsWith(root + path.sep))) {
        response.writeHead(realpathError ? 404 : 403, { "X-Content-Type-Options": "nosniff" }).end(realpathError ? "Not found" : "Forbidden");
        return;
      }

      fs.stat(realTarget, (statError, stat) => {
      if (statError || !stat.isFile()) {
        response.writeHead(404, { "X-Content-Type-Options": "nosniff" }).end("Not found");
        return;
      }

      const headers = {
        "Content-Type": mime[path.extname(target)] || "application/octet-stream",
        "Content-Length": stat.size,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-store"
      };
      response.writeHead(200, headers);
      if (request.method === "HEAD") response.end();
      else fs.createReadStream(realTarget).pipe(response);
      });
    });
  });
}

if (require.main === module) {
  const server = createServer();
  const port = Number(process.env.PORT || 4173);
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    process.stdout.write("KINGMAKER local server at http://127.0.0.1:" + address.port + "\n");
  });
}

module.exports = { createServer };
