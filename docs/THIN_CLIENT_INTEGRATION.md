# Thin Client Integration Guide: Aigent Z, AA-API, QubeBase & DiDQube

## 1. Purpose

This document explains how external agents ("thin clients") should integrate with the Aigent Z stack:

- Aigent Z / AA-API HTTP endpoints
- QubeBase (Supabase) via SDK
- DiDQube identity & reputation flows

The goal is to give a **single, reliable reference** for configuring environments, authenticating, and calling the correct endpoints without reverse‑engineering the main app.

---

## 2. High-Level Architecture

### 2.1 Components

- **Aigent Z Frontend**
  - Next.js app (this repo) deployed at `https://<env>.aigentz.me`
  - Hosts the operator console, registry UI, etc.

- **AA-API (Aigent Z Application API)**
  - Express service in `services/aa-api/`
  - Exposes HTTP API under `/aa/v1/*`:
    - `/aa/v1/auth/*` – authentication for agents (DID → `aa_token`)
    - `/aa/v1/assets/*` – asset registration and queries
    - `/aa/v1/payments/*` – Q¢ / A2A payments and funding flows
    - `/aa/v1/entitlements/*` – access control checks
    - `/aa/v1/updates/*` – SSE / updates
    - `/aa/v1/supabase/*` – controlled Supabase passthroughs

- **QubeBase**
  - Supabase project (separate repo) + SDKs (`@qriptoagentiq/*`)
  - Stores registry, DiDQube identity, reputation, ops config, etc.

- **DiDQube**
  - Identity & persona tables in QubeBase
  - ReputationQube (RQH) canister on IC mainnet
  - Exposed via Aigent Z HTTP routes under `/api/identity/*`

- **Thin Client**
  - Your agent/service/app that sits outside of Aigent Z
  - Talks to AA-API with an `aa_token`
  - Optionally talks directly to QubeBase via SDK on the server side

---

## 3. Environment Configuration for Thin Clients

### 3.1 Recommended Variables

Minimum environment for a thin client that talks to Aigent Z:

```bash
# AA-API Base URL (choose one based on availability)
# Primary (custom domain - may take up to 72h to propagate):
AIGENT_Z_API_BASE=https://aa.dev-beta.aigentz.me

# Fallback (Railway direct - always available):
# AIGENT_Z_API_BASE=https://aigentzbeta-production.up.railway.app

# Optional convenience: AA-API base including /aa/v1
AIGENT_Z_AA_BASE=https://aa.dev-beta.aigentz.me/aa/v1
# or fallback: https://aigentzbeta-production.up.railway.app/aa/v1

# QubeBase / Supabase (server-side only; never expose service key to browsers)
QUBEBASE_URL=https://<your-supabase-project>.supabase.co
QUBEBASE_SERVICE_ROLE_KEY=...  # server-side only
QUBEBASE_ANON_KEY=...          # optional; browser-safe anon key

# ReputationQube (DiDQube Phase 2) – for reference only, usually proxied via Aigent Z
RQH_CANISTER_ID=zdjf3-2qaaa-aaaas-qck4q-cai
```

> **Note**: The AA-API is deployed on Railway at `https://aigentzbeta-production.up.railway.app` with a custom domain `https://aa.dev-beta.aigentz.me`. Use the custom domain once DNS propagates, or use the Railway URL as an immediate fallback.

### 3.2 Base URL Patterns

**Pattern A (recommended for SDKs)**

- `AIGENT_Z_AA_BASE` already includes `/aa/v1`
- Thin clients construct URLs like:

```ts
const base = new URL(process.env.AIGENT_Z_AA_BASE!); // https://.../aa/v1

function aaUrl(path: string) {
  // path: 'auth/challenge', 'payments/transfer', etc.
  return new URL(path, base).toString();
}

// Examples:
// aaUrl('auth/challenge')  -> https://.../aa/v1/auth/challenge
// aaUrl('auth/verify')     -> https://.../aa/v1/auth/verify
// aaUrl('payments/transfer')-> https://.../aa/v1/payments/transfer
```

