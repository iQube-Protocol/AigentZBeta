# Protocols & Integration Architecture

## Protocol Stack

The AgentiQ platform integrates multiple protocols for identity, messaging, and value exchange.

---

## 1. x402 — HTTP Payment Protocol

See **Payments & Value** document (full specification).

**Key Points**:
- HTTP headers declare intent, sender, recipient, asset, amount
- Signature verification ensures authorization
- Supabase records all messages + settlements
- Multi-chain execution via smart contracts

**Routes**:
- `POST /api/x402/send` — Execute payment
- `POST /api/x402/receive` — Receive payment notification
- `POST /api/x402/custody` — Escrow grant
- `POST /api/x402/claims` — Manage claims
- `GET /api/x402/[id]` — Query settlement status

---

## 2. FIO Protocol — Human-Readable Addresses

**Purpose**: Register and resolve FIO handles (e.g., `alice@qripto`)

**Service**: `/services/identity/fioService.ts`

```typescript
export async function registerFioHandle(
  username: string,
  domain: 'qripto' | 'knyt',
  publicKey: string,
  chainMappings: Record<string, string>
): Promise<FioRegistration> {
  // 1. Use @fioprotocol/fiosdk
  // 2. Register handle@domain
  // 3. Map addresses:
  //    - BTC address
  //    - ETH/Optimism/Polygon/Arbitrum/Base addresses
  //    - SOL address
  //    - ICP principal
  // 4. Return registration record with tx hash
}

export async function lookupFioHandle(handle: string) {
  // Query FIO chain for addresses registered under handle
}
```

**Routes**:
- `GET /api/identity/fio/lookup?handle=alice@qripto` — Resolve handle → addresses
- `POST /api/identity/fio/register` — Register new handle
- `GET /api/identity/fio/check-availability?handle=alice` — Check if handle exists
- `POST /api/identity/fio/verify` — Verify handle ownership

---

## 3. DIDs (Decentralized Identifiers)

**Standard**: W3C DIDs (did:* format)

**AgentiQ DID Methods**:

```
did:iq:kybe:<uuid>             // KybeDID (estate-wide)
did:iq:persona:<uuid>          // Persona DID (root identity)
did:iq:alias:fio:<handle>      // FIO alias resolution
did:iq:alias:evm:<address>     // EVM address alias
did:iq:alias:email:<email>     // Email alias
did:iq:alias:<generic>         // Generic alias
```

**Identity Resolver** (`/services/identity/identityResolver.ts`):

```typescript
export async function resolveIdentity(subject: string): Promise<ResolvedIdentity> {
  if (isDid(subject)) {
    return { canonicalDid: subject };
  }
  
  if (isFio(subject)) {
    // FIO handle → resolve to DID
    const handle = subject.replace(/^fio:/i, '');
    const { data } = await fetch(`/api/identity/fio/lookup?handle=${handle}`);
    return {
      canonicalDid: `did:iq:alias:fio:${handle}`,
      verifiedAliases: [{ type: 'fio', value: handle }]
    };
  }
  
  // Treat as generic alias
  return { canonicalDid: `did:iq:alias:${subject}` };
}

export async function bindAliasToDid(
  entityDid: string,
  aliasType: 'fio' | 'evm' | 'icp' | 'email',
  aliasValue: string
) {
  // Insert into identity_aliases table
  // Set expiry (TTL)
  // Return binding record
}
```

---

## 4. A2A (Agent-to-Agent) Protocol

**Purpose**: Secure, signed communication between agents or services.

**Routes**:
- `POST /api/a2a/agui/send` — Send message to agent
- `POST /api/a2a/agui/stream` — Stream agent responses
- `POST /api/a2a/signer/[operation]` — Request signing from agent
- `POST /api/a2a/faucet/airdrop` — A2A faucet claim
- `POST /api/a2a/dvn/sse` — DVN attestation stream

**Example: A2A Signing**

```
POST /api/a2a/signer/request-tx-sign
Body:
  {
    "agentId": "agent-treasury-1",
    "txn": {
      "to": "0xrecipient",
      "value": "1000000000000000000",
      "data": "0x..."
    },
    "chain": "optimism"
  }
↓
Backend:
  - Verify request signature
  - Route to agent (via QubeTalk or direct)
  - Agent signs (using its custody key)
  - Return signed tx
↓
Frontend broadcasts on Optimism
```

---

## 5. AA-API — Abstract Account Operations

**Service**: `/services/aa-api/`

**Purpose**: Unified interface for account abstraction, signing, and transaction execution.

