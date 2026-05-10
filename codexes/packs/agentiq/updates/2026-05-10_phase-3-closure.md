# Phase 3 Closure — DVN as Policy Enforcer + Alias-Anchored Receipts

**Date:** 2026-05-10
**Status:** Phase 3 closed end-to-end. Receipts land alias-anchored, T0 leak canary green, on-chain submission live.
**Plan reference:** `2026-05-05_unified-identity-content-access-foundation-plan.md` §Phase 3
**Decisions doc:** `2026-05-10_phase-3-decisions.md`

---

## What Phase 3 closed

The trust boundary moved off the platform:

```
evaluateAccess decision (Phase 1)
  → buildReceiptHandle uses real cohortAliasService HMAC (Phase 3.1)
  → emitDecisionReceipt persists T2-only row (Phase 3.2)
  → orchestration_events.actor_alias_commitment + cohort_id populated
  → submitPendingAccessReceipts batches and submits (Phase 3.4)
  → cross_chain_service.submit_dvn_message → canister-side inscription
  → orchestration_events.on_chain_tx_id populated
```

Privacy contract holds end-to-end. The on-chain payload contains
`alias_commitment` + `cohort_id` + `asset_id` + decision shape. Never
`personaId` / `authProfileId` / `rootDid`. Verified by SQL canary
(t0_leak_count = 0).

---

## Phase status

| # | Status | Details |
|---|---|---|
| 3.0 | ✅ | Decisions locked: HMAC-SHA256 commitments, 15-min batch, RQH cohort resolver, deferred ordinal pipeline (uses cross_chain_service) |
| 3.1 | ✅ live | `services/identity/cohortAliasService.ts` — `computeAliasCommitment(personaId, cohortId, epoch)` → 64-char hex |
| 3.2 | ✅ live | `services/access/receiptEmitter.ts` + `orchestration_events` schema additions; rows landing in production |
| 3.3a | ✅ live | Cohort credential resolver via RQH canister (`fetchReputationFromRQH`) |
| 3.3b | ✅ live | Token credential resolver via JSON-RPC `eth_call` (ERC-721 + ERC-1155) |
| 3.4 | ✅ live | `services/dvn/accessReceiptBatcher.ts` + `/api/access/finalize-receipts` route — submits to cross_chain_service.submit_dvn_message |

---

## Verification artefacts

### Receipts landing with real commitments

```sql
select event_id, actor_alias_commitment, cohort_id, receipt_mode, on_chain_tx_id, created_at
from orchestration_events
where event_type = 'access_decision'
order by created_at desc limit 5;
```

Confirmed: `actor_alias_commitment` = 64-char hex, `on_chain_tx_id` populated after batcher run.

### T0 leak canary — 0 leaks

```sql
select count(*) as t0_leak_count
from orchestration_events
where event_type = 'access_decision'
  and (metadata::text ilike '%personaid%'
    or metadata::text ilike '%authprofileid%'
    or metadata::text ilike '%rootdid%');
```

Returns 0. Privacy contract validated.

### Batcher operational

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_OPS_TOKEN" \
  https://dev-beta.aigentz.me/api/access/finalize-receipts
