# Knowledge — DIDQube Identity Architecture

Source: `docs/IDENTITY_ARCHITECTURE.md`

---

## Identity Hierarchy

```
User (Human/AI Entity)
  └─ Root DID (did:qube:root-xyz...)           ← ONE per user
      ├─ Persona 1 (did:qube:persona-abc...)   ← MANY per user
      │   ├─ FIO Handle: alice@aigent
      │   ├─ Reputation: Gaming context
      │   └─ Cohorts: AI Researchers
      │
      ├─ Persona 2 (did:qube:persona-def...)
      │   ├─ FIO Handle: alice-work@aigent
      │   ├─ Reputation: Professional context
      │   └─ Cohorts: Developers
      │
      └─ Persona 3 (did:qube:persona-ghi...)
          ├─ No FIO Handle (anonymous)
          ├─ Reputation: Social context
          └─ Cohorts: Community
```

---

## The Four Layers

### Layer 0: Root DID (Master Identity)
- **Quantity:** ONE per user
- **Purpose:** Master identity controlling all personas
- **Field:** `root_id` in persona table
- **Status:** Phase 1 = `null`, Phase 2 = populated

### Layer 1: Persona ID (Context Identity)
- **Quantity:** MANY per user
- **Purpose:** Context-specific identities
- **Field:** `id` in persona table (UUID)
- **Links to:** Reputation, cohorts, transactions

### Layer 2: FIO Handle (Blockchain Identity)
- **Quantity:** 0–1 per persona (optional)
- **Purpose:** Human-readable blockchain identity
- **Field:** `fio_handle` (e.g., `alice@aigent`)
- **Searchable:** FIO Explorer

### Layer 3: FIO Public Key (Cryptographic Proof)
- **Quantity:** 1 per FIO handle
- **Purpose:** Ownership proof
- **Field:** `fio_public_key`

---

## Why Multiple Personas?

### 1. Privacy Contexts
- **Work:** `alice-work@aigent` (identifiable)
- **Social:** `alice@aigent` (semi-anonymous)
- **Anonymous:** No FIO handle

### 2. Reputation Isolation
- Gaming reputation separate from professional
- Each persona builds independent reputation
- Cannot link personas without root DID

### 3. Cohort Participation
- Join different cohorts with different personas
- Prevent cross-context tracking
- Selective disclosure

---

## Reputation System Integration

```typescript
interface Reputation {
  persona_id: string;  // Links to specific persona, NOT root
  context: string;     // e.g., "gaming", "finance"
  score: number;
  evidence: Evidence[];
}
```

Reputation is **per-persona**, not per-user. Root DID can aggregate optionally. User controls which personas to link.

---

## Cohort System Integration

```typescript
interface CohortMembership {
  cohort_id: string;
  persona_id: string;  // Persona joins, not root user
  role: string;
  joined_at: timestamp;
}
```

---

## Phase 1 vs Phase 2 State

### Phase 1 (Current)

```typescript
{
  id: "persona-abc-123",
  root_id: null,          // Not linked yet
  fio_handle: "alice@aigent"
}
```

### Phase 2 (Target)

```typescript
// First persona — Root DID created
{
  id: "persona-abc-123",
  root_id: "root-xyz-789",
  fio_handle: "alice@aigent"
}

// Second persona for same user
{
  id: "persona-def-456",
  root_id: "root-xyz-789",  // Same root DID
  fio_handle: "alice-work@aigent"
}
```

---

## Summary Table

| Layer | Quantity | Purpose | Example |
|-------|----------|---------|---------|
| **User** | 1 | Real entity | You |
| **Root DID** | 1 per user | Master identity | `did:qube:root-xyz` |
| **Persona** | Many per user | Context identity | `did:qube:persona-abc` |
| **FIO Handle** | 0–1 per persona | Blockchain ID | `alice@aigent` |
| **Reputation** | 1 per persona | Context score | Gaming: 850 |
| **Cohort** | Many per persona | Memberships | "AI Researchers" |

---

## Key Rule

**Root DID** = Your passport (ONE identity)
**Persona** = Your social profiles (MANY identities)
**FIO Handle** = Your username on each platform
**Reputation** = Your karma/score on each platform

See also:
- `items/knowledge/identity-policy.md` — DiDQube policy rules and admin role assignment
- `items/architecture/data-identity.md` — Full identity architecture with KybeDID and DIDQubes
