# Repository Structure & Module Map

## Root-Level Directories

```
/home/user/AigentZBeta/
├── .claude/                          # Claude Code session cache
├── .config/, .dfx/                   # ICP/dfx configuration
├── .github/                          # GitHub Actions (auto-deploy)
├── agents/                           # Multi-agent orchestration configs
├── app/                              # Next.js 14 application (main)
├── apps/                             # Workspace apps (metame, theqriptopian-web)
├── artifacts/                        # Compiled contract artifacts (Hardhat)
├── briefs/                           # Development briefs & specs
├── cache/                            # Build cache
├── clawhack-group-agents/            # Group agent framework & adapters
├── codexes/                          # Content knowledge bases (packs)
├── components/                       # Shared React components
├── config/                           # Configuration files (drawers, etc.)
├── contracts/                        # Solidity smart contracts
├── data/                             # Static data
├── deployments/                      # Contract deployment records
├── docs/                             # Architecture & progress documentation
├── examples/                         # Code examples
├── hooks/                            # Utility hooks (ops, qct)
├── netlify/                          # Netlify edge functions
├── orchestration/                    # Workflow orchestration
├── packages/                         # NPM workspace packages
├── public/                           # Static assets (icons, images)
├── qriptopian/                       # Qriptopian domain-specific code
├── qube_agent/                       # Qube agent reasoning engine
├── qube_integrations/                # Third-party integrations
├── scripts/                          # Utility scripts (deploy, setup)
├── sdk/                              # SDK & external integrations
├── server/                           # Server utilities
├── services/                         # Backend service layer
├── src/                              # Alternative/legacy source (Rust, Python)
├── static/                           # Static resources
├── stores/                           # Zustand stores (legacy)
├── styles/                           # Global CSS
├── supabase/                         # Supabase migrations & functions
├── templates/                        # Content templates
├── tests/                            # Test suites
├── types/                            # Shared TypeScript types
├── ui/                               # UI layout components
├── utils/                            # Global utilities
├── venv/                             # Python virtual environment
├── wallets/                          # Wallet configurations
├── CLAUDE.md                         # AI Agent rules & conventions
├── package.json                      # Root workspace config
├── tsconfig.json                     # TypeScript config
└── README.md, BUILD.md, etc.         # Documentation
```

---

## Major Subdirectories (Detailed)

### **`/app`** (Next.js 14 Application)

The main Next.js application using app router (server + client components).

```
app/
├── (shell)/                          # Shell routes (primary UI)
│   └── [routes for personas, content, experiences, etc.]
├── (embed)/                          # Embed-mode routes (iframe deployment)
├── api/                              # 400+ API routes
│   ├── identity/                     # Persona, DID, FIO management
│   ├── x402/                         # Payment protocol
│   ├── wallet/                       # Wallet operations
│   ├── content/                      # Content serving
│   ├── codex/                        # Knowledge base chat
│   ├── copilotkit/                   # CopilotKit integration
│   ├── mcp/                          # MCP tools
│   ├── crm/                          # CRM operations
│   ├── qubetalk/                     # Agent messaging
│   ├── ops/                          # Blockchain operations
│   ├── admin/                        # Admin endpoints
│   ├── compose/                      # Composer studio
│   └── [50+ other domain routes]
├── components/                       # React components (UI layer)
├── contexts/                         # React contexts
├── hooks/                            # Custom React hooks
├── services/                         # Client-side services
├── utils/                            # Client utilities
├── types/                            # App-specific types
├── data/                             # Static data
├── layout.tsx                        # Root layout
└── page.tsx                          # Home page
```

### **`/services`** (Backend Service Layer)

Organized by domain/concern. Each service folder contains TypeScript modules.