**Key Endpoints**:
- `POST /api/aa/v1/runtime/prompt-action` — Execute action from prompt
- `POST /api/aa/v1/runtime/menu-action` — Execute menu action
- `POST /api/aa/v1/runtime/selectors` — Query account state
- `POST /api/aa/v1/browser/[...path]` — Browser automation

**Example: Prompt Action**

```
POST /api/aa/v1/runtime/prompt-action
Body:
  {
    "action": "send_payment",
    "input": {
      "recipient": "bob@qripto",
      "amount": "100",
      "asset": "QCT"
    }
  }
↓
Backend:
  - Parse action
  - Resolve identities
  - Construct x402 request
  - Sign with user's key (from session)
  - Execute via x402/send
  - Return result
```

---

## 6. MCP (Model Context Protocol)

**Purpose**: Provide tools and resources to large language models. Two MCP surfaces exist: server-side tool dispatching (ExperienceQube tools) and external agent MCP app integration.

**Service**: `/services/mcp/`

**Routes**:
- `POST /api/mcp/experience-qube` — ExperienceQube tool dispatcher
- `POST /api/mcp/primitives` — Access primitives (contract calls, SmartTriad, etc.)
- `POST /api/mcp/xmtp-bridge` — XMTP inbound messaging bridge (see §11)

### MCP ExperienceQube Tools

Tool names (`ExperienceQubeTool`):

| Tool | Purpose |
|------|---------|
| `pill.get` | Smallest content unit (L0 experience) |
| `capsule.get` | Compact summary (L1 experience) |
| `mini_runtime.get` | Interactive mini-experience (L2) |
| `codex.entry` | Full codex article (L3) |
| `invite.create` | Generate invite for experience |
| `share.compose` | Compose shareable content |
| `next.best` | Recommend next action/experience |

**Experience Depth Ladder** (progressive disclosure):

```
L0 (pill) → L1 (capsule) → L2 (mini_runtime) → L3 (codex.entry)
```

**Response schema** (`metame.mcp.response.v0`):

```typescript
interface ExperienceMcpResponse {
  schema: 'metame.mcp.response.v0';
  experience_id: string;
  depth: 'L0' | 'L1' | 'L2' | 'L3';
  artifact: { title; body; share_text; tags };
  cta: {
    primary?: { type: 'deepen' | 'stay' | 'share'; label; target; value };
    secondary: Array<{ type; label; target; value }>;
  };
  ladder: { allowed_next_depth: ExperienceDepth | null; reason: string };
  telemetry: {
    receipt_events: string[];
    recommended_next_intent: 'share' | 'invite' | 'ask' | 'collect' | 'follow' | 'join';
  };
}
```

**Example: MCP Tool for Experience Creation**

```typescript
// In CopilotKit chat:
User: "Create an experience about blockchain basics"
  ↓
CopilotKit calls MCP tool: createExperience({
  title: "Blockchain Basics",
  description: "Intro to blockchain",
  format: "episode"
})
  ↓
POST /api/mcp/experience-qube
  { "tool": "capsule.get", "input": { "experience_id": "exp_blockchain" } }
  ↓
Backend: returns metame.mcp.response.v0 artifact at requested depth
```

---

## 7. CopilotKit — Agentic UI

**Service**: `/services/copilot/`

**Routes**:
- `POST /api/copilotkit/[[...path]]` — CopilotKit protocol handler
- `POST /api/copilotkit/system` — System/config endpoint

**Key Concepts**:

- **Agent LLM Providers** (`/services/metame/agentLlmOrchestra.ts`):
  - OpenAI (gpt-4o-mini, gpt-4o)
  - Claude (claude-3-5-sonnet)
  - Venice (venice-uncensored)
  - ChainGPT (general_assistant)

- **Composer Session** (`/services/copilot/composer/`):
  - Build prompt with KB context
  - Manage article composition
  - Stream LLM responses

**Example: Codex Chat**

```
POST /api/codex/chat
Body:
  {
    "message": "What is metaKnyts?",
    "userId": "persona-alice-...",
    "domain": "metaKnyts"
  }
↓
Backend:
  1. Get user context (persona, wallet, roles)
  2. Embed user message (OpenAI embeddings)
  3. Search KB (metaKnyts codex) for relevant chunks
  4. Build prompt:
     - System: "You are Kn0w1, expert on metaKnyts"
     - User context: wallet balance, achievements
     - KB context: retrieved chunks
     - User message
  5. Call LLM (stream response)
  6. Return response
```

---

## 8. QubeTalk — Agent Messaging

**Service**: `/services/qubetalk/`

