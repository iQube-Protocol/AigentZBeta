# Network & Minting State — iQube Protocol Platform

**Last verified:** 2026-04-21  
**Scope:** ICP canisters, EVM contracts, KNYT minting, Q¢ minting, DVN pipeline, Bitcoin anchoring

---

## ICP Canisters — Live Status

All four protocol canisters are deployed and confirmed live as of 2026-04-21. The actor factory at `services/ops/icAgent.ts` uses `@dfinity/agent` `HttpAgent` + `Actor.createActor()` targeting `https://ic0.app` for mainnet.

| Canister | Env var | IDL file | Integration level |
|---|---|---|---|
| `proof_of_state` | `PROOF_OF_STATE_CANISTER_ID` | `services/ops/idl/proof_of_state.ts` | Full — multiple live API routes |
| `cross_chain_service` | `CROSS_CHAIN_SERVICE_CANISTER_ID` | `services/ops/idl/cross_chain_service.ts` | Full — DVN submit, attest, quorum |
| `evm_rpc` | `EVM_RPC_CANISTER_ID` | `services/ops/idl/evm_rpc.ts` | Full — chain discovery, high-value routing |
| `btc_signer_psbt` | `BTC_SIGNER_CANISTER_ID` | `services/ops/idl/btc_signer_psbt.ts` | Partial — IDL defined, no backend calls wired yet |
| `rqh` (Reputation Hub) | `RQH_CANISTER_ID` (default: `sp5ye-2qaaa-aaaao-qkqla-cai`) | `services/ops/idl/rqh.ts` | Full — reputation buckets + evidence |
| `reward_hub` | `REWARD_HUB_CANISTER_ID` | `services/ops/idl/reward_hub.ts` | Full — reward proposals + distribution |

Secondary canisters: `escrow` (cohort/alias), `fbc` (Flag Bulletin), `dbc` (Dispute Board) — IDLs defined, routes partially stubbed.

---

## Bitcoin Anchoring — proof_of_state

**Status: Operational on testnet. Mainnet ready via env flag.**

The `proof_of_state` canister receives data hashes, builds Merkle batches, and anchors each batch to Bitcoin. The `MerkleBatch` record contains `btc_anchor_txid` and `btc_block_height` — populated by the canister after a successful anchor call. `/api/ops/btc/status` reads real confirmation counts from mempool.space/blockstream.

**API routes that call this canister:**

| Route | Method | Canister call |
|---|---|---|
| `/api/ops/pos/issue-receipt` | POST | `issue_receipt(data_hash)` |
| `/api/ops/btc/anchor` | POST | `issue_receipt()` → `batch()` → `anchor()` |
| `/api/ops/btc/fast-anchor` | POST | `fast_anchor()` |
| `/api/ops/btc/batch-now` | POST | `batch_now()` |
| `/api/ops/btc/status` | GET | `get_batches()`, `get_pending_count()` |
| `/api/ops/canisters/health` | GET | `get_pending_count()` |

**btc_signer_psbt gap:** The IDL defines `get_btc_address()`, `create_anchor_transaction()`, `sign_transaction()`, `broadcast_transaction()`. `services/x402/adapters/btc.ts` returns a placeholder instead of calling these. **Effort to wire: 2–3 days.** Requires `BTC_SIGNER_CANISTER_ID` env var in production.

**Bitcoin mainnet switch:** Change `BTC_NETWORK=mainnet` in env. The Blockstream/mempool.space endpoints support both networks. **Effort: 0.5 day** once testnet flow is fully validated.

---

## DVN Pipeline — cross_chain_service

**Status: Operational. 2-step quorum implemented. Receipt finalization loop missing.**

The DVN pipeline uses `cross_chain_service` ICP canister for message submission and attestation. `DVN_MOCK_MODE=true` env var switches to mock data for testing.

**2-step quorum flow:**
1. `submit_dvn_message(sourceChain, destChain, payload, messageId)` → message enters `pending_messages`
2. Two validators each call `submit_attestation(messageId, validatorId, signatureBytes)`
3. Message moves to `ready_messages` — quorum reached
4. `verify_layerzero_message()` confirms cross-chain delivery

The `/api/ops/dvn/debug/full-check` route exercises this full flow. `/api/ops/dvn/attest` and `/api/ops/dvn/tx` expose attestation submission and status reads.

