# Minting Activation Plan — KNYT, Base Q¢ & DVN Pipeline

**Status:** Ready for implementation  
**Last verified:** 2026-04-21  
**Branch:** `claude/setup-knyt-codex-Mrinp`

---

## 1. Verified Current State

### ICP Canisters — All Four Live (confirmed 2026-04-21)

| Canister | Status | Last seen | Integration level |
|---|---|---|---|
| `proof_of_state` | ● Live | 2h ago | Full — IDL + multiple API routes making real calls |
| `btc_signer_psbt` | ● Live | 2h ago | Partial — IDL + Candid types defined; no backend calls wired yet |
| `cross_chain_service` | ● Live | 2h ago | Full — DVN message submit, attestation, quorum verification |
| `evm_rpc` | ● Live | 2h ago | Full — chain discovery and high-value routing |

**Bitcoin anchoring via `proof_of_state` IS operational on testnet.** The canister batches receipts into Merkle trees (`MerkleBatch`), anchors to Bitcoin, and the `/api/ops/btc/status` route reads real `btc_anchor_txid` and `btc_block_height` fields plus confirmation count from mempool.space.

**DVN 2-step quorum IS implemented.** The `/api/ops/dvn/debug/full-check` route executes two attestation passes against `cross_chain_service.submit_attestation()`. Messages migrate from `get_pending_messages()` to `get_ready_messages()` once quorum (2 attestations) is reached. The `/api/ops/dvn/attest` and `/api/ops/dvn/tx` routes expose this live.

**`btc_signer_psbt` is the one gap** in the Bitcoin stack. The IDL at `services/ops/idl/btc_signer_psbt.ts` defines `get_btc_address()`, `create_anchor_transaction()`, `sign_transaction()`, and `broadcast_transaction()` — but `services/x402/adapters/btc.ts` still returns a PSBT plan placeholder without calling the canister.

### EVM Smart Contracts — Deployed on 5 Testnets

**QCT (QriptoCENT) contract address:** `0x4C4f1aD931589449962bB675bcb8e95672349d09`  
Deployed identically on all five testnets:

| Chain | ChainId | Explorer |
|---|---|---|
| Base Sepolia | 84532 | sepolia.basescan.org |
| Optimism Sepolia | 11155420 | sepolia-optimism.etherscan.io |
| Polygon Amoy | 80002 | amoy.polygonscan.com |
| Arbitrum Sepolia | 421614 | sepolia.arbiscan.io |
| Ethereum Sepolia | 11155111 | sepolia.etherscan.io |

Contract source: `contracts/QCT.sol`. ABI: `artifacts/contracts/QCT.sol/QriptoCENT.json`. Deployment scripts: `scripts/deploy-qct-erc20.js`. Reserve contract: `contracts/QCTReserve.sol` (1 USDC = 100 QCT).

**BTC and Solana testnet QCT also exist** (not yet in active minting flow):
- Bitcoin testnet: `tb1qywewf6kshzgvq9awzr46awhylu40v68tr8acm2`
- Solana testnet SPL mint: `H9FwtJbadVob3rpAwrjbw5dcfBM9VtbXHbM3UaDNKWBT`

**KNYT on EVM mainnet** — Two read-tracked contract addresses:
- `0xe53dad36cd0A8EdC656448CE7912bba72beBECb4`
- `0xCf890B7acBB5ffe0540a01860A75D3d765bF0756`

`services/wallet/knyt/evmKnytService.ts` reads from these via `viem` + `readContract()`. Currently read-only.

### KNYT Minting States — Current

| State | Status | Notes |
|---|---|---|
| Remote Custody (DVN KNYT) | **Live** | Supabase ledger + DVN batcher + PayPal purchase |
| Deferred Claim | Infrastructure exists, not wired to KNYT | x402 claims table + API at `/api/x402/claims` exists; KNYT purchase/reward paths do not issue claims |
| Canonical (EVM KNYT) | Read-only | EVM balance read works; no `mint()` call wired |

### Q¢ / QCT Minting States — Current

| State | Status | Notes |
|---|---|---|
| Remote Custody (Supabase ledger) | **Live** | `qcEventService.ts` + `qc_events` table |
| Deferred Claim | Not wired | Same x402 claims infrastructure available |
| Canonical (EVM) | Testnet deployed, not activated | Contract live on 5 testnets; no mint() call in app |
| Base Q¢ Mainnet | **Not deployed** | `QCTReserve.sol` has mainnet USDC addresses; contract not deployed to mainnet |

### DVN Receipt Finalization — Missing

Receipts are created as `provisional=true` and never closed. The schema (`registry_receipts.finalized_at`, `qc_events.finalized_at`) is correct. The DVN pipeline submits and attests. No service reads attestation results back and sets `finalized_at`. All platform receipts are indefinitely provisional.

---

## 2. Target Goals

1. **KNYT minting — activate deferred claim and canonical paths**
   - DVN KNYT already live — no change needed
   - Deferred claim: issue claimable KNYT record from purchase/reward flow; user redeems explicitly
   - Canonical (EVM KNYT): call `mint()` on KNYT mainnet contract from verified claim redemption
   - Payment: accept both DVN KNYT (ledger debit) and EVM KNYT (on-chain balance verify + approve) as payment for canonical asset purchases

