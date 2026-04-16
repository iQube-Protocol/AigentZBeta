# API Integration: iQube Minting & DVN Pipeline

**Version**: Alpha  
**Last updated**: 2026-04-16  
**Audience**: External dev teams integrating iQube minting via the aa-api

---

## Overview

This guide covers how to consume the AgentiQ `aa-api` from an external repository to:

- **Path A — Registry → Mint**: Submit an asset through the Registry Ingestion Factory pipeline, then mint it to a blockchain via the `mint-tokenqube` endpoint.
- **Path B — DVN Pipeline**: Ensure minted assets emit provisional receipts that are anchored on-chain and finalized through the DVN (Distributed Verification Network).

Both paths share the same authentication mechanism. The minting endpoint is a Next.js API route (`POST /api/core/mint-tokenqube`) that proxies to ICP canisters (Proof-of-State + cross-chain DVN service).

---

## Prerequisites

### Environment Variables (in your external repo)

```env
# aa-api base URL
AA_API_URL=https://your-agentiq-deploy.amplifyapp.com

# JWT secret (must match aa-api server's AA_JWT_SECRET)
AA_JWT_SECRET=<shared-secret>

# Supabase (for direct table access if needed)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# ICP Canister IDs (needed for receipt + DVN anchoring)
PROOF_OF_STATE_CANISTER_ID=<canister-id>
CROSS_CHAIN_SERVICE_CANISTER_ID=<canister-id>
```

### Supabase Migration

The following tables must exist before you call any registry or DVN endpoints. Run this in Supabase SQL editor if they don't exist:

```sql
-- registry_intakes, registry_assets, registry_receipts,
-- qc_events, knyt_reward_grants
-- See: supabase/migrations/20260402000000_experience_model_journey_state.sql
```

---

## Authentication

The aa-api uses a **DID challenge-response** flow that issues a 12-hour JWT.

### Step 1 — Request a nonce

```typescript
const challengeRes = await fetch(`${AA_API_URL}/auth/challenge`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ did: 'did:key:<your-public-key>' }),
});
const { nonce } = await challengeRes.json();
```

### Step 2 — Sign and verify

```typescript
// Sign the nonce with your DID private key.
// In alpha, any non-empty signature is accepted to unblock development.
const signature = await signWithDid(nonce);

const verifyRes = await fetch(`${AA_API_URL}/auth/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ did: 'did:key:<your-public-key>', signature }),
});
const { aa_token } = await verifyRes.json();
// aa_token is valid for 12 hours
```

All subsequent API calls must include:
```
Authorization: Bearer <aa_token>
```

---

## Path A — Registry → Mint

### Stage 1: Submit Intake

```typescript
const intakeRes = await fetch(`${AA_API_URL}/api/registry/intake`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aa_token}`,
  },
  body: JSON.stringify({
    tenantId: 'your-tenant-id',
    submittedBy: 'did:key:<your-did>',
    sourceType: 'upload',           // 'upload' | 'github' | 'npm' | 'url'
    sourceUri: 'https://...',       // URL to your asset source
    sourcePayload: {
      name: 'My SkillQube',
      description: 'What this skill does',
      assetClass: 'SkillQube',      // AigentQube | SkillQube | DataQube | ModelQube
      tags: ['knyt', 'alpha'],
    },
  }),
});
const { data: intake } = await intakeRes.json();
// intake.intakeId — save this for polling
// intake.status === 'pending'
```

### Stage 2: Poll Pipeline Status

The ingestion pipeline runs 8 stages asynchronously:
`intake → fetch → classify → package → validate → trust_score → review → publish`

```typescript
async function pollIntake(intakeId: string, token: string): Promise<string> {
  while (true) {
    const res = await fetch(
      `${AA_API_URL}/api/registry/intake/${intakeId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { data } = await res.json();
    
    if (data.status === 'published') return data.assetId;
    if (data.status === 'rejected') throw new Error(`Intake rejected: ${data.rejectionReason}`);
    
    await new Promise(r => setTimeout(r, 3000)); // poll every 3s
  }
}

