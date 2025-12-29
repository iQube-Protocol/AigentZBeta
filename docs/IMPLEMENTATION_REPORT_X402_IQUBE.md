# AgentiQ x402 + iQube Identity, Settlement, and UI Integration Report

## Overview
This document summarizes the features implemented to extend iQube transfers using x402 as the rail, integrate DIDQube and FIO identity, implement immediate QCT settlement with a policy path to escrow, and add privacy-preserving FIO→DID soft-binding with TTL and re-verification. It also covers the UI components added to control consent and retry failed/pending settlements, with design choices and rationale.

## Scope Delivered
- x402 message profile implementation (headers, schemas, signing verification helper).
- Additive DB schema for x402 messages, settlements, deliveries, iQube events, and identity aliasing with TTL.
- Identity resolution with FIO lookup, consent-gated alias persistence, and TTL management.
- Immediate settlement (Option B) with future switch to escrow via policy.
- Re-verify background endpoint that refreshes/invalidates alias bindings based on TTL and ownership.
- UI: consent toggle and settlement retry controls in Agent Wallet Drawer.

## Architecture Changes
- Database (Supabase) migrations:
  - supabase/migrations/20251104_x402_identity.sql
    - identity_aliases(entity_did, alias_type, alias_value, verified, proof_ref, updated_at)
    - fio_cache(handle, owner_pubkey, raw_response, expires_at)
    - x402_messages(intent, headers, payload, state, identity snapshots, timestamps)
    - x402_settlements(message_id, asset, amount, escrow_tx, release_tx, status)
    - iqube_capabilities(audience_did, audience_alias, scope, ttl)
    - iqube_events(type, x402_message_id, identity_snapshot)
    - deliveries(meta_cid, blak_uri, hashes, pod_proof, status)
  - supabase/migrations/20251104b_identity_aliases_ttl.sql
    - identity_aliases: expires_at, last_verified_at + index

Rationale: additive and isolated schema enabling x402 flows, settlement status tracking, and private alias lifecycle without breaking existing tables.

## Policy Flags and Rationale
- services/identity/policy.ts
  - IDENTITY_FIO_AUTOBIND: off|soft|public (default off) — controls automatic alias binding behavior model.
  - IDENTITY_FIO_REQUIRE_CONSENT: boolean (default true) — preserves privacy by requiring explicit consent.
  - IDENTITY_FIO_ALIAS_TTL_DAYS: number (default 90) — alias binding lifespan.
  - AUDIT_EXPOSE_ALIAS: boolean (default false) — avoid public exposure by default.

Rationale: keep privacy-first defaults, allow environment-controlled rollout and A/B.

## Identity Resolution and Binding
- services/identity/identityResolver.ts
  - resolveIdentity(subject) — supports DID and FIO handle lookup via internal API.
  - bindAliasToDid(did, 'fio', value, proofRef?) — on consent, persists alias with `verified=true`, sets `last_verified_at` and `expires_at` using policy TTL.
- API helpers
  - app/api/identity/fio/lookup — FIO handle info and ownership pubkey.
  - app/api/identity/fio/verify — ownership verification endpoint (existing).
  - app/api/identity/resolve — identity resolver HTTP wrapper.

Rationale: soft-binding with explicit consent preserves DIDQube anonymity model, while enabling UX convenience when desired.

## x402 APIs
- app/api/x402/send
  - Validates headers & payloads (Zod schemas in services/x402/schemas.ts).
  - Resolves identities, verifies ed25519 signature (services/x402/signing.ts).
  - Persists `x402_messages` and `x402_settlements`.
  - Settlement: immediate Option B by calling /api/a2a/signer/transfer unless policy says escrow.
  - If `X-402-Consent-Alias-Bind: true` and recipient is FIO, stores private audience_alias in capability and calls `bindAliasToDid`.
- app/api/x402/receive — persists message in received state for inbound flows.
- app/api/x402/finalize — updates PoD and marks settlement released.
- app/api/x402/[id] — status endpoint for message/settlement/delivery/events.
- Policy hook: services/x402/policy.ts `shouldEscrow` (env-driven switching).