**Purpose**: P2P messaging between agents, with capability delegation.

**Routes**:
- `POST /api/qubetalk/messages` — Send message
- `GET /api/qubetalk/channels` — List channels
- `POST /api/qubetalk/delegations` — Delegate capability
- `POST /api/qubetalk/invoke` — Invoke delegated capability

**Protocol**:

```typescript
export interface QubeTalkMessage {
  id: string;
  channel: string;           // e.g., "metame-runtime-thinclient"
  agentId: string;          // Sender
  thread: string;           // Topic (dev-exec, spec, api-wiring, etc.)
  type: 'text' | 'delegation' | 'response' | 'system' | 'receipt';
  title: string;
  body: string;
  severity?: 'info' | 'warn' | 'blocker';
  metadata?: Record<string, any>;
}

export interface QubeTalkDelegation {
  id: string;
  delegator: string;        // Who is delegating
  delegate: string;         // Who receives delegation
  capability: string;       // What can be done
  constraints?: {
    expiresAt?: string;
    maxUses?: number;
  };
}
```

---

## 9. ERC-8004 — On-Chain Agent Identity

**Purpose**: EVM-based identity standard used to register and verify agent identities on-chain. Used in A2A delegated validation flows.

**Component**: `Identity / Registry (ERC-8004 Identity)` in the Services Layer

**Usage in A2A**:

The A2A protocol uses ERC-8004 to verify an external agent's identity before delegating capabilities:

```
External Agent → POST /a2a/delegate { capability, params, sig }
  ↓
Aigent Z API verifies agent identity via ERC-8004 registry on EVM
  ↓
Registry returns: agent identity metadata (verified on-chain)
  ↓
202 Accepted (task id returned to agent)
```

**IdentityRegistry abstraction** (swappable layer):
- Current: ERC-8004 Identity (minimal implementation on EVM)
- Future: extensible to other identity standards
- Enables capability grants and audit trail creation for agent-to-agent operations

**Contracts**: `contracts/` — ERC-8004 compliant identity registry

---

## 10. ICP (Internet Computer Protocol)

**Purpose**: ICP provides the cross-chain verification, Bitcoin anchoring, and EVM RPC relay infrastructure for the platform.

**Key Canisters**:

| Canister | ID | Role |
|----------|----|------|
| `cross_chain_service` | `sp5ye-2qaaa-aaaao-qkqla-cai` | DVN quorum verification, LayerZero |
| `proof_of_state` | `ulvla-h7777-77774-qaacq-cai` | Bitcoin state anchoring |
| `btc_signer_psbt` | `uxrrr-q7777-77774-qaaaq-cai` | Bitcoin PSBT signing (tECDSA) |
| `evm_rpc` | `uzt4z-lp777-77774-qaabq-cai` | EVM chain RPC relay |

**Protocol integration points**:
- DVN (cross-chain messaging verification) — see `items/knowledge/dvn.md`
- Bitcoin anchoring (proof-of-state Merkle roots via OP_RETURN) — see `items/knowledge/icp-bitcoin.md`
- EVM RPC via ICP HTTP outcalls (censorship-resistant chain access)
- Chain-key Bitcoin (tECDSA) for Phase 3 dual-lock minting

**Actor pattern** (`services/ops/icAgent.ts`):

```typescript
const actor = await getActor(canisterId, idlFactory);
// Gateway: DFX_NETWORK=local → 127.0.0.1:4943 | ic → ic0.app | fallback → icp-api.io
```

**Environment**:
- `NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID` — active DVN canister ID (overrides hardcoded)
- `DFX_NETWORK` — `local` or `ic`
- `DFX_IDENTITY_PEM` — Ed25519/Secp256k1 PEM for authenticated calls

---

## 11. XMTP — External Messaging Bridge

**Purpose**: Ingest messages from XMTP group chats into QubeTalk, enabling external agents and users to interact with the platform via XMTP.

**Route**: `POST /api/mcp/xmtp-bridge`

**Payload**:

```json
{
  "group_id": "string",
  "message": {
    "id": "string",
    "sender": "string",
    "content": "string",
    "timestamp": "ISO-8601"
  }
}
```

**Bridge flow**:

```
XMTP group message
  ↓
POST /api/mcp/xmtp-bridge
  ↓
Normalised into: metame.bridge.inbound.v0 schema
  - provider: { name: "xmtp", environment }
  - thread: { provider_thread_id: group_id, qt_thread_id }
  - routing: { target_agent: "openclaw_group_agent", intent_hint }
  - security: { data_classification: "internal", receipt_required, redaction_required }
  ↓
Stored as QubeTalk message (from_agent: "bridge_adapter_xmtp")
  ↓
Routed to openclaw_group_agent for processing
```