2. **Base Q¢ mainnet launch**
   - Deploy `QCTReserve.sol` + `QCT.sol` to Base mainnet
   - Activate all three Q¢ minting states: remote custody (already works), deferred claim, canonical EVM mint
   - Update chain config with mainnet contract address

3. **DVN pipeline integration for all transactions**
   - Every DVN KNYT, EVM KNYT, and Base Q¢ transaction must produce a DVN receipt
   - Receipts must flow through `cross_chain_service` → attestation → finalization
   - Bitcoin anchoring: transactions must flow through `proof_of_state` → `batch()` → `anchor()` → confirmed `btc_anchor_txid`

4. **Bitcoin anchoring — testnet confirmed, mainnet as final phase**
   - The `proof_of_state` → Bitcoin testnet path is already operational
   - Wire `btc_signer_psbt` for custody-layer Bitcoin transaction signing (currently placeholder)
   - Mainnet Bitcoin anchoring: switch `BTC_NETWORK=mainnet` once testnet is fully validated

---

## 3. Gap Analysis

| Gap | Effort | Dev days | Blocker? |
|---|---|---|---|
| Deferred claim issuance for KNYT | Small | 1 | No — x402 claims infra exists |
| KNYT claim redemption → creditKnyt() | Small | 0.5 | No |
| Deferred claim for Q¢ | Small | 0.5 | No |
| SmartWallet UI — pending claims display | Small | 1 | No |
| DVN receipt finalization service | Medium | 3–4 | Yes — all receipts stay provisional without this |
| Replace mock DVN status with real canister query | Small | 0.5 | No |
| Base Q¢ mainnet contract deployment | Small | 0.5 | Requires deployer key + ETH on Base mainnet |
| Q¢ on-chain balance read (mainnet) | Small | 0.5 | Depends on mainnet deploy |
| Q¢ canonical mint() call wiring | Medium | 1–2 | Depends on mainnet deploy |
| KNYT canonical mint() call | Medium | 1–2 | Requires confirming writable contract + minter role |
| EVM KNYT as payment (approve + transferFrom) | Medium | 2–3 | Requires payment-receiving contract or hot wallet |
| DVN receipts for canonical mint events | Small | 1 | Depends on mint() wiring |
| btc_signer_psbt canister wiring | Medium | 2–3 | IDL ready; `BTC_SIGNER_CANISTER_ID` env var must be set |
| Bitcoin mainnet anchoring | Small | 0.5 | Environment flag switch once testnet fully validated |
| **Total (Phase 1–4)** | | **~15–21 days** | |

### Phase effort summary

| Phase | Scope | Days |
|---|---|---|
| Phase 1 — Deferred claims | KNYT + Q¢ issuance, redemption, UI | 3 |
| Phase 2 — DVN finalization | Finalization service + real DVN status | 4–5 |
| Phase 3a — Base Q¢ mainnet | Deploy + on-chain reads + canonical mint | 2–3 |
| Phase 3b — KNYT canonical + EVM payment | mint() call + payment flows + receipts | 4–6 |
| Phase 4 — btc_signer_psbt + mainnet BTC | Canister wiring + mainnet switch | 3 |

---

## 4. Implementation Phases

### Phase 1 — Deferred Claim Activation (KNYT + Q¢)

**Files to change:**
- `services/wallet/knyt/knytPurchaseService.ts` — add `minting_mode` branch; when deferred, call `createClaim()` instead of `creditKnyt()`
- `services/rewards/entitlementService.ts` or rewards grant route — same branch for reward grants
- `app/api/x402/claims/redeem/route.ts` — add KNYT-specific handler: on redemption, call `creditKnyt()`, mark claim `redeemed`
- Same pattern for Q¢: `qcEventService.ts` deferred mode → create Qc claim; on redemption, write finalized `qc_events` record
- SmartWallet UI — expose pending claims count + "Claim" button per item

No new migrations required if `20251105114300_remote_custody_claim.sql` is deployed.

### Phase 2 — DVN Receipt Finalization Loop

**Files to create/change:**
- `services/dvn/receiptFinalizationService.ts` — new: polls `cross_chain_service.get_message_attestations()` for confirmed batches; sets `finalized_at` on matching `wallet_transactions`, `registry_receipts`, `qc_events` records
- `app/api/ops/dvn/finalize/route.ts` — POST endpoint to trigger finalization (called by scheduler or on DVN webhook)
- `services/ops/dvnService.ts` — replace hardcoded mock status with real canister query

**Dependency:** `CROSS_CHAIN_SERVICE_CANISTER_ID` must be populated in env. Verify via Ops Console before starting.

### Phase 3a — Base Q¢ Mainnet Deployment

**Steps:**
1. Run `scripts/deploy-qct-erc20.js` targeting Base mainnet with funded deployer key (`EVM_DEPLOYER_KEY`, sufficient ETH on Base mainnet)
2. Run `scripts/deploy-qct-reserve.js` with Base mainnet USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
3. Run `scripts/update-deployed-addresses.js` to populate `config/qct-contracts.ts` with mainnet address
4. Update `NEXT_PUBLIC_QCT_BASE_MAINNET` in `.env.local` / Amplify env vars
5. Add Base mainnet to chain config in `types/chains.ts` (currently disabled)

