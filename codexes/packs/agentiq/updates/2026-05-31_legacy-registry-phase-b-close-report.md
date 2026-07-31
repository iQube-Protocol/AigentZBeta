# Legacy `/registry` Integration — Phase B Close Report

**Status:** Phase B complete on `claude/dreamy-gates-mMqNv`. Every legacy write surface (create / fork / edit / mint / library / delete / cart) now flows through the canonical API. The mint mock is replaced by the Stage 5 saga. The cart is a real batch-mint orchestration.
**Date:** 2026-05-31
**Phase B commits:** `260bff88` (B1), `a0eb7a7c` (B2), `21f33b45` (B3), `687b1f35` (B4), `ef40b254` (B5), `474548c5` (B6), `a6611ee7` (B7+B8), `00b28726` (B9 caller swaps), `<this commit>` (B10 close report).
**Plan:** `codexes/packs/agentiq/updates/2026-05-31_legacy-registry-canonical-integration-plan.md` §Phase B.

---

## What shipped — Phase B (write path + mint canonicalisation + batch mint)

### B1 — `POST /api/registry/iqube` accepts the full legacy template surface

Extended `app/api/registry/iqube/route.ts`:
- New optional body fields: `business_model`, `price`, `score_axes{sensitivity,accuracy,verifiability,risk}`, `blakqube_labels`, `meta_extras`, `parent_template_id`, `identity_state`, `min_reputation_bucket`, `require_human_proof`, `require_agent_declare`, `instance_type`, `visibility_state`
- Legacy extras fold into `iq_meta_qubes.metadata.legacyTemplateExtras` (JSONB; no schema migration)
- `score_axes` upsert into `iqube_scores` with `derivation_strategy='operator_override_v1'` and per-axis `*_source='operator_override'` — preserves the score backfill's operator-override-is-sacred contract
- Response echoes `extras_persisted` + `scores_overridden`

### B2 — `POST /api/registry/iqube/[id]/fork`

New route `app/api/registry/iqube/[id]/fork/route.ts`:
- Resolves parent via internal projection → reads parent's `iq_meta_qubes` row
- Auto-increments provenance (`parent.provenance + 1`)
- Carries `parentTemplateId` + `forkOriginIqubeId` in `legacyTemplateExtras` (template_lineage population)
- Copies parent's tags / description / business_model / blakqube_labels / identity hints into the new draft's metadata
- Inherits parent's score block as operator overrides (strategy `fork_inherit_v1`) — forks ship with scores; operator can edit them
- Emits `orchestration_events` with `event_type='iqube_forked'`
- Auth: admin OR partner

### B3 — `PATCH /api/registry/iqube/[id]`

New PATCH handler on `app/api/registry/iqube/[id]/route.ts`:
- Updates `name / description / tags / preview_url` on `iq_meta_qubes`
- Merges editable extras into `metadata.legacyTemplateExtras`
- Score axes upsert into `iqube_scores` with `operator_override_v1` strategy
- Emits `orchestration_events` with `event_type='iqube_edited'` + `fields_touched` + `scores_overridden`
- Lifecycle transitions are explicitly NOT in scope (those go through Stage 3 canonization + Stage 5 mint saga; PATCH covers display / metadata / score edits only)
- Auth: admin OR partner

### B4 — Replace mock mint with the Stage 5 saga

`components/registry/IQubeDetailModal.tsx`:
- Mint button now calls `POST /api/registry/iqube/[id]/mint` via `personaFetch` (spine-gated; raw fetch returns 401)
- Body `{ visibility }` is stashed on `mint_sagas.idempotency_keys.visibility` for the saga or follow-up consumer
- Handles saga response shape (terminal+complete = success toast; pending = progress toast; failure = error toast)

`app/api/registry/iqube/[id]/mint/route.ts`:
- Accepts optional `{ visibility }` body
- After `startSaga`, persists `idempotency_keys.visibility` on the row before driving

### B5 — Library add → canonical audit trail

