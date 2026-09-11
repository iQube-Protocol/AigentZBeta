# Stage 6 Close Report — DVN block ledger live, receipts tab functional, mint saga + canonization emit real receipts

**Status:** Stage 6 complete on `claude/dreamy-gates-mMqNv`. Block ledger writes on every receipt-eligible emission; query API spans both source surfaces; DVN Receipts tab live (5/7 iqube-registry cartridge tabs functional).
**Date:** 2026-05-31
**Branch commits this batch:** `242105eb` (C24), `55527ab5` (C25), `<this>` (C26 tab + close).

---

## What Stage 6 delivered

### C24 — `services/registry/dvnBlocks.ts` + writer integration

`services/registry/dvnBlocks.ts` (~330 LOC):

- **`appendReceiptToBlock({ scope, receipt_source, receipt_id, item_payload })`** — idempotent via the `(block_id, receipt_source, receipt_id)` UNIQUE constraint. Computes SHA-256 `item_hash`. Returns `was_inserted` flag.
- **`ensureOpenBlock(scope)`** — finds the open block or opens a new one. UNIQUE partial index `uq_dvn_blocks_one_open_per_scope` keeps races safe; 23505 unique-violation triggers re-fetch of the winner.
- **`sealOpenBlock(scope)`** — computes deterministic `batch_hash = sha256(sorted(item_hash).join('\n'))` per PRD v1.1 §B.7. Empty blocks left open.
- **`sealIfThresholdReached(scope)`** — reads `registry_config` for per-scope override of size (default 1000) + time (default 1 hour) thresholds.
- **`sealAllScopesIfThresholdReached()`** — bulk seal across all open scopes.
- **`listRecentBlocks(scope?, limit)`** + **`getBlockItems(block_id)`** — read API for the receipts tab.

Authority compliance: never decides access/ownership; only indexes already-authoritatively-written receipts; never reads secrets.

`services/orchestration/orchestrationEvents.ts`:

- `emitOrchestrationEvent` now writes the `iqube_id` column (Stage 1 C4 added it; this is the first writer). Resolves from `metadata.iqube_id` first, then legacy `metadata.asset_id`.
- After successful insert, appends to the dvn_receipt_blocks ledger when `event.receipt_eligible` is true. **Best-effort** — block append failures log warning but don't fail the receipt write. `cartridge_scope` defaults to `'platform'`.
- Canonical item_payload is stable T2-safe JSON: `{event_id, event_type, iqube_id, actor_alias_commitment, cohort_id, receipt_mode, timestamp}`.

**Every receipt-eligible orchestration emission going forward will land in the block ledger and be queryable by block / iqube_id / cartridge_scope.**

### C25 — Receipts query API + sealer admin endpoints + real receipt emission in saga + canonization

**`GET /api/registry/receipts`** (dual-mode):
- Legacy: `?intakeId=<id>` → unchanged ingestion-receipt list.
- Stage 6: any of `?iqube_id`, `?cartridge`, `?primitive_type`, `?actor_alias_commitment`, `?tx_hash`, `?block`, `?source`, `?limit`, `?before` triggers the cross-source unified query.

Output shape:
```json
{
  "receipts": [
    {
      "source": "orchestration_events" | "content_qube_dvn_receipts",
      "receipt_id": "...",
      "iqube_id": "...",
      "cartridge_scope": "...",
      "actor_alias_commitment": "...",
      "cohort_id": "...",
      "receipt_mode": "sync" | "async" | null,
      "event_type": "mint_canonized" | ...,
      "receipt_kind": "mint" | "transfer" | ...,
      "created_at": "...",
      "block_id": "...",
      "block_number": 42
    }
  ],
  "total": 50,
  "sources": { "orchestration": 47, "content_qube": 3 }
}
```

Notes:
- `primitive_type` filter pre-resolves via `iqube_id_map` (cap 5000 ids).
- `block` filter pre-resolves via `dvn_receipt_block_items`, tags `block_id` + `block_number` on results.
- T0 fields (`personaId`, `actor_persona_id`) never selected from either source.

**`GET /api/admin/registry/dvn-blocks`** — list recent blocks (admin-gated). `?scope`, `?limit` (1–200).

**`POST /api/admin/registry/dvn-blocks?seal=all`** — bulk seal-if-threshold across all open scopes.

**`POST /api/admin/registry/dvn-blocks?seal=<scope>`** — operator force-seal (admin override regardless of threshold).

**`services/registry/mintSaga.ts::receipt_emitting`** — flipped from placeholder to real emission:
- Idempotent: recorded `event_id` in `idempotency_keys.receipt_emitted` short-circuits re-emit on saga resume.
- Failure path: advances to `receipt_pending` (transient state) so the reconciler retries.
- Emits `event_type='mint_canonized'`, `receipt_mode='sync'`, metadata carries `iqube_id`, `saga_id`, and the chain anchor recorded in the earlier `chain_minting` step.

**`/api/registry/canonization/[id]` PATCH approve** — emits `event_type='iqube_canonized'` DVN receipt BEFORE kicking off the saga. Receipt failure is non-fatal; saga still triggers.

### C26 — DVN Receipts tab live

`app/triad/components/codex/tabs/IQubeRegistryReceiptsTab.tsx`:

