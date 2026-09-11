# Stage 3 + 4 Close Report — Lifecycle state machine + legacy migration complete

**Status:** Stage 3 + Stage 4 complete on `claude/dreamy-gates-mMqNv`. 4 of 7 iqube-registry cartridge tabs now live (Browse, Health, Mints+Sagas, Canonization). All 5 legacy `useOwnedEntitlements` consumers migrated to registry-backed hooks.
**Date:** 2026-05-31
**Branch commits this batch:** `07018759` (S3 C16), `045d5b62` (S3 C17), `67384eb0` (S4 C18), `77fca8d6` (S4 C19).

---

## Stage 3 — Lifecycle state machine

### C16 — `services/registry/lifecycle.ts` + tests

The full universal state machine + per-transition rules + ContentQube and surface mappers. ~370 LOC.

Three enums codified:

- **Universal internal** (9 states): `draft → wip → review_pending → published → canonized → deprecated → revoked → new_version_pending → abandoned`
- **ContentQube internal** (8 states from `content_qubes.lifecycle_state`): mapped INTO universal via `CONTENT_QUBE_TO_UNIVERSAL_MAP` per the operator-confirmed default (Stage 1→2 transition doc)
- **Surface** (5 states from shipped legibility enum): derived from universal via `internalToSurface()` per PRD v1.1 §B.2 — `published` and `canonized` both collapse to surface `canonized`, governance distinction stays on internal

API:
- `validateTransition(from, to)` — pure graph validator
- `transitionRule(from, to)` — table lookup returning the rule row (initiator, approval, receipt action/mode, chain interaction, descriptor side effect, payload access change, reversibility)
- `decideTransition(from, to)` — composite: validate + rule + surface_after
- `mapContentQubeInternalToUniversal(raw)` — substate map (with default to `draft` on unknown)
- `internalToSurface(universal)` — surface derivation

15 transition rules covering every graph edge. Notable encoded rules:
- **Canonization** (`published → canonized`) requires operator + human approval + sync `canonize` receipt + chain interaction (Stage 5 saga executes the chain side).
- **Revocation** is `platform_admin` only and carries `payload_access_change: true`.
- **Tombstone descriptor transitions** always emit sync receipts.
- **Canonized → wip is rejected** — PRD §6.2 "no uncanonize".

Tests:
- `tests/registry-lifecycle.test.ts` — graph/rules consistency, transition behaviour, per-rule invariants, surface mapping totality, ContentQube substate coverage, decideTransition composite.
- `tests/registry-lifecycle-clarity.test.ts` — PRD v1.1 §B.2 collapse: published + canonized both surface canonized; admin projection preserves internal distinction; cartridge projection doesn't leak it.

`contentQubeAdapter.ts` refactored: removed the inline ContentQube → universal mapper (Stage 2 stopgap), now delegates to `lifecycle.ts`. Added a soft-drift `console.warn` if the legibility `mapLifecycleState` ever disagrees with the state-machine's surface derivation.

### C17 — Canonization Queue API + tab live

API:
- `GET /api/registry/canonization?status=<pending|approved|rejected|withdrawn>` — admin-gated list. T0 persona IDs intentionally omitted from the SELECT.
- `POST /api/registry/canonization` — submit request. Validates iqube_id exists in `iqube_id_map`, rejects duplicate pending (HTTP 409).
- `PATCH /api/registry/canonization/[id]` — approve/reject. Approve path: loads request → map entry → for ContentQubes reads current `content_qubes.lifecycle_state`, maps to universal, validates `published → canonized` via `decideTransition()`. On success: updates `content_qubes.lifecycle_state = 'canonized'` + `internal_lifecycle` + `surface_lifecycle`, marks request approved with `decided_by` + `decided_at`. Stage 6 wires the `orchestrationEvents.emitDecisionReceipt({ action: 'canonize', mode: 'sync', ... })` call (placeholder marked in handler comments).

