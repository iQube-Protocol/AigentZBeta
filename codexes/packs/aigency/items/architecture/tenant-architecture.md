# Tenant Architecture

Source: `docs/TENANT_ARCHITECTURE.md`

AigentiQ operates a three-tier multi-tenant architecture with privacy-first data sharing governed by iQube and DIDQube policies.

---

## Three-Layer Enforcement Model

Access control is enforced at three layers, with blockchain as the ultimate source of truth:

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: BLOCKCHAIN (DVN) - Ultimate Enforcement               │
│  - DIDQube policies (identity verification, consent)            │
│  - iQube policies (data access, sharing rules)                  │
│  - On-chain attestations and revocations                        │
│  - DVN validates all cross-tenant data access                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: QUBEBASE (Supabase RLS) - Database Enforcement        │
│  - Row-Level Security policies                                  │
│  - Franchise/Tenant isolation                                   │
│  - Persona-scoped data access                                   │
│  - Mirrors blockchain policies for performance                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: REGISTRY (Application) - Business Logic               │
│  - Tenant/Franchise management                                  │
│  - Smart Menu configuration                                     │
│  - AA-API access control                                        │
│  - Caches blockchain state for UX                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tenant Hierarchy

```
AigentiQ Platform (L0)
Root orchestration layer & AA-API
        │
        ├── Franchise Kn0w1 (L1)
        │
        ├── Franchise Nakamoto (L1)
        │       ├── Tenant Aigent JMO (L2)
        │       └── Tenant ... (L2)
        │
        └── Franchise Qriptopian (L1)
```

### Tier Definitions

**L0: AigentiQ Platform**
- Role: Root orchestration layer
- Provides: AA-API, QubeBase, Identity services, Smart Menu system
- Access: Platform super-admins only

**L1: Franchise (First-Class Tenants)**
- Role: Independent business entities that operate their own UI
- Examples: Kn0w1, Nakamoto, Qriptopian, Aigent Moneypenny
- Capabilities:
  - Run their own UI calling AigentiQ AA-API
  - Can host sub-tenants (L2)
  - Access via Smart Menu in AigentiQ console
  - Own Knowledge Base (KB), Personas, Wallets, iQubes
  - Super-Admins can see data across all their tenants

**L2: Tenant (Sub-Tenant of Franchise)**
- Role: Client of a Franchise
- Example: Aigent JMO (tenant of Nakamoto)
- Capabilities:
  - Gets Personas/Wallets via AA-API
  - Own tables in shared QubeBase
  - Own Knowledge Base that augments Franchise KB
  - Seeded with Franchise user personas (opt-in required)
  - Can only access their specific tenant tables
  - Can access MetaQube data of Franchise (public)

---

## Data Access Model

### MetaQube (Public Metadata)
- Visibility: Anyone in the Franchise can access
- No opt-in required

### BlakQube (Private Payload)
- Controlled by iQube and DIDQube policies
- Requires user opt-in and explicit sharing consent

### Access Matrix

| Actor | Own Data | Tenant MetaQube | Tenant BlakQube | Franchise MetaQube | Other Tenant Data |
|-------|----------|-----------------|-----------------|--------------------|--------------------|
| User | Full | Read | ❌ (unless shared) | Read | ❌ (unless invited) |
| Tenant Admin | Full | Full | Tenant scope | Read | ❌ |
| Franchise Super-Admin | Full | All tenants | Policy-governed | Full | MetaQube only |
| Platform Admin | Full | All | Audit only | All | Audit only |

---

## Database Schema

```sql
-- Franchises (L1)
CREATE TABLE franchises (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  platform_id uuid REFERENCES platforms(id),
  kb_endpoint text,
  created_at timestamptz DEFAULT now()
);

-- Tenants (L2)
CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  franchise_id uuid REFERENCES franchises(id),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  kb_endpoint text,        -- Augments franchise KB
  chains text[],
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- iQube sharing permissions
CREATE TABLE iqube_shares (
  id uuid PRIMARY KEY,
  iqube_id uuid REFERENCES iqubes(id),
  owner_persona_id uuid REFERENCES persona(id),
  shared_with_tenant_id uuid REFERENCES tenants(id),
  access_level text CHECK (access_level IN ('metaqube', 'blakqube_read', 'blakqube_write')),
  granted_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);
```

