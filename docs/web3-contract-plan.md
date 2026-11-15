# KINGMAKER on-chain asset contract — implementation notes

## Contract template

`contracts/KingmakerAssets.sol` is an ERC-1155 multi-asset contract based on OpenZeppelin Contracts v5.

It provides:
- Admin-defined asset IDs with a fixed maximum supply.
- Role-gated minting and batch minting.
- Standard ERC-1155 transfers and balances.
- Owner/approved-operator burning.
- Admin pause/unpause controls.
- A configurable metadata base URI.

## Build and test

The repository uses Hardhat with a pinned Solidity compiler version and OpenZeppelin Contracts v5.

- `npm install` installs the project and contract toolchain.
- `npm run contract:compile` compiles the Solidity contract.
- `npm run contract:test` runs local EVM tests covering roles, supply caps, batch validation, pause controls, transfers, burns, metadata URI, and ERC-1155 interface support.
- The main quality workflow runs compilation and contract tests on Node 20 and Node 22.

These tests are a development baseline, not an independent security audit.

## Important status

The contract source and automated test suite are in development. A passing local test suite does **not** mean the contract has been audited, deployed, or connected to a production chain. Do not use it to hold valuable assets or funds. Independent security review and network-specific deployment preparation remain mandatory.

## Decisions required before production

1. Select the target EVM network and testnet.
2. Decide whether assets are ERC-1155 items, ERC-721 unique parcels, or a combination.
3. Finalize asset IDs, metadata schema, supply policy, royalties (if any), and transfer restrictions.
4. Define admin and minter custody, ideally using a multisig and narrowly scoped roles.
5. Add deployment scripts, verified contract addresses, monitoring, and indexer/API support.
6. Complete an independent security review before any mainnet deployment.

## Wallet integration boundary

The browser wallet module detects an EIP-1193 provider and connects an account. `src/web3-chain.js` can read ERC-1155 balances with read-only `eth_call` when a verified contract address, chain ID, and token IDs are configured. It keeps chain-read balances separate from local prototype inventory. It does not request signatures or submit transactions. A successful balance query is a view of the configured contract only; it does not establish that the contract or metadata is audited or production-ready.

## Live wallet balance reader

`src/web3-chain.js` adds a read-only ERC-1155 `balanceOf` integration using the connected EIP-1193 provider's `eth_call`. It never requests signatures and never sends transactions.

Before balances can be read, the hosting page must define `window.KINGMAKER_WEB3_CONFIG` before the module loads:

```js
window.KINGMAKER_WEB3_CONFIG = {
  chainId: "0xaa36a7",
  contractAddress: "0xYOUR_DEPLOYED_CONTRACT_ADDRESS",
  assets: [
    { id: "founder-banner", tokenId: "1", name: "Founder Banner" },
    { id: "frontier-surveyor", tokenId: "2", name: "Frontier Surveyor" }
  ]
};
```

The example chain ID is Sepolia; the contract address and token IDs above are placeholders and must be replaced with values from a verified deployment. With no configuration, the UI explicitly reports that live balances are unavailable and retains the prototype disclosure. Do not enable minting or marketplace actions until deployment, access-control review, metadata hosting, server-side verification, and independent security audit are complete.


## Integration safety notes

- Local prototype inventory and on-chain balances are displayed in separate sections; local browser records must never be presented as verified ownership.
- The reader queries the connected account through the provider and checks the configured chain before calling the contract.
- The reader is intentionally read-only. No wallet signature, approval, mint, transfer, or marketplace settlement is implemented.
- Do not publish a contract address as official until the deployed bytecode, verified source, role configuration, metadata, and network have been independently checked.


## Player asset economy domain model

The browser prototype now includes a deterministic asset-economy domain module in `src/asset-economy.js`. It defines a stable asset catalog, validates wallet identities and listing bounds, models listing expiry and cancellation, prevents self-purchases, and creates simulated trade records using the explicitly non-financial `GAME_CREDITS` unit.

The module is deliberately separate from the ERC-1155 balance reader. Its listing and trade records are local simulation data, not proof of ownership, escrow, payment, or blockchain settlement. A production marketplace still requires authenticated server-side state, authoritative inventory ownership checks, atomic settlement, anti-fraud controls, contract integration, and independent security review.


## Local marketplace prototype

