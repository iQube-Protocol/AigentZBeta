# metaMe Threshold — Gateway Increment 2b (live Constitutional Handshake / OAuth crossing)

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** build
**Charter:** PRD-THR-001 (metaMe Threshold), Phase 1 · **Increment:** 2b of 4 (auth goes live)

## What shipped

The **live Constitutional Handshake** — an OAuth 2.1 authorization-code + PKCE
crossing where the human's single browser click performs the whole constitutional
delegation and the Threshold Companion receives a scoped bearer bound to the
authorized agreement. **Ships inert until the operator provisions** (see below):
without the migration, every step soft-fails to null/503 and the gateway stays on
its read-only surface — fail-closed by construction.

**The flow (spec-correct OAuth 2.1 + PKCE):**

1. **Discovery** — `/.well-known/oauth-protected-resource` (the MCP gateway is the
   protected resource) points at the authorization server; `/.well-known/oauth-authorization-server`
   advertises the endpoints. PKCE **S256 is required**; clients are public (no secret).
2. **Registration** — `POST /api/threshold/oauth/register` (RFC 7591 DCR): a
   Companion registers a redirect_uri allowlist and gets a `client_id`. No secret issued.
3. **Authorize (the human)** — the Companion sends the person to
   `/threshold/authorize` (the browser page). `authorize-init` validates the client
   + redirect, enforces PKCE, and binds a `pending` handshake to exactly these
   parameters. The human sees the destination + requested scope, then **authorizes**.
4. **The human's click** — `POST /api/threshold/oauth/complete` (spine-authenticated
   as the person) performs **form → agent-accept → HUMAN-authorize** a Constitutional
   Agreement (`authorizeAgreement` — the real 409-gate-opening act), then mints a
   one-time authorization **code** bound to the crossing. The agent never reaches
   this route.
5. **Token exchange (the agent)** — `POST /api/threshold/oauth/token` verifies the
   code + PKCE `code_verifier` + redirect_uri, then mints the `ths_` bearer, stores
   only its sha256, and returns it once. The code is single-use (burned + replay-guarded).
6. **Authenticated use** — the Companion presents the bearer to `/api/threshold/mcp`;
   `resolveBearer` attaches the scoped session. A bearer-less call to an authenticated
   crossing tool now answers **HTTP 401 + `WWW-Authenticate` → the protected-resource
   metadata** (the MCP trigger to run the crossing).

## Constitutional guardrails (held)

- **Principal–Delegate Separation** — only the human authorizes. The agent never
  reaches `/complete`; there is no agent-authorize path. The human's browser click
  IS the constitutional authorization act.
- **Read/participate only** — a Threshold crossing grants a Domain-3 delegation:
  `valueCeiling: null` + `forbiddenActions` include move-funds, publish,
  delegate-agent, disclose-identity-credentials. **Money-moving is a separate,
  higher-consequence crossing** (MoneyPenny / CRP-003a runtime), never a Threshold.
- **No T0** — the session stores only the T2 `personaPublicRef`, a per-crossing T2
  agent alias, the `agreement_id`, the granted scope, and the sha256 of the bearer.
- **PKCE mandatory + fail-closed** — the code is useless without the verifier;
  redirect_uri is allowlisted per client; every store call soft-fails to null.

## Files

- `supabase/migrations/20260806000000_agent_gateway_sessions.sql` — extended with
  the OAuth columns (client_id, redirect_uri, pkce_challenge, oauth_state,
  auth_code_hash, code_expires_at), the `authorized` status, and the
  `agent_gateway_clients` (DCR) table.
- `services/threshold/gatewaySession.ts` — `registerClient` / `getClient`,
  `issueAuthorizationCode`, `exchangeAuthorizationCode` (PKCE S256), extended
  `createPendingHandshake`.
- `app/.well-known/oauth-protected-resource/route.ts`, `app/.well-known/oauth-authorization-server/route.ts`
- `app/api/threshold/oauth/{register,authorize-init,complete,token}/route.ts`
- `app/threshold/authorize/page.tsx` — the human crossing page (slate house style).
- `app/api/threshold/mcp/route.ts` — 401 + `WWW-Authenticate` challenge for
  bearer-less authenticated-tool calls.

## Operator action required (the crossing is inert until BOTH are done)

1. **Apply the migration** (adds the sessions + clients tables; idempotent):

   ```sql
   -- paste supabase/migrations/20260806000000_agent_gateway_sessions.sql
   -- into the Supabase SQL editor and run it
   ```

2. **(Recommended) review the auth flow** before first external use — this is the
   platform's identity/delegation ingress. A security checklist for the review:
   redirect_uri allowlisting per client, code single-use + PKCE S256 enforcement,
   the read/participate-only scope ceiling, and confirming money-moving stays out
   of the Threshold crossing.

`NEXT_PUBLIC_APP_URL` (or `NEXT_PUBLIC_BASE_URL`) should be set so the discovery
documents advertise the correct public origin; otherwise it is derived from the
proxied request headers.

## Next

3 — persona tools over the scoped session (Agent Card, `propose_delegation`).
4 — the IRL service adapter (accept invitation, locker read, submit review, QubeTalk),
each mutating call re-passing the 409 gate.
