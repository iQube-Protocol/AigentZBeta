# AigentiQ Tenant Architecture

## Overview

AigentiQ operates a **three-tier multi-tenant architecture** with privacy-first data sharing governed by iQube and DIDQube policies.

## Three-Layer Enforcement Model

Access control is enforced at three layers, with blockchain as the ultimate source of truth:

```text
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

## Tenant Hierarchy

```text
┌─────────────────────────────────────────────────────────────────┐
│                    AigentiQ Platform (L0)                       │
│              Root orchestration layer & AA-API                  │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Franchise   │     │   Franchise   │     │   Franchise   │
│    Kn0w1      │     │   Nakamoto    │     │  Qriptopian   │
│    (L1)       │     │    (L1)       │     │    (L1)       │
└───────────────┘     └───────┬───────┘     └───────────────┘
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              ┌─────────┐ ┌─────────┐ ┌─────────┐
              │ Tenant  │ │ Tenant  │ │ Tenant  │
              │Aigent JMO│ │  ...   │ │  ...   │
              │  (L2)   │ │  (L2)   │ │  (L2)   │
              └─────────┘ └─────────┘ └─────────┘
```

## Tier Definitions

### L0: AigentiQ Platform
- **Role**: Root orchestration layer
- **Provides**: AA-API, QubeBase, Identity services, Smart Menu system
- **Access**: Platform super-admins only

### L1: Franchise (First-Class Tenants)
- **Role**: Independent business entities that operate their own UI
- **Examples**: Kn0w1, Nakamoto, Qriptopian, Aigent Moneypenny
- **Capabilities**:
  - Run their own UI calling AigentiQ AA-API
  - Can host sub-tenants (L2)
  - Access via Smart Menu in AigentiQ console
  - Own Knowledge Base (KB)
  - Own Personas, Wallets, iQubes
  - Super-Admins can see data across all their tenants

### L2: Tenant (Sub-Tenant of Franchise)
- **Role**: Client of a Franchise
- **Example**: Aigent JMO (tenant of Nakamoto)
- **Capabilities**:
  - Gets Personas/Wallets via AA-API
  - Own table in shared QubeBase
  - Own Knowledge Base that augments Franchise KB
  - Seeded with Franchise user personas (opt-in required)
  - Can only access their specific tenant tables
  - Can access MetaQube data of Franchise (public)
  - Can invite Franchise users to share data within tenancy

## Data Access Model

### MetaQube (Public Metadata)
- **Visibility**: Anyone in the Franchise can access
- **Contains**: Non-sensitive descriptive data about iQubes
- **No opt-in required**

### BlakQube (Private Payload)
- **Visibility**: Controlled by iQube and DIDQube policies
- **Access requires**: User opt-in and explicit sharing consent
- **Cross-tenant sharing**: Users can invite others to share specific BlakQube data

### Access Matrix

| Actor | Own Data | Tenant MetaQube | Tenant BlakQube | Franchise MetaQube | Other Tenant Data |
|-------|----------|-----------------|-----------------|--------------------|--------------------|
| User | ✅ Full | ✅ Read | ❌ (unless shared) | ✅ Read | ❌ (unless invited) |
| Tenant Admin | ✅ Full | ✅ Full | ✅ Tenant scope | ✅ Read | ❌ |
| Franchise Super-Admin | ✅ Full | ✅ All tenants | ✅ Policy-governed | ✅ Full | ✅ MetaQube only |
| Platform Admin | ✅ Full | ✅ All | ✅ Audit only | ✅ All | ✅ Audit only |

## Franchise → Tenant Inheritance

When a Tenant (L2) is created under a Franchise (L1):

1. **Functionality**: Inherits all Franchise capabilities
2. **User Personas**: Seeded from Franchise (requires user opt-in)
3. **Knowledge Base**: Tenant KB augments Franchise KB
4. **Data Isolation**: Tenant data in separate tables
5. **Policy Governance**: iQube/DIDQube policies control cross-access

## Cross-Tenant Interaction

**Goal**: Encourage engagement while respecting user privacy

### Sharing Mechanisms
1. **Invitation**: Users can invite other Franchise users to share data
2. **Opt-in**: Users must explicitly agree to share iQubes with Tenant Aigents
3. **Revocable**: Sharing can be revoked at any time via DIDQube

### Example: Aigent JMO accessing Nakamoto user data
```
1. User creates Persona in Nakamoto
2. User opts-in to Aigent JMO tenant
3. User grants JMO access to specific iQubes
4. JMO Aigent can now access those iQubes' BlakQube data
5. JMO augments responses with its own KB + Nakamoto KB
```

## Database Schema (QubeBase)

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

-- Tenants (L2) - belong to a Franchise
CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  franchise_id uuid REFERENCES franchises(id),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  kb_endpoint text,  -- Augments franchise KB
  chains text[],
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Personas can belong to Franchise or Tenant
CREATE TABLE persona (
  id uuid PRIMARY KEY,
  franchise_id uuid REFERENCES franchises(id),
  tenant_id uuid REFERENCES tenants(id),  -- NULL = franchise-level
  -- ... existing fields
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

## Current Franchises

| Franchise | Slug | Status | Tenants |
|-----------|------|--------|---------|
| Kn0w1 | `kn0w1` | Active | - |
| Nakamoto | `nakamoto` | Active | Aigent JMO |
| Qriptopian | `qriptopian` | Pending Integration | - |
| Aigent Moneypenny | `moneypenny` | Planned | - |

## Smart Menu Integration

Franchises can be accessed directly in the AigentiQ console via Smart Menu:

```typescript
// Smart Menu config for Franchise access
{
  menuId: "franchise_nakamoto",
  context: "console",
  actions: [
    { type: "launch_franchise", franchiseId: "nakamoto" },
    { type: "switch_tenant", tenantId: "aigent-jmo" },
    { type: "view_shared_iqubes" },
  ]
}
```

## Data Storage Architecture

AigentiQ supports **hybrid data storage** with intelligent routing based on policy requirements. Storage decisions are configurable at Platform, Franchise, Tenant, or iQube level.

### Storage Providers

| Provider | Type | Best For | Characteristics |
|----------|------|----------|-----------------|
| **QubeBase (Supabase)** | Centralized | Fast queries, real-time | Low latency, SQL, managed |
| **Autonomys** | Decentralized | AI-native permanent storage | Verifiable, AI-optimized |
| **Arweave** | Decentralized | Permanent archival | Pay-once, immutable |
| **Swarm** | Decentralized | Privacy-first, censorship-resistant | Encrypted, distributed |
| **IPFS** | Decentralized | Content-addressed | Deduplication, CDN-like |

### Storage Topology

```text
┌─────────────────────────────────────────────────────────────────┐
│                     iQube Data Structure                        │
├─────────────────────────────────────────────────────────────────┤
│  MetaQube (Public Metadata)                                     │
│  ├── Always: QubeBase (fast queries)                           │
│  └── Optional: IPFS/Arweave (permanent reference)              │
├─────────────────────────────────────────────────────────────────┤
│  BlakQube (Private Payload)                                     │
│  ├── Hot: QubeBase (encrypted, fast access)                    │
│  ├── Warm: Autonomys/Swarm (encrypted, decentralized)          │
│  └── Cold: Arweave (encrypted, permanent archive)              │
└─────────────────────────────────────────────────────────────────┘
```

### Storage Policy Configuration

Policies can be set at multiple levels (lower level overrides higher):

```typescript
interface StoragePolicy {
  level: 'platform' | 'franchise' | 'tenant' | 'iqube';
  
