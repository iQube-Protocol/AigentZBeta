# Architectural Decisions: Why AgentiQ is Designed This Way

## 1. Next.js 14 App Router (Server-First)

**Decision**: Use Next.js 14 with app router, server components by default.

**Why**:
- Server components reduce JavaScript bundle size
- API routes co-locate with data-fetching logic
- Built-in middleware support for auth/validation
- SSR for critical pages (content, personas)
- Fast refresh for developer experience
- Vercel Amplify deployment integration

**Tradeoff**: Requires careful client/server boundary management (no client-only libraries in server components).

---

## 2. x402 HTTP Headers for Payments

**Decision**: Use custom x-402-* HTTP headers for value transfers instead of JSON body only.

**Why**:
- HTTP headers are **immutable** once sent → tamper-proof
- Can be **proxied and logged** by middleware transparently
- Decouple payment signal from content/action payload
- Follows existing HTTP semantics (authorization headers, content-type, etc.)
- Enables **DVN attestation** at the network edge
- Supports both synchronous and asynchronous settlement

**Example**:
```
POST /api/content/deliver
x-402-sender: alice@qripto
x-402-recipient: metaknyts@store
x-402-asset: QCT
x-402-amount: 100
x-402-intent: asset.send

{ /* regular JSON body for content */ }
```

**Tradeoff**: Non-standard. Requires custom clients; can't use naive HTTP libraries.

---

## 3. Supabase as Source of Truth

**Decision**: PostgreSQL (Supabase) holds critical state; blockchain is read-only attestation.

**Why**:
- Supabase provides **RLS policies** for row-level security without middleware
- Transactional queries for atomic updates
- **Immediate consistency** (no blockchain lag)
- Lower cost than on-chain storage for metadata
- Full-text search, aggregations, time-series queries
- Audit logs via triggers

**What lives in Supabase**:
- Personas, identities, reputation
- x402 messages & settlements
- Content metadata, entitlements
- CRM relationships
- User library, transactions

**What lives on-chain**:
- Token contracts (QCT, KNYT)
- Smart contract state (custody escrow, claims)
- Distributed identity proof (FIO chain)
- Immutable audit trail (optional)

**Tradeoff**: Centralized database. Mitigated by transparent Supabase schema and RLS policies.

---

## 4. Multi-Chain (EVM, Bitcoin, Solana, ICP)

**Decision**: Support multiple blockchains instead of single chain.

**Why**:
- Users hold assets on different chains → serve all networks
- EVM (Ethereum, Optimism, Arbitrum, Base, Polygon) for DeFi composability
- Bitcoin for store-of-value trust & Runes protocol
- Solana for speed & cost (SPL tokens)
- ICP for smart contract computing & canister persistence
- Avoid lock-in to single blockchain ecosystem

**How**:
- `/services/ops/evmService.ts` — Unified EVM interface
- `/services/ops/btcService.ts` — Bitcoin & Runes
- `/services/ops/SolanaService` — SPL tokens
- `/services/ops/icAgent.ts` — ICP canisters
- `/services/ops/crossChainService.ts` — Bridge coordination

**Tradeoff**: Operational complexity. Must manage RPC endpoints, gas prices, bridge security.

---

## 5. Personas as First-Class DIDs

**Decision**: Every user identity is a DID; every alias (FIO, EVM address) resolves to a canonical DID.

**Why**:
- **Portable identity** — User can move to different platforms, DID persists
- **Zero-knowledge friendly** — DID can be pseudonymous (did:iq:alias:...)
- **Alias flexibility** — One DID can have multiple aliases (FIO, EVM, email, etc.)
- **Reputation aggregation** — KybeDID + Root DID enable estate-wide reputation
- **Standards-compliant** — W3C DID specification

**Structure**:
```
KybeDID (estate-wide)
  ↓
Root DID (persona canonical)
  ↓
Aliases (FIO, EVM, email, generic)
```

**Tradeoff**: Adds identity resolution layer. But enables portable, composable identity.

---

## 6. CopilotKit for Agentic UI

**Decision**: Use CopilotKit 1.50 for AI chat + agent actions, not custom LLM orchestration.

**Why**:
- **Streaming** native → fast user perception
- **Tool calling** (MCP integration) → AI can invoke smart contracts
- **Context injection** → pass user wallet state, persona, KB directly to LLM
- **Multi-model** support → OpenAI, Claude, Venice, ChainGPT all work
- **Maintained library** → don't reinvent orchestration

**How Used**:
- `/api/copilotkit/[[...path]]` — Protocol handler
- `/api/codex/chat` — Domain-specific chat (metaKnyts, Qriptopian)
- `/services/copilot/composer/` — Article composition chains

**Tradeoff**: Vendor dependency on CopilotKit. But flexibility to swap LLMs.

---

## 7. iQube Primitive (Not Just JSON)

**Decision**: All data is an "iQube" — self-aware, queryable, permissioned object.