Two stacked sections:

1. **Filters + Receipts table** — 5 query filters (iqube_id, cartridge, primitive_type dropdown, block_id, source dropdown), live source counts, results table with colour-coded source badge, receipt_id + iqube_id (truncated), event_type / receipt_kind, mode, cartridge, timestamp.
2. **Recent Blocks** — table with block #, scope, status badge (open/sealed/anchored/failed), receipt count, batch hash preview, opened + sealed timestamps. **Click a block row → auto-filters the receipts table by that block_id**. "Seal at threshold" button calls the bulk seal-if-threshold endpoint.

Wired into `TabRenderer.componentRegistry`; `iqube-registry-receipts` tab in `data/codex-configs.ts` upgraded from `PlaceholderTab`. **5 of 7 iqube-registry tabs now functional.**

---

## Smoke-test path

Once Amplify deploys, the next operator action that emits a receipt (canonization approval, mint saga, etc.) will:

1. Insert into `orchestration_events` with `iqube_id` populated
2. Append to `dvn_receipt_blocks` (opens block #1 for the scope if none open)
3. Surface in the DVN Receipts tab immediately

```bash
# Inspect receipts (no filter — most recent 100)
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://dev-beta.aigentz.me/api/registry/receipts?limit=20 | jq '.sources, .total'

# Filter to one iQube
IQ_ID="<uuid>"
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://dev-beta.aigentz.me/api/registry/receipts?iqube_id=$IQ_ID" | jq

# List recent blocks
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://dev-beta.aigentz.me/api/admin/registry/dvn-blocks?limit=10 | jq

# Manually seal at threshold (auto-cadence)
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://dev-beta.aigentz.me/api/admin/registry/dvn-blocks?seal=all | jq
```

In the cartridge UI:

```
https://dev-beta.aigentz.me/triad/embed/codex/iqube-registry/receipts
```

You should see filter controls + (after first receipt-eligible emission) one or more rows in the receipts table + Block #1 for `platform` scope.

---

## Authority matrix — Stage 6 state

| Domain | Authority | Stage 6 state |
|---|---|---|
| Receipt emission | `services/orchestration/orchestrationEvents.ts::emitOrchestrationEvent` | ✅ Sole writer; now also appends to dvn_receipt_blocks ledger |
| Block ledger append | `services/registry/dvnBlocks.ts::appendReceiptToBlock` | ✅ Idempotent; never decides allow/deny; never reads secrets |
| Block sealing | `services/registry/dvnBlocks.ts::sealOpenBlock` | ✅ Operator-triggered + auto-cadence; deterministic batch_hash for replay |
| Cross-source query | `GET /api/registry/receipts` | ✅ Unified orchestration_events + content_qube_dvn_receipts; T0 omitted |
| Mint receipt | `mintSaga.receipt_emitting` step | ✅ Real emission (was Stage 5 placeholder) |
| Canonization receipt | `/api/registry/canonization/[id]` PATCH | ✅ Real emission |
| `services/registry/receiptEmitter.ts` (ingestion) | Independent legacy writer | Unchanged — still writes its own `registry_receipts` table; convergence onto orchestration_events is a separate cleanup PR (per Stage 0 audit D7 30-day window) |
| `bridge-core/dvnReceiptService.ts` | Clawhack subsystem | Unchanged (retain-with-mirror confirmed; mirror endpoint can land in cleanup PR) |

---

## What downstream stages wire in

- **Stage 7 (AigentQube governance + card refresh)**:
  - `mintSaga.card_publishing` step still has `deferred_to_stage_7` marker; flip to a real card refresh that re-derives `/api/iqubes/[id]/card` from the canonical resolver.
  - AigentQube cards gain a `governance` block (KNYT framework §10/11/12/14 — `root_agent_id`, `deployment_id`, `charter`, `trust_band`, payment_authority).
  - Non-content primitive chain mints wire into `mintSaga.token_qube_created → chain_minting`.
- **Stage 9 (Phase 2 stubs)** — `services/registry/phase2/*` interfaces only.
- **Action Vocabulary tab** + **Docs tab** — can land anytime as thin tabs.
- **Cleanup PR** — delete `useOwnedEntitlements.ts` + `/api/codex/owned` after observation window (ends 2026-06-30); converge `receiptEmitter.ts` onto orchestration_events.

---

## Branch state

35 commits on `claude/dreamy-gates-mMqNv` since dev merge:

```
PRD v0.1 → v1.1                                    (4 docs)
Stage 0 audit + row counts + orphan flags            (3 commits)
Stage 1 — schema + types                            (5 commits + close)
Stage 2 — resolver + projections + backfill + CI    (4 commits + close)
Stage 8 partial — Browse/Health/Mints/slug          (4 commits + close)
Stage 1→2 transition + slug fix
Stage 3 — lifecycle state machine + Canonization    (2 commits)
Stage 4 — legacy migration                          (2 commits + close)
Stage 5 — mint saga + routes + tab section          (3 commits + close)
Stage 6 — block ledger + writer + query + tab       (3 commits + close)
```

5/7 iqube-registry cartridge tabs functional. Remaining 2: Action Vocabulary, Docs (both low-priority placeholders).

Continuing to Stage 7 next.

---

**End of Stage 6 close report.**