### Current Franchises

| Franchise | Slug | Status | Tenants |
|-----------|------|--------|---------|
| Kn0w1 | `kn0w1` | Active | — |
| Nakamoto | `nakamoto` | Active | Aigent JMO |
| Qriptopian | `qriptopian` | Pending Integration | — |
| Aigent Moneypenny | `moneypenny` | Planned | — |

---

## Decentralized Storage Architecture

AigentiQ supports hybrid data storage with routing based on policy requirements.

### Storage Providers

| Provider | Type | Best For |
|----------|------|----------|
| **QubeBase (Supabase)** | Centralized | Fast queries, real-time, SQL |
| **Autonomys** | Decentralized | AI-native permanent storage, verifiable |
| **Arweave** | Decentralized | Permanent archival (pay-once, immutable) |
| **Swarm** | Decentralized | Privacy-first, censorship-resistant |
| **IPFS** | Decentralized | Content-addressed, deduplication |

### Storage Topology

```
iQube Data Structure
├── MetaQube (Public Metadata)
│   ├── Always: QubeBase (fast queries)
│   └── Optional: IPFS/Arweave (permanent reference)
│
└── BlakQube (Private Payload)
    ├── Hot:  QubeBase (encrypted, fast access)
    ├── Warm: Autonomys/Swarm (encrypted, decentralized)
    └── Cold: Arweave (encrypted, permanent archive)
```

### Storage Policy Configuration

```typescript
interface StoragePolicy {
  level: 'platform' | 'franchise' | 'tenant' | 'iqube';

  metaQubeStorage: ('qubebase' | 'ipfs' | 'arweave')[];
  blakQubeStorage: {
    hot: 'qubebase' | 'autonomys' | 'swarm';
    warm?: 'autonomys' | 'swarm' | 'ipfs';
    cold?: 'arweave';
  };

  rules: {
    region?: string[];                         // e.g. ["EU"] for GDPR
    minEncryption?: 'aes256' | 'aes512' | 'quantum-resistant';
    requireDecentralized?: boolean;
    requirePermanent?: boolean;
    maxStorageCostPerGB?: number;
    sensitivityThreshold?: number;             // 0-10, triggers decentralized
    retentionDays?: number;                    // Auto-archive to cold after N days
  };
}
```

**Example: GDPR-Compliant Franchise (EU)**

```json
{
  "level": "franchise",
  "metaQubeStorage": ["qubebase", "ipfs"],
  "blakQubeStorage": { "hot": "swarm", "cold": "arweave" },
  "rules": { "region": ["EU"], "requireDecentralized": true }
}
```

---

## DVN Enforcement Model

### Cross-Tenant Flow (DVN-Enforced)

```
1. User A (Nakamoto) wants to share iQube with Aigent JMO
2. User A creates sharing attestation on-chain via DIDQube
3. DVN records: { owner: PersonaA, sharedWith: TenantJMO, iQube: X, access: blakqube_read }
4. QubeBase RLS mirrors this attestation for query performance
5. Aigent JMO requests access to iQube X
6. Registry checks QubeBase (fast path)
7. For sensitive ops, DVN validates on-chain attestation (secure path)
8. If User A revokes on-chain, DVN propagates to QubeBase within 1 block
```

### Policy Sync

| Operation | Primary Check | Fallback |
|-----------|---------------|---------|
| Read MetaQube | QubeBase RLS | — |
| Read BlakQube | QubeBase RLS | DVN validation |
| Write/Share | DVN first | Then QubeBase |
| Revoke | DVN first | Immediate QubeBase update |

### iQube Policy Key Points

- **MetaQube**: Public metadata, no policy check required
- **BlakQube**: Requires valid DIDQube attestation + iQube policy match
- **Sharing**: Owner-defined rules; time-bound with automatic expiration
- **Revocation**: Immediate on-chain, propagates to QubeBase within 1 block

---

## Cross-Tenant Interaction Example

**Aigent JMO accessing Nakamoto user data:**

```
1. User creates Persona in Nakamoto
2. User opts-in to Aigent JMO tenant
3. User grants JMO access to specific iQubes
4. JMO Aigent can access those iQubes' BlakQube data
5. JMO augments responses with its own KB + Nakamoto KB
```