**Pattern B (absolute paths)**

- `AIGENT_Z_API_BASE` is just the host, e.g. `https://dev-beta.aigentz.me`
- Thin clients always use absolute paths:

```ts
const host = process.env.AIGENT_Z_API_BASE!;

new URL('/aa/v1/auth/challenge', host);
new URL('/aa/v1/payments/transfer', host);
```

> **Important**: avoid mixing a base that already contains `/aa/v1` with absolute paths that also start with `/`. For example, `new URL('/auth/challenge', 'https://.../aa/v1')` will drop `/aa/v1`.

---

## 4. Authentication Flow (AA-API)

### 4.1 Endpoints

Defined in `services/aa-api/src/routes/auth.ts` and mounted in `src/index.ts`:

- `POST /aa/v1/auth/challenge`
- `POST /aa/v1/auth/verify`

### 4.2 Challenge Request

**Request**:

```http
POST /aa/v1/auth/challenge
Content-Type: application/json

{
  "did": "did:example:aigent-z"  // your agent DID
}
```

**Response**:

```json
{ "nonce": "<random-hex>" }
```

The thin client must:

- Receive `nonce`
- Sign it with the agent's key according to its DID method

### 4.3 Verify Request

**Request**:

```http
POST /aa/v1/auth/verify
Content-Type: application/json

{
  "did": "did:example:aigent-z",
  "signature": "<signature-over-nonce>"
}
```

**Current Phase 1 behavior** (see `auth.ts`):

- Signature verification is stubbed; any non-empty `signature` is accepted
- This will tighten in later phases once DID methods are wired in

**Response**:

```json
{
  "aa_token": "<JWT>",
  "tenant_id": "00000000-0000-0000-0000-000000000000"
}
```

The `aa_token` is a JWT signed with `AA_JWT_SECRET` and represents your agent + tenant context.

### 4.4 Using `aa_token`

All AA-API routes protected by `requireAuth` expect:

```http
Authorization: Bearer <aa_token>
```

The middleware (`mw-auth.ts`) will:

- Verify the token with `AA_JWT_SECRET`
- Attach payload as `req.auth` for downstream handlers

---

## 5. Calling AA-API from Thin Clients

Once you have `aa_token`, you can call any AA-API route under `/aa/v1/*` that is meant to be public to agents.

### 5.1 Assets (`/aa/v1/assets/*`)

Typical usage (pseudocode):

