# Knowledge — DVN (Decentralized Verification Network)

The DVN is the cross-chain attestation and message verification layer for the iQube Protocol. It uses a LayerZero-compatible quorum model implemented as an ICP canister.

---

## 1. Overview

The DVN verifies cross-chain messages before execution — ensuring that iQube capability grants, token transfers, and state changes that span multiple chains (EVM ↔ ICP ↔ Bitcoin) are attested by a trusted quorum before being acted upon.

**Quorum requirement**: 2 attestations required for execution.

DVN status is surfaced in the Ops Console Network Ops panel (Aigent Z → Settings → Network Ops).

### 1.1 Hybrid DVN Routing

The platform uses a hybrid routing strategy to optimise cost:

| Operation type | Route | Rationale |
|---------------|-------|-----------|
| Low-risk / routine | Next.js server-side API | ~90% cycle cost reduction |
| High-risk / high-value | ICP canister (cross_chain_service) | Full DVN attestation required |

The routing threshold is governance-controlled and determined by transaction value and risk assessment. This means most API calls handle DVN operations directly in the Next.js API layer; only threshold-crossing operations invoke the ICP canister.

---

## 2. Cross-Chain Service Canister

The core DVN logic runs in the `cross_chain_service` ICP canister.

| Property | Value |
|----------|-------|
| Canister ID (env) | `NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID` |
| Canister ID (legacy ref) | `u6s2n-gx777-77774-qaaba-cai` |
| Canister ID (updated mainnet) | `sp5ye-2qaaa-aaaao-qkqla-cai` *(deployed Oct 2025 to resolve connectivity)* |
| Service file | `services/ops/dvnService.ts` |
| API routes | `/api/ops/dvn/*`, `/api/a2a/dvn/*` |

> The active canister ID is determined by `NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID` at runtime. Check `.env.local` for the current value.

### 2.1 Key Canister APIs

| Method | Description |
|--------|-------------|
| `submit_dvn_message(msg)` | Submit a cross-chain message for DVN processing |
| `get_dvn_message(id)` | Retrieve a message by ID |
| `submit_attestation(messageId, sig)` | Add an attestation to a message |
| `get_message_attestations(messageId)` | Get all attestations for a message |
| `monitor_evm_transaction(txHash, chain)` | Monitor EVM tx for DVN event |
| `verify_layerzero_message(packet)` | Verify a LayerZero packet |

---

## 3. DVN Flow

### 3.1 EVM → ICP Cross-Chain Grant

```
EVM Chain (e.g., Base Sepolia)
  │  TokenQubeACL.grantCapability(grantee, iQubeRef, scopes, ttl)
  │  → emits CapabilityGranted event
  ↓
LayerZero DVN
  │  monitors EVM event via cross_chain_service.monitor_evm_transaction()
  │  attestors call submit_attestation() [quorum: 2]
  ↓
cross_chain_service ICP canister
  │  verify_layerzero_message(packet)
  │  → quorum reached: execute cross-chain capability grant on ICP
  ↓
ICP state update
  │  capability recorded, recipient can now decrypt BlakQube on ICP side
```

### 3.2 x402 + DVN

When `x-402-dvn-attest` header is present on an x402 request:

```
Client sends x402 request with 'x-402-dvn-attest': attestationSignature
  ↓
API route validates attestation via dvnService.verifyAttestation(sig, messageId)
  ↓
If valid: proceed with iqube.grant / iqube.deliver / iqube.transfer
If invalid: 402 Payment Required or 403 Forbidden
```

### 3.3 DVN Sequence (Ops Console)

```
Ops Console → /api/ops/dvn/status → cross_chain_service.get_message_attestations()
            ← { ok: true, attestations: N, quorum: 2, lastUpdate: timestamp }
```

---

## 4. DVN in Smart Contracts

Source: `contracts/TokenQubeACL.sol`

The `verifyDVNAttestation()` function on `TokenQubeACL.sol` validates DVN signatures for cross-chain capability operations:

```solidity
function verifyDVNAttestation(
    bytes32 messageId,
    bytes calldata attestation
) external view returns (bool valid)
```

Cross-chain capability grants require a valid DVN attestation before the on-chain ACL is updated.

---

## 5. DVN in the Studio (A2A API)

Source: API routes at `/api/a2a/dvn/`

The A2A (Agent-to-Agent) API exposes DVN operations for agent-to-agent credential verification:

- `POST /api/a2a/dvn/submit` — submit a DVN message from an agent
- `GET /api/a2a/dvn/status/:id` — check message status
- `POST /api/a2a/dvn/attest` — submit an attestation

These routes use the same `cross_chain_service` canister via `dvnService.ts`.

---

## 6. DVN Configuration

**Environment variables**:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID` | Cross-chain service canister ID |
| `DFX_NETWORK` | `local` or `ic` (mainnet) |
| `DFX_IDENTITY_PEM` | Optional PEM key for authenticated canister calls |

**ICP gateway selection** (`services/ops/icAgent.ts`):
- `DFX_NETWORK=local` → `http://127.0.0.1:4943`
- `DFX_NETWORK=ic` → `https://ic0.app`
- Local unreachable → fallback to `https://icp-api.io`

---

## 7. DVN Monitoring

The Ops Console DVN card shows:
- Attestation count for recent messages
- Quorum status (2/2 required)
- Last update timestamp
- Error details on network failure

DVN status is polled on 30-second intervals alongside ICP canister health checks.