const assetId = await pollIntake(intake.intakeId, aa_token);
```

**Trust scoring**: Assets receive a trust band automatically:
- L1_EXPERIMENTAL (0–29): failed validation, secrets found, no license
- L2_COMMUNITY (30–49): basic metadata present
- L3_VERIFIED (50–69): signed, test coverage present
- L4_AUDITED (70–89): independent review completed
- L5_CORE_SOVEREIGN (90–100): full audit + governance sign-off

Assets must be at L3+ before they can be minted.

### Stage 3: Mint to Chain

Once published (or for an existing `assetId`):

```typescript
const mintRes = await fetch(`${AA_API_URL}/api/core/mint-tokenqube`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aa_token}`,
  },
  body: JSON.stringify({
    metaIdentifier: assetId,   // the registry assetId
    tokenId: undefined,         // optional; auto-generated if omitted
    network: 'Ethereum',        // 'Ethereum' | 'Polygon' | 'Optimism' | 'Arbitrum' | 'Base' | 'Bitcoin' | 'Solana'
  }),
});

const mint = await mintRes.json();
// mint.txHash       — blockchain transaction hash
// mint.explorerUrl  — block explorer link
// mint.contractAddress
// mint.owner
// mint.receiptId    — ICP Proof-of-State receipt (if POS canister configured)
// mint.dvnMessageId — DVN cross-chain tracking ID (if DVN canister configured)
```

**Supported chains:**
| Network | Chain ID | Explorer |
|---------|----------|---------|
| Ethereum | 1 | etherscan.io |
| Polygon | 137 | polygonscan.com |
| Optimism | 10 | optimistic.etherscan.io |
| Arbitrum | 42161 | arbiscan.io |
| Base | 8453 | basescan.org |
| Bitcoin | 0 (custom) | blockstream.info |
| Solana | 101 | explorer.solana.com |

---

## Path B — DVN Pipeline Integration

Every mint automatically attempts to:
1. Issue a **Proof-of-State receipt** on the ICP canister (`pos.issue_receipt(dataHash)`)
2. Submit a **DVN cross-chain tracking message** (`dvn.submit_dvn_message(...)`)

If either canister is unavailable, minting continues — the blockchain tx still lands.

### Monitoring Receipt Status via Supabase

Receipts are persisted in `registry_receipts`. All receipts start provisional and finalize once the DVN anchors:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Check if a receipt is finalized
const { data: receipt } = await supabase
  .from('registry_receipts')
  .select('receipt_id, provisional, finalized_at, content_hash')
  .eq('receipt_id', mint.receiptId)
  .single();

if (receipt?.provisional === false) {
  console.log('Receipt finalized at', receipt.finalized_at);
} else {
  console.log('Receipt still provisional — DVN anchoring pending');
}
```

### Emitting Custom DVN Receipts

For custom pipeline events (e.g. skill invocations, delegation completions), use the `QubeTalkDvnReceiptPipeline` contract:

```typescript
import type { QubeTalkDvnReceiptInput } from './qubetalkReceiptPipeline';

const result = await submitQubeTalkReceiptToDvn({
  receiptId: 'your-receipt-id',
  delegationId: 'delegation-uuid',
  tenantId: 'your-tenant-id',
  status: 'completed',
  taskCompleted: 'skill_invocation:knyt-onboard',
  fromAgentId: 'aigent-z',
  toAgentId: 'aigent-c',
  policyEvaluation: { approved: true, band: 'L3_VERIFIED' },
  resultData: { /* your payload */ },
});

// result.ok — true if DVN message submitted
// result.messageId — DVN message ID for tracking
```

The DVN service encodes payloads as UTF-8 byte arrays and submits via `dvn.submit_dvn_message(chainId, targetChainId, payloadBytes, messageId)`.

### Qc Event Logging

All economic events (skill invocations, reward grants, receipts) should be logged to `qc_events`:

```typescript
await supabase.from('qc_events').insert({
  event_id: `evt_${Date.now()}`,
  cartridge_id: 'your-cartridge',
  persona_id: userPersonaId,
  action_type: 'skill_invocation',   // skill_invocation | reward_grant | receipt_anchor
  direction: 'credit',               // credit | debit | meter
  amount_qc: 0,                      // all amounts 0 in alpha; set to actual value at launch
  provisional: true,
  skill_id: 'your-skill-id',
  created_at: new Date().toISOString(),
});
```

---

## Full End-to-End Example (TypeScript)

```typescript
const AA_API_URL = process.env.AA_API_URL!;

