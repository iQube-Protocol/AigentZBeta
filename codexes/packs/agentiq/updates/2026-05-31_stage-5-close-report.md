# Stage 5 Close Report — Mint saga state machine + Mints+Sagas tab live with saga status

**Status:** Stage 5 complete on `claude/dreamy-gates-mMqNv`. Mint saga state machine implemented with idempotency + retry + outbox; canonization-approval flow now kicks off a saga automatically; Mints+Sagas tab gained a live Saga Status section.
**Date:** 2026-05-31
**Branch commits this batch:** `e85d7806` (S5 C20+C21), `<this commit>` (S5 C22 tab + C23 close).

---

## What Stage 5 delivered

### C20 — `services/registry/mintSaga.ts` (~410 LOC)

Full saga state machine per PRD v1.0 §7 + v1.1 §B.12. 12 happy-path states + 6 failure/pending states.

State graph:

```
unminted
  → registry_draft_created
  → payload_encrypted
  → payload_uploaded                  [retry; failure → payload_upload_failed]
  → token_qube_created
  → chain_minting                     [bounded retry; failure → mint_failed]
  → chain_minted
  → anchor_persisted                  [retry; failure → anchor_persist_failed]
  → receipt_emitting                  [retry; failure → receipt_pending]
  → receipt_emitted
  → card_publishing                   [retry; failure → card_publish_pending]
  → card_published
  → MINT_COMPLETE
```

API:
- `startSaga({ iqube_id, initiated_by_persona_id })` — idempotent on iqube_id; returns existing in-flight saga if any
- `advanceSaga(saga_id)` — runs one step
- `driveSagaToCompletion(saga_id)` — loops to terminal / failure / pending. Hard-capped at 25 iterations (runaway guard).
- `reconcilePendingSagas()` — bulk advance for `*_pending` states. Returns `{ processed, advanced, still_pending, failed }`.
- `listRecentSagas(limit)` — feed for the tab.

Idempotency contract: every step records an entry in `idempotency_keys` JSONB. Re-running from the same state short-circuits on the recorded key. **Chain step records the txHash there** — so a crash mid-call leaves the saga at `chain_minting` with the txHash already recorded; the next reconcile run reads the txHash and advances to `chain_minted` **without re-broadcasting**. Loud doc comments: no chain rollback ever attempted.

Per-step behaviour:
- `unminted → registry_draft_created` — verifies `iqube_id_map` row exists
- `registry_draft_created → payload_encrypted` — no-op for Stage 5 (encryption happens at content-upload time for ContentQubes)
- `payload_encrypted → payload_uploaded` — Autonomys upload deferred (existing KNYT persona mint route handles its case)
- `payload_uploaded → token_qube_created` — no-op for editioned content
- `token_qube_created → chain_minting → chain_minted` — **ContentQubes route through `baseTokenMint.mintMasterQube`** which already handles pre-deploy gracefully (`skipped='contract_unconfigured'` until contracts deploy). Non-content primitives advance with `non_content_primitive_stage7` marker; Stage 7 wires those.
- `chain_minted → anchor_persisted` — `mintMasterQube` persists txHash itself; this step is observational
- `anchor_persisted → receipt_emitting → receipt_emitted` — DVN receipt deferred to Stage 6 (`orchestrationEvents.emitDecisionReceipt`); saga advances with `deferred_to_stage_6` marker
- `receipt_emitted → card_publishing → card_published` — agent card refresh deferred to Stage 7; saga advances with `deferred_to_stage_7` marker
- `card_published → MINT_COMPLETE` — terminal

Authority compliance:
- Saga never SELECTs from `persona_token_qube_ownership` (Stage 4 hook is canonical reader)
- Saga never reimplements `evaluateAccess` or `userOwnsAsset`
- Saga emits no receipts directly — `orchestrationEvents` integration is Stage 6

### C21 — Routes

`POST /api/registry/iqube/[id]/mint`:
- Admin-gated. Calls `startSaga` + `driveSagaToCompletion`. Returns the final snapshot (current_state, retry_count, last_error, idempotency_keys, terminal/failure/pending flags).
- Idempotent: re-POST for the same iqube returns the existing saga snapshot. Failed sagas can be retried by POSTing again (state machine resumes from where it failed).

`GET /api/admin/registry/mint-sagas?limit=N`:
- List recent sagas (admin-gated, default 50, max 200).

`POST /api/admin/registry/mint-sagas`:
- Bulk-advance `*_pending` sagas. Returns `{ processed, advanced, still_pending, failed }`.

**Canonization wire-in** (`app/api/registry/canonization/[id]/route.ts`):
- The PATCH approve handler now fires `startSaga` + background `driveSagaToCompletion` on successful approval.
- Fire-and-forget — saga drives asynchronously; the approval response includes `saga_id` so the operator can poll the Mints+Sagas tab.
- Saga kickoff failure is non-fatal — operator retriggers via the mint route above.