**Intent detection** (automatic from message content):

| Keyword | Intent hint |
|---------|-------------|
| "drop", "comic", "make" | `create_drop` |
| "summarize", "summary" | `summarize` |
| "help" | `help` |
| (default) | `unknown` |

**GET endpoint** — returns bridge status and config:

```bash
GET /api/mcp/xmtp-bridge?tenant_id=tnt_xyz
# → { ready: true, config: { xmtp_env, bridge_inbound_channel_id, ... } }
```

**Environment variables**:
- `XMTP_SIMULATION_MODE` — `"false"` to use live XMTP, default simulated
- `XMTP_ENV` — `"dev"` (XMTP network environment)
- `QT_CHANNEL_BRIDGE_INBOUND_ID` — pre-configured bridge inbound channel ID

---

## 12. DVN (Decentralized Verifier Network)

**Service**: `/services/dvn/`

**Purpose**: Off-chain attestation and verification of transactions.

**Routes**:
- `POST /api/a2a/dvn/sse` — Stream DVN events
- `POST /api/dvn/events` — Report event to DVN

**Usage in x402**:

```
POST /api/x402/send
  x-402-dvn-attest: <signature-from-dvn-validator>
  ↓
Backend stores DVN attestation in x402_settlements
  ↓
Can be used for:
  - Cross-chain verification
  - High-value transaction confirmation
  - Dispute resolution
```

---

## 10. Runtime System Protocols

### **MetaMe Runtime** (`/services/metame_runtime/`)

Manages agent lifecycle, state, and capabilities.

**Routes**:
- `GET /api/metame/agent-llm-options` — List available LLM providers
- `POST /api/metame/runtime` — Initialize agent runtime
- `POST /api/metame/design-qube` — Get design system for UI

### **Pipeline** (`/services/pipeline/`)

ETL pipeline for data synchronization.

**Routes**:
- `POST /api/pipeline/runs` — Execute pipeline
- `GET /api/pipeline/health` — Check pipeline status

---

## Integration Example: Full Payment Flow

```
User Alice buys Episode via CopilotKit Chat
│
├─ CopilotKit processes intent
│  └─ MCP calls: executePurchase(episode-123, 100 QCT)
│
├─ AA-API constructs x402 request
│  ├─ Resolve alice@qripto → did:iq:persona:alice-...
│  ├─ Resolve creator@store → did:iq:persona:creator-...
│  └─ Sign with alice's key (from wallet session)
│
├─ x402 protocol executes
│  ├─ Verify signature
│  ├─ Check balance on Optimism
│  ├─ Transfer 100 QCT (ERC-20 call)
│  ├─ Store in x402_messages + x402_settlements
│  └─ Request DVN attestation (optional)
│
├─ QubeTalk notifies agents
│  ├─ Send message: "Purchase completed: alice → episode-123"
│  └─ Log in dev-exec thread for audit
│
└─ SmartWalletQube updated
   ├─ Balance: -100 QCT on Optimism
   └─ Entitlements: +episode-123 (status: active)
```

---

## Protocol Stack Summary

| Protocol | Purpose | Routes | Status |
|----------|---------|--------|--------|
| **x402** | Payment | `/api/x402/*` | Live |
| **FIO** | Human-readable addresses | `/api/identity/fio/*` | Live |
| **DIDs** | Decentralized identity | `/api/identity/resolve` | Live |
| **A2A** | Agent-to-agent messaging | `/api/a2a/*` | Live |
| **AA-API** | Account abstraction | `/api/aa/*` | Live |
| **MCP** | LLM tools / ExperienceQubes | `/api/mcp/*` | Live |
| **CopilotKit** | Agentic UI | `/api/copilotkit/*` | Live |
| **QubeTalk** | Agent P2P messaging | `/api/qubetalk/*` | Live |
| **ERC-8004** | On-chain agent identity | EVM contracts | Live |
| **ICP** | Cross-chain / BTC anchoring | ICP canisters | Live |
| **XMTP** | External messaging bridge | `/api/mcp/xmtp-bridge` | Live |
| **DVN** | Cross-chain attestation | `/api/dvn/*`, ICP canister | Live |
| **MetaMe** | Runtime management | `/api/metame/*` | Live |
| **LayerZero** | Cross-chain OApp/OFT | EVM → LayerZero | Live |

All protocols are **composable**, **interoperable**, and **recorded in Supabase** for auditability.