  // Where to store data
  metaQubeStorage: ('qubebase' | 'ipfs' | 'arweave')[];
  blakQubeStorage: {
    hot: 'qubebase' | 'autonomys' | 'swarm';
    warm?: 'autonomys' | 'swarm' | 'ipfs';
    cold?: 'arweave';
  };
  
  // Policy triggers
  rules: {
    // Regional compliance (GDPR, etc.)
    region?: string[];
    requiredJurisdiction?: string;
    
    // Security requirements
    minEncryption?: 'aes256' | 'aes512' | 'quantum-resistant';
    requireDecentralized?: boolean;
    requirePermanent?: boolean;
    
    // Cost optimization
    maxStorageCostPerGB?: number;
    preferredProvider?: string;
    
    // Data classification
    sensitivityThreshold?: number;  // 0-10, triggers decentralized
    retentionDays?: number;         // Auto-archive to cold after N days
  };
}
```

### Example Policies

**Platform Default:**
```json
{
  "level": "platform",
  "metaQubeStorage": ["qubebase"],
  "blakQubeStorage": { "hot": "qubebase" },
  "rules": { "minEncryption": "aes256" }
}
```

**GDPR-Compliant Franchise (EU):**
```json
{
  "level": "franchise",
  "metaQubeStorage": ["qubebase", "ipfs"],
  "blakQubeStorage": { "hot": "swarm", "cold": "arweave" },
  "rules": {
    "region": ["EU"],
    "requiredJurisdiction": "EU",
    "requireDecentralized": true
  }
}
```

**High-Security Tenant:**
```json
{
  "level": "tenant",
  "blakQubeStorage": { "hot": "autonomys", "warm": "swarm", "cold": "arweave" },
  "rules": {
    "minEncryption": "quantum-resistant",
    "requireDecentralized": true,
    "requirePermanent": true,
    "sensitivityThreshold": 7
  }
}
```

### Intelligent Storage Router

The Storage Router automatically selects providers based on policy:

```text
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  iQube Data  │────▶│  Storage Router │────▶│  Provider(s)     │
└──────────────┘     └─────────────────┘     └──────────────────┘
                              │
                     ┌────────┴────────┐
                     ▼                 ▼
              ┌─────────────┐   ┌─────────────┐
              │   Policy    │   │   Context   │
              │   Engine    │   │   (region,  │
              │             │   │   user,     │
              └─────────────┘   │   app)      │
                                └─────────────┘

