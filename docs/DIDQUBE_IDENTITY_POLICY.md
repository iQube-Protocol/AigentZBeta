# DiDQube Identity Policy Framework

## Identity Hierarchy

DiDQube implements a layered identity model with clear separation of concerns:

```
KybeDID (personhood anchor)
    └── Root DID (deep identity + reputation)
            └── Persona (primary identity sharing surface)
                    └── Root DID proxies (revocable real-world ID)
```

### 1. KybeDID – Proof of Personhood / Life Anchor

**Purpose:** Canonical "birth/life/death certificate of consciousness"

- Ultimate, stable personhood anchor
- **Rarely changed and rarely shared directly**
- Primarily used to:
  - Generate proof-of-personhood / proof-of-life attestations
  - Anchor long-term continuity across multiple Root DIDs and Personas

**Usage Guidelines:**
- ❌ Do NOT use for admin role assignments
- ❌ Do NOT share directly in normal transactions
- ✅ Use to generate attestations when needed
- ✅ Use for proof-of-personhood verification

### 2. Root DID – Deep, Highly Verifiable Identity

**Purpose:** Long-lived identity tied to a real human, anchored to a KybeDID

- Used in **high-assurance, regulated contexts**:
  - Opening a bank account
  - Registering with a doctor or healthcare provider
  - Applying for government services or benefits
  - **Admin role assignments** ✅
- Where formal, long-term reputation is accumulated
- Exist in small numbers per person (e.g., pre-/post-name change)

**Usage Guidelines:**
- ✅ Use for admin role assignments (grantor and assignee)
- ✅ Use for regulated/high-assurance workflows
- ✅ Use for reputation accumulation
- ❌ Do NOT share casually in day-to-day transactions

### 3. Root DID Proxies – Revocable "Real World ID"

**Purpose:** When a user wants to interact as themselves (not pseudonymously) in normal day-to-day environments

- Anchored to a Root DID
- Provide strong identifiability to counterparties
- **Sovereign and revocable** – user can rotate or revoke a proxy while keeping the underlying Root DID and reputation intact

**Usage Guidelines:**
- ✅ Use when real-world identity is needed in normal transactions
- ✅ Use when you want identifiability but with revocability
- ✅ Attach to Personas when stronger identity assurance is required

### 4. Persona – Primary Identity Sharing Surface

**Purpose:** Main identity interface for most interactions

- May be:
  - Pseudonymous
  - Semi-anonymous
  - Fully named / branded
- What most apps, services, and other agents see and use in day-to-day transactions
- Can be:
  - Backed by KybeDID-derived proof-of-personhood when needed
  - Linked to Root DID proxies when user chooses to reveal real-world identity

**Usage Guidelines:**
- ✅ Default identity context for tools and orchestrations
- ✅ Use for day-to-day transactions
- ✅ Map to Fio handles and x402 request flows
- ❌ Do NOT use for admin role assignments

---

## Fio Integration and x402

Personas are often mapped to **Fio handles** and related addressing schemes.

Payment requests, invoicing, and other flows via **x402** are typically expressed in terms of:
- Persona + Fio handle + associated wallets
- KybeDID-derived proofs or Root DID proxies can be attached when stronger identity assurances are required

---

## Operational Rules for Platform Copilot

1. **Treat Persona as the default identity context** for tools and orchestrations

2. **Use KybeDID mostly to:**
   - Check or attach proof-of-personhood / proof-of-life when requested or required

3. **Use Root DID only for operations that clearly require high-assurance, real-world identity:**
   - Bank-grade, medical, or government-grade workflows
   - **Admin role assignments**

4. **Use Root DID proxies when:**
   - The user wants to be strongly identifiable to a counterparty in normal transactions
   - But still retain the ability to revoke or rotate that identifiability later

5. **Never encourage or default to sharing KybeDIDs or Root DIDs directly** unless the context is explicitly high-assurance and the tools/role allow it

6. **When orchestrating payment or request flows (via Fio/x402)**, always think in terms of:
   - Persona + wallets + optional attached proofs (KybeDID/Root DID proxy), depending on required assurance

---

## Admin Role Assignment Policy

### Required Identity Type: Root DID

Per DiDQube policy, admin roles MUST use Root DIDs (not KybeDIDs or Personas):

```typescript
// ✅ Correct - Using Root DIDs
{
  grantorRootDid: "did:root:grantor123...",  // Admin granting the role
  rootDid: "did:root:assignee456...",        // Person receiving admin access
  roleType: "tenant_super_admin",
  permissions: { ... }
}

// ❌ Incorrect - Using KybeDIDs (deprecated for admin roles)
{
  grantorKybeDid: "did:kybe:...",  // Should use Root DID
  kybeDid: "did:kybe:...",         // Should use Root DID
}
```

### Rationale

1. **Root DIDs are appropriate for high-assurance contexts** like admin access
2. **KybeDIDs are personhood anchors** that should rarely be shared directly
3. **Personas are for day-to-day interactions**, not admin/regulated contexts
4. **Root DIDs accumulate reputation** which is relevant for admin trustworthiness

---

## API Compatibility

The admin roles API accepts both formats for backward compatibility:

| Preferred (Root DID) | Legacy (KybeDID) | Description |
|---------------------|------------------|-------------|
| `grantorRootDid` | `grantorKybeDid` | Admin granting the role |
| `rootDid` | `kybeDid` | Person receiving admin access |

New implementations should always use the Root DID fields.

---

## Version History

- **v1.0** (2024-11-29): Initial policy framework
  - Established identity hierarchy
  - Defined admin role assignment policy
  - Updated API to prefer Root DIDs