`app/api/registry/library/route.ts`:
- Existing `user_library` table mechanism preserved (multi-user friendly — one canonical iQube can be in many users' libraries)
- New: every successful add emits `orchestration_events` with `event_type='iqube_library_added'` + `iqube_id` correlation so the canonical resolver can report library-member counts in Phase C

**Plan deviation:** The plan suggested PATCHing `visibility_state='unlisted'` on every library-add. That would break the multi-user model — multiple users sharing a public template each adding it to their library shouldn't collectively make it unlisted. Per-user membership via `user_library` is the correct shape and stays.

### B6 — DELETE → canonical revocation request

New route `app/api/registry/iqube/[id]/revoke/route.ts`:
- Submits a `iqube_canonization_requests` row marked with `[REVOKE]` prefix in `decision_notes` (sidesteps a schema migration; Phase C can add a dedicated `action` column if revocation volume warrants)
- 409 if a request is already in flight (single in-flight per iqube)
- Emits `orchestration_events` with `event_type='iqube_revoke_requested'`
- Approval gated to platform-admins via existing `PATCH /api/registry/canonization/[id]` (Stage 3 contract — no change)

`components/registry/RegistryHome.tsx`:
- Confirm dialog re-labelled: title `Request Revocation`, body explains the iQube remains in the registry until admin approval, no hard delete
- Toast confirms `Revocation requested. Awaiting platform-admin approval.`

### B7 — `POST /api/registry/iqube/mint-batch`

New route `app/api/registry/iqube/mint-batch/route.ts`:
- Validates every `iqube_id` exists in `iqube_id_map` atomically before any saga starts (HTTP 400 with `missing[]` if any unknown)
- Caps at 100 ids per batch
- Calls `startSaga()` per id (idempotent — existing in-flight sagas are reused)
- Stashes `batch_id` + `visibility` on each saga's `idempotency_keys`
- Drives sagas in parallel via `Promise.all` (one failure doesn't block the rest)
- Returns `{ batch_id, sagas[], summary{total,completed,pending,failed}, visibility_choice }`
- Emits ONE `orchestration_events` row with `event_type='mint_batch_initiated'` + `metadata.{batch_id, iqube_ids, summary}` — per-iqube saga receipts still emit individually from saga steps, so the batch is auditable AS A UNIT and per-iqube
- Auth: admin only (matches single-mint gate)

### B8 — Cart UI wiring

`components/registry/RegistryHome.tsx`:
- Cart counter chip is now a clickable button (disabled when empty)
- Click opens a batch-mint confirm dialog with Public/Private radio (same affordance as single mint)
- On confirm: `POST /api/registry/iqube/mint-batch` via `personaFetch`
- Toast surfaces the batch summary; clears the cart on initiation (sagas are idempotent so retry-by-re-add is safe)
- Refetches the list so newly-minted records reflect their state

### B9 — Swap remaining legacy write callers

- `AddIQuBeForm.tsx` create → `POST /api/registry/iqube`
- `IQubeDetailModal.tsx` fork → `POST /api/registry/iqube/[id]/fork`
- `IQubeDetailModal.tsx` edit-save → `PATCH /api/registry/iqube/[id]`

All three use `personaFetch` per CLAUDE.md's spine-gated client rule.

---

## Authority compliance

| Authority | Phase B behaviour |
|---|---|
| Identity spine | All write routes call `getActivePersona`; no parallel resolver |
| Access spine | Admin / partner gates enforced server-side; no client-trusted role checks |
| Resolver | Read path unchanged; write surface delegates to triad service + canonization queue |
| Lifecycle authority | Canonization queue (Stage 3) decides revoke; mint saga (Stage 5) drives mint state; PATCH never transitions lifecycle |
| Score block | Operator overrides preserved on every write; per-axis `*_source='operator_override'` flag set |
| Receipt emission | Every write produces `orchestration_events` row; mint produces saga events + DVN receipts via existing Stage 6 plumbing; batch mint adds ONE batch-level row + N per-iqube rows |
| Hard-delete | Eliminated — DELETE now requests revocation; canonical record persists |

No spine files modified. No access gates removed. Stage 3 lifecycle authority preserved.

---

## What changed for the operator

Visible:
- "Delete" button → "Request Revocation" with explanatory description
- Cart counter → clickable batch-mint button with Public/Private dialog
- Mint button now reflects saga state (progress toast for pending; not just success/fail)

Invisible (audit + correctness):
- Every create / fork / edit / mint / library-add / delete now produces an `orchestration_events` row with `iqube_id` correlation
- Batch mints are atomically auditable via one `mint_batch_initiated` event with the `batch_id` correlating to N per-iqube saga receipts
- Operator score overrides are preserved on every PATCH (per-axis source flag prevents accidental re-derivation overwrite)
- Provenance auto-increments on fork (no more client-computed lineage)
- Revocation never hard-deletes the canonical record

---

## What's deferred to Phase C

| Surface | Phase C work |
|---|---|
| Shared components | Lift `IQubeCard` / `IQubeDetailModal` / filter primitives into `components/registry/_shared/` so cartridge surfaces consume the same components |
| Analytics page | Full retirement (banner already shipped in Phase A; banner becomes a 302 redirect) |
| Legacy API routes | Retire `GET/POST/PUT/DELETE /api/registry/templates`, `GET /api/registry/templates/[id]` after observation window |
| Adapter fallbacks | Remove `legacyAdapter.ts` fallback paths to `/api/registry/templates/*` |
| Per-user library count surface | Use `iqube_library_added` orchestration_events to roll up per-iqube library membership counts on the cartridge view |
| Revoke action column | If revocation volume warrants, add a dedicated `action` column to `iqube_canonization_requests` and stop relying on the `[REVOKE]` notes prefix |
| Visibility_state on iqube_id_map | Surface a column on the canonical record so the saga can flip it post-MINT_COMPLETE; today the `visibility` choice lives on `idempotency_keys.visibility` only |
| Resolver list pagination + search | Phase A flagged these; Phase C is the natural window |

Plan: `2026-05-31_legacy-registry-canonical-integration-plan.md` §Phase C (5 commits, ~2–3 days).

---

## Branch state

54 commits on `claude/dreamy-gates-mMqNv` since dev merge:

```
PRD v0.1 → v1.1                                    (4 docs)
Stage 0 audit                                       (3 commits)
Stage 1                                             (5 + close)
Stage 2                                             (4 + close)
Stage 8 partial                                     (4 + close)
Stage 3                                             (2 commits)
Stage 4                                             (2 + close)
Stage 5                                             (3 + close)
Stage 6                                             (3 + close)
Stage 7                                             (1 + close)
Stage 9                                             (1 + close)
Vocabulary + Docs tabs                              (1 commit)
ECONNRESET retry trigger                            (1 commit)
Lambda file-trace fix + dependency hygiene backlog  (1 commit)
Legacy /registry integration plan                   (1 + 1 update + 2 backlog items)
Score Data Backfill                                 (4 + close report)
Legacy /registry integration Phase A                (5 + close report)
Legacy /registry integration Phase B                (9 + this close report)
```

---

**End of Legacy `/registry` Phase B close report.**
