# Data Architecture Assessment

## Executive Summary

After reviewing the codebase, I've identified **significant architectural inconsistencies** between the CRM system and the rest of the estate (Copilot, Registry, Identity). The CRM has created parallel data structures (`crm_*` tables) instead of using the canonical QubeBase tables, breaking the single-source-of-truth principle.

---

## Current Architecture Analysis

### 1. Data Source Mapping

| System | Data Source | Tables Used | Issue |
|--------|-------------|-------------|-------|
| **Copilot** | QubeBase (Supabase) | `franchises`, `tenants`, `persona`, `kybe_identity`, `root_identity` | ✅ Correct |
| **Registry** | QubeBase (Supabase) | `iqube_templates`, `persona` | ✅ Correct |
| **Identity** | QubeBase (Supabase) | `persona`, `kybe_identity`, `root_identity` | ✅ Correct |
| **CRM** | QubeBase (Supabase) | `crm_personas`, `crm_franchises`, `crm_tenants`, `crm_contributions`, etc. | ⚠️ **PARALLEL TABLES** |

### 2. The Problem

The CRM system created its own parallel data structures:

```
QubeBase Canonical Tables     CRM Parallel Tables
─────────────────────────     ───────────────────
franchises                    crm_franchises (DUPLICATE)
tenants                       crm_tenants (DUPLICATE)
persona                       crm_personas (DUPLICATE)
                              crm_contributions (NEW - OK)
                              crm_rewards (NEW - OK)
                              crm_segments (NEW - OK)
```

**Impact:**
- Franchises/tenants in Copilot don't match CRM
- Personas in identity system are disconnected from CRM personas
- No single source of truth for organizational hierarchy

### 3. What Was Partially Fixed

In the previous session, I updated `crmDataAccess.ts` to query the canonical `franchises` and `tenants` tables instead of `crm_franchises` and `crm_tenants`:

```typescript
// services/crm/crmDataAccess.ts - NOW QUERIES CANONICAL TABLES
export async function listFranchises() {
  // Query the main 'franchises' table (same as Copilot)
  const { data } = await client.from('franchises').select('*');
  // ... mapping to CrmFranchise format
}
```

### 4. What Still Needs Fixing

#### A. Personas Mismatch

**Current State:**
- Identity system uses `persona` table
- CRM uses `crm_personas` table
- These are NOT linked

**Required Fix:**
```
persona (canonical)
    ↓ linked via
crm_registry_persona_links
    ↓ to
crm_personas (CRM-specific data like PoKW, contributions)
```

The `crm_registry_persona_links` table exists but is not being used consistently.

#### B. Missing Blockchain Verification Layer

**Current State:**
- DVN canister exists for cross-chain message verification
- ReputationHub (RQH) canister exists for reputation
- **NO integration between CRM rewards and blockchain verification**

**Required:**
- Rewards should be verified on-chain before distribution
- PoKW calculations should be anchored to blockchain evidence

---

## Layered Architecture Review

### Expected Architecture (per CopilotKit integration design)

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  AgentiQ UI  │  Copilot  │  Registry  │  CRM Dashboard      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                             │
│  UniversalQubeService  │  CRM Service  │  Identity Service  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATA ACCESS LAYER                         │
│              QubeBase (Supabase) - SINGLE SOURCE             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    VERIFICATION LAYER                        │
│  DVN Canister  │  ReputationHub  │  LayerZero  │  BTC PoS   │
└─────────────────────────────────────────────────────────────┘
```

### Actual State

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  AgentiQ UI  │  Copilot  │  Registry  │  CRM Dashboard      │
└─────────────────────────────────────────────────────────────┘
        ↓              ↓           ↓              ↓
┌───────────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐
│ qubebase.ts   │ │ persona │ │ registry│ │ crmDataAccess   │
│ (franchises,  │ │ Service │ │ Service │ │ (crm_* tables)  │ ← PROBLEM
│  tenants)     │ │         │ │         │ │                 │
└───────────────┘ └─────────┘ └─────────┘ └─────────────────┘
        ↓              ↓           ↓              ↓
┌─────────────────────────────────────────────────────────────┐
│              QubeBase (Supabase) - FRAGMENTED               │
│  franchises │ tenants │ persona │ crm_personas │ crm_*     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    VERIFICATION LAYER                        │
│  DVN Canister (exists)  │  RQH (exists)  │  NOT INTEGRATED  │
└─────────────────────────────────────────────────────────────┘
```

---

## Reputation vs Reward System Analysis

### Current ReputationHub Canister (RQH)

Located at: `src/rqh/src/lib.rs`

**Capabilities:**
- `create_reputation_bucket` - Create reputation bucket for a partition
- `add_reputation_evidence` - Add evidence to reputation
- `get_reputation_bucket` - Query reputation by partition_id
- `get_reputation_evidence` - Get evidence for a bucket

**Data Model:**
```rust
struct ReputationBucket {
    id: String,
    partition_id: String,      // Links to persona/identity
    bucket: u32,               // 0-5 reputation tier
    skill_category: String,    // Domain of reputation
    score: f64,                // Numeric score
    evidence_count: u32,       // Number of evidence items
    last_updated: u64,
    created_at: u64,
}

struct ReputationEvidence {
    id: String,
    bucket_id: String,
    evidence_type: String,     // Type of evidence
    evidence_data: String,     // JSON data
    weight: f64,               // Evidence weight
    verified: bool,
    created_at: u64,
}
```

