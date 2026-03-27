# Knowledge — Snippets & Patterns

Reusable code patterns and implementation snippets from the AgentiQ codebase.

---

## 1. ICP Actor Creation

Source: `services/ops/icAgent.ts`

The canonical way to create an ICP actor from a canister ID + IDL factory:

```typescript
import { getActor } from '@/services/ops/icAgent';
import { idlFactory } from '@/services/ops/idl/reward_hub';

const actor = await getActor(
  process.env.REWARD_HUB_CANISTER_ID!,
  idlFactory
);
const result = await actor.someMethod(args);
```

**Environment resolution**:
- `DFX_NETWORK=local` → `http://127.0.0.1:4943` (local replica)
- `DFX_NETWORK=ic` or unset → `https://ic0.app` (mainnet)
- Falls back to `https://icp-api.io` if local replica is unreachable

**Identity**:
- Reads PEM from `DFX_IDENTITY_PEM` env var or file at `DFX_IDENTITY_PEM_PATH`
- Supports Ed25519 and Secp256k1 keys
- Falls back to anonymous identity if no PEM is available

**Anonymous actor** (for ACL testing):
```typescript
import { getAnonymousActor } from '@/services/ops/icAgent';
const anonActor = await getAnonymousActor(canisterId, idlFactory);
```

---

## 2. x402 Header Construction

Source: `services/x402/schemas.ts`, API route handlers

### 2.1 Grant Intent Headers

```typescript
const headers = {
  'x-402-intent': 'iqube.grant',
  'x-402-sender': senderDid,
  'x-402-recipient': recipientDid,
  'x-402-dvn-attest': dvnAttestationSig, // optional for cross-chain
};

const body = {
  capability: {
    iqube_ref: 'iqube:base:0xabc...',
    scope: ['read', 'decrypt'],
    ttl: '24h',
    nonce: crypto.randomUUID(),
  },
};
```

### 2.2 Deliver Intent — Canonical Mode

```typescript
const headers = {
  'x-402-intent': 'iqube.deliver',
  'x-402-sender': senderDid,
  'x-402-recipient': recipientDid,
  'x-402-delivery-mode': 'canonical',
  'x-402-asset': 'iqube:base:0xabc...',
};

const body = {
  meta: { cid: 'bafyreib...', hash: '0xd3ad...' },
  blak: { uri: 'ipfs://bafyreib...', hash: '0xbeef...' },
  license: 'CC-BY-4.0',
};
```

### 2.3 Claim Intent Headers

```typescript
const headers = {
  'x-402-intent': 'asset.claim',
  'x-402-sender': senderDid,
  'x-402-recipient': recipientAddress,
  'x-402-delivery-mode': 'claim',
};

const body = {
  claim_id: 'claim-uuid-v4',
  rights: { asset: 'QCT', amount: '1000000000000000000' }, // 1 QCT in wei
  redeem_to: { chain: 'base', recipient: '0xabc...' },
  expiry: new Date(Date.now() + 86400000).toISOString(), // 24h
};
```

### 2.4 Schema Validation Pattern

```typescript
import { validateByIntent } from '@/services/x402/schemas';

const validation = validateByIntent(intent, payload, headers);
if (!validation.success) {
  return NextResponse.json(
    { ok: false, error: validation.error.issues },
    { status: 400 }
  );
}
```

---

## 3. DVN Status Check

Source: `services/ops/dvnService.ts`

```typescript
// API route: /api/ops/dvn/status
// Returns DVN attestation count and quorum status

const response = await fetch('/api/ops/dvn/status');
const data = await response.json();
// { ok: boolean, attestations: number, quorum: 2, lastUpdate: string }
```

DVN quorum is 2 attestations. Cross-chain operations require a valid DVN attestation before execution.

---

## 4. Bitcoin Testnet Block Height

Source: `services/ops/btcService.ts`

```typescript
// Tries Blockstream first, falls back to mempool.space
// API route: /api/ops/btc/height

const res = await fetch('/api/ops/btc/height');
const { height, source } = await res.json();
// { height: 2873421, source: 'blockstream' | 'mempool' }
```

**Direct calls**:
```typescript
// Blockstream
const r = await fetch('https://blockstream.info/testnet/api/blocks/tip/height');
const height = await r.text(); // plain text number

// mempool.space fallback
const r = await fetch('https://mempool.space/testnet/api/blocks/tip/height');
const height = await r.text();
```

---

## 5. RewardHub Canister Integration

Source: `services/ops/idl/reward_hub.ts`, `services/crm/taskCanisterService.ts`

```typescript
import { getActor } from '@/services/ops/icAgent';
import { idlFactory } from '@/services/ops/idl/reward_hub';

const REWARD_HUB_CANISTER = 'lvo2w-jqaaa-aaaas-qc2wa-cai';

const hub = await getActor(REWARD_HUB_CANISTER, idlFactory);

// Submit a reward proposal
const proposal: RewardProposal = {
  task_id: 'task-uuid',
  recipient: Principal.fromText(recipientPrincipal),
  amount: BigInt(100),
  metadata: [],
};
const result = await hub.propose_reward(proposal);

// Get approvals for a proposal
const approvals = await hub.get_approvals(proposalId);
```

**Flow**: Task completed → `propose_reward()` on RewardHub → Multi-sig approval → `distribute()` → RQH canister updates reputation bucket.

---

## 6. Codex Write-Doc Pattern (Aigent Z)

Source: `app/api/codex/chat/aigentiq/write-doc/route.ts`

Aigent Z can write `.md` files to the codex by embedding a `write_doc` block in its response:

````markdown
```write_doc
path: architecture/new-feature.md
---
# New Feature

Content here...
```
````

The chat route (`/api/codex/chat/aigentiq`) detects this pattern, strips it from the display response, and calls `/api/codex/chat/aigentiq/write-doc` to commit the file to GitHub.

**Security constraints**:
- Path must be under `items/`, `architecture/`, `knowledge/`, `repos/`, or `build_/`
- Must end in `.md`
- Max 64KB content
- No path traversal (`..`)
- Requires `GITHUB_TOKEN` env var

**Programmatic call**:
```typescript
const res = await fetch('/api/codex/chat/aigentiq/write-doc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    path: 'architecture/dvn.md',
    content: '# DVN Architecture\n...',
    overwrite: false, // pass true to update existing
  }),
});
const { ok, path, github_url, action } = await res.json();
```

---

## 7. Next.js API Route Pattern (AgentiQ Stack)

Standard pattern for server-side API routes in this codebase:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { field } = body;

    if (!field || typeof field !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'field is required' },
        { status: 400 }
      );
    }

    // ... logic ...

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('[route-name] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
```

---

## 8. Supabase Row-Level Security Pattern

All iQube data operations use Supabase RLS. The server-side service role bypasses RLS for admin ops; client-side calls use anon/user JWT.

```typescript
// Server-side (API route) — uses service role, bypasses RLS
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // never expose to client
);

// Client-side — uses anon key + user JWT
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**Key rule**: `SUPABASE_SERVICE_ROLE_KEY` must never be `NEXT_PUBLIC_` prefixed.