### C22 — Mints+Sagas tab gets Saga Status section

`app/triad/components/codex/tabs/IQubeRegistryMintsTab.tsx`:

Added a Saga Status section below the existing `CanonicalMintPanel`:
- Reads `GET /api/admin/registry/mint-sagas?limit=20` on mount + manual refresh.
- Table per saga: saga_id (first 8), iqube_id (first 8), state (colour-coded badge with check/alert/clock icon), retry count, updated timestamp, last_error.
- "Reconcile pending" button triggers `POST /api/admin/registry/mint-sagas`; shows `Reconciled N sagas — M advanced, P still pending, Q failed.` summary.
- Loading + error states.
- Existing CanonicalMintPanel + series selector unchanged.

---

## Smoke-test path (once Amplify deploys)

```bash
# 1. Make sure token is fresh
export ADMIN_TOKEN="<fresh-bearer>"

# 2. Submit + approve a canonization request (Stage 3 path; sets up the saga trigger)
# - In the Canonization Queue tab, submit then approve a request
# - The approve response includes saga_id

# 3. Open Mints+Sagas tab — scroll to "Mint Sagas" section
# - You should see the just-created saga
# - For ContentQubes it should reach MINT_COMPLETE (with chain_minting
#   recorded as skipped='contract_unconfigured' if Base contracts aren't
#   deployed in your env — that's normal pre-deploy behaviour)

# 4. Alternative: start a saga manually
IQ_ID="<some-iqube-uuid>"
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://dev-beta.aigentz.me/api/registry/iqube/$IQ_ID/mint" | jq

# 5. List recent sagas
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://dev-beta.aigentz.me/api/admin/registry/mint-sagas?limit=10" | jq
```

Expected for a ContentQube on a pre-deploy env:
- saga reaches `MINT_COMPLETE` in one drive call
- `idempotency_keys.chain_minting = { skipped: 'contract_unconfigured' }`
- `idempotency_keys.receipt_emitting = { deferred_to_stage_6: true }`
- `idempotency_keys.card_publishing = { deferred_to_stage_7: true }`

Once Base contracts deploy + env vars are set, the same saga (or a re-run) executes the real chain mint.

---

## What this enables for downstream stages

- **Stage 6 (DVN block index + receipts tab)** — the saga's `receipt_emitting` step is the point where `orchestrationEvents.emitDecisionReceipt({ action: 'mint', mode: 'sync', iqube_id, ... })` plugs in. Stage 6 modifies that single step.
- **Stage 7 (AigentQube governance + legibility extension)** — the saga's `card_publishing` step is where card refresh triggers; Stage 7 makes that call. Stage 7 also wires non-content primitive chain mints into `token_qube_created → chain_minting`.
- **Operator UX** — the Mints+Sagas tab already surfaces failed/pending sagas. Stage 6 adds receipt linkage; Stage 7 adds chain-anchor visibility.

---

## Branch state

31 commits on `claude/dreamy-gates-mMqNv` since dev merge. Stage trail:

```
PRD v0.1 → v1.1                          (4 docs)
Stage 0 audit + row counts + orphan flags (3 commits)
Stage 1 — schema + types                 (5 commits + close report)
Stage 2 — resolver + projections + backfill + CI gates  (4 commits + close report)
Stage 8 partial — Browse/Health/Mints/cartridge slug  (4 commits + close report)
Stage 1→2 transition + slug fix
Stage 3 — lifecycle state machine + Canonization Queue  (2 commits)
Stage 4 — legacy migration              (2 commits + close report)
Stage 5 — mint saga + routes + tab section (3 commits + this close report)
```

---

## Remaining stages (per "work through the stages")

| Stage | Scope | Est | Notes |
|---|---|---|---|
| **Stage 6** | DVN block ledger + sealer worker + receipts tab live | 3–4 days | Wires the `dvn_receipt_blocks` Stage 1 tables; flips saga `receipt_emitting` to a real emission |
| **Stage 7** | AigentQube governance block on cards + non-content chain mint wiring | 2–3 days | KNYT framework §10/11/12/14 fields; saga's `card_publishing` becomes real |
| **Stage 9** | Phase 2 stubs — `services/registry/phase2/*` interfaces only | 1–2 days | No runtime |
| **Action Vocabulary tab** | Thin list view over `actionMap.ts` | <1 day | |
| **Docs tab** | Markdown reader | <1 day | |
| **Cleanup PR** | Delete `useOwnedEntitlements.ts` + `/api/codex/owned` | <1 day | Gated by observation window ending 2026-06-30 |

Continuing to Stage 6 next.

---

**End of Stage 5 close report.**