**DVN batcher (KNYT):** `services/wallet/knyt/knytDvnBatcher.ts` queues KNYT ledger events in memory, auto-flushes at 100 events or 60s, submits to `/api/ops/dvn/monitor`.

**QubeTalk receipts:** `services/dvn/qubetalkReceiptPipeline.ts` submits QubeTalk delegation completions directly to `cross_chain_service.submit_dvn_message()`.

**Finalization gap:** Receipts in `registry_receipts`, `wallet_transactions`, and `qc_events` are created as `provisional=true` and never finalized. The schema has `finalized_at` and `provisional` columns. No service reads DVN attestation results back and closes these records. **Effort: 3–4 days** — new `services/dvn/receiptFinalizationService.ts` + `/api/ops/dvn/finalize` endpoint + real DVN status replacing mock in `dvnService.ts`.

---

## EVM Smart Contracts

### QCT (QriptoCENT) — Deployed on 5 Testnets

**Contract address (identical on all chains):** `0x4C4f1aD931589449962bB675bcb8e95672349d09`

| Chain | ChainId | Status |
|---|---|---|
| Base Sepolia | 84532 | ✅ Deployed |
| Optimism Sepolia | 11155420 | ✅ Deployed |
| Polygon Amoy | 80002 | ✅ Deployed |
| Arbitrum Sepolia | 421614 | ✅ Deployed |
| Ethereum Sepolia | 11155111 | ✅ Deployed |
| **Base mainnet** | 8453 | ❌ Not deployed |

- Source: `contracts/QCT.sol` | ABI: `artifacts/contracts/QCT.sol/QriptoCENT.json`
- Reserve contract: `contracts/QCTReserve.sol` (1 USDC = 100 QCT; max fee 0.5%)
- Deployment scripts: `scripts/deploy-qct-erc20.js`, `scripts/deploy-qct-reserve.js`
- Chain config: `config/qct-contracts.ts`, `types/chains.ts`
- Balance reading: `app/utils/balanceUtils.ts` via `ethers.JsonRpcProvider` + `ethers.Contract`

**Other contracts:**
- `contracts/ClaimManager.sol` — claim operations
- `contracts/TokenQubeACL.sol` — access control for token qubes (ABI at `services/contracts/ITokenQubeACL.ts`)
- `contracts/MockUSDC.sol` — test USDC

**Bitcoin testnet QCT:** `tb1qywewf6kshzgvq9awzr46awhylu40v68tr8acm2`  
**Solana testnet SPL mint:** `H9FwtJbadVob3rpAwrjbw5dcfBM9VtbXHbM3UaDNKWBT`  
Neither is yet wired into the active minting flow.

### KNYT — EVM Mainnet (Read-Only)

Two contract addresses tracked on Ethereum mainnet:
- `0xe53dad36cd0A8EdC656448CE7912bba72beBECb4`
- `0xCf890B7acBB5ffe0540a01860A75D3d765bF0756`

`services/wallet/knyt/evmKnytService.ts` reads balances via `viem` + `createPublicClient` → `readContract()`. No write path exists. Writable minting contract and minter-role holder must be confirmed before canonical minting can be implemented.

---

## KNYT Token — Minting States

| State | Label in UI | Status | Key files |
|---|---|---|---|
| Remote Custody | DVN KNYT | **Live** | `knytLedgerService.ts`, `knytDvnBatcher.ts` |
| Deferred Claim | — | Infra exists, not wired | `app/api/x402/claims/`, claims table from `20251105114300_remote_custody_claim.sql` |
| Canonical | EVM KNYT | Read-only | `evmKnytService.ts` (balance read only) |

**Remote custody (DVN KNYT):** Supabase ledger (`wallet_balances`, `wallet_transactions`). PayPal purchase (`paypalService.ts`) credits via `creditKnyt()`. DVN batcher submits events. Fully operational.

**Deferred claim gap:** x402 claims table, `GET/POST /api/x402/claims`, and redemption endpoint exist. KNYT purchase/reward paths call `creditKnyt()` immediately — no branch for issuing a claim record. **Effort: 1.5 days** — add `minting_mode` branch in `knytPurchaseService.ts` + redemption handler + reward grant path.