```ts
const res = await fetch(aaUrl('assets'), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${aaToken}`,
  },
  body: JSON.stringify({
    // asset metadata here
  }),
});
```

The exact payloads and contracts for assets evolve with the registry; refer to `services/aa-api/src/routes/assets.ts` for the latest.

### 5.2 Payments (`/aa/v1/payments/*`)

The AA-API payments routes mediate Q¢ flows and use QubeBase for agent keys and balances.

Thin clients should **always** go through AA-API for payments; do not write directly to payment tables in QubeBase.

Example shape:

```ts
await fetch(aaUrl('payments/transfer'), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${aaToken}`,
  },
  body: JSON.stringify({
    fromAgentId: 'aigent-z',
    toAgentId: 'aigent-moneypenny',
    amountQct: 100,
  }),
});
```

### 5.3 Entitlements (`/aa/v1/entitlements/*`)

These routes check whether an agent/DID is allowed to access a specific iQube or action.

Typical pattern:

1. Client describes the asset and desired action.
2. AA-API evaluates registry + DiDQube policies.
3. Response is allow/deny + reason.

Thin clients should **not** implement policy logic themselves; they should ask AA-API.

### 5.4 Updates / SSE (`/aa/v1/updates/*`)

For streaming updates about operations, AA-API exposes an SSE endpoint. Thin clients can subscribe using EventSource or equivalent.

---

## 6. QubeBase SDK Usage

For services that can safely keep secrets (server-side agents), QubeBase can be accessed directly.

### 6.1 Installation

```bash
npm install @supabase/supabase-js @qriptoagentiq/core-client
```

### 6.2 Initialization

```ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.QUBEBASE_URL!;
const serviceKey = process.env.QUBEBASE_SERVICE_ROLE_KEY!;

export const qbase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
```

> **Security**: `SERVICE_ROLE_KEY` must only ever be used in trusted server-side environments.

### 6.3 DiDQube Identity Example

`persona` table (simplified example):

```ts
const { data, error } = await qbase
  .from('persona')
  .select('*')
  .eq('did', 'did:example:aigent-z');
```

Use this pattern when your agent needs read/write access to identity data and is allowed to act as a trusted service.

---

## 7. DiDQube from Thin Clients (Identity + Reputation)

### 7.1 Persona via Aigent Z HTTP

Aigent Z exposes identity routes under `/api/identity/*` (Next.js app routes), e.g.:

- `GET /api/identity/persona` – list personas
- `POST /api/identity/persona` – create persona

These operate server-side against QubeBase and are safe to consume from agents if you control auth at your edge.

Example:

```ts
const res = await fetch('https://dev-beta.aigentz.me/api/identity/persona');
const body = await res.json();
// body.ok, body.data[...]
```

### 7.2 Reputation via RQH (ReputationQube)

Aigent Z proxies the RQH canister via:

- `GET /api/identity/reputation/bucket?partitionId=<id>`
- `POST /api/identity/reputation/bucket`

**Fetch reputation bucket:**

```ts
const res = await fetch(
  'https://dev-beta.aigentz.me/api/identity/reputation/bucket?partitionId=agent:aigent-z',
);
const body = await res.json();
// body.data.bucket, .score, .skill_category, etc.
```

**Create initial bucket:**

```ts
await fetch('https://dev-beta.aigentz.me/api/identity/reputation/bucket', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    partitionId: 'agent:aigent-z',
    skillCategory: 'cross_chain_ops',
    initialScore: 75,
  }),
});
```

Thin clients should prefer these HTTP routes instead of calling the IC canister directly.

---

## 8. Typical Thin-Client Workflow

### 8.1 Agent Bootstrapping

1. Load env:
   - `AIGENT_Z_AA_BASE`
   - (Optional) QubeBase vars for server-side work.
2. Call `/aa/v1/auth/challenge` → get `nonce`.
3. Sign `nonce` with agent key.
4. Call `/aa/v1/auth/verify` → get `aa_token`.
5. Cache `aa_token` and attach as `Authorization: Bearer ...` for AA-API calls.

### 8.2 Access-Controlled Asset Fetch

1. Optionally read DiDQube persona/reputation constraints.
2. Call `/aa/v1/entitlements/*` with details of asset + action.
3. If allowed, fetch asset via AA-API or QubeBase proxy.

### 8.3 Reputation-Aware Actions

- Use `partitionId` conventions like `agent:<id>`, `persona:<id>`, `iqb:<id>` to group reputation.
- Update reputation (future evidence APIs) when interactions succeed/fail.

---

## 9. Best Practices & Gotchas

- **URL building**: keep `/aa/v1` handling consistent; do not mix base-with-path and absolute paths.
- **Service keys**: never expose `QUBEBASE_SERVICE_ROLE_KEY` to browsers or untrusted environments.
- **Payments**: always go through AA-API; do not manipulate payment tables directly in QubeBase.
- **DiDQube policies**: leave gating logic to AA-API / RegistryService wherever possible.
- **Environment safety**: adding env vars must be additive and non-destructive; do not rename/delete existing vars in AigentZBeta or QubeBase without a migration plan.

---

## 10. Example Client Module

See `docs/examples/aigentz-client.ts` for a minimal TypeScript helper that:

- Handles challenge/verify and returns `aa_token`
- Provides typed helpers for calling AA-API routes
- Encodes the URL-building conventions described above.