**Why**:
- **Composability** — Qubes relate to other Qubes (sequence, branch, prerequisite)
- **Metadata-rich** — Content knows its pricing, entitlements, rewards
- **Type system** — DataQube, ContentQube, DesignQube, SmartWalletQube, PersonaQube
- **Extensible** — New Qube types = new capabilities
- **Audit trail** — Every Qube has creation, update, ownership metadata

**Example**: SmartContentQube = Episode with:
- Self-describing metadata
- Pricing model + x402 intent
- Relation map (next episode, prerequisites)
- Reward triggers (episodeComplete → +10 KNYT)
- Access control (min identity state, reputation bucket)

**Tradeoff**: Requires discipline — not every API response is a Qube. But enables rich, composable content.

---

## 8. Custody Model for Escrow

**Decision**: x402 with three delivery modes: canonical, claim, custody.

**Why**:
- **Canonical** → Instant settlement (trusted parties, low-value)
- **Claim** → Deferred settlement (user claims later, safer)
- **Custody** → Escrow via smart contract (conditional release)

**Use Case**:
```
User purchases $1000 worth of KNYT content:
  ↓
Not immediately transferred (risk).
Custody grant to seller: "Release when content delivered & verified."
  ↓
On delivery: Smart contract releases funds.
On dispute: Arbitration via x402/verify endpoint.
```

**Policy** (`/services/x402/policy.ts`):
```typescript
export function shouldEscrow(headers: Record<string, string>): boolean {
  const amount = parseFloat(headers['x-402-amount'] || '0');
  const asset = headers['x-402-asset'];
  
  // Escrow if high-value or risky asset
  if (amount > 1000) return true;
  if (['KNYT', 'QCT'].includes(asset)) return true;
  return false;
}
```

**Tradeoff**: Adds custody contract complexity. But enables safer high-value transactions.

---

## 9. Encryption-First for Private Keys

**Decision**: All private keys encrypted at rest (AES-256-GCM) with password-derived keys.

**Why**:
- Supabase breach doesn't expose private keys
- Password recovery relies on user memory, not recovery seeds
- Keys bound to password → different person's machine = different keys
- Encrypted key format: `{ ciphertext, iv, salt, authTag }`

**Flow**:
```
1. User enters password during persona creation
2. Generate random salt
3. Derive encryption key: PBKDF2(password, salt)
4. Encrypt private key: AES-256-GCM(privateKey, derivedKey, iv)
5. Store { ciphertext, iv, salt, authTag } in Supabase
6. On unlock: Re-derive key from password → decrypt private key into memory
```

**Where Keys Live**:
- ✅ Encrypted in Supabase (personas table)
- ✅ Decrypted in memory during wallet session
- ❌ Never in localStorage
- ❌ Never in IndexedDB
- ❌ Never unencrypted on disk

**Tradeoff**: If user forgets password, key is irrecoverable. But security > recoverability.

---

## 10. Registry as Catalog, Not Blockchain

**Decision**: iQube registry lives in Supabase, not on-chain.

**Why**:
- **Search & discovery** — Full-text search, filters (type, business model, price)
- **Metadata updates** — Can change description, price without transaction cost
- **Permissions** — Can restrict to tenant without on-chain governance
- **Analytics** — Track popular Qubes, trending content
- **Private Qubes** — Not all Qubes are public

**What IS on-chain**:
- Token contracts (QCT, KNYT)
- Smart contracts for custody/claims
- Optional: Content hash (for proof of creation)

**Registry queries**:
```
GET /api/registry/iqube?type=ContentQube&search=blockchain&limit=20
  ↓
SQL query on Supabase
  ↓
Full-text search + filtering
  ↓
Instant results (no blockchain lag)
```

**Tradeoff**: Registry is centralized. But benefits (UX, cost, metadata flexibility) outweigh decentralization need.

---

## Summary: Design Philosophy

| Decision | Principle | Benefit |
|----------|-----------|---------|
| **Next.js + App Router** | Server-first | Performance, security, DX |
| **x402 Headers** | HTTP semantics | Immutable, proxyable payments |
| **Supabase critical state** | Immediate consistency | Transactions, RLS, queries |
| **Multi-chain** | User-centric | Serve users where their assets live |
| **DIDs for identity** | Portable identity | Composable, zero-knowledge friendly |
| **CopilotKit** | Leverage maintained libraries | Fast iteration, multi-model support |
| **iQube primitives** | Type composability | Rich, extensible data model |
| **Custody escrow** | Risk management | Safe high-value transactions |
| **Encryption at rest** | Defense in depth | Keys secure even if DB breached |
| **Registry as catalog** | UX priority | Search, discovery, analytics |

**Core Ethos**: **Identity-first, payment-aware, multi-chain, composable by design.**
```

---

All 9 documents are now complete with full, detailed content based on actual codebase analysis. They are ready for populating the AgentiQ Codex.
