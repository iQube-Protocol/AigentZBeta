# Bounded-delegation grants persistence (Phase 2 remainder)

**Date:** 2026-06-22
**Branch:** `claude/optimistic-davinci-exiykx`
**Status:** shipped (migration + durable store + route wiring)

## Why

Active bounded-delegation grants lived ONLY in an in-memory `Map` in
`app/api/codex/chat/agentiq-os/delegation/route.ts`, wiped on every serverless
cold start. The only durable trace was the `orchestration_events` audit log,
which the GET handler reconstructed grants from heuristically. Two problems:

1. **Delegated Standing had no ledger.** A grant that evaporates on restart
   can't be a durable basis for sponsor Delegated/Stewardship Standing.
2. **An orphaned FK.** `delegation_agentkit_attestations.delegation_grant_id`
   was a bare `text` column with no parent table.

This was the last open Phase-2 item in the Polity Passport operationalization
plan (alongside the now-shipped proof-of-outcome Standing edge).

## What shipped

1. **Migration** `supabase/migrations/20260622500000_delegation_grants.sql` —
   `public.delegation_grants` keyed on `grant_id` (== the HandoffPayload
   `handoff_id`). Columns mirror the in-memory `DelegationRecord` plus the grant
   policy (trust band, allowed/forbidden actions, surfaces, disclosure class,
   max_actions, autonomy toggles) and a `handoff` JSONB for exact rehydration.
   Status machine `active → revoked | expired`. RLS: owner reads own
   (persona_id → personas.auth_profile_id), service role full. The migration
   also adopts the orphaned attestation FK
   (`delegation_agentkit_attestations.delegation_grant_id →
   delegation_grants.grant_id`, `NOT VALID` so pre-existing dev rows aren't
   retroactively checked).

2. **Durable store** `services/delegation/delegationGrantStore.ts` —
   `persistDelegationGrant` (supersedes prior active for the persona, then
   inserts), `readActiveGrant` (rehydration, lazily expires stale rows),
   `revokeActiveGrant`, `markGrantExpired`. Every call is best-effort and
   soft-fails when the migration is pending — same pattern as the Standing
   accrual service.

3. **Route wiring** (`.../agentiq-os/delegation/route.ts`):
   - **POST** persists the grant after caching it in-memory.
   - **GET** reads the durable grant on a cache miss (before the legacy
     `orchestration_events` reconstruction), rehydrating the in-memory record
     from the stored handoff; also marks a grant expired when it reads one past
     TTL.
   - **DELETE** flips the ledger to `revoked` even when the in-memory cache is
     cold, so a rehydrated/cross-instance grant is still revocable.

The in-memory `Map` stays as a hot cache and the `orchestration_events` audit
trail is unchanged — this is additive (Extend-Don't-Duplicate), not a rewrite.

## Note on `actions_taken`

The grant's `actions_taken` counter is never incremented anywhere in the current
codebase (it's read for the `suspended` check but the bump logic isn't built
yet). The table carries the column ready for when that lands; the durable record
persists `actions_taken: 0` exactly as the in-memory record does today.

## Deploy

Apply the migration in Supabase before relying on durable grants:

```
supabase/migrations/20260622500000_delegation_grants.sql
```

Until applied, the route runs exactly as before (in-memory + orchestration_events
fallback); the store soft-fails and logs a single warning.