### Reward System Requirements

**Current CRM Reward Model:**
```typescript
interface CrmReward {
    id: string;
    tenantId: string;
    personaId: string;
    periodStart: string;
    periodEnd: string;
    pokwBasis: number;         // PoKW score basis
    amount: number;            // Token amount
    tokenType: TokenType;
    status: RewardStatus;      // proposed | approved | distributed | rejected
    approvedAt?: string;
    approvedBy?: string;
    distributedAt?: string;
    txHash?: string;
}
```

### Question: Separate RewardHub or Extend ReputationHub?

#### Option A: Extend ReputationHub to Handle Rewards

**Pros:**
- Single canister for all "earned value" tracking
- Reputation evidence can directly trigger rewards
- Simpler architecture
- Evidence-based rewards are naturally linked

**Cons:**
- Mixing concerns (reputation ≠ rewards)
- ReputationHub would need significant expansion
- Different approval workflows

#### Option B: Separate RewardHub Canister

**Pros:**
- Clear separation of concerns
- Different governance models possible
- Rewards can have different verification requirements
- Easier to audit reward distributions separately

**Cons:**
- More canisters to maintain
- Need cross-canister calls for reputation-based rewards
- Additional complexity

### **Recommendation: Hybrid Approach**

```
┌─────────────────────────────────────────────────────────────┐
│                    ReputationHub (RQH)                       │
│  - Reputation buckets                                        │
│  - Evidence collection                                       │
│  - Score calculation                                         │
│  - Emits "ReputationUpdated" events                         │
└─────────────────────────────────────────────────────────────┘
                              ↓ events
┌─────────────────────────────────────────────────────────────┐
│                    RewardHub (NEW)                           │
│  - Reward proposals (based on PoKW/reputation)              │
│  - Multi-sig approval workflow                              │
│  - Distribution tracking                                     │
│  - On-chain verification of distributions                   │
│  - Links to DVN for cross-chain reward distribution         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    DVN (Cross-Chain)                         │
│  - Verify reward distributions on target chains             │
│  - LayerZero message verification                           │
│  - BTC PoS anchoring for audit trail                        │
└─────────────────────────────────────────────────────────────┘
```

**Why Separate:**
1. **Identity Safeguards**: Rewards require Root DID verification (per DiDQube policy), reputation uses partition_id
2. **Approval Workflow**: Rewards need multi-sig approval, reputation is evidence-based
3. **Audit Requirements**: Reward distributions need stricter audit trails
4. **Token Economics**: Rewards involve actual token transfers, reputation is scoring

---

## Recommended Fixes

### Phase 1: Data Consistency (Immediate)

1. **Link CRM Personas to Identity Personas**
   ```sql
   -- Ensure all crm_personas have corresponding registry links
   INSERT INTO crm_registry_persona_links (registry_profile_id, persona_id, tenant_id)
   SELECT rp.id, cp.id, cp.tenant_id
   FROM crm_personas cp
   JOIN crm_registry_profiles rp ON rp.kybe_did = cp.kybe_did
   WHERE NOT EXISTS (
     SELECT 1 FROM crm_registry_persona_links l 
     WHERE l.persona_id = cp.id
   );
   ```

2. **Sync Franchise/Tenant Data**
   - Already partially done (listFranchises/listTenants now query canonical tables)
   - Need to ensure CRM UI uses these functions consistently

### Phase 2: Blockchain Integration (Short-term)

1. **Connect Rewards to ReputationHub**
   ```typescript
   // When proposing rewards, fetch reputation from RQH
   async function proposeReward(personaId: string) {
     const reputation = await rqhCanister.get_reputation_bucket(personaId);
     const pokwScore = calculatePokwFromReputation(reputation);
     // Create reward proposal with on-chain reputation basis
   }
   ```

2. **Add DVN Verification for Reward Distributions**
   ```typescript
   // When distributing rewards, track via DVN
   async function distributeReward(rewardId: string, txHash: string) {
     await dvnCanister.monitor_evm_transaction(chainId, txHash, rpcUrl);
     // Update reward status with DVN message ID
   }
   ```

### Phase 3: RewardHub Canister (Medium-term)

Create new canister at `src/reward_hub/`:

```rust
// Reward proposal with Root DID verification
struct RewardProposal {
    id: String,
    proposer_root_did: String,    // Must be Root DID per DiDQube
    recipient_root_did: String,
    amount: u64,
    token_type: String,
    pokw_basis: f64,
    reputation_bucket_id: Option<String>,
    status: RewardStatus,
    approvals: Vec<Approval>,
    created_at: u64,
}

struct Approval {
    approver_root_did: String,
    approved_at: u64,
    signature: Vec<u8>,
}
```

---

## Summary

| Issue | Severity | Status | Fix |
|-------|----------|--------|-----|
| CRM uses parallel tables | High | Partially Fixed | Complete persona linking |
| No blockchain verification for rewards | High | Not Started | Integrate DVN + create RewardHub |
| Reputation not linked to CRM | Medium | Not Started | Link RQH to CRM rewards |
| Identity safeguards for rewards | Medium | Partially Done | Enforce Root DID for approvals |

The system needs a RewardHub canister separate from ReputationHub because:
1. Different identity requirements (Root DID vs partition_id)
2. Different approval workflows (multi-sig vs evidence-based)
3. Different audit requirements (token transfers vs scoring)
4. Clear separation of concerns for governance
