# AgentiQ System Map

## Mental Model: Decentralized Digital Assets & Persistent Identity

AgentiQ is a **Next.js 14 + Python/Flask platform** that creates self-aware digital objects called **iQubes** that live on distributed ledgers, connect to persistent identities (DIDs), and enable value flows through structured payments (x402 HTTP headers).

The system treats:
- **iQubes** = discrete, on-chain entities with metadata, permissions, and content
- **Personas** = user identities with FIO handles, DIDs, and cryptographic keys
- **Wallets** = asset aggregators and entitlement managers (Qc, QOYN, QCT, KNYT)
- **x402** = HTTP payment protocol for transactional flows
- **Relations** = relationships between iQubes (sequence, branch, prerequisite, collection)

## Core Mental Picture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AgentiQ Platform                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  IDENTITY LAYER (DIDs, Personas, Reputation)                       │
│  ├── KybeDID (universal estate-wide identifier)                    │
│  ├── Root DID (decentralized identifier did:iq:...)              │
│  ├── PersonaQube (user identity: FIO handle, EVMKey, badges)    │
│  └── Reputation System (bucket 0-5, score, badges)              │
│                                                                     │
│  DATA LAYER (iQubes, Registry, Content)                            │
│  ├── DataQube (knowledge, structured data)                        │
│  ├── ContentQube (media: episodes, articles, issues)             │
│  ├── DesignQube (UI/UX templates and theming)                   │
│  ├── SmartContentQube (self-aware content with rewards)         │
│  └── SmartWalletQube (wallet state, entitlements, balances)     │
│                                                                     │
│  PAYMENT LAYER (x402, Wallets, Tokens)                            │
│  ├── x402 Protocol (HTTP header-based payments)                  │
│  ├── Smart Wallets (Qc, QOYN, QCT, KNYT across chains)         │
│  └── Custody & Claim (escrow, deferred delivery)                │
│                                                                     │
│  RUNTIME LAYER (CopilotKit, MCP, Agents)                          │
│  ├── CopilotKit (agentic UI, AI orchestration)                   │
│  ├── MCP (Model Context Protocol for tool integration)           │
│  └── AA-API (Abstract Account operations, signing)               │
│                                                                     │
│  DATABASE: Supabase (PostgreSQL + RLS)                            │
│  BLOCKCHAIN: EVM (Ethereum, Optimism, Arbitrum, Base, Polygon)   │
│             Bitcoin, Solana, ICP (Internet Computer)              │
└─────────────────────────────────────────────────────────────────────┘
```

## Module Map

### **Frontend / App Layer**

- **`app/`** — Next.js 14 app router (server + client components)
  - `(shell)/` — Shell routes (main UI experiences)
  - `(embed)/` — Embed-mode routes (iframe/widget deployments)
  - `api/` — 400+ API routes (see API Reference)
  - `components/` — React components (UI, forms, experiences)
  - `contexts/` — React contexts (SmartContentActionContext, MetaAvatarContext)
  - `hooks/` — Custom React hooks (useBalances, useKnytCards, useCopilotAction, etc.)
  - `services/` — Client-side service proxies (personaService, designParity)
  - `utils/` — Utilities (cn, logger, metrics, image-loader)
  - `providers/` — Providers (Auth, Query, etc.)

### **Services Layer** (`/services/`)

- **`identity/`** — User identity & personas
  - `personaService.ts`, `identityResolver.ts`, `fioService.ts`, `reputationService.ts`

- **`x402/`** — HTTP payment protocol implementation
  - `signing.ts`, `schemas.ts`, `policy.ts`, `exec.ts`, `router.ts`

- **`wallet/`** — Wallet operations
  - `qctLedgerService.ts`, wallet state management

- **`ops/`** — Blockchain operations
  - `evmService.ts`, `btcService.ts`, `crossChainService.ts`, `icAgent.ts`

- **`qct/`** — QCT (Qripto Token) operations

- **`content/`** — Content management
  - `embeddingService.ts`, `coverSelectionService.ts`, `encryptionService.ts`

- **`copilot/`** — CopilotKit integration
  - `composer/` — Article composition, prompt chains

- **`mcp/`** — Model Context Protocol integration
  - `experienceQubeTools.ts`, `qubetalkContracts.ts`

- **`crm/`** — CRM operations (personas, entitlements, rewards)

- **`qubetalk/`** — Agent messaging protocol

- **`aa-api/`** — Abstract Account API (signing, wallet operations)

- **`agentiq-wallet/`** — SmartWallet implementation

### **Package Layer** (`/packages/`)

- **`smarttriad/`** — SmartTriad UI framework
- **`smartwallet/`** — Wallet logic and state
- **`aa-client/`** — Abstract Account client
- **`browser-contracts/`** — Browser-compatible contract interactions
- **`iframe-bridge/`** — IFrame communication bridge
- **`qubetalk-client/`** — QubeTalk messaging client
- **`codex/`** — Codex SDK
- **`article-reader/`** — Article reading experience
- **`avatar-host/`** — Avatar rendering service
- **`agentiq-sdk/`** — Core SDK

### **Data & Types**

- **`types/`** — TypeScript definitions for core entities
  - `persona.ts` — PersonaQube, EVMKey, FioHandle
  - `crm.ts` — CRM entities (Personas, Franchises, Tenants, Reputation)
  - `smartContent.ts` — SmartContentQube, Pricing, Rewards, Relations
  - `smartWalletQube.ts` — Wallet state, Balances, Entitlements
  - `registry.ts` — IQube registry and templates
  - `designQube.ts` — Design system and theming

- **`app/types/`** — App-specific types

- **`app/data/`** — Static data and configuration

### **Database & Migrations**

- **`supabase/migrations/`** — PostgreSQL schema migrations
  - Persona tables, Identity aliases, CRM entities, X402 messages
- **`services/agentiq-wallet/db/migrations/`** — Wallet-specific schemas

### **Contracts**

- **`contracts/`** — Solidity smart contracts
  - `QCT.sol` — QCT token (ERC-20)
  - `TokenQubeACL.sol` — Access control for TokenQubes
  - `ClaimManager.sol` — Claim management

### **Configuration & Scripts**

- **`config/`** — Client config (drawers, etc.)
- **`scripts/`** — Deploy, setup, utility scripts
- **`middleware.ts`** — Next.js middleware

## Core Request/Data Flows

### **1. Persona Creation & Authentication Flow**

```
User Signs Up
  ↓