**Canonical minting gap:** `app/api/core/mint-tokenqube/route.ts` returns mock transaction hashes with a 2-second delay. No `viem` `writeContract()` call exists. **Effort: 1–2 days** after confirming writable contract address and minter role. Blocked on that confirmation.

**EVM KNYT as payment:** No code path reads on-chain balance as payment input, requests ERC-20 approval, or calls `transferFrom`. **Effort: 2–3 days** — needs payment-receiving contract address or designated hot wallet.

**DVN KNYT as payment for canonical purchases:** `debitKnyt()` already works. Adding this as a payment option requires wiring the debit to a canonical asset mint call. **Effort: 1 day** once canonical minting is wired.

---

## Q¢ (QriptoCENT) — Minting States

| State | Status | Key files |
|---|---|---|
| Remote Custody (Supabase ledger) | **Live** | `qcEventService.ts`, `qc_events` table |
| Deferred Claim | Not wired | Same x402 infra as KNYT |
| Canonical (EVM testnet) | Deployed, not activated | `0x4C4f1aD931589449962bB675bcb8e95672349d09` |
| Base Q¢ mainnet | **Not deployed** | `QCTReserve.sol` has mainnet USDC addr |

**Supabase ledger:** Immutable event log (`qc_events`) with directions: credit / debit / meter. Alpha: all SkillQube invocations are 0 Q¢. Events are `provisional=true` until DVN confirms — finalization loop is the same gap as KNYT.

**Base Q¢ mainnet deployment steps:**
1. Fund deployer wallet with ETH on Base mainnet
2. `node scripts/deploy-qct-erc20.js` → Base mainnet (add network entry to `hardhat.config.js`)
3. `node scripts/deploy-qct-reserve.js` with Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
4. `node scripts/update-deployed-addresses.js`
5. Set `NEXT_PUBLIC_QCT_BASE_MAINNET` in env; enable Base mainnet in `types/chains.ts`

**Effort: 0.5 day** (deployment is scripted). On-chain balance read + canonical mint wiring: **1–2 additional days**.

---

## Gap Summary with Effort

| Gap | Days | Phase |
|---|---|---|
| KNYT deferred claim issuance | 1 | 1 |
| KNYT claim redemption → creditKnyt() | 0.5 | 1 |
| Q¢ deferred claim | 0.5 | 1 |
| SmartWallet pending claims UI | 1 | 1 |
| DVN finalization service | 3–4 | 2 |
| Real DVN status (replace mock) | 0.5 | 2 |
| Base Q¢ mainnet deployment | 0.5 | 3a |
| Q¢ on-chain balance + canonical mint | 1–2 | 3a |
| KNYT canonical mint() | 1–2 | 3b |
| EVM KNYT payment flow | 2–3 | 3b |
| DVN receipts for canonical mints | 1 | 3b |
| btc_signer_psbt wiring | 2–3 | 4 |
| Bitcoin mainnet switch | 0.5 | 4 |
| **Total** | **15–21 days** | |

---

## Key Environment Variables

```bash
# ICP Canisters
PROOF_OF_STATE_CANISTER_ID
CROSS_CHAIN_SERVICE_CANISTER_ID
EVM_RPC_CANISTER_ID
BTC_SIGNER_CANISTER_ID          # Live canister, env var may not be set in production
RQH_CANISTER_ID                 # Default: sp5ye-2qaaa-aaaao-qkqla-cai
REWARD_HUB_CANISTER_ID

# DVN
DVN_MOCK_MODE                   # Set 'true' to bypass real canister calls

# EVM / Bitcoin
BTC_NETWORK                     # 'testnet' (current) | 'mainnet' (switch when ready)
BTC_CUSTODY_ENABLED             # 'true' to activate BTC custody flow
EVM_DEPLOYER_KEY                # Private key for contract deployment
EVM_RPC_MODE                    # 'auto' | 'force_server' | 'force_canister'
NEXT_PUBLIC_QCT_BASE_MAINNET    # Populate after Base mainnet deployment

# KNYT
NEXT_PUBLIC_KNYT_CONTRACT       # EVM KNYT contract address
```

---

*Part of the AgentiQ cartridge Codebase collection. See also: `identity-and-reputation-state.md` for DIDQube, FIO, and reputation system state.*
