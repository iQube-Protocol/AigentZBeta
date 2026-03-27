# Functional Modules & Capabilities

## Module: Identity & Persona Management

**Location**: `/services/identity/`, `/app/api/identity/`, `/types/persona.ts`

**Responsibility**: User identity lifecycle, DIDs, FIO handles, key management

**Exports**:
- `PersonaService` — Create, update, fetch personas
- `identityResolver.resolveIdentity()` — Convert alias → canonical DID
- `identityResolver.bindAliasToDid()` — Register new alias for DID
- `FioService` — FIO handle registration & lookup
- `ReputationService` — Calculate and update reputation scores

**Key Types**:
- `PersonaQube` — User identity with keys, reputation, FIO handle
- `ResolvedIdentity` — Resolved DID + verified aliases
- `EvmKeyPair` — Encrypted private key + public address

**Routes**:
- `GET /api/identity/persona` — Fetch persona(s)
- `POST /api/identity/persona` — Create persona
- `POST /api/identity/persona/create-with-fio` — Create + register FIO
- `GET /api/identity/fio/lookup` — Resolve FIO handle
- `POST /api/identity/fio/register` — Register new FIO handle
- `GET /api/identity/resolve` — Resolve any identity to DID
- `GET /api/identity/reputation` — Get reputation history

**Capabilities**:
- Generate secure EVM keypairs (Ed25519/ECDSA)
- Encrypt private keys with password (AES-256-GCM)
- Register human-readable FIO handles
- Resolve FIO/EVM/DID to canonical identity
- Track reputation score and bucket
- Award badges for achievements

---

## Module: x402 / Payments

**Location**: `/services/x402/`, `/app/api/x402/`

**Responsibility**: HTTP header-based payment protocol, settlement execution, custody

**Exports**:
- `verifyX402Signature()` — Cryptographic signature validation
- `validateByIntent()` — Zod schema validation per intent
- `shouldEscrow()` — Determine custody vs direct settlement
- `executeCustodyGrant()` — Execute escrow smart contract
- `resolveHeaderIdentities()` — Resolve sender/recipient to DIDs

**Key Types**:
- x402 intent enums: `iqube.transfer | iqube.grant | iqube.deliver | asset.claim | asset.send`
- Payload types: `TransferPayload | GrantPayload | DeliverPayload | ClaimPayload`
- Settlement state: `pending | escrow | delivered | claimed`

**Routes**:
- `POST /api/x402/send` — Execute payment
- `POST /api/x402/receive` — Receive payment notification
- `POST /api/x402/custody` — Grant escrow capability
- `POST /api/x402/claims/{claim-id}` — Claim deferred asset
- `GET /api/x402/{id}` — Query settlement status
- `POST /api/x402/verify` — Verify x402 message

**Capabilities**:
- Parse & validate x-402-* HTTP headers
- Verify cryptographic signatures
- Resolve FIO/DID identities in headers
- Execute multi-chain settlements (EVM, Bitcoin, Solana, ICP)
- Manage custody escrow with smart contracts
- Track settlement state in Supabase

---

## Module: Wallet & Balances

**Location**: `/services/wallet/`, `/app/api/wallet/`

**Responsibility**: Asset aggregation, entitlements, balance queries

**Exports**:
- `SmartWalletQube` — Unified wallet state
- `getWalletBalance()` — Query balance on specific chain
- `aggregateBalances()` — Sum across all chains
- `getEntitlements()` — List purchased/earned content
- `getRewardState()` — Pending + claimed rewards

**Key Types**:
- `WalletBalance` — {asset, chain, amount, symbol}
- `EntitlementQube` — Purchased/earned content with expiry
- `RewardClaim` — Pending or claimed reward

**Routes**:
- `GET /api/wallet/[persona-id]` — Get full wallet state
- `GET /api/wallet/qct` — QCT balances across chains
- `GET /api/wallet/knyt` — KNYT balances
- `POST /api/wallet/persona` — Update wallet entitlements
- `GET /api/wallet/notifications` — Wallet alerts

**Capabilities**:
- Real-time balance aggregation across EVM chains
- Query Bitcoin, Solana, ICP balances
- Manage content entitlements (with expiry)
- Track pending vs claimed rewards
- Provide wallet UI with balances + history

---

## Module: Content & iQubes

**Location**: `/app/api/content/`, `/services/content/`, `/types/smartContent.ts`

**Responsibility**: Serve, manage, and render iQubes (episodes, articles, issues)

**Exports**:
- `SmartContentQube` — Self-aware content object
- `getContent()` — Fetch content by ID
- `getRelations()` — Fetch content relationships
- `getRewards()` — Get reward triggers for content

**Key Types**:
- `SmartContentQube` — Full content definition with metadata
- `RelationshipType` — sequence | branch | prerequisite | collection
- `RewardTrigger` — episodeComplete | shareContent | etc.