POST /api/identity/persona (with FIO handle + password)
  ↓
PersonaService generates EVM key pair + encrypts private key
  ↓
FioService registers FIO handle (e.g., alice@qripto)
  ↓
Persona stored in Supabase: personas table
  ↓
Identity alias bound: identity_aliases table
  ↓
Wallet unlocked with password for session management
  ↓
PersonaQube available for all x402/wallet operations
```

### **2. Content Purchase Flow (x402)**

```
User sees SmartContentQube (article/episode) with price
  ↓
Frontend calculates payment: asset + amount + x402 headers
  ↓
POST /api/x402/send with:
  - x-402-sender: user FIO handle
  - x-402-recipient: merchant alias
  - x-402-intent: asset.send or iqube.transfer
  - payload: {asset, amount, settlement}
  ↓
resolveIdentity() converts FIO/alias → canonical DID
  ↓
verifyX402Signature() validates request
  ↓
x402_messages row created (state=received)
  ↓
x402_settlements row created (state=pending)
  ↓
DVN attestation stored if provided
  ↓
shouldEscrow() determines custody vs claim delivery
  ↓
POST /api/x402/custody for escrow OR
POST /api/x402/send for direct settlement
  ↓
Content delivered to user's wallet/library
```

### **3. Content Serving & Entitlement Check**

```
User requests article/episode
  ↓
GET /api/content/[content-type]/[id]
  ↓
Check user's Persona + SmartWalletQube state
  ↓
Query x402_settlements for ownership/entitlement
  ↓
Verify identity state (anon, pseudo, semi, full) against content requirements
  ↓
Return content with metadata + relations (sequence, branch, etc.)
  ↓
Frontend renders with SmartContentActionContext (rewards, actions)
```

### **4. Copilot / AI Chat Flow**

```
User opens Copilot Chat (CopilotKit instance)
  ↓
POST /api/copilotkit/[[...path]]
  ↓
CopilotKit runtime processes message + context
  ↓
User context built: persona, wallet, user roles, domain
  ↓
Embedding search runs on codex KB (metaKnyts, Qriptopian)
  ↓
Prompt constructed with KB results + persona context
  ↓
Call LLM (OpenAI, Claude, Venice, ChainGPT)
  ↓
Stream response back to client
  ↓
Track engagement (mint, track-engagement API)
```

### **5. MCP Tool Integration**

```
CopilotKit requests MCP tool (e.g., experience qube creation)
  ↓
POST /api/mcp/[tool-type]
  ↓
Tool handler validates input + checks persona/permissions
  ↓
Execute blockchain/database operation
  ↓