```
services/
├── identity/
│   ├── personaService.ts             # Persona CRUD
│   ├── identityResolver.ts           # DID resolution
│   ├── fioService.ts                 # FIO integration
│   ├── reputationService.ts          # Reputation calculations
│   └── agentKeyService.ts            # Agent key management
├── x402/
│   ├── signing.ts                    # Signature verification
│   ├── schemas.ts                    # Zod validation
│   ├── policy.ts                     # Business rules
│   ├── exec.ts                       # Settlement execution
│   └── router.ts                     # Request routing
├── wallet/
│   ├── qctLedgerService.ts           # QCT ledger operations
│   └── fixtures/                     # Test fixtures
├── ops/
│   ├── evmService.ts                 # EVM chain interactions
│   ├── btcService.ts                 # Bitcoin operations
│   ├── crossChainService.ts          # Cross-chain orchestration
│   ├── icAgent.ts                    # ICP canister agent
│   └── idl/                          # ICP IDL files
├── content/
│   ├── embeddingService.ts           # KB embeddings
│   ├── coverSelectionService.ts      # Cover art selection
│   └── encryptionService.ts          # Data encryption
├── copilot/
│   └── composer/                     # Article composition
├── crm/
│   └── [CRM operations]
├── mcp/
│   ├── experienceQubeTools.ts        # Experience tools
│   └── qubetalkContracts.ts          # QubeTalk integration
├── qubetalk/
│   └── [QubeTalk protocol]
├── aa-api/                           # Abstract Account (separate npm service)
├── agentiq-wallet/                   # Smart Wallet (separate npm service)
├── metame/                           # MetaMe runtime
├── metame_runtime/                   # Runtime management
├── pipeline/                         # Data pipeline
├── qct/                              # QCT token operations
├── rewards/                          # Reward management
├── tenant/                           # Tenant service
├── policy/                           # Policy evaluation
└── [15+ other domain services]
```

### **`/packages`** (NPM Workspace Packages)

Reusable packages published to npm or used internally.

```
packages/
├── smarttriad/                       # SmartTriad UI framework
│   ├── src/
│   ├── package.json
│   └── dist/
├── smartwallet/                      # Smart Wallet logic
├── aa-client/                        # AA-API client SDK
├── browser-contracts/                # Browser-compatible contract interactions
├── iframe-bridge/                    # IFrame communication
├── qubetalk-client/                  # QubeTalk client
├── codex/                            # Codex SDK
├── article-reader/                   # Article reading experience
├── avatar-host/                      # Avatar rendering service
└── agentiq-sdk/                      # Core SDK
```

### **`/contracts`** (Solidity Smart Contracts)

EVM-compatible smart contracts for token management and access control.

```
contracts/
├── QCT.sol                           # ERC-20 token implementation
├── QCTReserve.sol                    # Treasury & reserve
├── QCTToken.sol                      # Alternative ERC-20 variant
├── TokenQubeACL.sol                  # Access control
├── ClaimManager.sol                  # Claim management
└── MockUSDC.sol                      # Test token
```

### **`/types`** (Shared Type Definitions)

Centralized TypeScript type definitions for the entire system.

```
types/
├── agentiq.ts                        # AgentiQ core types
├── persona.ts                        # PersonaQube, EVM keys
├── crm.ts                            # CRM entities
├── smartContent.ts                   # SmartContentQube
├── smartWalletQube.ts                # SmartWalletQube
├── designQube.ts                     # Design system types
├── smartDrawer.ts                    # Drawer configuration
├── registry.ts                       # iQube registry types
├── relationship.ts                   # Content relationships
├── cardVariant.ts                    # UI card variants
├── liquidUI.ts                       # Liquid UI types
└── [10+ more type files]
```

### **`/components`** (Shared React Components)

Reusable UI components organized by feature domain.

```
components/
├── ui/                               # Primitive UI components
│   ├── [Radix-based components]
│   └── Common form elements
├── composer/                         # Article composition UI
├── registry/                         # iQube registry browser
├── identity/                         # Identity & persona UI
├── drawer/                           # Smart drawer implementations
├── smarttriad/                       # SmartTriad UI
├── smartDrawer/                      # Drawer variations
├── qubetalk/                         # QubeTalk UI
├── crm/                              # CRM panels
├── ops/                              # Blockchain ops UI
├── preview/                          # Content preview
├── metame/                           # MetaMe components
├── admin/                            # Admin panels
├── SubmenuDrawer.tsx                 # Main navigation drawer
├── Sidebar.tsx                       # Navigation sidebar
└── [10+ more components]
```

### **`/supabase`** (Database Migrations)

PostgreSQL schema and policy definitions.

