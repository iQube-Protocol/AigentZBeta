# AigentZ AA API

**AA API** is the backend service for the AigentZ / metaMe platform. "AA" is short for **AigentZ API** — it has no other expansion. Think of it as the server that sits between the frontend (or any thin client) and the underlying systems (database, asset registry, payment processor).

If you're looking at the code and thinking "this is a directory full of route handlers" — you're right. That's exactly what it is. Each route group handles a different concern:

```
thin client  →  AA API  →  Supabase (database)
                        →  Registry (asset metadata)
                        →  X402 (micropayments)
```

The frontend never talks to Supabase or the Registry directly. All reads and writes go through AA API so that auth, tenant scoping, and policy enforcement happen in one place.

---

## What each route group does

| Route prefix | Plain-language purpose |
|---|---|
| `/aa/v1/auth` | Log in with a DID (decentralised identity). Returns a JWT you use for all other requests. |
| `/aa/v1/assets` | Upload a file, register it in the asset registry, and set who can access it. |
| `/aa/v1/entitlements` | Grant or list a user's access rights to assets. |
| `/aa/v1/quotes` | Start an X402 micropayment flow (get a price quote for an asset). |
| `/aa/v1/payments` | Receive the webhook when an X402 payment settles. |
| `/aa/v1/runtime` | Return the shell configuration — menus, selected Aigent, LLM selector, iframe URL — so the frontend knows what to render. Also handles menu and prompt actions. |
| `/aa/v1/updates` | Server-Sent Events stream. Pushes real-time updates to a connected client (e.g. "your asset registered successfully"). |
| `/aa/v1/browser` | Create and control automated browser sessions (Playwright / Browserbase) on behalf of an agent. |
| `/aa/v1/supabase` | Internal DB helper endpoints. Not intended for external callers. |
| `/health` | Health check. Returns `{ ok: true }`. |

---

## Run

From the repo root (uses root `.env.local`):

```bash
npm run aa:install   # install dependencies
npm run aa:dev       # development (hot reload)
npm run aa:build     # compile TypeScript
npm run aa:start     # run compiled build
```

Node v20+ required (see `.nvmrc` at repo root).

---

## Environment variables

These must be present in `.env.local` at the repo root:

| Variable | What it does |
|---|---|
| `AA_JWT_SECRET` | Signs and verifies the JWTs issued by `/auth/verify`. |
| `SUPABASE_URL` | Your Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — full DB access, never expose to the browser. |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name for asset uploads (if used). |
| `REGISTRY_ENDPOINT` | URL of the asset registry service. |
| `REGISTRY_API_KEY` | API key for the registry. |
| `X402_FACILITATOR_ENDPOINT` | URL of the X402 payment facilitator. |
| `X402_SIGNING_PRIVATE_KEY` | Private key used to sign X402 payment payloads. |
| `X402_CALLBACK_PUBLIC_BASE` | Public base URL for X402 settlement callbacks. |
| `CORS_ORIGIN` | Comma-separated list of allowed origins, or `*` for all. |
| `RUNTIME_IFRAME_URL` | URL of the embedded runtime iframe (default: `http://localhost:3000/metame/runtime?embed=1`). |
| `RUNTIME_IFRAME_ORIGIN` | Origin of the iframe (defaults to the origin of `RUNTIME_IFRAME_URL`). |
| `DEFAULT_TENANT_ID` | Optional fallback tenant ID when none is in the JWT. |
| `DEFAULT_PERSONA_ID` | Optional fallback persona ID. |

Compatibility alias: `SUPABASE_JWT_SECRET` is accepted as a fallback for `AA_JWT_SECRET`.

---

## How auth works

1. Client calls `POST /aa/v1/auth/challenge` with a DID → gets a challenge string back.
2. Client signs the challenge with their private key → calls `POST /aa/v1/auth/verify` with the signature.
3. AA API verifies the signature → issues a JWT.
4. Client includes `Authorization: Bearer <token>` on all subsequent requests.

The JWT carries `tenantId` and `personaId` claims. Every route that touches data uses these to scope the query to the right tenant.

---

## How the frontend connects

The Next.js app **does not call AA API directly**. It proxies through `/app/api/aa/*` Next.js API routes. Those routes add server-side concerns (cookie-based sessions, additional auth checks) before forwarding to AA API.

The `@metame/aa-client` package (`/packages/aa-client`) is the typed client used by the frontend to call those Next.js proxy routes.

---

## Scaling notes

- **SSE is in-memory.** For multi-instance deployments, replace with Redis pub/sub.
- **Rate limiting** is not yet implemented on public endpoints — add it before production scale.
- The Registry and X402 adapters are entirely env-driven; swap endpoints via env vars per environment.
