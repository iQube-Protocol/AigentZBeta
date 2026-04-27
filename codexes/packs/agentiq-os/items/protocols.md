# AgentiQ OS Protocols

AgentiQ OS is built on three interlocking protocols. Each has a distinct concern and a canonical interface.

## 1. iQube Protocol — Data Sovereignty

The iQube protocol governs how data is owned, disclosed, and transmitted between agents, personas, and systems.

### Core Types

| Type | Role |
|------|------|
| `DataQube` | Encrypted data container with owner-controlled disclosure |
| `MetaQube` | Metadata shell — describes a DataQube without revealing contents |
| `ContentQube` | Media and document assets with access policy |
| `SmartWalletQube` | Persona wallet binding — balances, entitlements, rewards |
| `AigentQube` | Agent registration — capabilities, policy bindings, Root DiD |

### Disclosure Classes

All iQube content carries a `disclosure_class` that governs what agents can see:

| Class | Who Can Read |
|-------|-------------|
| `public` | Anyone |
| `tenant` | Tenant members only |
| `persona` | Persona owner only |
| `sovereign` | metaMe guardian only (never delegated) |

An agent operating under a bounded delegation can never read content above its granted `disclosure_class`. This is enforced at the API boundary, not just in the system prompt.

### Key Contracts

```typescript
interface DataQube {
  id: string
  ownerId: string          // Root DID of owner
  disclosureClass: DisclosureClass
  encryptedPayload: string // AES-256 encrypted
  metaQube: MetaQube       // Safe-to-share descriptor
  accessPolicy: AccessPolicy
}
```

---

## 2. Qripto Protocol — Trust and Payments

The Qripto protocol governs trust scoring, reputation, and payment settlement between agents and users.

### Trust Bands

| Band | Meaning |
|------|---------|
| `L1_EXPERIMENTAL` | Unverified, community-submitted |
| `L2_VERIFIED_COMMUNITY` | Community-reviewed, production-safe for low-stakes use |
| `L3_PRODUCTION_CANDIDATE` | Reviewed candidate, pending formal approval |
| `L4_PRODUCTION_APPROVED` | Formally approved for production |
| `L5_CORE_SOVEREIGN` | Core protocol asset, sovereign-level trust |

Trust band determines what actions an agent or asset can perform and what delegation scopes it can receive.

### x402 Payment Protocol

All value exchange in the ecosystem uses the x402 standard:
- Payment intent declared in HTTP headers before response delivery
- Settlement logged as DVN receipt
- x402 messages linked to persona FIO handle for human-readable addressing

### DVN Receipts

Distributed Verifiable Notifications — tamper-evident records of material events:
- Receipt-eligible events: delegation granted, policy blocked, stage assigned, mission completed
- Anchored to Root DiD of both parties
- Stored in `orchestration_events` table with `receipt_eligible: true`

---

## 3. Aigent Protocol — Agent Identity and Delegation

The Aigent protocol governs agent identity (Root DiD), capability declaration, policy binding, and bounded delegation.

### Agent Identity Model

Per the Aigent DiDQube Identity Upgrade Note:

> **One Root DiD / Root DiDQube. Multiple bounded personas. Shared accountability. Context-specific disclosure.**

```
Root DiD  ← Enduring accountability anchor (trust, receipts, reputation)
  └── Bounded Persona A  ← cartridge context, disclosure policy A
  └── Bounded Persona B  ← client context, disclosure policy B
```

- The **Root DiD** is the agent's immutable identity across all contexts
- **Bounded personas** are context-specific presentation layers derived from the root
- Mission receipts and reputation effects always trace back to the Root DiD

### PolicyEnvelope — Delegation Boundary

When an agent receives delegated authority, it carries a sealed `PolicyEnvelope`:

```typescript
interface PolicyEnvelope {
  tenant_id: string
  persona_id: string                    // Bounded persona in this context
  allowed_surfaces: string[]            // Cartridge scopes permitted
  forbidden_actions: string[]           // Explicitly blocked operations
  disclosure_class: DisclosureClass     // Max data visibility
  requires_guardian_approval: boolean
  cartridge_scope: string | null
}
```

The envelope is **sealed at grant time** and cannot be expanded by any agent conversation. Expansion requires a new explicit grant from the user.

### Routing Priority Chain

1. metaMe guardian (policy veto — always wins)
2. Active cartridge lead agent
3. Aigent Z (system orchestrator)
4. Aigent C (default handler)

No agent can escalate its own authority or invoke a higher-priority role without an explicit routing event.
