# DIDQube Identity Architecture - Core Concepts

## Identity Hierarchy

```
User (Human/AI Entity)
  └─ Root DID (did:qube:root-xyz...)  ← ONE per user
      ├─ Persona 1 (did:qube:persona-abc...)  ← MANY per user
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
- **Status:** Currently `null` (Phase 1), to be implemented

### Layer 1: Persona ID (Context Identity)
- **Quantity:** MANY per user
- **Purpose:** Context-specific identities
- **Field:** `id` in persona table (UUID)
- **Links to:** Reputation, cohorts, transactions

### Layer 2: FIO Handle (Blockchain Identity)
- **Quantity:** 0-1 per persona (optional)
- **Purpose:** Human-readable blockchain identity
- **Field:** `fio_handle` (e.g., `alice@aigent`)
- **Searchable:** FIO Explorer

### Layer 3: FIO Public Key (Cryptographic Proof)
- **Quantity:** 1 per FIO handle
- **Purpose:** Ownership proof
- **Field:** `fio_public_key`
- **Searchable:** FIO Explorer

---

## Why Multiple Personas?

### 1. Privacy Contexts
- **Work:** `alice-work@aigent` (identifiable)
- **Social:** `alice@aigent` (semi-anonymous)
- **Anonymous:** No FIO handle

### 2. Reputation Isolation
- Gaming reputation separate from professional
- Each persona builds independent reputation
- Can't link personas without root DID

### 3. Cohort Participation
- Join different cohorts with different personas
- Prevent cross-context tracking
- Selective disclosure

---

## Reputation System Integration

```typescript
interface Reputation {
  persona_id: string;  // ← Links to specific persona, NOT root
  context: string;     // e.g., "gaming", "finance"
  score: number;
  evidence: Evidence[];
}
```

**Key Points:**
- Reputation is **per-persona**, not per-user
- Each persona has independent reputation
- Root DID can aggregate (optional)
- User controls which personas to link

---

## Cohort System Integration

```typescript
interface CohortMembership {
  cohort_id: string;
  persona_id: string;  // ← Persona joins, not root user
  role: string;
  joined_at: timestamp;
}
```

**Benefits:**
- Privacy-preserving participation
- Can't be tracked across cohorts
- Different personas for different communities

---

## Current vs Future State

### Phase 1 (Current)
```typescript
{
  id: "persona-abc-123",
  root_id: null,  // ← Not linked yet
  fio_handle: "alice@aigent"
}
```

### Phase 2 (Recommended)
```typescript
// Root DID created on first persona
{
  id: "persona-abc-123",
  root_id: "root-xyz-789",  // ← Links to user
  fio_handle: "alice@aigent"
}

// Second persona for same user
{
  id: "persona-def-456",
  root_id: "root-xyz-789",  // ← Same root
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
| **FIO Handle** | 0-1 per persona | Blockchain ID | `alice@aigent` |
| **Reputation** | 1 per persona | Context score | Gaming: 850 |
| **Cohort** | Many per persona | Memberships | "AI Researchers" |

---

## Key Takeaway

**Persona ID ≠ Root DID**

- **Root DID** = Your passport (ONE identity)
- **Persona** = Your social media profiles (MANY identities)
- **FIO Handle** = Your username on each platform
- **Reputation** = Your karma/score on each platform

**Each user should have:**
- ✅ ONE Root DID (master)
- ✅ MULTIPLE Personas (contexts)
- ✅ OPTIONAL FIO Handles (blockchain)
