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

**Purpose**: Provide tools and resources to large language models.

**Service**: `/services/mcp/`

**Integrated Tools**:
- **Experience Qube Tools** — Create, edit, deploy experience iQubes
- **QubeTalk Contracts** — Invoke QubeTalk messaging protocol

**Routes**:
- `POST /api/mcp/experience-qube` — Create/edit experience
- `POST /api/mcp/primitives` — Access primitives (contract calls, etc.)
- `POST /api/mcp/xmtp-bridge` — XMTP messaging bridge

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
  {
    "tool": "createExperience",
    "params": { title, description, format }
  }
  ↓
Backend:
  - Create DesignQube or SmartContentQube
  - Store in Supabase
  - Return qube ID + metadata
  ↓
CopilotKit: "Experience created: episode-456"
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

## 9. DVN (Decentralized Verifier Network)

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
| **FIO** | Addresses | `/api/identity/fio/*` | Live |
| **DIDs** | Identity | `/api/identity/resolve` | Live |
| **A2A** | Agent messaging | `/api/a2a/*` | Live |
| **AA-API** | Account abstraction | `/api/aa/*` | Live |
| **MCP** | LLM tools | `/api/mcp/*` | Live |
| **CopilotKit** | Agentic UI | `/api/copilotkit/*` | Live |
| **QubeTalk** | Agent P2P | `/api/qubetalk/*` | Live |
| **DVN** | Off-chain attestation | `/api/dvn/*` | Live |
| **MetaMe** | Runtime management | `/api/metame/*` | Live |

All protocols are **composable**, **interoperable**, and **recorded in Supabase** for auditability.
```