The browser prototype includes a local player-to-player listing interface. A connected wallet can list a locally recorded catalog item, browse active listings, cancel its own listing, or simulate an exchange with another wallet address available in the same browser profile. Inventory records and listing records are stored in browser local storage.

This is strictly a UI and game-flow simulation. Asking prices are display-only game credits: the prototype does not debit or credit a balance, collect payment, prove ownership, escrow assets, or submit a blockchain transaction. Listings are not shared between browsers or players. Production trading requires authenticated server-side listings, authoritative inventory and ownership checks, atomic settlement, payment/credit accounting, replay protection, anti-fraud controls, and audited contract integration.


## Shared marketplace API and wallet authentication

The local Node server exposes:
- `POST /api/auth/challenge` — issues a short-lived, one-time sign-in message bound to the wallet address, chain ID, and exact application origin.
- `POST /api/auth/verify` — verifies the EIP-191 personal-signature using ethers, consumes the nonce, and issues an opaque server-side session.
- `GET /api/auth/session` and `POST /api/auth/logout` — inspect or revoke the current session.
- `GET /api/market/inventory` — returns the signed-in wallet’s server-verified ERC-1155 balances for configured catalog token IDs.
- `GET /api/market/listings`, `POST /api/market/listings`, and `DELETE /api/market/listings/:id` — browse listings and manage the signed-in seller's own listings.

The session token is held in an HttpOnly, SameSite=Strict cookie; it is not exposed to browser JavaScript or local storage. Marketplace write requests require a same-origin request and a valid wallet session. The server derives the seller address from the verified session rather than trusting a seller address supplied in the request. Challenge nonces are single-use and expire after five minutes; sessions expire after twelve hours. The listing store persists active listings to `data/marketplace.json` (or `KINGMAKER_MARKET_FILE`).

**Security boundary:** this is still a local development prototype, not a production marketplace. It authenticates control of an EVM address but does not prove that a seller owns the listed asset; inventory remains browser-local. Prices are simulated game credits. There is no purchase, payment, escrow, balance debit, asset transfer, or blockchain settlement. Sessions and challenges are held in process memory and are lost on server restart. There is no database-backed multi-instance session store, robust IP/wallet rate limiting, production TLS/proxy configuration, authoritative inventory, monitoring, or independent security audit. The server accepts only origins listed in `KINGMAKER_APP_ORIGINS`; the default allowlist is the local `127.0.0.1` and `localhost` origins for the configured port. The server binds to loopback by default and must not be exposed publicly or used for valuable assets.

Before production, add persistent and distributed session/challenge storage, IP and wallet rate limits, strict deployment-origin configuration, HTTPS behind a correctly configured trusted proxy, authoritative inventory/ownership checks, database transactions, audit logging, anti-abuse controls, operational monitoring, and independently reviewed settlement contracts.


## Server-side on-chain ownership gate (development)

The authenticated inventory endpoint and marketplace write route call `src/chain-ownership.js`. The inventory endpoint returns live balances for configured catalog assets; the listing route independently repeats the ownership check before accepting a listing. Configure the server environment with:
- `KINGMAKER_RPC_URL` — trusted EVM JSON-RPC endpoint.
- `KINGMAKER_ASSET_CONTRACT` — deployed ERC-1155 contract address.
- `KINGMAKER_CHAIN_ID` — decimal chain ID expected by the server.
- `KINGMAKER_ASSET_TOKEN_IDS` — JSON object mapping KINGMAKER catalog IDs to decimal ERC-1155 token IDs, for example `{"founder-banner":"1","frontier-surveyor":"2"}`.

The server checks the authenticated session's chain ID, the RPC's actual chain ID, deployed bytecode at the configured contract, and the wallet's live `balanceOf(address,uint256)` result. It fails closed when configuration or RPC checks fail, when an asset has no token mapping, or when the wallet balance is zero. A compact verification snapshot (chain, token ID, balance and time) is stored with the listing.

**Critical limitation:** this is an ownership check at listing creation time, not escrow or a continuing reservation. The seller can transfer the token after listing; the marketplace does not lock it or guarantee availability at purchase time. Buyers still cannot purchase, pay, or receive transfers. Configure only a verified deployment and trusted RPC. Do not enable real trading until atomic escrow/settlement, ongoing listing validity, authoritative token mapping, rate limits, monitoring and an independent security audit are complete.
