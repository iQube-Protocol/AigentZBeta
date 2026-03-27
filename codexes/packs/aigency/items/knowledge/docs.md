# Knowledge — Platform Documentation

Canonical platform documentation for the iQube Protocol and AgentiQ ecosystem.

---

## 1. iQube Protocol — Overview

The iQube Protocol is a decentralized AI agent framework that integrates contextual intelligence, blockchain-backed state management, and tokenized information access. The core abstraction is the **iQube** — a verifiable, composable data asset with public metadata, encrypted private data, and token-gated access control.

### 1.1 iQube Core Components

Every iQube is built from three structural layers:

| Component | Visibility | Purpose |
|-----------|-----------|---------|
| **MetaQube** | Public | Verifiable metadata: name, type, scoring, business model, ownership |
| **BlakQube** | Private (encrypted) | Sensitive data fields; multiple encryption levels and access controls |
| **TokenQube** | Access control | Token-gated decryption; controls who can access BlakQube data |

MetaQube fields are immutable once minted to the blockchain. BlakQube fields require wallet-based capability grants to decrypt.

### 1.2 iQube Types

| Type | Purpose | Formats |
|------|---------|---------|
| **DataQube** | Alpha-numeric structured data | JSON, CSV, XML |
| **ContentQube** | Multi-modal binary content | Images, video, audio, documents |
| **ToolQube** | Executable capabilities, service adapters | OpenAPI/JSON Schema, MCP tool manifest, gRPC, CLI spec, Docker image ref, OAuth |
| **ModelQube** | ML model artifacts and behavior profiles | Model card (YAML/JSON), safetensors/ONNX/GGUF weights, HuggingFace/MLflow config |
| **AgentQube** | AI agent performance and compliance tracking | Structured logs with performance indicators |

### 1.3 iQube Operational Modes

The iQube interface exposes six modes:

| Mode | Purpose |
|------|---------|
| **View** | Read-only inspection of MetaQube and structure |
| **Use** | Populate instances from templates with controlled editing |
| **Edit** | Full template editing: dynamic fields, schema design, validation rules |
| **Decrypt** | Secure BlakQube decryption with wallet auth and audit trail |
| **Mint** | Commit to blockchain (Public or Private registry); irreversible |
| **Activate** | Enable instance with activation code; supports batch activation |

Registry visibility:
- **Public Registry** — discoverable, forkable
- **Private Registry** — owner-only, activatable later
- **Library (local)** — browser storage only, not on-chain

---

## 2. DNV — Decentralized Network of Validation

The DNV is a foundational infrastructure component (distinct from DVN, which is the cross-chain messaging layer):

- **Purpose**: Anchors all iQube state changes to Bitcoin, issues DiDQubes (attestations), enforces identifiability
- **Bitcoin anchoring**: Merkle-batched roots published via OP_RETURN transactions; SPV-verifiable
- **DiDQubes**: Attestation objects issued by the DNV for each validated state change

**Four identifiability levels** (enforced by DNV):

| Level | Description |
|-------|-------------|
| Anonymous | No identity linked |
| Semi-anonymous | Pseudonymous, wallet-linked |
| Semi-identifiable | Partial KYC |
| Identifiable | Full verified identity |

See also: `items/knowledge/dvn.md` for the cross-chain DVN (LayerZero) and `items/knowledge/icp-bitcoin.md` for Bitcoin anchoring details.

---

## 3. Identity Architecture

Source: `items/architecture/data-identity.md`

The identity hierarchy is DID-based and progressively disclosed:

```
KybeDID (platform root)
  └── Root DID (per-user)
        └── PersonaQube (per-persona: anon → pseudo → semi → full)
```

| State | Description |
|-------|-------------|
| `anon` | No identity linked |
| `pseudo` | Pseudonymous, wallet-linked |
| `semi` | Partial KYC |
| `full` | Full verified identity |

Agent capabilities (`AgentCapability.requiredIdentityState`) gate features by identity level.

### 2.1 iQube Scoring (MetaQube)

All iQubes carry four scores (1–10):

| Score | Meaning |
|-------|---------|
| Risk | Sensitivity/risk of the data |
| Accuracy | Data accuracy confidence |
| Verifiability | How verifiable the data is |
| Sensitivity | Privacy sensitivity level |

---

## 3. Reputation System — RQH Canister

The Reputation/Quality Hub canister tracks agent and iQube reputation on ICP.