```

Returns `{ ok: true, pendingCount: N, submitted: N, failed: 0 }`.

---

## Files added or modified in Phase 3

### New
- `services/identity/cohortAliasService.ts` — alias commitment computation
- `services/access/receiptEmitter.ts` — decision → orchestration_events row
- `services/identity/personaAddressResolver.ts` — persona → chain address
- `services/access/tokenOwnership.ts` — ERC-721/1155 ownership via eth_call
- `services/dvn/accessReceiptBatcher.ts` — batch submitter
- `app/api/access/finalize-receipts/route.ts` — operator/cron trigger
- `supabase/migrations/20260510010000_phase3_receipt_attribution.sql`

### Modified
- `services/access/evaluateAccess.ts` — receipt emission + cohort/token gate
- `services/access/policyResolvers.ts` — `resolveExternalCredential` dispatcher
- `services/orchestration/orchestrationEvents.ts` — extracts T2 columns from metadata
- `types/access.ts` — `ReceiptMode` adds `'async-batched'` and `'none'`; `ActivePersonaContext.fioHandle` (Phase 1 carry-over)
- `types/orchestration.ts` — `OrchestrationEventType` adds `'access_decision'`
- `scripts/create-env-production.js` — adds `COHORT_ESCROW_SECRET`, `COHORT_ALIAS_EPOCH`, `FIO_API_ENDPOINT_DEDICATED`

---

## Required env (verified live in Amplify)

| Var | Purpose |
|---|---|
| `COHORT_ESCROW_SECRET` | HMAC key for alias commitment computation |
| `COHORT_ALIAS_EPOCH` | Rotation marker (default `'v1'`) |
| `RQH_CANISTER_ID` | Reputation Hub canister for cohort resolver |
| `EVM_RPC_CANISTER_ID` | EVM RPC canister (used elsewhere; token resolver uses public RPC fallback) |
| `CROSS_CHAIN_SERVICE_CANISTER_ID` | DVN submission target |
| `ADMIN_OPS_TOKEN` | Bearer for `/api/access/finalize-receipts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role for orchestration_events writes |

Optional (per-chain RPC overrides for token resolver):
`ETH_RPC_URL`, `BASE_RPC_URL`, `OPTIMISM_RPC_URL`, `POLYGON_RPC_URL`, `ARBITRUM_RPC_URL`

---

## Cron schedule for the batcher

Operator picks the path; both work:

**External cron (every 15 min):**
```
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $ADMIN_OPS_TOKEN" \
  https://dev-beta.aigentz.me/api/access/finalize-receipts > /dev/null
```

**Amplify scheduled function** — point at the same URL, same cadence, same auth.

---

## Key bugs we hit + fixes (so the next agent doesn't repeat them)

1. **Constraint excluded `'async'`** — first migration had `CHECK (receipt_mode IN ('sync','async-batched','none'))` but the spine produces `'async'`. Every emit failed silently. Fixed with ALTER.
2. **Missing `active_codex` column** — emit payload included a column that was never in the schema. Insert returned an error in `error.code`, was logged but invisible. Diag endpoint surfaced via row-landed=false. Added column.
3. **Fire-and-forget receipts in Lambda** — `void emitDecisionReceipt(...)` was torn down before the DB write completed. Switched to `await`.
4. **Anon-key fallback** — `getDb()` silently fell back to anon when service-role was missing. Added explicit warning log.

The diag endpoint (`app/api/access/diag-receipts/route.ts`) was removed after closure since the bugs are fixed and an unrestricted debug surface should not stay around.

---

## What Phase 3 unblocks

- **Phase 4a** — TokenQube on-chain ownership proof. Already has working primitives in 3.3b's `tokenOwnership.ts` to extend
- **KNYT rep/rewards/tasks workstream** — receipt emission point is durable + on-chain. Per the spine integration brief
- **Phase 4b** — sovereign TokenQube + per-holder ciphertext. Encryption library from Phase 2 + alias commitment from Phase 3.1 = the building blocks

---

## Backlog from Phase 3

- **Cohort directory + group seed migration** — populate the 5 seed cohorts (`knyt:backers`, `knyt:alpha-investors`, `agentiq:partners`, `agentiq:developers`, `qriptopian:editors`) with their RQH partition records when the canister is provisioned for them
- **Receipt-on-chain audit script** — `scripts/verify-receipts-on-chain.mjs` that picks N random orchestration_events rows with on_chain_tx_id and verifies their inscription presence on Bitcoin (deferred until DVN canister exposes a query API)
- **Remove the placeholder fallback in cohortAliasService** — Phase 5 cleanup. Once the escrow secret has been deployed for >30 days everywhere, the `__phase1_pending_alias__` fallback can be removed entirely
- **`verify-spine.mjs --phase=3` mode** — extend the existing smoke gate with a check that asserts an inspect call lands a row with non-placeholder commitment
