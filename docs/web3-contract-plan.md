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


## ERC-1155 escrow marketplace prototype (not production)

`contracts/KingmakerMarketplace.sol` is a separate local-EVM prototype that demonstrates a custody-based ERC-1155 listing flow:
- Sellers approve the marketplace and create a listing; the listed quantity is transferred into contract custody.
- Buyers pay the exact quoted native-chain currency amount; the contract transfers the escrowed ERC-1155 quantity to the buyer.
- Sale proceeds are credited to the seller and withdrawn separately (pull-payment pattern).
- Sellers can cancel active listings and recover escrowed assets.
- Reentrancy protection guards listing, cancellation, purchase, and proceeds withdrawal.

Automated behavior tests are in `contract-tests/KingmakerMarketplace.test.js`. These tests run on Hardhat's local test chain only.

**Important limitations:** this prototype accepts the chain's native currency only, not USDT/BTC/ETH across multiple networks or stablecoin settlement. There is no fee/royalty system, expiry, dispute process, marketplace UI integration, production deployment, event indexer, or independent audit. It is not connected to the existing shared marketplace API. It must not be deployed with valuable assets or exposed as a live trading feature. A production design still needs an audited settlement contract, explicit admin/emergency governance, supported-token policy, chain-specific deployment, monitoring, economic/security review, and end-to-end wallet/UI integration. The code is a development experiment, not a claim of safe or complete trading.


## Repeatable local contract deployment

A local-only deployment script is available at `scripts/deploy-local.js`. Run `npm run contract:deploy:local` to deploy the ERC-1155 asset contract, define the three initial catalog token IDs, deploy the escrow marketplace, and print a JSON summary with the resulting addresses and token mapping. Hardhat's default network is an ephemeral local network; the addresses are not persistent after the process exits and are not a public-chain deployment. For a persistent local node, start `npx hardhat node` separately and run `npx hardhat run scripts/deploy-local.js --network localhost`.

The script does not mint assets, transfer funds, or publish deployment addresses into application configuration. Do not point the live server or browser at these ephemeral addresses. Public-network deployment remains intentionally out of scope until a target chain, funded deployer, verified configuration, end-to-end tests, and independent security review are available.


## Wallet-connected escrow interface (configuration gated)

The Web3 & Assets panel now includes an on-chain escrow interface in `src/web3-escrow.js`. When configured, it can:
- Read active listings and seller proceeds from the escrow contract.
- Request ERC-1155 operator approval, then deposit assets into escrow to create a listing.
- Purchase an active listing using the exact native-currency price.
- Cancel the seller's own listing and withdraw seller proceeds.

The interface checks the connected wallet's chain ID against the configured chain before reads or writes. Every write is submitted through the user's EIP-1193 wallet and requires wallet confirmation. The browser loads ethers v6 from jsDelivr for contract interaction.

Provide configuration **before** the Web3 modules load, for example in a deployment-specific script included before `src/web3.js`:

```js
window.KINGMAKER_WEB3_CONFIG = {
  chainId: "0x7a69",
  contractAddress: "0xYOUR_DEPLOYED_ASSET_CONTRACT",
  marketplaceAddress: "0xYOUR_DEPLOYED_MARKETPLACE",
  assets: [
    { id: "founder-banner", tokenId: "1", name: "Founder Banner" },
    { id: "frontier-surveyor", tokenId: "2", name: "Frontier Surveyor" },
    { id: "royal-blueprint", tokenId: "3", name: "Royal Blueprint" }
  ]
};
```

The example chain ID is Hardhat's local chain (31337); replace both addresses with the contracts deployed to the same persistent local node. Never use placeholder addresses. If configuration is absent, invalid, or on the wrong chain, the escrow interface stays disabled. The interface is a development integration only: no public-chain deployment, stablecoin settlement, fee/royalty logic, indexing, production monitoring, or independent security audit is included. The CDN dependency requires an internet connection. Do not use with valuable assets or real funds.


### Escrow listing pagination and activity feed

The browser escrow panel loads active listings newest-first in pages of 50 and exposes a **Load older listings** control. It also queries the contract's `ListingCreated`, `ListingCancelled`, `AssetPurchased`, and `ProceedsWithdrawn` events over the most recent 5,000 blocks and displays up to 20 events. This is a lightweight browser-side history view, not a durable indexer: older events are not included, RPC providers may limit log ranges, and activity can be unavailable when the configured RPC does not support historical log queries. A production marketplace needs a separately operated event indexer with reorg handling, persistent storage, pagination, and transaction-status reconciliation. Optionally set `explorerUrl` in `KINGMAKER_WEB3_CONFIG` to show transaction links for the selected chain.


### Persistent marketplace event indexer (development)

The local Node server can maintain a durable event history for the escrow contract. Configure these server environment variables:
- `KINGMAKER_MARKET_RPC_URL` — trusted read-only EVM JSON-RPC endpoint.
- `KINGMAKER_MARKETPLACE_CONTRACT` — deployed `KingmakerMarketplace` address.
- `KINGMAKER_MARKET_CHAIN_ID` — expected decimal chain ID.
- `KINGMAKER_MARKET_START_BLOCK` — deployment block to begin indexing (defaults to `0`; set this to the actual deployment block to avoid scanning unrelated history).
- `KINGMAKER_MARKET_CONFIRMATIONS` — confirmation depth before events are indexed (defaults to `12`).
- Optional `KINGMAKER_MARKET_EVENTS_FILE` — local JSON persistence path (defaults to `data/market-events.json`).

When all required settings are valid, the server performs an initial sync and polls every 15 seconds. It checks the RPC chain ID, scans bounded block ranges, decodes the four marketplace events, persists the index using an atomic file replacement, and rewinds 12 blocks on each pass to reconcile short chain reorganizations. `GET /api/market/activity?limit=20&cursor=0` serves recent indexed events with offset pagination. The escrow panel prefers this persistent API and falls back to its limited browser-side query when the server indexer is not configured.

**Operational limitations:** this is a single-process JSON-file development indexer, not a production indexing service. It retains at most 10,000 events, uses a fixed 12-block rewind rather than full canonical-chain reconciliation, and does not independently verify transaction receipts or finality guarantees. It has no distributed locking, database, backfill job controls, metrics, alerting, or multi-chain support. Run it only with a trusted RPC and a verified deployment; do not treat it as an audited financial record or expose this development server publicly.
