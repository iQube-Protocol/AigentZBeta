# Mainnet Deployment Registry
*Doc 35 — On-chain contract addresses, deploy procedures, and BTC anchoring wiring for AgentiQ KNYT Alpha*

**Status:** QCT + iQubeNFT + QCTReserve LIVE on Base mainnet (2026-05-28)
**Last updated:** 2026-05-28

---

## 0. Live Contract Roster — Base Mainnet (chainId 8453)

All three QCT-era contracts deployed AND verified 2026-05-28 from AigentZ EOA `0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844`. ~0.000023 ETH total deploy gas (≈$0.05).

| Contract | Address | Deploy tx | Source verified |
|---|---|---|---|
| **QriptoCENT (QCT)** — Base Q¢ ERC-20, 18 dec, 400M premine, 1B cap | `0x46CD79B8f795169FC59D5f1DE1a444c3C39fE7CE` | `0xaa7e258a64a1e72cebf8413e5dceb04c97d8bc02d2352d3c51ab89dbc7dbe066` | ✅ [#code](https://basescan.org/address/0x46CD79B8f795169FC59D5f1DE1a444c3C39fE7CE#code) |
| **iQubeNFT** — Base iQube ERC-721 identity anchor | `0xD7e07dF8259bD491B1259892F4Fb9357Dd0aff17` | `0xb0eea0101265c5ec57b29922c225702df3a74b1f211e840cc37fb5f52d91b21d` | ✅ [#code](https://basescan.org/address/0xD7e07dF8259bD491B1259892F4Fb9357Dd0aff17#code) |
| **QCTReserve** — Base Q¢ ↔ Base USDC swap (1 USDC = 100 QCT, 0.1% fee) | `0x06Be2FbcBBB9cCA2D0Ce1753AdC18ab8021dc0FA` | `0xa8ea8d9b3630fa102cc8fe543002cff61b0957122b27422a4daf5718d55fcade` | ✅ [#code](https://basescan.org/address/0x06Be2FbcBBB9cCA2D0Ce1753AdC18ab8021dc0FA#code) |
| `QCT.setReserve(reserve)` linking tx | (call on QCT above) | `0x68e8a43ec6c299bb1b7f1b59a46352a4edee6d21e8719020d604867668f3508f` | — |

USDC reference: canonical Circle USDC on Base at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (no deploy needed).

### Amplify env vars (set in dev branch, soak, then main)

```
NEXT_PUBLIC_QCT_BASE_MAINNET=0x46CD79B8f795169FC59D5f1DE1a444c3C39fE7CE
NEXT_PUBLIC_QCT_BASE_MAINNET_CHAIN_ID=8453
IQUBE_NFT_CONTRACT_ADDRESS=0xD7e07dF8259bD491B1259892F4Fb9357Dd0aff17
IQUBE_NFT_CHAIN_ID=8453
NEXT_PUBLIC_QCT_RESERVE_BASE_MAINNET=0x06Be2FbcBBB9cCA2D0Ce1753AdC18ab8021dc0FA
```

### Deploy scripts (chain-pinned + balance-prechecked — use these, not the legacy multi-chain scripts)

```
scripts/deploy-qct-base-mainnet.js          # QCT
scripts/deploy-iqube-nft-base-mainnet.js    # iQubeNFT
scripts/deploy-qct-reserve-base-mainnet.js  # QCTReserve (reads QCT address from deployments/qct-base-mainnet.json)
scripts/verify-deployer-key.js              # local key→address derivation, no RPC
```

Hardhat config requires `version: "0.8.27"` + `evmVersion: "cancun"` (OpenZeppelin v5 Bytes.sol uses the Cancun `mcopy` opcode; Base is fully Dencun-compatible).

### Deployment artefacts persisted to repo

```
deployments/qct-base-mainnet.json
deployments/iqube-nft-base-mainnet.json
deployments/qct-reserve-base-mainnet.json
```

---

## 1. KNYT Contracts — Base Mainnet (chainId 8453)

Both contracts are live. The second holds the `minter` role used for canonical EVM minting.

| Contract | Address | Role |
|----------|---------|------|
| KNYT ERC-20 (original) | `0xe53dad36cd0A8EdC656448CE7912bba72beBECb4` | Balance tracking |
| KNYT ERC-20 (minter) | `0xCf890B7acBB5ffe0540a01860A75D3d765bF0756` | Canonical mint target |

**Service file:** `services/wallet/knyt/evmKnytService.ts`  
- Reads balances via raw `eth_call` JSON-RPC (no chain library at read time)
- Mints via `ethers` v6 dynamic import — calls `mint(address, uint256)` on the minter contract

**Required env vars:**
```
KNYT_MINTER_PRIVATE_KEY=0x...   # wallet holding minter role on 0xCf89...
BASE_RPC_URL=https://mainnet.base.org  # optional, this is the default
```

---

## 2. KNYT Minting Modes (per-SKU config)

Three modes, configurable per SKU in the admin panel:

| Mode | Behaviour | When to use |
|------|-----------|------------|
| `immediate` | DVN ledger credit only | Default — no on-chain cost |
| `deferred` | x402 claim token issued | Deferred settlement |
| `canonical` | EVM `mint()` on Base | KS backers, high-value events |

**Config table:** `knyt_sku_config` (Supabase)  
**Admin API:** `GET / PATCH /api/admin/knyt/sku-config`  
**UI:** KnytStoreAdminTab → Minting section  
**Migration:** `supabase/migrations/20260421000002_knyt_sku_config.sql`

SKU slugs covered: `episode_-1` through `episode_12`, all bundles, `cards_all`, `qripto_all`.

---

## 3. QCT (QriptoCENT) — Base Mainnet Deployment (PENDING)

### Deployer

```
Address:  0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844   ← AigentZ EOA
Required: 0.002 ETH on Base mainnet (send from Kraken, select Base network)
```

> **Important:** Do NOT use MoneyPenny's address `0x8D286CcECf7B838172A45c26a11F019C4303E742` — it is an EIP-7702 smart account (Coinbase delegation) and cannot sign Hardhat transactions. ETH sent there is forwarded automatically by the delegation contract `0x3Ae1F70C...F62162D10`.

### Deploy sequence

Once 0.002 ETH is in the AigentZ EOA and `EVM_DEPLOYER_KEY` is set:

```bash
git pull origin dev

# 1. Deploy QriptoCENT ERC-20 (400M premine to deployer)
npx hardhat run scripts/deploy-qct-erc20.js --network base

# 2. Deploy QCTReserve (1 USDC = 100 QCT, 0.1% fee)
npx hardhat run scripts/deploy-qct-reserve.js --network base
```

### Post-deploy env vars (set in Amplify)

```
NEXT_PUBLIC_QCT_BASE_MAINNET=<QriptoCENT contract address>
NEXT_PUBLIC_QCT_RESERVE_BASE_MAINNET=<QCTReserve contract address>
QCT_BRIDGE_PRIVATE_KEY=0x...    # wallet with bridge mint role
EVM_DEPLOYER_KEY=0x...          # AigentZ EOA private key
```

### QCT contract specs

- **QriptoCENT:** 400M premine → deployer; `mint()` restricted to reserve; `bridgeMint()` restricted to bridge
- **QCTReserve:** 1 USDC → 100 QCT (0.1% fee); live Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Service file:** `services/wallet/qctCanonicalService.ts`
- **Reserve API:** `GET /api/qct/reserve`

---

## 4. BTC Anchoring — ICP Canister (Phase 4)

### Architecture

Bitcoin anchoring runs through the `btc_signer_psbt` ICP canister using threshold ECDSA. No Bitcoin private key exists in this codebase — signing is fully delegated to ICP.

**Flow per iQube ref:**
1. `get_btc_address(derivPath)` — derives a per-iQube custody BTC address  
2. Blockstream API — fetches UTXOs + script pubkeys for that address  
3. `create_anchor_transaction(sha256(iqubeRef), utxos, feeRate)` — builds OP_RETURN tx  
4. `sign_transaction(unsignedTx, derivPath)` — ICP threshold ECDSA signs it  
5. `broadcast_transaction(rawTx)` — broadcasts to Bitcoin network  

**Graceful degradation:**
- `BTC_CUSTODY_ENABLED=false` (default) → returns plan without executing
- `BTC_SIGNER_PSBT_CANISTER_ID` not set → returns plan without executing
- Custody address has no UTXOs → returns address so caller can fund it

**Service file:** `services/x402/adapters/btc.ts`  
**IDL:** `services/ops/idl/btc_signer_psbt.ts`  
**Fee source:** Blockstream fee-estimates API (6-block target, fallback 10 sat/vB)

### Required env vars

```
BTC_CUSTODY_ENABLED=true         # set to activate
BTC_NETWORK=testnet              # change to mainnet after testnet validation
BTC_SIGNER_PSBT_CANISTER_ID=    # ICP canister ID for btc_signer_psbt
BTC_CUSTODIAN_KEY_REF=           # KMS ref (informational, not used for signing)
DFX_NETWORK=ic                   # ensure mainnet ICP gateway
```

### Mainnet activation checklist

- [ ] Deploy `btc_signer_psbt` canister to ICP mainnet
- [ ] Set `BTC_SIGNER_PSBT_CANISTER_ID` in Amplify
- [ ] Validate full flow on testnet with a funded testnet address
- [ ] Set `BTC_NETWORK=mainnet`
- [ ] Set `BTC_CUSTODY_ENABLED=true`
- [ ] Fund the custody address returned in the first `planBtcCustody` call

---

## 5. Pre-Launch Key Rotation (REQUIRED before go-live)

All agent keys are suspected compromised. Before go-live, rotate:

| Key | Used by | Env var |
|-----|---------|---------|
| KNYT minter key | `evmKnytService.mintKnyt()` | `KNYT_MINTER_PRIVATE_KEY` |
| QCT bridge key | `qctCanonicalService.mintQctCanonical()` | `QCT_BRIDGE_PRIVATE_KEY` |
| AigentZ EOA key | Hardhat deploys | `EVM_DEPLOYER_KEY` |
| All agent identity keys | Aigent Z, Marketa, Know1, MoneyPenny | Per-agent env vars |

Generate fresh keys off any internet-connected machine, update in Amplify, re-deploy.

---

## 6. Network Config Summary

| Network | Chain ID | RPC | Purpose |
|---------|----------|-----|---------|
| Base mainnet | 8453 | `https://mainnet.base.org` | KNYT + QCT |
| Bitcoin mainnet | — | Blockstream API | BTC anchoring (after activation) |
| Bitcoin testnet | — | Blockstream testnet API | BTC anchoring (current) |
| ICP mainnet | — | `https://ic0.app` | btc_signer_psbt canister |

Hardhat network config: `hardhat.config.js` → `networks.base`  
Chain type overrides: `types/chains.ts` → Base entry switches to `chainId: 8453` when `NEXT_PUBLIC_QCT_BASE_MAINNET` is set