async function getToken(): Promise<string> {
  const did = 'did:key:my-external-service';
  const { nonce } = await fetch(`${AA_API_URL}/auth/challenge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ did }),
  }).then(r => r.json());

  // In production: sign nonce with your DID private key
  const signature = 'dev-signature-placeholder';
  
  const { aa_token } = await fetch(`${AA_API_URL}/auth/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ did, signature }),
  }).then(r => r.json());

  return aa_token;
}

async function submitAndMint(assetPayload: object, network: string = 'Ethereum') {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 1. Submit intake
  const { data: intake } = await fetch(`${AA_API_URL}/api/registry/intake`, {
    method: 'POST', headers,
    body: JSON.stringify({
      tenantId: 'my-tenant',
      submittedBy: 'did:key:my-external-service',
      sourceType: 'upload',
      sourcePayload: assetPayload,
    }),
  }).then(r => r.json());

  console.log('Intake submitted:', intake.intakeId);

  // 2. Poll to published
  let assetId: string | null = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const { data } = await fetch(
      `${AA_API_URL}/api/registry/intake/${intake.intakeId}`,
      { headers }
    ).then(r => r.json());
    if (data.status === 'published') { assetId = data.assetId; break; }
    if (data.status === 'rejected') throw new Error(data.rejectionReason);
  }

  if (!assetId) throw new Error('Pipeline timed out');
  console.log('Asset published:', assetId);

  // 3. Mint to chain
  const mint = await fetch(`${AA_API_URL}/api/core/mint-tokenqube`, {
    method: 'POST', headers,
    body: JSON.stringify({ metaIdentifier: assetId, network }),
  }).then(r => r.json());

  console.log('Minted:', mint.txHash, mint.explorerUrl);
  console.log('Receipt:', mint.receiptId, '| DVN:', mint.dvnMessageId);
  
  return mint;
}
```

---

## Known Gaps / Alpha TODOs

| Item | Status |
|------|--------|
| DID signature verification | Placeholder — any non-empty signature accepted in dev |
| DVN anchoring → `provisional=false` finalization | Pipeline present; cron job to sweep and finalize in progress |
| Qc `amount_qc` non-zero values | All set to 0 in alpha; will reflect actual token amounts at KNYT launch |
| L3+ trust gating on mint endpoint | Currently unenforced — will be added before mainnet |
| Multi-tenant receipt namespace isolation | RLS on `registry_receipts` enforced by service role; review before exposing to untrusted tenants |

---

## Key Types to Copy

```typescript
// From @/types/registryIngestion
type AssetClass = 'AigentQube' | 'SkillQube' | 'DataQube' | 'ModelQube';
type TrustBand = 'L1_EXPERIMENTAL' | 'L2_COMMUNITY' | 'L3_VERIFIED' | 'L4_AUDITED' | 'L5_CORE_SOVEREIGN';
type IntakeStatus = 'pending' | 'fetching' | 'classifying' | 'packaging' | 'validating' | 'trust_scoring' | 'review' | 'published' | 'rejected';
type ReceiptEventType = 'intake_submitted' | 'asset_published' | 'mint_completed' | 'dvn_anchored' | 'skill_invoked';

interface RegistryAsset {
  assetId: string;
  assetClass: AssetClass;
  name: string;
  trustBand: TrustBand;
  trustScore: number;
  publicationStatus: 'draft' | 'published' | 'archived';
  provisional: boolean;
  tenantId: string;
  createdAt: string;
}
```

---

## Support

- Registry pipeline source: `services/registry/`
- Mint endpoint: `app/api/core/mint-tokenqube/route.ts`
- DVN receipt pipeline: `services/dvn/qubetalkReceiptPipeline.ts`
- Receipt emitter: `services/registry/receiptEmitter.ts`
- Supabase schema: `supabase/migrations/`
