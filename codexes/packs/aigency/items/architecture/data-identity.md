# Data & Identity Architecture

## Identity Model: KybeDID → Root DID → PersonaQube

The identity system uses a **three-tier approach** with **decentralized identifiers (DIDs)** and **FIO handles** as persistent human-readable aliases.

### **Tier 1: KybeDID (Estate-Wide Identifier)**

A KybeDID is the **universal, immutable identifier** for an entity across the entire AgentiQ estate. It is assigned once and never changes.

```typescript
// KybeDID format: did:iq:kybe:<uuid>
type KybeDID = string; // e.g., "did:iq:kybe:550e8400-e29b-41d4-a716-446655440000"

// In Supabase:
// - crm_platform_accounts.kybe_did
// - crm_registry_profiles.kybe_did
// - Any table with estate-wide reference
```

**Purpose**:
- Unique, immutable reference for audit trails
- Estate-wide user tracking across platforms/tenants
- Reputation aggregation across all contributions
- DIDQube consent tracking

### **Tier 2: Root DID (Canonical Identity)**

A Root DID is the **canonical decentralized identifier** for a Persona. It is generated during persona creation and can resolve to multiple aliases (FIO handles, EVM addresses).

```typescript
// Root DID format: did:iq:<method>:<identifier>
// Example: did:iq:persona:550e8400-e29b-41d4-a716-446655440000

export interface ResolvedIdentity {
  canonicalDid: string;        // The root DID
  displayName?: string;
  personaId?: string;
  verifiedAliases?: Array<{    // All aliases for this DID
    type: string;               // 'fio', 'evm', 'icp', 'email'
    value: string;
  }>;
  proofs?: any[];              // Cryptographic proofs of ownership
}
```

**Identity Resolver** (`/services/identity/identityResolver.ts`):
```typescript
export async function resolveIdentity(subject: string): Promise<ResolvedIdentity> {
  // If input is a DID → return as canonical
  if (isDid(subject)) {
    return { canonicalDid: subject };
  }
  
  // If input is FIO handle (alice@qripto) → resolve to DID
  if (isFio(subject)) {
    const handle = subject.replace(/^fio:/i, '');
    const { data } = await fetch(`/api/identity/fio/lookup?handle=${handle}`);
    return {
      canonicalDid: `did:iq:alias:fio:${handle}`,
      verifiedAliases: [{ type: 'fio', value: handle }],
    };
  }
  
  // Otherwise → treat as generic alias
  return { canonicalDid: `did:iq:alias:${subject}` };
}

export async function bindAliasToDid(
  entityDid: string,
  aliasType: 'fio'|'evm'|'icp'|'email',
  aliasValue: string,
  proofRef?: string
) {
  // Inserts to identity_aliases table with TTL
  await supabase.from('identity_aliases').insert({
    entity_did: entityDid,
    alias_type: aliasType,
    alias_value: aliasValue,
    verified: true,
    proof_ref: proofRef,
    expires_at: expiration,
  });
}
```

### **Tier 3: PersonaQube (User Identity Object)**

A **PersonaQube** is a full identity record in the iQube schema. It represents a user's persistent identity within a tenant or platform.

```typescript
export interface PersonaQube {
  // Identity
  id: string;                           // UUID
  rootDid: string;                      // did:iq:persona:...
  fioHandle: string;                    // alice@qripto
  fioDomain: 'qripto' | 'knyt';
  displayName: string;
  avatarUri?: string;
  
  // Keys & Addresses
  evmKey: EvmKeyPair;                   // Single EVM key
  chainAddresses: ChainAddresses;       // Derived addresses per chain
  bitcoinKey?: BitcoinKeyPair;
  solanaKey?: SolanaKeyPair;
  
  // Reputation
  reputationScore: number;              // 0-100
  reputationBucket: 0 | 1 | 2 | 3 | 4 | 5;
  badges: string[];
  
  // Metadata
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  authProfileId?: string;
}

export interface EvmKeyPair {
  publicKey: string;                    // Hex
  address: string;                      // 0x...
  encryptedPrivateKey: EncryptedKey;    // AES-256-GCM
  keySource: 'generated' | 'imported';
  createdAt: string;
}
```

**Flow: Persona Creation**

```
POST /api/identity/persona/create-with-fio
  ↓
Input: { username, domain, password, displayName, tenantId }
  ↓
PersonaService.generateEvmKey()
  - Creates Ed25519/ECDSA keypair
  - Encrypts private key with password (AES-256-GCM)
  ↓
PersonaService.registerFioHandle()
  - Calls FIO Protocol SDK
  - Registers username@domain chain addresses
  ↓
Supabase INSERT personas table
  - id, root_did, fio_handle, evm_key_encrypted, etc.
  ↓
bindAliasToDid()
  - INSERT identity_aliases (fio@qripto → did:iq:persona:...)
  ↓
PersonaQube returned to client
```

---

## Data Structure: iQube Types

The system uses a **flexible iQube hierarchy** for all data objects.

### **Base iQube Concept**

Every data entity extends an iQube type:

