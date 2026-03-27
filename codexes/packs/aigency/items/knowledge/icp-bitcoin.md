# Knowledge — ICP & Bitcoin Infrastructure

ICP (Internet Computer Protocol) canisters and Bitcoin integration powering the iQube Protocol's cross-chain and anchoring capabilities.

---

## 1. ICP Canister Architecture

The protocol deploys four specialised ICP canisters:

| Canister | ID | Purpose |
|----------|----|---------|
| `cross_chain_service` | `u6s2n-gx777-77774-qaaba-cai` | LayerZero DVN quorum verification, cross-chain messaging |
| `proof_of_state` | `ulvla-h7777-77774-qaacq-cai` | Bitcoin state anchoring, batch receipts |
| `btc_signer_psbt` | `uxrrr-q7777-77774-qaaaq-cai` | Bitcoin PSBT signing and broadcast (tECDSA) |
| `evm_rpc` | `uzt4z-lp777-77774-qaabq-cai` | EVM chain RPC relay via ICP HTTP outcalls |

> Note: `NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID` env var overrides the `cross_chain_service` ID in AigentZBeta runtime.

**Additional canisters**:

| Canister | ID | Purpose |
|----------|----|---------|
| `RewardHub` | `lvo2w-jqaaa-aaaas-qc2wa-cai` | Task reward proposals and multi-sig distribution |
| `RQH` (Reputation Quality Hub) | `zdjf3-2qaaa-aaaas-qck4q-cai` | Reputation bucket scoring (0–4) |

---

## 2. ICP Actor Pattern

Source: `services/ops/icAgent.ts`

All canister interactions use the `getActor()` factory:

```typescript
import { getActor } from '@/services/ops/icAgent';
import { idlFactory } from '@/services/ops/idl/<canister>';

const actor = await getActor(canisterId, idlFactory);
```

**Gateway selection logic**:
1. `DFX_NETWORK=local` → `http://127.0.0.1:4943`
2. `DFX_NETWORK=ic` (or unset) → `https://ic0.app`
3. Local replica unreachable (1.5s timeout) → `https://icp-api.io` fallback

**Identity**:
- Server-side PEM from `DFX_IDENTITY_PEM` or file at `DFX_IDENTITY_PEM_PATH`
- Supports Ed25519KeyIdentity and Secp256k1KeyIdentity
- Falls back to anonymous if no PEM

**Build-time guard**: All canister calls throw immediately during Next.js production build (`NEXT_PHASE === 'phase-production-build'`).

---

## 3. Bitcoin Anchoring

Source: `services/ops/btcService.ts`, `proof_of_state` + `btc_signer_psbt` canisters

### 3.1 Anchoring Flow

```
App / Ops Console
  │
  ├─ proof_of_state.issue_receipt(data)
  │    └─ returns receipt_id
  │
  ├─ proof_of_state.batch([receipt_id, ...])
  │    └─ groups receipts into a batch
  │
  ├─ proof_of_state.anchor(batch_id)
  │    └─ requests BTC anchoring
  │         │
  │         └─ btc_signer_psbt.create_and_broadcast_anchor(batch)
  │              └─ HTTP outcall → Bitcoin testnet via Blockstream API
  │              └─ returns txid
  │
  └─ proof_of_state.get_batches()
       └─ returns batches with txid once confirmed
```

### 3.2 Bitcoin Testnet Block Height

Used in Ops Console for network health monitoring:

```typescript
// Primary: Blockstream testnet API
GET https://blockstream.info/testnet/api/blocks/tip/height
// Returns plain text block height number

// Fallback: mempool.space
GET https://mempool.space/testnet/api/blocks/tip/height
```

API route: `GET /api/ops/btc/height` → `{ height: number, source: 'blockstream' | 'mempool' }`

### 3.3 Async Anchoring

Bitcoin anchoring is asynchronous. The flow:
1. Receipt issued and batched
2. `anchor()` called — ICP canister makes HTTP outcall to broadcast PSBT
3. On failure: falls back to mock anchoring
4. txid returned when confirmed on testnet

---

## 4. RewardHub Canister

