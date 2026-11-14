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

The browser wallet module currently detects an EIP-1193 provider and connects an account. It does not yet request signatures, read contract balances, submit transactions, or prove on-chain ownership. Those functions must be added only after the contract and chain configuration are finalized.