Decision factors:
1. iQube sensitivity score
2. User/Tenant/Franchise policy
3. Regional compliance requirements
4. Cost constraints
5. Access pattern (hot/warm/cold)
6. Third-party app requirements
```

### Cross-Provider Consistency

- **MetaQube Hash**: Stored on-chain, references all storage locations
- **BlakQube Encryption Key**: Managed by DIDQube, never stored with data
- **Replication Proof**: DVN verifies data exists across required providers
- **Migration**: Data can move between providers without changing iQube ID

## DVN (Decentralized Verification Network) Enforcement

The DVN is the ultimate authority for cross-tenant data access. All sharing decisions are validated on-chain.

### DIDQube Policies

DIDQube policies control identity-based access:

- **Persona Verification**: Validates persona ownership before granting access
- **Consent Attestations**: On-chain proof that user consented to share
- **Revocation**: Immediate on-chain revocation propagates to all layers
- **Cohort Membership**: Anonymous verification without revealing identity

### iQube Policies

iQube policies control data-level access:

- **MetaQube Access**: Public metadata, no policy check required
- **BlakQube Access**: Requires valid DIDQube attestation + iQube policy match
- **Sharing Rules**: Owner-defined rules for who can access payload
- **Time-Bound Access**: Automatic expiration of sharing permissions

### Cross-Tenant Flow (DVN-Enforced)

```text
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

QubeBase mirrors blockchain state for performance, but DVN is authoritative:

| Operation | Primary Check | Fallback |
|-----------|---------------|----------|
| Read MetaQube | QubeBase RLS | - |
| Read BlakQube | QubeBase RLS | DVN validation |
| Write/Share | DVN first | Then QubeBase |
| Revoke | DVN first | Immediate QubeBase update |

## Next Steps

### Phase 1: Franchise Architecture

1. [ ] Update QubeBase schema with `franchises` table
2. [ ] Migrate `tenants` to reference `franchise_id`
3. [ ] Integrate Qriptopian as new Franchise
4. [ ] Implement iQube sharing consent flow
5. [ ] Add Smart Menu Franchise launcher
6. [ ] Rename Nakamoto2 → Nakamoto

### Phase 2: DVN Integration

7. [ ] Implement DVN attestation sync to QubeBase
8. [ ] Add on-chain revocation listener
9. [ ] DIDQube policy enforcement at data access layer
10. [ ] iQube policy validation before BlakQube access

### Phase 3: Decentralized Storage

11. [ ] Implement Storage Router service
12. [ ] Integrate Autonomys provider (AI-native storage)
13. [ ] Integrate Arweave provider (permanent archival)
14. [ ] Integrate Swarm provider (privacy-first)
15. [ ] Storage policy configuration UI
16. [ ] Hot/Warm/Cold data migration automation
17. [ ] Cross-provider consistency verification