**Q¢ canonical mint activation:**
- `app/api/wallet/base-qc/balance/route.ts` — add on-chain balance read via `viem` (same pattern as `evmKnytService.ts`)
- Add `mint()` call path: on deferred claim redemption, call contract `mint(userAddress, amount)` via deployer key or user-signed transaction
- Create DVN receipt for each canonical mint

### Phase 3b — KNYT Canonical Minting + EVM KNYT as Payment

**Files to change:**
- `app/api/core/mint-tokenqube/route.ts` — replace mock hash generation with real `viem` `writeContract()` call to KNYT contract
- `services/wallet/knyt/evmKnytService.ts` — add `mintKnyt(toAddress, amount)` alongside existing balance read
- Purchase flow: add EVM KNYT payment path — read on-chain balance, request ERC-20 `permit` or `approve` signature, call `transferFrom` to platform wallet
- DVN KNYT payment path: `debitKnyt()` (already works) + create canonical asset

**Open question for this phase:** Which KNYT contract address is canonical for minting (`0xe53dad36cd0A8EdC656448CE7912bba72beBECb4` vs `0xCf890B7acBB5ffe0540a01860A75D3d765bF0756`)? Does the platform hold a minter role on one of these, or does a new minting contract need to be deployed? Confirm before coding.

### Phase 4 — btc_signer_psbt Wiring + Bitcoin Mainnet

**Files to change:**
- `services/x402/adapters/btc.ts` — replace `planBtcCustody()` placeholder with real call to `btc_signer_psbt.create_anchor_transaction()` → `sign_transaction()` → `broadcast_transaction()`
- `services/ops/btcService.ts` — wire `BTC_SIGNER_CANISTER_ID` into signing flow alongside existing `proof_of_state` anchoring
- Bitcoin mainnet: change `BTC_NETWORK=mainnet` and update RPC/explorer URLs in `btcService.ts`

**Dependency:** `BTC_SIGNER_CANISTER_ID` must be set in env. The canister is live (confirmed) but the env var may not be populated in production.

---

## 5. Key Files Reference

| Purpose | File |
|---|---|
| KNYT ledger service | `services/wallet/knyt/knytLedgerService.ts` |
| KNYT DVN batcher | `services/wallet/knyt/knytDvnBatcher.ts` |
| KNYT purchase service | `services/wallet/knyt/knytPurchaseService.ts` |
| KNYT EVM balance (viem) | `services/wallet/knyt/evmKnytService.ts` |
| Q¢ event service | `services/qc/qcEventService.ts` |
| x402 claims API | `app/api/x402/claims/route.ts`, `app/api/x402/claims/redeem/route.ts` |
| DVN monitor | `app/api/ops/dvn/monitor/route.ts` |
| DVN attest | `app/api/ops/dvn/attest/route.ts` |
| DVN 2-step quorum debug | `app/api/ops/dvn/debug/full-check/route.ts` |
| Bitcoin status | `app/api/ops/btc/status/route.ts` |
| Bitcoin anchor | `app/api/ops/btc/anchor/route.ts`, `app/api/ops/btc/fast-anchor/route.ts` |
| btc_signer_psbt adapter (placeholder) | `services/x402/adapters/btc.ts` |
| ICP actor factory | `services/ops/icAgent.ts` |
| proof_of_state IDL | `services/ops/idl/proof_of_state.ts` |
| btc_signer_psbt IDL | `services/ops/idl/btc_signer_psbt.ts` |
| cross_chain_service IDL | `services/ops/idl/cross_chain_service.ts` |
| evm_rpc IDL | `services/ops/idl/evm_rpc.ts` |
| QCT contract config | `config/qct-contracts.ts` |
| Chain config | `types/chains.ts` |
| QCT ERC-20 source | `contracts/QCT.sol` |
| QCTReserve source | `contracts/QCTReserve.sol` |
| Deployment script | `scripts/deploy-qct-erc20.js` |
| EVM balance utils | `app/utils/balanceUtils.ts` |
| MetaMask integration | `services/wallet/metamask.ts` |
| Mint episode endpoint | `app/api/mint/episode/route.ts` |
| Mint tokenqube endpoint (mock) | `app/api/core/mint-tokenqube/route.ts` |

---

## 6. Open Questions Before Phase 3b

1. **KNYT canonical contract:** Which of the two mainnet KNYT EVM addresses is the mintable one? Does the platform hold a `MINTER_ROLE` on it?
2. **Q¢ economic model:** Fixed cap or unlimited mint-on-demand backed by reserve?
3. **EVM KNYT payment:** Does the platform use a hot wallet to receive `transferFrom`, or a payment contract?
4. **BTC_SIGNER_CANISTER_ID env:** Is this populated in production Amplify env vars?

---

*Generated: 2026-04-21*  
*Based on: comprehensive codebase exploration + 4 ICP canister IDL review + 5 EVM testnet contract verification*