Tab — `IQubeRegistryCanonizationTab.tsx`:
- Status sub-tabs (pending / approved / rejected / withdrawn)
- Per-row Approve/Reject buttons with notes input
- Surfaces `payment_authority_proposed` flag for AigentQube requests (v1.1 §B.6)
- Refresh + status feedback
- Wired into `TabRenderer` + `data/codex-configs.ts` replacing the PlaceholderTab

**4 of 7 iqube-registry tabs functional:** Browse (Stage 8 C13), Health (C13), Mints+Sagas (C14), Canonization (Stage 3 C17). Remaining 3 (DVN Receipts, Action Vocabulary, Docs) wait for Stage 6 or operator priority.

---

## Stage 4 — Legacy `useOwnedEntitlements` migration

PRD v1.0 §10 Stage 4: migrate the 5 remaining `useOwnedEntitlements` consumers off `/api/codex/owned`. Done via two focused replacement hooks.

### C18 — `useEntitlementsList` (wallet surfaces, 2/5)

Minimal hook calling `/api/entitlements/list` directly. Returns `{ entitlements, loading, error, refresh }`. No SKU expansion, no registry call, no dependency on the deprecated `/api/codex/owned`.

Migrated:
- `app/components/content/SmartWalletDrawer.tsx:329` — wallet drawer library list
- `app/triad/components/SmartWalletPanel.tsx:44` — wallet panel library list

Both surfaces only consumed `entitlements + loading + refresh`. Identical shape, smaller import.

### C19 — `useRegistryOwnedItems` (store/grid surfaces, 3/5)

Wraps `useContentQubeSeriesRights('metaKnyts', { personaId })` and derives the full legacy helper surface from the registry's persona-aware response. Preserves the legacy shape (`ExpandedItem`, `ownedAssetIds`, `ownedEpisodeNumbers`, `ownedCharacterIds`, `ownedGnVariants`, `isEpisodeOwned`, `isCharacterOwned`, `isCharacterOwnedByEp`, `isGnVariantOwned`) so store/grid consumers swap with a one-line import + one-line call change.

`expandedItems` derivation honors `manifest.is_placeholder` for SKU-rights coming-soon items — same semantic the legacy hook had via `/api/codex/owned`. `ownedGnVariants` reuses `types/knyt-store.ts::getOwnedGnVariants`; bundle-SKU lookup logic unchanged.

Migrated:
- `app/triad/components/codex/tabs/KnytStoreEpisodesTab.tsx:29,648` — uses `isEpisodeOwned + isGnVariantOwned`
- `app/triad/components/codex/tabs/KnytStoreCardsTab.tsx:16,294` — uses `ownedAssetIds + isCharacterOwnedByEp`
- `app/triad/components/content/KnytCardsGrid.tsx:23,132` — uses `isCharacterOwned`

### Verification

```bash
grep -r 'useOwnedEntitlements' --include='*.tsx' --include='*.ts' app/
```

Returns only:
- `app/hooks/useEntitlementsList.ts` — docstring reference
- `app/hooks/useOwnedEntitlements.ts` — the deprecated file itself
- `app/hooks/useRegistryOwnedItems.ts` — docstring reference
- `app/triad/components/codex/tabs/KnytShelfTab.tsx` — comment reference (Phase B migration history)
- `app/triad/components/codex/tabs/useContentQubeSeriesRights.ts` — docstring reference

**Zero live `import` or hook-call sites in `app/`.** Migration is complete.

### Deprecation note + cleanup checklist

The legacy `useOwnedEntitlements` hook + `/api/codex/owned` route stay in the tree for one 30-day observation window. The hook's deprecation banner updated to document the cleanup checklist:

1. Confirm no new callers via grep (already true)
2. Confirm `/api/codex/owned` receives zero traffic via Amplify/Vercel logs
3. Operator-approved cleanup PR deletes both files in the same commit

Recommended observation window end: 2026-06-30.

---

## Authority matrix — Stage 3+4 state

