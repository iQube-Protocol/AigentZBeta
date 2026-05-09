# Phase 3 — DVN as Policy Enforcer Decisions

**Date:** 2026-05-10
**Status:** 3.0 + 3.1 + 3.2 ship in this session. 3.3 (DVN canister hook) and 3.4 (Bitcoin ordinal pipeline) are queued — they depend on external infrastructure decisions (canister addresses, inscription tooling).
**Plan reference:** `2026-05-05_unified-identity-content-access-foundation-plan.md` §Phase 3
**Phase 1+2 closure:** `2026-05-08_phase-1-iam-spine-closure.md`, `2026-05-09_phase-2-encryption-decisions.md`

---

## What Phase 3 closes

The trust boundary moves: the platform stops deciding "is this allowed", the DVN does. Every receipt-eligible decision attributes via T2 alias commitment (never personaId/rootDid) and lands a durable, auditable row that Phase 3.4 batches onto Bitcoin.

Phase 1 was the gate scaffolding. Phase 2 closed the cryptographic gap. Phase 3 closes the **attribution + durability** gap.

---

## Decisions locked (operator-approved 2026-05-10)

### 1. Alias commitment scheme

```
commitment = HMAC-SHA256(
  escrow_secret,
  `${cohortId}|${personaId}|${epoch}`
)
```

64-char hex output (32-byte HMAC-SHA256 digest).

Why HMAC, not Pedersen / Merkle:
- Deterministic + unforgeable (only the spine server can compute it)
- Per-cohort isolation (same persona → different commitment per cohort)
- Rotatable via `epoch` env without rotating the master secret
- Zero ZK-proof overhead — Phase 5 can swap to Pedersen if zero-knowledge becomes a requirement

### 2. Receipt batching cadence

**Async-batched at 15-minute intervals.**

Sync-per-decision would multiply chain costs at our action volume; hourly batches make audit latency too long. 15 minutes is the sweet spot for Phase 3 v1. The cadence is a constant in `services/receipts/receiptBatcher.ts` (Phase 3.4) — easy to revisit.

### 3. Ordinal inscription pipeline

**Deferred to Phase 3.4.** Operator picks with the team. The orchestration_events row carries `on_chain_tx_id` and `inscription_id` columns ready to populate; the batcher service is the only piece needing the pipeline choice.

Candidates carried forward:
- Direct `ord` wallet (operator runs node — most control, most ops)
- OrdinalsBot / Hiro API (managed — least ops, cost per inscription)
- Custom indexer with a parent-child inscription pattern for batching

### 4. Cohort taxonomy seed

```
knyt:backers
knyt:alpha-investors
agentiq:partners
agentiq:developers
qriptopian:editors
```

These are the initial cohort ids the system operates on. New cohorts are added by:
1. Adding the id to a constant in `services/identity/cohortDirectory.ts` (Phase 3.3 lands this)
2. Optionally seeding membership rows in `cohort_groups` (also Phase 3.3)

The cohort id is a string (not a UUID) because it's part of the alias commitment input — stable string semantics matter more than DB referential integrity here.

### 5. DVN canister addresses

**Deferred to Phase 3.3.** `RQH_CANISTER_ID` (reputation) and `EVM_ADAPTER_RPC_URL` (token-credential resolver) need the canister team's input. Both env vars are reserved; the spine returns conservative deny for `cohort:*` / `token:*` credentials until they're populated and 3.3 ships.

### 6. Identifiability floor for receipts

Already enforced. `getActivePersona` clamps `context.identifiability` to the most-restrictive of (agent declared, operator current). The receipt emitter reads `context.identifiability` directly into the metadata payload. No separate policy needed for receipts — the spine's clamp IS the policy.

---

## What ships in this commit (3.0 + 3.1 + 3.2)

### 3.1 — Cohort alias service (alias commitment lands)

- New: `services/identity/cohortAliasService.ts` — `computeAliasCommitment(personaId, cohortId, epoch)` + `isAliasServiceConfigured()` probe
- `services/access/evaluateAccess.ts` — `buildReceiptHandle` now calls the alias service when configured; falls back to the Phase 1 placeholder when env is missing
- New env: `COHORT_ESCROW_SECRET` (32 bytes base64), `COHORT_ALIAS_EPOCH` (default `'v1'`)

After 3.1: every `evaluateAccess` decision returns a real, unforgeable, non-correlatable receipt handle.

### 3.2 — Receipt emission scaffolding