```
supabase/
├── migrations/
│   ├── 20260220110000_personas_auth_profile_canonicalization.sql
│   ├── 20251128173200_agentiq_crm_enhanced.sql
│   ├── 20251129030000_crm_persona_linking.sql
│   ├── 20250101_codex_registry.sql
│   ├── 20251230_share_analytics.sql
│   └── [migration history]
└── functions/                        # Supabase Edge Functions
```

### **`/scripts`** (Deployment & Setup)

Scripts for deployment, migration, and local setup.

```
scripts/
├── deploy-qct-runes.js               # Bitcoin Runes deployment
├── deploy-qct-erc20.js               # EVM token deployment
├── deploy-qct-spl.js                 # Solana deployment
├── deploy-qct-reserve.js             # Reserve contract
├── dev-start.mjs                     # Local dev startup
├── verify-embed-policy.mjs            # Embed security check
├── check-embed-headers.mjs            # Header validation
├── reembed-kb.sh                     # Knowledge base embedding
├── setup-marketa-tables.sql          # Marketa DB setup
└── migrations/                       # Data migrations
```

### **`/docs`** (Documentation)

Architecture, specs, and operational documentation.

```
docs/
├── architecture/                     # System design docs
├── briefs/                           # Development briefs
├── specs/                            # Technical specifications
├── examples/                         # Code examples
├── schema/                           # Database schema docs
├── x402/                             # x402 protocol docs
├── qubetalk/                         # QubeTalk docs
├── marketa/                          # Marketa (marketing) docs
├── progress/                         # Project progress reports
├── screenshots/                      # UI screenshots
└── openapi/, postman/                # API documentation
```

### **`/clawhack-group-agents`** (Multi-Agent Framework)

Framework for coordinating multiple agents.

```
clawhack-group-agents/
├── router/                           # Agent routing
├── bridge-core/                      # Bridge between agents
├── adapters/
│   ├── discord/                      # Discord integration
│   └── xmtp/                         # XMTP messaging
├── openclaw-wrapper/                 # Wrapper for OpenClaw
├── schemas/                          # Message schemas
└── scripts/                          # Utility scripts
```

---

## File Organization Principles

1. **Services** — Backend business logic, isolated by domain
2. **API Routes** — HTTP handlers, thin layer calling services
3. **Components** — React UI, minimal logic
4. **Types** — Centralized, shared across app + services
5. **Utils** — Pure functions, no side effects
6. **Hooks** — React-specific state & side effects
7. **Data** — Static, configuration-driven
8. **Contracts** — Solidity, immutable once deployed

---

## Key Statistics

- **API Routes**: 400+ (across all domains)
- **Type Files**: 25+ (shared definitions)
- **Service Modules**: 35+ (backend layer)
- **React Components**: 50+ (UI layer)
- **Smart Contracts**: 6 (EVM, Bitcoin, Solana, ICP)
- **NPM Packages**: 11 (workspace packages)
- **Database Migrations**: 5+ (Supabase schema)

---

## Dependency Graph (High-Level)

```
Next.js App (app/)
  ├── API Routes (app/api/*) → Services (/services/*)
  ├── React Components (components/*) → API Routes
  ├── Contexts (app/contexts/*) → Zustand stores
  ├── Hooks (app/hooks/*) → API calls
  └── Utils (app/utils/*) → Utility functions

Services (/services/*)
  ├── Supabase → Database
  ├── Ethers.js → EVM chains
  ├── @solana/web3.js → Solana
  ├── bitcoinjs-lib → Bitcoin
  ├── @dfinity/agent → ICP
  ├── FIO SDK → FIO protocol
  ├── LangChain / db-gpt → LLM chains
  └── CopilotKit → Agentic UI

Packages (/packages/*)
  ├── Used by app/ and services/
  └── Can be published to npm

Contracts (/contracts/*)
  └── Deployed to EVM, Bitcoin, Solana, ICP
```

---

## Summary

The repository is **organized by responsibility layer** (routes → services → data) and **domain** (identity, payments, content, ops, etc.). Each major concern has:
- API routes in `app/api/[domain]/`
- Services in `services/[domain]/`
- Types in `types/` (shared)
- Components in `components/[domain]/` (if UI)

This structure enables **parallel development**, **clear boundaries**, and **easy testing** of individual domains.
```