| Domain | Authority | Stage 3+4 state |
|---|---|---|
| Lifecycle transitions | `services/registry/lifecycle.ts` | ✅ Codified; validateTransition + decideTransition are the only callable APIs; resolver/canonization handler never reimplement |
| ContentQube → universal substate mapping | `lifecycle.ts::mapContentQubeInternalToUniversal` | ✅ One mapper; contentQubeAdapter delegates; inline copy removed |
| Surface lifecycle (5-state) | `lifecycle.ts::internalToSurface` | ✅ Single canonical derivation; legibility cardBuilder has its own (kept for parity); soft-drift warning if they diverge |
| Canonization approval | `iqube_canonization_requests` table + PATCH handler | ✅ Live; spine-gated; T0 columns never selected; CI grep should add this table to the "no direct SELECT" rule |
| Wallet ownership API | `userOwnsAsset()` | Unchanged — Stage 4 hooks never reimplement; `useRegistryOwnedItems` consumes `persona_owns` from registry endpoint which goes through `evaluateAccess` |
| Wallet library list | `/api/entitlements/list` | Unchanged — `useEntitlementsList` is the new direct consumer |

---

## What remains — stage-by-stage forecast

Per the operator's "work through the stages" direction:

| Stage | Scope | Effort | Notes |
|---|---|---|---|
| **Stage 5** | Mint saga (idempotency + outbox + retry + compensation) — `services/registry/mintSaga.ts` driving `mint_sagas` table | 3–4 days | Subscribes to Canonization Queue approval receipt (Stage 3 wired the placeholder); executes ContentQube edition mint via existing `baseTokenMint.ts`. Adds the saga state surface to the Mints+Sagas tab. |
| **Stage 6** | DVN block ledger + sealer worker + receipts tab — `services/registry/dvnBlocks.ts` + worker + `GET /api/registry/receipts` + `IQubeRegistryDvnReceiptsTab` live | 3–4 days | Block sealer cadence already configured via `registry_config` table from Stage 1. Sealer worker uses the Stage 1 advisory-lock + unique-partial-index design. |
| **Stage 7** | AigentQube governance + legibility extension — adds `governance` block to AigentQube cards via `aigentQubeAdapter` extension + legibility schema additions | 2–3 days | KNYT framework §10/11/12/14 (root_agent_id / deployment_id / charter / trust band) populated from future `aigent_qubes` table; until then, the `defaultGovernance()` already-shipped in Stage 2 C7 is the placeholder. |
| **Stage 9** | Phase 2 stubs — interfaces at `services/registry/phase2/*` (intent / calibration / risk / value / pricing / exchange) — no runtime | 1–2 days | Stub-only. Operator drives Phase 2 work in a separate PRD later. |
| **Action Vocabulary tab** | Live thin list view over `actionMap.ts` | <1 day | Can land anytime. |
| **Docs tab** | Markdown reader for PRD trail | <1 day | Can land anytime. |
| **Cleanup PR** | Delete `useOwnedEntitlements.ts` + `app/api/codex/owned/route.ts` | <1 day | Gated by 30-day observation window ending 2026-06-30. |

Total remaining estimate: ~10–13 working days for Stages 5/6/7/9 + tabs + cleanup.

---

## Branch state

29 commits on `claude/dreamy-gates-mMqNv` since the dev merge. Stage trail complete:

```
PRD v0.1 → v1.1 (4 docs)
Stage 0 audit + follow-up (3 commits)
Stage 1 — schema + types (5 commits + close report)
Stage 2 — resolver + projections + backfill + CI gates (4 commits + close report)
Stage 8 partial — Browse + Health + Mints + cartridge slug (4 commits + close report)
Stage 1→2 transition doc + slug fix
Stage 3 — lifecycle state machine + Canonization Queue (2 commits)
Stage 4 — legacy migration (2 commits + this close report)
```

---

**End of Stage 3 + 4 close report. Continuing with Stage 5 next per "work through the stages" direction.**
