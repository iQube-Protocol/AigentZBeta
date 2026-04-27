# AgentiQ OS Stack Overview

The full AgentiQ OS stack follows an **hourglass architecture**: open participation at the top and bottom, governed policy enforcement at the waist.

## Layer Model

| Layer | Role | Openness |
|-------|------|---------|
| **Cartridges / Experiences** | Domain-specific modules for users and developers | Open — anyone can build |
| **AgentiQ Platform** | Cartridge renderer, multi-codex viewer, SmartTriad shell | Private — deployed by iQube Protocol |
| **AgentiQ OS SDK** | Developer surface: cartridge scaffolding, persona creation, delegation | Open source |
| **AgentiQ OS Runtime** | NBE routing, OrchestrationEvents, experience depth ladder | Open spec, private runtime |
| **iQube Protocol** | Data sovereignty, ownership, disclosure classes | Open spec |
| **Qripto Protocol** | Trust, payments, DVN receipts, reputation | Open spec |
| **nanOS** | metaMe's proprietary production distribution of AgentiQ OS — Population Console, Aigent coordination, CRM, commercial rails, Registry governance, Experience Matrix | Proprietary |
| **Storage / Chain** | Supabase, ICP canisters, EVM, Autonomys Auto-Drive | Mixed — public chains, private DB |

## The Governed Waist

The governed waist is the AgentiQ OS Runtime + Policy layer. This is where:
- PolicyEnvelope sealing occurs (delegation boundaries are set)
- Routing priority chain is enforced (metaMe → Z → C → cartridge lead)
- Trust band checks gate capability access
- DVN receipts are generated

nanOS operates on top of this governed waist — adding proprietary intelligence and production operations without bypassing the open policy layer.

## Current Technology Stack

| Concern | Technology |
|---------|-----------|
| Frontend / Cartridges | Next.js (App Router), React, TailwindCSS |
| API Routes | Next.js API routes (server-side) |
| Agent Runtime | Anthropic Claude API (Opus/Sonnet/Haiku), OpenAI, Venice AI |
| Identity | Supabase (personas, wallet), ICP canisters (DID anchoring) |
| Storage — working state | Supabase PostgreSQL + Row Level Security |
| Storage — canonical / persistent | Autonomys Auto-Drive (mainnet, encrypted) |
| Storage — on-chain receipts | EVM (Sepolia, Polygon Amoy, Arbitrum Sepolia, Base Sepolia) |
| Payments | x402 protocol, FIO handle addressing |
| SDK | `packages/agentiq-sdk` (TypeScript, published from this monorepo) |

## Experience Depth Ladder

Experiences escalate one step at a time — no skipping:

```
L0: pill         → 30-second intro (static)
L1: capsule      → 2-minute interactive (inline)
L2: mini_runtime → 5-10 minute session (stateful)
L3: codex        → Full cartridge (persistent, copilot-enabled)
```

The NBE (Next Best Experience) system recommends the appropriate depth based on the user's current journey stage and persona state.

## Journey Stages

```
prospect → acolyte → keta → keji → first → zero
```

Each stage unlocks deeper experience depths and higher delegation scopes.

## Data Flow: Request → Response

```
User message
    │
    ▼
DelegationGuard
 ├── Load PolicyEnvelope for persona + cartridge
 ├── Injection pattern scan
 ├── Action classification vs forbidden_actions
 ├── TTL + action counter check
    │
    ▼
OrchestrationRouter
 ├── metaMe guardian check (policy violation?)
 ├── Active cartridge lead routing
 ├── Aigent Z / Aigent C selection
    │
    ▼
LLM (Claude / OpenAI / Venice)
 ├── System prompt: grounding KB + PolicyEnvelope (immutable block)
 ├── RAG: search codexes/packs/agentiq-os/
    │
    ▼
Response disclosure check (strip disclosure_class violations)
    │
    ▼
OrchestrationEvent emitted (receipt_eligible events → DVN)
    │
    ▼
Response to client
```