```typescript
export type IQubeType = 
  | 'DataQube'                        // Knowledge, facts, structured data
  | 'ContentQube'                     // Media: articles, episodes, issues
  | 'ToolQube'                        // Executable tool
  | 'ModelQube'                       // AI model specification
  | 'AigentQube'                      // Agent configuration
  | 'LiquidUITemplateArchetypeQube'   // UI/design template
  | 'DesignQube'                      // Custom: design system + theming
  | 'SmartContentQube'                // Custom: self-aware content
  | 'SmartWalletQube'                 // Custom: wallet state
  | 'PersonaQube'                     // Custom: user identity
  | 'TokenQubeACL';                   // Custom: token access control
```

### **SmartContentQube** — Self-Aware Content

```typescript
export interface SmartContentQube {
  // Identity
  id: string;
  type: 'SmartContentQube';
  contentType: 'episode' | 'article' | 'issue' | 'collection';
  title: string;
  description?: string;
  
  // Modality
  modality: 'read' | 'watch' | 'listen' | 'interact';
  
  // Pricing & Access
  pricingModel: PricingKind;           // payPerEpisode, subscription, free
  price?: { currency: PaymentCurrency; amount: string };
  identityRequirements: IdentityRequirements;  // Min identity state
  
  // Rendering Hints
  layout: {
    cardShape: 'portrait' | 'landscape' | 'square';
    responsive: { mobile: string; tablet: string; desktop: string };
  };
  
  // Relations (Wave Layer)
  relations: Array<{
    type: RelationshipType;            // sequence, branch, prerequisite
    targetId: string;                  // Related content ID
    metadata?: Record<string, any>;
  }>;
  
  // Rewards
  rewards: Array<{
    trigger: RewardTrigger;            // episodeComplete, shareContent
    asset: PaymentCurrency;
    amount: string;
  }>;
  
  // Storage
  content: ContentReference;           // { type: 'uri' | 'ipfs' | 'autonomys'; uri: string; }
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  creatorId: string;                   // Persona ID of creator
}
```

### **SmartWalletQube** — Persistent Wallet State

```typescript
export interface SmartWalletQube {
  id: string;
  type: 'SmartWalletQube';
  personaId: string;                   // Owner's persona ID
  
  // Balances (across chains)
  balances: WalletBalance[];           // Qc, QOYN, QCT, KNYT
  
  // Entitlements (what user has access to)
  entitlements: EntitlementQube[];     // Episodes, articles, series purchased
  
  // Rewards
  rewards: {
    pending: RewardClaim[];            // Not yet claimed
    claimed: RewardClaim[];
    history: RewardTransaction[];
  };
  
  // Tasks & Quests
  tasks: WalletTask[];                 // Daily/weekly/event-based tasks
  quests: WalletQuest[];               // Longer journeys
  
  // DeFi Positions
  defiPositions: DefiPosition[];       // Staking, LP, vaults
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string;
}
```

### **DesignQube** — Design System & Theming

```typescript
export type DesignQube = {
  id: string;
  type: 'DesignQube';
  name: string;
  mode: 'light' | 'dark';
  
  // Style tokens
  styles: StyleQube;        // Colors, typography, spacing
  
  // Structure tokens
  structure: StructureQube; // Layout grid, components
  
  // Constraints
  constraints: DesignQubeConstraints;
  
  // Asset references
  source: DesignQubeSource;
};
```

---

## Supabase Schema (Key Tables)

### **personas** — User Identity

```sql
CREATE TABLE personas (
  id UUID PRIMARY KEY,
  root_did VARCHAR(256) NOT NULL,
  tenant_id UUID NOT NULL,
  auth_profile_id UUID,
  fio_handle VARCHAR(128) NOT NULL,
  fio_domain VARCHAR(32) NOT NULL,  -- 'qripto' | 'knyt'
  display_name VARCHAR(256),
  avatar_uri TEXT,
  evm_key_encrypted JSONB NOT NULL, -- { ciphertext, iv, salt, authTag }
  chain_addresses JSONB,             -- { base, optimism, polygon, arbitrum, ethereum }
  reputation_score INT DEFAULT 0,    -- 0-100
  reputation_bucket INT DEFAULT 0,   -- 0-5
  badges TEXT[] DEFAULT '{}',
  status VARCHAR(32) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policy: Users can read their own persona, service role can read all
CREATE POLICY personas_select ON personas
  USING (auth_id = current_user_id() OR current_user_role() = 'service_role');
```

### **identity_aliases** — DID/FIO/EVM Mappings

```sql
CREATE TABLE identity_aliases (
  id UUID PRIMARY KEY,
  entity_did VARCHAR(256) NOT NULL,     -- Root DID
  alias_type VARCHAR(32) NOT NULL,      -- 'fio' | 'evm' | 'icp' | 'email'
  alias_value VARCHAR(256) NOT NULL,    -- Actual handle/address
  verified BOOLEAN DEFAULT false,
  proof_ref TEXT,                       -- Reference to proof data
  last_verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_entity_did_alias_type ON identity_aliases(entity_did, alias_type);
```

### **x402_messages** — Payment Records