**Routes**:
- `GET /api/content/episode/[id]` — Get episode
- `GET /api/content/article/[id]` — Get article
- `GET /api/content/issue/[id]` — Get issue
- `GET /api/content/issues` — List all issues
- `GET /api/content/library` — User's content library
- `GET /api/content/registry` — Content registry

**Capabilities**:
- Store self-aware content (SmartContentQube)
- Manage content relationships (sequence, branch, etc.)
- Track content pricing & entitlements
- Provide content reader UI
- Support multiple modalities (read, watch, listen, interact)
- Generate rewards on content completion

---

## Module: Registry & Templates

**Location**: `/app/api/registry/`, `/services/*/`, `/types/registry.ts`

**Responsibility**: Centralized iQube catalog, templates, search

**Exports**:
- `IQubeTemplate` — Template definition
- `searchRegistry()` — Full-text search
- `getTemplate()` — Fetch template by ID
- `createInstance()` — Instantiate template

**Routes**:
- `GET /api/registry/iqube` — List iQubes
- `GET /api/registry/iqube/[id]` — Get iQube details
- `GET /api/registry/templates` — List templates
- `POST /api/registry/library` — Manage user library
- `GET /api/registry/analytics` — Registry usage analytics

**Capabilities**:
- Catalog all iQubes (DataQube, ContentQube, DesignQube, etc.)
- Store & search templates
- Manage user library (bookmarks, favorites)
- Track popularity & analytics

---

## Module: CopilotKit / AI Chat

**Location**: `/services/copilot/`, `/app/api/copilotkit/`, `/app/api/codex/chat`

**Responsibility**: Agentic UI, LLM orchestration, knowledge base chat

**Exports**:
- `CopilotKit` runtime handler
- `CodexChat` — Domain-specific chat (metaKnyts, Qriptopian)
- `buildComposerPromptParts()` — Construct prompt with context

**Key Types**:
- `ChatMessage` — {role: user|assistant|system, content}
- `UserContext` — {domain, roles, walletBalance, nftCount}
- `ComposerSessionContext` — KB context + user state

**Routes**:
- `POST /api/copilotkit/[[...path]]` — CopilotKit protocol
- `POST /api/codex/chat` — Codex-specific chat
- `POST /api/copilot/chat` — General AI chat

**Capabilities**:
- Stream LLM responses (OpenAI, Claude, Venice, ChainGPT)
- Embed user messages + search KB
- Build personalized prompts with wallet/persona context
- Support multiple domains (metaKnyts, Qriptopian, AgentiQ)
- Manage chat sessions + history

---

## Module: MCP (Model Context Protocol)

**Location**: `/services/mcp/`, `/app/api/mcp/`

**Responsibility**: Expose tools & resources to LLMs

**Exports**:
- `ExperienceQubeTools` — Create/edit experiences
- `QubeTalkContracts` — Invoke messaging protocol
- `XtmpBridge` — XMTP integration

**Routes**:
- `POST /api/mcp/experience-qube` — Experience tool
- `POST /api/mcp/primitives` — Generic primitives
- `POST /api/mcp/xmtp-bridge` — XMTP messaging

**Capabilities**:
- Expose tools to CopilotKit + Claude
- Enable AI to create/edit content
- Invoke smart contracts from AI
- Manage agent delegations

---

## Module: QubeTalk / Agent Messaging

**Location**: `/services/qubetalk/`, `/app/api/qubetalk/`

**Responsibility**: P2P agent messaging, capability delegation

**Exports**:
- `QubeTalkMessage` — Message type
- `QubeTalkDelegation` — Capability delegation
- `sendMessage()` — Send to agent/channel
- `delegateCapability()` — Grant temporary capability
- `invokeCapability()` — Use delegated capability

**Routes**:
- `POST /api/qubetalk/messages` — Send message
- `GET /api/qubetalk/channels` — List channels
- `POST /api/qubetalk/delegations` — Create delegation
- `POST /api/qubetalk/invoke` — Invoke delegated capability

**Capabilities**:
- Send messages to agents or channels
- Delegate capabilities with TTL/constraints
- Track message history
- Support threading (dev-exec, spec, api-wiring, etc.)

---

## Module: Blockchain Ops

**Location**: `/services/ops/`, `/app/api/ops/`

**Responsibility**: Multi-chain execution (EVM, Bitcoin, Solana, ICP)

**Exports**:
- `EVMService` — Ethereum, Optimism, Arbitrum, Base, Polygon
- `BTCService` — Bitcoin & Runes
- `SolanaService` — Solana SPL tokens
- `ICAgent` — Internet Computer canisters
- `CrossChainService` — Bridge operations

