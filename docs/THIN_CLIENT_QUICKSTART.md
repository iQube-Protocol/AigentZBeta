# Thin Client Quickstart (External Agents)

This is a **minimal** guide for external agents / thin clients that need to:

- Authenticate against Aigent Z (AA-API)
- Call core AA-API routes (e.g. payments)
- Use DiDQube reputation via Aigent Z HTTP routes

For full context and architecture details, see `docs/THIN_CLIENT_INTEGRATION.md`.

---

## 1. Environment Variables (in Your Agent Project)

Add these to your agent / thin client project (not AigentZBeta itself):

```bash
# AA-API base (includes /aa/v1)
# Primary (custom domain - may take up to 72h to propagate):
AIGENT_Z_AA_BASE=https://aa.dev-beta.aigentz.me/aa/v1

# Fallback (Railway direct - always available):
# AIGENT_Z_AA_BASE=https://aigentzbeta-production.up.railway.app/aa/v1

# Aigent Z app base (for /api/identity/* routes)
AIGENT_Z_APP_BASE=https://dev-beta.aigentz.me
```

Optionally, you can also set:

```bash
# Use custom domain or fallback to Railway
AIGENT_Z_API_BASE=https://aa.dev-beta.aigentz.me
# or: https://aigentzbeta-production.up.railway.app
```

The example client will fall back to `AIGENT_Z_API_BASE` if the more specific vars are missing.

> **Note**: AA-API is deployed on Railway. Use `https://aa.dev-beta.aigentz.me` once DNS propagates, or `https://aigentzbeta-production.up.railway.app` as an immediate fallback.

---

## 2. Copy the Example Client

Copy this file from AigentZBeta into your agent project:

- `docs/examples/aigentz-client.ts`

Then import it in your agent code:

```ts
import { AigentZClient } from './aigentz-client';
```

> You can also copy only the pieces you need; the file is designed as a reference.

---

## 3. Authenticate and Get `aa_token`

In your agent project:

```ts
import { AigentZClient } from './aigentz-client';

const client = new AigentZClient({
  did: 'did:example:aigent-z',
  signNonce: async (nonce) => {
    // TODO: sign the nonce with your agent key.
    // TEMP (Phase 1 dev): signature is not strictly checked yet,
    // so you can return any non-empty string while wiring things up.
    return nonce;
  },
});

// Get a valid aa_token (cached after first call)
const aaToken = await client.getToken();
console.log('aa_token:', aaToken);
```

This runs the AA-API flow:

1. `POST /aa/v1/auth/challenge` → get `nonce`
2. Your agent signs `nonce`
3. `POST /aa/v1/auth/verify` → get `aa_token`

All subsequent AA-API calls from `AigentZClient` automatically attach:

```http
Authorization: Bearer <aa_token>
```

---

## 4. Call AA-API: Example Payment (Q¢ Transfer)

```ts
// Q¢ transfer from one agent to another
await client.transferQct({
  fromAgentId: 'aigent-z',
  toAgentId: 'aigent-moneypenny',
  amountQct: 100,
});
```

Under the hood this calls:

- `POST /aa/v1/payments/transfer`
- With Bearer `aa_token` in the Authorization header

You can also call any other AA-API path via the generic `fetch` helper:

```ts
const res = await client.fetch('assets', {
  method: 'GET',
});

const json = await res.json();
console.log(json);
```

---

## 5. DiDQube Reputation from Thin Clients

`docs/examples/aigentz-client.ts` also exports two helpers for DiDQube reputation via the Aigent Z app’s HTTP routes.

### 5.1 Read Reputation Bucket

```ts
import { getReputationBucket } from './aigentz-client';

const rep = await getReputationBucket('agent:aigent-z');

if (rep.ok && rep.data) {
  console.log('Bucket:', rep.data.bucket);
  console.log('Score:', rep.data.score);
  console.log('Skill:', rep.data.skill_category);
} else {
  console.log('No reputation yet or error:', rep.error);
}
```

This calls:

- `GET /api/identity/reputation/bucket?partitionId=agent:aigent-z`

### 5.2 Create Initial Reputation Bucket

```ts
import { createReputationBucket } from './aigentz-client';

const created = await createReputationBucket({
  partitionId: 'agent:aigent-z',
  skillCategory: 'cross_chain_ops',
  initialScore: 75,
});

if (created.ok && created.data) {
  console.log('Created bucket:', created.data.bucket, 'score:', created.data.score);
} else {
  console.log('Error creating bucket:', created.error);
}
```

This calls:

- `POST /api/identity/reputation/bucket`

Payload:

```json
{
  "partitionId": "agent:aigent-z",
  "skillCategory": "cross_chain_ops",
  "initialScore": 75
}
```

---

## 6. Summary Checklist

- [ ] Set `AIGENT_Z_AA_BASE` and `AIGENT_Z_APP_BASE` in your agent project env
- [ ] Copy `docs/examples/aigentz-client.ts` into your project
- [ ] Implement a real `signNonce` function for your agent DID
- [ ] Use `AigentZClient` for AA-API (payments, etc.)
- [ ] Use `getReputationBucket` / `createReputationBucket` for DiDQube reputation

For anything deeper (QubeBase SDK, personas, entitlements, identity policies), please refer to:

- `docs/THIN_CLIENT_INTEGRATION.md`