- **Canister ID**: `zdjf3-2qaaa-aaaas-qck4q-cai`
- **Service**: `services/crm/taskCanisterService.ts`

Reputation Buckets (0–4):

| Bucket | Meaning |
|--------|---------|
| 0 | Unverified |
| 1 | Community verified |
| 2 | Operator verified |
| 3 | Platform verified |
| 4 | Fully attested |

Tasks flow through: Task → RewardHub (`lvo2w-jqaaa-aaaas-qc2wa-cai`) → RQH for scoring and reward distribution.

---

## 4. Tokens

### 4.1 QCT — QriptoCENT

- **Full name**: Qripto Content Token
- **Contract**: `contracts/QCT.sol` (ERC-20)
- **Total supply cap**: 1,000,000,000 (1B)
- **Premine**: 40% at deploy to deployer address
- **Decimals**: 18
- **Phase 1 chains**: Base Sepolia, Optimism Sepolia, Polygon Amoy

**Mint mechanisms**:
- `bridgeMint(address, amount)` — bridge operator (cross-chain)
- `reserveMint(address, amount)` — reserve contract (USDC-backed)

**Reserve mechanics** (`QCTReserve.sol`):
- 1 USDC → 100 QCT (1:100 ratio)
- USDC backing held in reserve
- Fee structure for reserve operations

### 4.2 KNYT

- **Full name**: KNYT Token
- **Chain**: KNYT Chain (Phase 1, non-EVM)
- **Use**: metaKnyts franchise, NFT/content access, KNYT universe
- **Bitcoin support**: Phase 3 (Ordinals/Runes)

### 4.3 QOYN

- **Function**: Economic primitives and tokenization models
- **Role**: Minting and activation flows, access control via TokenQube
- **Registry visibility**: determines Public vs Private minting cost

---

## 5. AigentQube — Agent Registry

Agents in the ecosystem are typed as `AigentQube` objects (`types/aigentQube.ts`).

**Agent types**: `copilot | franchise | metavatar | specialist`

**Capability categories**: `chat | content | wallet | tasks | codex | commerce | analytics | creative`

**Well-known agents**:
| ID | Role |
|----|------|
| `Copilot` | Main Aigent Z assistant |
| `Kn0w1` | metaKnyts franchise agent |
| `MoneyPenny` | Financial/wallet assistant |
| `Nakamoto` | Crypto/blockchain specialist |

**Policy binding types**: `access | content | payment | privacy | behaviour`

---

## 6. Platform Applications

| Application | Path | Description |
|-------------|------|-------------|
| **Aigent Z** | `apps/aigent-z/` | Unified intelligence platform; multi-mode iQube ops, registry, Network Ops |
| **Ops Console** | `apps/ops-console/` | Standalone network operations monitoring; ICP canister health, cross-chain DVN |
| **21 Sats Market** | `apps/21sats-market/` | Bitcoin-native marketplace application |

> Note: In AigentZBeta, Network Ops is integrated into Aigent Z under Settings → Network Ops, providing live testnet monitoring without a separate app.

### 6.1 Network Operations (Ops Console — Integrated)

Real-time monitoring of:
- **Ethereum Sepolia** — Live RPC via Infura
- **Polygon Amoy** — Live RPC via official endpoints
- **ICP Canisters** — Health with 30-second refresh; cross-chain DVN messages
- **Bitcoin testnet** — Block height via Blockstream/mempool.space

All data is live testnet — no mocks.

---

## 7. Multi-Chain Architecture

Source: `types/chains.ts`

| Phase | Chains | Tokens | Status |
|-------|--------|--------|--------|
| Phase 1 | Base Sepolia (84532), Optimism Sepolia (11155420), Polygon Amoy (80002), KNYT Chain | QCT, KNYT | Enabled |
| Phase 2 | Arbitrum Sepolia (421614), Ethereum Sepolia (11155111) | QCT | Disabled |
| Phase 3 | Bitcoin, Solana | KNYT, future | Disabled |

---

## 8. iQube Best Practices

1. **Draft in Library** before minting (browser-local, reversible)
2. **Validate Early** — resolve all score ranges (1–10) before mint
3. **Plan Visibility** carefully — Public minting is irreversible and globally discoverable
4. **Use BlakQube encryption** for all sensitive fields
5. **Monitor Access** — BlakQube decryption creates an immutable audit trail