Source: `services/ops/idl/reward_hub.ts`, `services/crm/taskCanisterService.ts`

**Canister ID**: `lvo2w-jqaaa-aaaas-qc2wa-cai`

### 4.1 Core Types (Candid)

```
type RewardProposal = record {
  task_id: text;
  recipient: principal;
  amount: nat64;
  metadata: opt vec record { text; text };
};

type Approval = record {
  approver: principal;
  timestamp: nat64;
};

type Distribution = record {
  proposal_id: nat64;
  recipient: principal;
  amount: nat64;
  distributed_at: nat64;
};
```

### 4.2 Key Methods

| Method | Description |
|--------|-------------|
| `propose_reward(proposal)` | Submit a reward proposal for a completed task |
| `approve_proposal(proposalId)` | Multi-sig approval (requires N approvers) |
| `distribute(proposalId)` | Execute reward distribution after quorum |
| `get_approvals(proposalId)` | Get current approvals for a proposal |
| `get_distributions()` | List all completed distributions |

### 4.3 Task → Reward Flow

```
Task completed (CRM / taskCanisterService)
  ↓
RewardHub.propose_reward(task_id, recipient, amount)
  ↓
Multi-sig approvals (platform operators)
  ↓
RewardHub.distribute(proposalId)
  ↓
RQH canister updates reputation bucket for recipient
```

---

## 5. RQH — Reputation Quality Hub

Source: `services/crm/taskCanisterService.ts`

**Canister ID**: `zdjf3-2qaaa-aaaas-qck4q-cai`

Tracks reputation scores for agents and iQube operators across the platform.

### 5.1 Reputation Buckets

| Bucket | Level | Meaning |
|--------|-------|---------|
| 0 | Unverified | No attestation |
| 1 | Community | Community-verified actions |
| 2 | Operator | Platform operator verified |
| 3 | Platform | Full platform verification |
| 4 | Fully attested | Cross-chain DVN attested |

Bucket level gates certain platform operations (e.g., minting to public registry, cross-chain grants).

---

## 6. EVM RPC via ICP

The `evm_rpc` canister (`uzt4z-lp777-77774-qaabq-cai`) relays Ethereum/EVM RPC calls through ICP HTTP outcalls, providing censorship-resistant access to EVM chain state.

Used by Ops Console for:
- Ethereum Sepolia live RPC health checks
- Polygon Amoy live RPC health checks
- Transaction monitoring for DVN events
- Block number and chain health queries

---

## 7. Bitcoin Ordinals & Runes (Phase 3)

The full ICP/BTC architecture targets Bitcoin-native token representation:

- **Ordinals** — KNYT token on Bitcoin via Ordinals inscription
- **BRC-721** — NFT class/instance minting on Bitcoin
- **Runes** — alternative Bitcoin token protocol
- **OP_RETURN anchoring** — proof-of-state Merkle roots embedded in Bitcoin transactions; SPV-verifiable

Dual-lock minting workflow:
```
EVM class token ↔ BTC collection (parallel ERC-721 + Ordinal)
  ├─ EVM: mint ERC-721 instance
  └─ BTC: mint corresponding Ordinal
      └─ proof_of_state anchors Merkle batch root via OP_RETURN txid
```

This is Phase 3 (currently disabled in `types/chains.ts`; Bitcoin chain config is non-EVM, `isEnabled: false`).

---

## 8. Cross-Chain DVN (ICP ↔ EVM)

See `items/knowledge/dvn.md` for full DVN architecture.

Summary: `cross_chain_service` canister provides LayerZero DVN quorum verification. Messages submitted from EVM chains are attested by the canister before cross-chain operations are executed. Requires 2/N attestations.

---

## 8. Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID` | DVN cross-chain canister ID |
| `DFX_NETWORK` | `local` or `ic` |
| `DFX_IDENTITY_PEM` | Ed25519/Secp256k1 PEM for canister auth |
| `DFX_IDENTITY_PEM_PATH` | Path to PEM file (server-side only) |
| `REWARD_HUB_CANISTER_ID` | RewardHub canister (server-side) |
| `RQH_CANISTER_ID` | Reputation Quality Hub canister (server-side) |
