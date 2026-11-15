"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createAgentIdentityService } = require("./agent-identity.js");

const root = path.resolve(__dirname, "..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function readJsonBody(request, maxBytes = 16 * 1024) {
  return new Promise((resolve, reject) => {
    if (!/^application\\/json(?:;|$)/i.test(request.headers["content-type"] || "")) {
      const error = new Error("Content-Type must be application/json");
      error.statusCode = 415;
      reject(error);
      request.resume();
      return;
    }
    let size = 0;
    const chunks = [];
    request.on("data", chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        const error = new Error("Request body too large");
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (_) {
        const error = new Error("Request body must be valid JSON");
        error.statusCode = 400;
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function createServer() {
  const agentIdentity = createAgentIdentityService();
  return http.createServer(async (request, response) => {
    if (!["GET", "HEAD", "POST"].includes(request.method)) {
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

    if (request.method === "POST") {
      const enrollmentRoutes = {
        "/api/agent/v1/enrollment/challenge": async body => agentIdentity.issueChallenge(body),
        "/api/agent/v1/enrollment/verify": async body => agentIdentity.completeEnrollment(body)
      };
      const handler = enrollmentRoutes[pathname];
      if (!handler) {
        response.writeHead(405, { Allow: "GET, HEAD", "X-Content-Type-Options": "nosniff" }).end("Method not allowed");
        return;
      }
      try {
        const body = await readJsonBody(request);
        const result = await handler(body);
        const payload = JSON.stringify(result);
        response.writeHead(pathname.endsWith("/challenge") ? 201 : 201, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(payload),
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "Cache-Control": "no-store"
        });
        response.end(payload);
      } catch (error) {
        if (response.headersSent || response.destroyed) return;
        const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
        const payload = JSON.stringify({ error: error.message || "Enrollment request failed" });
        response.writeHead(statusCode, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(payload),
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store"
        });
        response.end(payload);
      }
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
