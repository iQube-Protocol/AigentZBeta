# Base TokenQube Activation — Fast Follow Backlog

**Date:** 2026-05-13
**Workstream:** ContentQube Phase 7B
**Status:** Backlog — operator action + contract deployment required before activation

## Context

Phase 7B (`services/chain/baseTokenMint.ts`) shipped in commit `a2cc3d0c`.
The minting service is fully wired and gracefully no-ops when contract
addresses are absent. The following tasks are needed to activate it in
production.

## Tasks

### 1. Deploy ERC-1155 Editions Contract to Base

- Deploy an OpenZeppelin ERC-1155 contract with an operator `mint()` function.
- The deployer wallet should be funded with enough ETH for deployment gas.
- Set the minter role to the `BASE_MINTER_PRIVATE_KEY` wallet address.
- Target: Base mainnet (chainId 8453) or Base Sepolia (84532) for testnet first.

```bash
# After deployment, set the env var:
CONTENT_QUBE_ERC1155_ADDRESS=<deployed_contract_address>
```

### 2. Deploy ERC-721 Master Contract to Base

- Deploy an OpenZeppelin ERC-721 contract with a `safeMint(address to, uint256 tokenId)` function.
- Grant minter role to the `BASE_MINTER_PRIVATE_KEY` wallet.

```bash
CONTENT_QUBE_ERC721_ADDRESS=<deployed_contract_address>
```

### 3. Configure Minter Wallet

- Generate or designate a server-side wallet to be the minter.
- Fund it with ETH for gas on the target chain.
- Store its private key as a server-side secret (never browser-exposed):

```bash
BASE_MINTER_PRIVATE_KEY=<hex_private_key>
```

### 4. Configure RPC Endpoint

- Set `IQUBE_NFT_RPC_URL` (already in allowlist) or `BASE_RPC_URL` to a
  reliable Base RPC (Alchemy/QuickNode recommended over public nodes for
  production write traffic):

```bash
IQUBE_NFT_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
# or
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
```

### 5. Set All Four Vars in Amplify Environment

In the Amplify console under Environment Variables (or via AWS CLI),
add for the `dev` (and later `main`) branch:

```
BASE_MINTER_PRIVATE_KEY
CONTENT_QUBE_ERC1155_ADDRESS
CONTENT_QUBE_ERC721_ADDRESS
IQUBE_NFT_RPC_URL   (or BASE_RPC_URL)
```

### 6. Write a Mint-Trigger Admin Route (Phase 7B.1)

Currently `mintCanonicalEdition` and `mintMasterQube` are service functions
with no HTTP entrypoint. A future admin route is needed to trigger batch
minting from the KNYT Codex Admin tab:

```
POST /api/admin/content-qube/mint-edition
POST /api/admin/content-qube/mint-master
```

Both should be `adminOnly` gated and idempotent (check `base_token_id IS NULL`
before minting to prevent double-minting).

### 7. Verify Token ID Determinism

The `deriveEditionTokenId(contentQubeId, editionNumber)` function produces
`SHA-256("edition:<uuid>:<n>")` → uint256. Before mainnet deployment, run a
spot-check to confirm:

- Two calls with the same inputs produce the same token ID
- Token IDs for editions of different content qubes don't collide (check
  a sample of 10 qubes × 1,860 editions — collisions are astronomically
  unlikely given SHA-256, but worth asserting)

## Notes

- Commons (rarity = 'common') are **permanently excluded** from canonical
  minting. The `isCanonicalRarity()` guard enforces this.
- The minting service emits a `content_qube_dvn_receipts` row with
  `receipt_kind = 'mint'` for every successful on-chain mint.
- Phase 7B.1 (ICP DVN anchoring of receipt rows) is tracked separately.