**Routes**:
- `GET /api/ops/ethereum/balance` — ETH balance
- `GET /api/ops/optimism/gas` — OP gas price
- `GET /api/ops/btc/runes` — Bitcoin Runes balance
- `GET /api/ops/solana/spl` — Solana balance
- `GET /api/ops/icp/balance` — ICP balance
- `POST /api/ops/evm/send` — Send EVM tx
- `POST /api/ops/crosschain/bridge` — Bridge asset

**Capabilities**:
- Query balances on all chains
- Execute transactions (send, swap, stake)
- Manage smart contract interactions
- Bridge assets cross-chain
- Monitor gas prices

---

## Module: CRM & Relationships

**Location**: `/services/crm/`, `/app/api/crm/`

**Responsibility**: Tenant, franchise, persona relationships; rewards; segments

**Exports**:
- `Franchise` — Multi-tenant grouping
- `Tenant` — Application instance
- `CrmPersona` — Persona in CRM context
- `Contribution` — User contribution (article, episode, etc.)
- `Reward` — Reward distribution

**Routes**:
- `GET /api/crm/personas` — List personas in tenant
- `GET /api/crm/franchises` — List franchises
- `GET /api/crm/contributions` — List contributions
- `GET /api/crm/rewards` — List rewards
- `POST /api/crm/rewards/distribute` — Distribute rewards

**Capabilities**:
- Manage tenant hierarchy
- Track contributions
- Distribute rewards to creators
- Segment users by behavior/role
- Manage CRM relationships

---

## Module: Admin & Operations

**Location**: `/app/api/admin/`, `/app/api/ops/`

**Responsibility**: System operations, debugging, maintenance

**Exports**:
- Admin endpoints for fund management
- Debug tools for development
- Batch operations

**Routes**:
- `POST /api/admin/fund-agents` — Fund agent wallets
- `POST /api/admin/register-agent-keys` — Register agent keys
- `GET /api/admin/debug` — Debug info
- `POST /api/admin/cleanup-duplicates` — Data cleanup

**Capabilities**:
- Fund agent wallets
- Manage agent keys
- Debug system state
- Run maintenance tasks

---

## Module: Analytics & Engagement

**Location**: `/app/api/analytics/`, `/app/api/engagement/`

**Responsibility**: Tracking, metrics, user engagement

**Routes**:
- `POST /api/engagement/track` — Track event
- `GET /api/analytics/dashboard` — Analytics dashboard
- `POST /api/social/track` — Social engagement

**Capabilities**:
- Track user actions (view, click, purchase)
- Calculate engagement metrics
- Provide analytics dashboards

---

## Module: Design System & UI

**Location**: `/types/designQube.ts`, `/components/ui/`

**Responsibility**: Theming, design tokens, component library

**Exports**:
- `DesignQube` — Design system definition
- UI component library (Radix-based)
- Tailwind configuration

**Key Types**:
- `DesignQubeTokens` — Colors, typography, spacing
- `DesignQubeConstraints` — Layout rules

**Capabilities**:
- Define design systems as iQubes
- Apply themes dynamically
- Provide reusable UI components

---

## Module: Marketplace & Pricing

**Location**: `/app/api/pricing/`, `/app/api/purchase/`

**Responsibility**: Pricing models, purchases, transactions

**Routes**:
- `GET /api/pricing/content` — Get pricing
- `POST /api/purchase/complete` — Complete purchase
- `POST /api/purchase/paypal` — PayPal integration
- `GET /api/purchase/history` — Purchase history

**Capabilities**:
- Define pricing models (pay-per-episode, subscription, etc.)
- Process purchases
- Manage subscriptions
- Track purchase history

---

## Summary Table

| Module | Purpose | Key Files | Routes |
|--------|---------|-----------|--------|
| **Identity** | Personas, DIDs, FIO | `/services/identity/` | `/api/identity/*` |
| **x402** | Payments | `/services/x402/` | `/api/x402/*` |
| **Wallet** | Balances, entitlements | `/services/wallet/` | `/api/wallet/*` |
| **Content** | Episodes, articles | `/app/api/content/` | `/api/content/*` |
| **Registry** | iQube catalog | `/app/api/registry/` | `/api/registry/*` |
| **CopilotKit** | AI chat | `/services/copilot/` | `/api/copilotkit/*`, `/api/codex/chat` |
| **MCP** | LLM tools | `/services/mcp/` | `/api/mcp/*` |
| **QubeTalk** | Agent messaging | `/services/qubetalk/` | `/api/qubetalk/*` |
| **Blockchain** | Multi-chain ops | `/services/ops/` | `/api/ops/*` |
| **CRM** | Relationships, rewards | `/services/crm/` | `/api/crm/*` |
| **Admin** | Operations, debugging | `/app/api/admin/` | `/api/admin/*` |
| **Analytics** | Metrics, engagement | `/app/api/analytics/` | `/api/analytics/*` |

All modules are **independently testable**, **independently deployable**, and **share data via Supabase + REST APIs**.
```