- New: `services/access/receiptEmitter.ts` — `emitDecisionReceipt` translates an AccessDecision to an orchestration_events row with T2-only attribution
- `services/access/evaluateAccess.ts` — fire-and-forget call to `emitDecisionReceipt` after every decision when `receipt.mode !== 'none'`
- `services/orchestration/orchestrationEvents.ts` — extracts T2 fields from metadata into top-level columns for indexing
- Migration: `supabase/migrations/20260510010000_phase3_receipt_attribution.sql` — adds `actor_alias_commitment`, `cohort_id`, `receipt_mode`, `on_chain_tx_id`, `inscription_id`, `inscribed_at` + 2 partial indexes
- Privacy: NO personaId / authProfileId / rootDid in the emitted row's metadata. Tested by canary in tests/access-spine.test.ts (Phase 3 cases — extension lands when test runner is available)

After 3.2: every decision lands a durable receipt row. Phase 3.4 picks them up for chain emission.

### What's NOT in this commit

- DVN canister hook (3.3) — needs canister addresses
- Bitcoin ordinal batcher (3.4) — needs pipeline decision + secret-key custody for the inscription wallet
- Cohort group taxonomy seed migration (3.3 sub-step) — lands with 3.3

These are independent and can ship asynchronously. Each is gated on its own external decision.

---

## Operator action required before 3.1 takes effect in production

```bash
# Generate the escrow secret
openssl rand -base64 32

# Add to BOTH .env.local AND Amplify env
COHORT_ESCROW_SECRET=<paste output>
COHORT_ALIAS_EPOCH=v1
```

If the secret isn't set, the alias service falls back to the Phase 1 placeholder commitment (graceful degradation; no error, but receipts aren't real yet). Once the secret lands in env, every subsequent decision emits a real commitment.

Run the migration in Supabase SQL editor — full SQL block in the migration file or paste from this doc:

```sql
-- (full SQL inline — see 20260510010000_phase3_receipt_attribution.sql)
```

---

## Acceptance criteria

Phase 3 v1 (this commit) is complete when:

1. `COHORT_ESCROW_SECRET` is set in Amplify + local `.env.local`
2. Migration `20260510010000_phase3_receipt_attribution.sql` is applied
3. A test request hitting any spine consumer (e.g. `/api/access/inspect`) produces an `orchestration_events` row with:
   - `actor_alias_commitment` populated as 64-char hex (NOT the `__phase1_pending_alias__` placeholder)
   - `cohort_id` populated (`default` for personas with no cohort memberships)
   - `receipt_mode` populated (`sync` or `async-batched`)
   - NO personaId / authProfileId / rootDid in `metadata`
4. `verify-spine.mjs` passes existing checks

Phase 3 full closure (3.3 + 3.4 also live) requires the canister addresses + inscription pipeline. Tracked separately.

---

## Verification SQL

After running a few requests against any spine route:

```sql
select event_id, actor_alias_commitment, cohort_id, receipt_mode,
       inscription_id, on_chain_tx_id, created_at
from orchestration_events
where event_type = 'access_decision'
  and created_at > now() - interval '10 minutes'
order by created_at desc
limit 10;
```

Expect: `actor_alias_commitment` = 64-char hex, `cohort_id` populated, `receipt_mode` = `sync` or `async-batched`, `inscription_id` and `on_chain_tx_id` NULL (Phase 3.4 fills these later).

Also assert no T0 leak in metadata:

```sql
select count(*) as t0_leak_count
from orchestration_events
where event_type = 'access_decision'
  and (metadata::text ilike '%personaid%'
    or metadata::text ilike '%authprofileid%'
    or metadata::text ilike '%rootdid%');
```

Expected: 0. Anything else is a privacy contract violation — investigate immediately.

---

## What Phase 3 unblocks

- **Phase 3.4** — Bitcoin ordinal pipeline picks up the durable rows; once chosen + wired, every decision becomes a verifiable Bitcoin-anchored receipt
- **KNYT rep/rewards/tasks workstream** — the receipt emitter is the integration point for their reputation events (per the spine integration brief)
- **DVN as policy enforcer** — Phase 3.3 swaps `credentialRequiresExternalVerifier` deny path for live canister calls; the receipt emission already in place captures the result

---

## Backlog from Phase 3

- Phase 3.3 — DVN policy hook (cohort + token credential resolution via ICP / EVM)
- Phase 3.4 — Bitcoin ordinal batcher + cron schedule
- Cohort directory + group seed migration
- Once 3.4 lands, an audit script: `scripts/verify-receipts-on-chain.mjs` that picks N random orchestration_events rows and verifies their inscription presence on Bitcoin