Design Rationale: Use x402 as an envelope with headers for identity & settlement parameters, allowing consistent audit and delivery semantics.

## Settlement Strategy
- Default: Immediate payment (Option B) using internal A2A transfer.
- Future: Policy gate to switch to escrow (Option A) based on env or thresholds.

Why: Immediate reduces complexity and latency for pilot; policy flag provides migration path if risk requires escrow.

## Re-Verification Job
- app/api/identity/aliases/reverify (POST)
  - Finds FIO aliases that are expiring soon or unverified.
  - Revalidates via `/api/identity/fio/lookup` and updates `verified`, `last_verified_at`, and extends `expires_at` if valid.

Rationale: Automatically maintain correct alias bindings without exposing identity publicly.

## UI Components
- app/components/identity/AliasConsentToggle.tsx
  - Drawer-styled toggle with description. Local persistence via localStorage key `x402_alias_consent` used by UI.
- app/components/x402/SettlementRetryButton.tsx
  - Styled to match Send Payment. Calls `/api/x402/settlements/retry` with `settlementId` or `messageId`.
- components/AgentWalletDrawer.tsx (legacy path) + app/components/AgentWalletDrawer.tsx (app path)
  - Identity card shows the consent toggle and FIO.
  - x402 Settlement card with labeled inputs and tooltips for IDs; Retry button.

Rationale: Put privacy control and recovery actions in the wallet aside drawer where operators already monitor balances and payments.

## Security and Privacy
- ed25519 detached signatures on x402 payload + headers per agreed header names (`ed25519:<hex>` for pub and sig).
- Soft-binding only with explicit consent. Aliases kept private and TTL-bound.
- No public alias exposure by default; env flag required to change behavior.

## Operational Guidance
- Env vars:
  - X402_SETTLEMENT_MODE, X402_ESCROW_MIN_QCENT
  - IDENTITY_FIO_AUTOBIND, IDENTITY_FIO_REQUIRE_CONSENT, IDENTITY_FIO_ALIAS_TTL_DAYS, AUDIT_EXPOSE_ALIAS
  - TREASURY_ADDRESS, NEXTAUTH_URL, FIO_API_ENDPOINT, FIO_CHAIN_ID
  - RPC endpoints and token addresses for A2A signer.
- Cron suggestion:
  - Daily POST to `/api/identity/aliases/reverify`.
- Status & retry:
  - Use `/api/x402/[id]` to inspect a message.
  - Use `/api/x402/settlements/retry` to reattempt payments; either `settlementId` or `messageId`.

## Known Limitations / Future Work
- Add idempotency + rate limiting to retry endpoint.
- Add richer x402 escrow flow and thresholds.
- Expand UI with message status view and inline actions.
- Unit/integration tests for policy flags, TTL lifecycle, and retry flows.

## Files Added/Edited (key)
- services/x402/{schemas.ts, signing.ts, policy.ts}
- services/identity/{identityResolver.ts, policy.ts}
- app/api/x402/{send,receive,finalize,[id]}/route.ts
- app/api/x402/settlements/retry/route.ts
- app/api/identity/{resolve,aliases/reverify}/route.ts
- app/components/identity/AliasConsentToggle.tsx
- app/components/x402/SettlementRetryButton.tsx
- components/AgentWalletDrawer.tsx (and app/components/AgentWalletDrawer.tsx)
- supabase/migrations/20251104_x402_identity.sql
- supabase/migrations/20251104b_identity_aliases_ttl.sql
- docs/x402/x402-IQ.md (profile spec)

## Decision Log (Why)
- Immediate settlement first to reduce complexity and validate flows rapidly; escrow via policy later as needed.
- ed25519 scheme for compact, modern signing consistent with DID-style keys.
- Consent-gated alias binding to maintain DIDQube anonymity posture.
- TTL + reverify to ensure correctness of alias mapping over time without public exposure.
- Drawer-based UI to centralize privacy/operational controls near balances and transfers.