```sql
CREATE TABLE x402_messages (
  id UUID PRIMARY KEY,
  intent VARCHAR(64) NOT NULL,
    -- 'iqube.transfer' | 'iqube.grant' | 'iqube.deliver' | 'asset.claim' | 'asset.send'
  headers JSONB NOT NULL,               -- Full x-402-* headers
  payload JSONB,
  state VARCHAR(32) DEFAULT 'received', -- 'received' | 'processing' | 'settled' | 'failed'
  resolved_sender_did VARCHAR(256),     -- Canonical DID after resolution
  resolved_recipient_did VARCHAR(256),
  signature VARCHAR(512),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### **x402_settlements** — Settlement State

```sql
CREATE TABLE x402_settlements (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES x402_messages(id),
  asset VARCHAR(64) NOT NULL,           -- 'QCT.QCENT' | 'KNYT' | 'Qc'
  amount VARCHAR(256) NOT NULL,
  status VARCHAR(32) DEFAULT 'pending', -- 'pending' | 'escrow' | 'delivered' | 'claimed'
  delivery_mode VARCHAR(32),            -- 'custody' | 'claim' | 'canonical'
  escrow_contract_address VARCHAR(256),
  claim_id VARCHAR(256),
  dvn_attestation JSONB,                -- Off-chain attestation
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### **crm_registry_profiles** — Public Identity Profiles

```sql
CREATE TABLE crm_registry_profiles (
  id UUID PRIMARY KEY,
  kybe_did VARCHAR(256) NOT NULL,       -- Universal identifier
  platform_account_id UUID,
  auth_profile_id UUID,
  display_name VARCHAR(256),
  avatar_url TEXT,
  bio TEXT,
  reputation_bucket INT,
  reputation_score_cached INT,
  visibility_level VARCHAR(32),         -- 'private' | 'standard' | 'public'
  total_pok_all_tenants INT DEFAULT 0,
  total_contributions_all_tenants INT DEFAULT 0,
  total_rewards_earned JSONB DEFAULT '{}', -- { 'QCT': 100, 'KNYT': 50 }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Key Data Flow Patterns

### **Pattern 1: Payment + Content Delivery (x402)**

```
1. User discovers SmartContentQube (price: 100 QCT)
2. Frontend calls identity resolver: user's FIO handle → canonical DID
3. Construct x402 request:
   - x-402-intent: asset.send
   - x-402-sender: alice@qripto
   - x-402-recipient: metaknyts-store
   - x-402-asset: QCT.QCENT
   - x-402-amount: 100
   - Payload: { iqube_ref: content-id, settlement: {...} }
4. POST /api/x402/send
5. Verify signature, resolve both parties
6. Check shouldEscrow() → decide custody vs claim
7. If claim: create settlement in PENDING state
8. On delivery trigger: move to DELIVERED, grant entitlement
9. SmartWalletQube updated: entitlements array + balance adjusted
```

### **Pattern 2: Reputation Accumulation**

```
1. User completes quest → reward triggers
2. ReputationService.calculateReputationDelta()
3. Supabase UPDATE personas:
   - reputation_score += delta
   - reputation_bucket = bucket(new_score)
   - Possibly grant new badge
4. CRM platform account reputation aggregated:
   - crm_registry_profiles.reputation_score_cached
   - Updated via cron job or real-time trigger
5. Future content access checks minimum_reputation_bucket
```

### **Pattern 3: Identity Resolution in Payments**

```
x402 header: x-402-sender = "alice@qripto"
  ↓
resolveIdentity("alice@qripto")
  ↓
Check identity_aliases table:
  - alias_type = 'fio'
  - alias_value = 'alice@qripto'
  - entity_did = did:iq:persona:550e8400-...
  ↓
Return: { canonicalDid: "did:iq:persona:550e8400-...", ... }
  ↓
Store as x402_messages.resolved_sender_did
  ↓
All downstream logic uses canonical DID for bookkeeping
```

### **Pattern 4: Entitlement & Access Control**

```
GET /api/content/episode/episode-1
  ↓
Check user's persona identity state:
  - content.identityRequirements.minimumIdentifiability = 'semi'
  - user.default_identity_state = 'pseudo' → DENIED
  
  OR
  
  - user.default_identity_state = 'semi' → ALLOWED
  ↓
Query x402_settlements:
  - resolved_recipient_did = user's canonical DID
  - intent = 'iqube.transfer' | 'iqube.deliver'
  - status = 'delivered'
  - asset matches content.pricingModel
  ↓
If found + not expired → content served
If not found → redirect to pricing/purchase
```

---

## Summary: Three Pillars of Identity

| Pillar | Purpose | Example |
|--------|---------|---------|
| **KybeDID** | Estate-wide, immutable user reference | `did:iq:kybe:550e8400-...` |
| **Root DID** | Canonical persona identifier | `did:iq:persona:alice-uuid-...` |
| **PersonaQube** | Full identity record with keys, reputation | { fioHandle, evmKey, reputationScore, badges } |

Every x402 transaction resolves identities to canonical DIDs. Every access check validates identity state + entitlements. Every reward triggers reputation accumulation. The system is **identity-first**, **payment-aware**, and **permissioned-by-design**.
```


