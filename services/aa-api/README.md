# AigentZ AA API

Core orchestration service for AigentZ. Handles DID auth, tenant/role policy, asset registration and policies, x402 quotes/settlement webhooks, entitlement issuance, SSE events, and Registry calls. Data plane (tables, migrations, storage, SDK) resides in QubeBase.

## Ownership
- Repository: AigentZBeta
- Package: `aigentz-aa-api`
- Service path: `services/aa-api`

## Run
- From root using root env:
  - Install: `npm run aa:install`
  - Build: `npm run aa:build`
  - Start: `npm run aa:start`
  - Dev: `npm run aa:dev`
- Node: v20+ (see `.nvmrc` at repo root). The service enforces `engines.node =20.x`.

## Environment
Required variables (read from root `.env.local` via DOTENV_CONFIG_PATH):
- `AA_JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (if used by storage endpoints)
- `REGISTRY_ENDPOINT`
- `REGISTRY_API_KEY`
- `X402_FACILITATOR_ENDPOINT`
- `X402_SIGNING_PRIVATE_KEY`
- `X402_CALLBACK_PUBLIC_BASE`
- `CORS_ORIGIN`

Compatibility alias:
- `SUPABASE_JWT_SECRET` falls back to `AA_JWT_SECRET` in `src/env.ts`.

## Endpoints
- `GET /health` health check
- `POST /aa/v1/auth/challenge` → start DID challenge
- `POST /aa/v1/auth/verify` → verify DID and issue JWT
- `GET/POST /aa/v1/assets/*` → initiate upload, upload binary, register, set policies, list
- `GET/POST /aa/v1/entitlements/*` → create/list/update entitlements
- `POST /aa/v1/payments/*` → x402 settlement webhooks (quotes/commits)
- `POST /aa/v1/quotes/*` → x402 quote publish/flow
- `GET /aa/v1/updates` → SSE stream

## Integration with AigentZ SDK
- The SDK should call AA API endpoints for orchestration and use QubeBase SDK for data access.
- Shared types and adapters should be promoted to `/packages` (future work):
  - `packages/aigentz-sdk` (client)
  - `packages/aigentz-types` (DTO/Zod)
  - `packages/registry-adapter`, `packages/x402-adapter`

## Notes
- CORS and Helmet enabled; consider rate limiting for public endpoints.
- SSE is in-memory; for scale-out, use Redis pub/sub or a fanout layer.
- Registry/x402 adapters are env-driven; wire to prod endpoints/keys per environment.