Return result to CopilotKit → streamed to user
```

## Technology Stack

### **Frontend**
- **Next.js 14** — App router, server components, API routes
- **React 18** — UI, hooks, state management
- **TypeScript 5.2** — Type safety
- **Tailwind CSS 3.3** — Styling, animation
- **Radix UI 1.1** — Accessible component primitives
- **Zustand 4.5** — State management (stores)
- **TanStack Query 5.90** — Server state, caching, sync

### **Backend / Runtime**
- **Node.js 20+** — Runtime
- **CopilotKit 1.50** — Agentic UI + chat orchestration
- **LangChain** — LLM chains (imported via DB-GPT)
- **db-gpt** — Context Intelligence, RAG
- **blakQube** — Encrypted data container
- **MCP (Model Context Protocol)** — Tool integration

### **Payments & Wallets**
- **x402 HTTP Headers** — Payment protocol
- **ethers.js 6.8** — EVM interactions
- **@solana/web3.js 1.95** — Solana RPC
- **bitcoinjs-lib 7.0** — Bitcoin operations
- **FIO Protocol SDK** — FIO handle registration

### **Blockchain & Chain Support**
- **Ethereum, Optimism, Arbitrum, Base, Polygon** — EVM chains
- **Bitcoin** — Native chain (via bitcoinjs-lib)
- **Solana** — Native chain (via @solana/web3.js)
- **Internet Computer (ICP)** — Canister operations (@dfinity/agent)
- **Hardhat** — Local EVM deployment & testing

### **Database & Storage**
- **Supabase (PostgreSQL)** — Relational data, RLS policies
- **IPFS / Autonomys Auto Drive** — Distributed file storage
- **PDF.js 4.2.67** — PDF rendering
- **Sharp 0.34** — Image processing

### **Cryptography & Security**
- **jose 5.9.6** — JWT handling
- **@noble/ed25519 1.7.3** — Ed25519 signing
- **@peculiar/webcrypto 1.5** — Web crypto API
- **ed25519-hd-key 1.3** — HD key derivation

### **Infrastructure**
- **Amplify** — CI/CD, auto-deploy on `dev` branch
- **GitHub Actions** — Automated workflows (merge-claude-to-dev)
- **Next.js Build System** — Static generation + server functions

## Module Boundaries & Contracts

### **Service Boundary: Identity Service**

**Responsibility**: Manage personas, DIDs, FIO handles, reputation

**Exports**:
- `PersonaService` — CRUD + password management
- `resolveIdentity(subject)` — FIO/DID → canonical DID
- `bindAliasToDid(did, type, value)` — Register alias

**Contracts**:
- Input: FIO handle, password, EVM key
- Output: PersonaQube with encrypted private key
- Failures: FIO registration error, duplicate handle, crypto error

### **Service Boundary: x402 / Payments**

**Responsibility**: Parse x402 headers, validate signatures, execute settlements

**Exports**:
- `verifyX402Signature(headers, payload)` → boolean
- `validateByIntent(intent, payload)` → ZodParseResult
- `shouldEscrow(headers)` → boolean
- `executeCustodyGrant(msg, settlement)` → grant record

**Contracts**:
- Input: x-402-* headers + JSON payload
- Output: settlement state + attestation
- Failures: Invalid signature, malformed headers, missing sender/recipient

### **Service Boundary: Content / iQubes**

**Responsibility**: Serve, render, and manage SmartContentQubes

**Exports**:
- `GET /api/content/[type]/[id]` → SmartContentQube with relations
- `GET /api/registry/[id]` → IQubeTemplate
- Relations resolved: sequence, branch, prerequisite, collection

**Contracts**:
- Input: Content ID, user context (persona, wallet state)
- Output: Content + metadata + relations + pricing
- Failures: Not found, entitlement check failed, identity state mismatch

### **Service Boundary: Wallets & Balances**

**Responsibility**: Aggregate balances, manage entitlements, track claims

**Exports**:
- `SmartWalletQube` → all user assets + entitlements
- `GET /api/wallet/[persona-id]` → aggregated state
- Supports: Qc, QOYN, QCT, KNYT across chains

**Contracts**:
- Input: Persona ID
- Output: WalletState with balances, entitlements, tasks, quests
- Failures: Persona not found, chain RPC error

### **Service Boundary: CopilotKit / AI**

**Responsibility**: Orchestrate AI-driven chat, context, streaming

**Exports**:
- `POST /api/copilotkit/[[...path]]` — CopilotKit protocol handler
- `POST /api/codex/chat` — Codex-specific chat (metaKnyts, Qriptopian)
- User context built: wallet, persona, roles, domain

**Contracts**:
- Input: Chat message, optional document context
- Output: Streamed LLM response
- Failures: LLM API error, KB embedding timeout

---

This system is **API-first**, **identity-centric**, and **payment-aware**. Every transaction flows through x402 headers. Every user action is tied to a Persona + DID. Every piece of content is a queryable, permissioned iQube.
```


