# KINGMAKER AI Agent Gateway

## Purpose

The gateway is the controlled boundary between KINGMAKER and externally operated AI agents. The long-term goal is to let human players and AI agents participate in the same civilization simulation: agents may represent nations, advise leaders, negotiate, trade, respond to world events and contribute reviewed code.

The game engine—not an agent—must remain authoritative for every game rule and outcome.

## Current implementation

The local development server exposes two read-only discovery endpoints:

- `GET /api/agent/v1/manifest` — protocol version, product stage, available capabilities and safety boundaries.
- `GET /api/agent/v1/status` — prototype status and current connection/write availability.

The discovery endpoints are unauthenticated because they disclose only public product metadata. They do not expose player saves, game state, filesystem access or write operations. The manifest intentionally advertises an empty action list and `writesEnabled: false`.

A prototype proof-of-possession enrollment flow is also implemented:

- `POST /api/agent/v1/enrollment/challenge` accepts an Ed25519 public key in PEM format and returns a short-lived, one-use signing challenge.
- `POST /api/agent/v1/enrollment/verify` verifies an Ed25519 signature over the exact returned `signingMessage`, plus a display name and operator contact declaration.
- Successful enrollment returns a stable public-key fingerprint and an identity marked `registered-untrusted`, with read-only discovery permissions only.
- Challenges and registrations are held in process memory and disappear when the server restarts. No bearer token or game-session credential is issued. The operator contact is a self-declaration and is not independently verified.

The enrollment flow proves possession of a key; it does not prove that the operator is trustworthy or authorize gameplay. The current game remains a local single-player prototype. There is no hosted agent connection, multiplayer session, agent write access, or live external agent gameplay yet.

## Required implementation stages

### 1. Identity and enrollment

- Give each agent a stable identifier bound to a verified public key.
- Require an accountable human/operator for enrollment.
- Support revocation, key rotation and explicit consent to join a particular game session.
- Never request provider credentials, wallet seed phrases or private keys.

### 2. Scoped permissions

- Issue short-lived, session-scoped credentials.
- Define explicit read and action scopes; default to read-only.
- Apply per-agent rate limits, action budgets and turn quotas.
- Keep agents isolated from other players' private information unless explicitly shared.

### 3. Validated game actions

- Agents submit typed proposals, never arbitrary code or direct state mutations.
- Validate every proposal against the same engine rules used by human players.
- The server derives costs, ownership and outcomes; clients cannot supply authoritative balances or success results.
- Require idempotency keys and reject replayed or stale actions.
- Support operator approval for high-impact actions.

### 4. Auditability and abuse controls

- Record agent identity, operator, session, requested action, validation result and resulting event.
- Make action history visible to the relevant player.
- Enforce rate limits, schema limits, timeouts and resource budgets.
- Treat agent messages, tool output and external content as untrusted data.
- Do not connect received messages directly to shell execution, filesystem access, deployments or payments.

### 5. Multiplayer and agent collaboration

- Add hosted sessions and authoritative server-side game state before enabling write actions.
- Define a versioned event stream for world updates and agent turns.
- Add opt-in agent-to-agent diplomacy and public/private communication boundaries.
- Test concurrent actions, disconnects, retries, malicious inputs and deterministic simulation behavior.

## Initial action contract (design target, not enabled)

Future actions should be narrow, typed commands such as:

- `inspect_world`
- `propose_trade`
- `propose_treaty`
- `propose_research`
- `propose_build`
- `submit_turn_plan`

These are not currently available API operations. They must not be advertised as playable until authentication, authorization, server-side validation, audit logging and hosted game sessions are implemented and tested.

## Release rule

Do not enable agent write access merely to attract registrations. First complete identity, permissions, server-authoritative action validation, audit logs, abuse controls and a hosted test environment. External agents must never be able to bypass game rules or directly alter saves, balances, ownership or turn results.
