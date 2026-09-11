# Stage 1 Close Report — Canonical iQube Registry Operating Plane

**Status:** Stage 1 complete on `claude/dreamy-gates-mMqNv`. Ready for operator review + dev Supabase migration apply. Stage 2 (resolver) gated on operator sign-off of the operator-action checklist below.
**Date:** 2026-05-30
**Branch commits (this stage):** `d502512f`, `090ebbe7`, `3d4cbab4`, `319dac60`, `53884b56`.
**Reads with:** PRD v1.0 + v1.1 + Stage 0 audit (with operator-confirmed live row counts).

---

## What Stage 1 delivered (5 commits)

### C1 — Drop `LiquidUITemplateArchetypeQube` + reclassify 20 seeds + add `ClusterQube`

| File | Change |
|---|---|
| `types/registry.ts` | `IQubeType` loses `'LiquidUITemplateArchetypeQube'`, gains `'ClusterQube'` (PRD v1.1 §B.14 fix — was missing from registry enum but present in legibility surface). |
| `app/api/registry/templates/store.ts` | All 20 seed records' `iQubeType: 'LiquidUITemplateArchetypeQube'` → `'DataQube'`. Adds `withLiquidUiCategory()` transformer in `getStore()` that injects `{ k: 'category', v: 'ui_template_archetype' }` into `metaExtras` for any template with id prefix `liquidui-template-`. Idempotent. |
| `app/api/registry/templates/route.ts` | Adds `?category=<value>` query param to both filter sites. Filters by `metaExtras.k='category'` equality. |
| `app/(shell)/content/demo/page.tsx` | Demo fetch updated: `?type=LiquidUITemplateArchetypeQube` → `?type=DataQube&category=ui_template_archetype` (primary + forceFallback). |

Forward-only. Reversible by revert (dev seeds, no chain anchor). Closes Stage 0 audit Deliverable 2 + checklist item #2.

### C2 — `services/iqube/legibility/actionMap.ts` (Stage 0 audit D4 critical gap)

The PRD v1.0 §4.3 mapping between `AccessAction` (internal spine) and `IQubeAgentAction` (legibility surface) was documented in the PRD but **not codified anywhere**. `cardBuilder.ts` did not import `AccessAction`. Stage 0 audit Deliverable 4 flagged this as a Stage 1 must-fix.

| File | Change |
|---|---|
| `services/iqube/legibility/actionMap.ts` | New file. `ACTION_SURFACE_MAP` (every `AccessAction` → `IQubeAgentAction` or `'internal_only'`). `SURFACE_INTERNAL_MAP` (inverse for non-collapsing, non-passive). `PASSIVE_SURFACE_VERBS` (7 surface verbs with no internal). `MUTATING_SURFACE_VERBS` (drives card auth + DVN flags). Helpers: `surfaceForAccessAction`, `accessActionForSurfaceVerb`, `isPassiveSurfaceVerb`, `isMutatingSurfaceVerb`. |
| `tests/iqube-legibility-actionmap.test.ts` | New file. CI gate. Asserts: (1) every `AccessAction` keyed in map, (2) every `IQubeAgentAction` in passive set OR has inverse, (3) round-trip consistency for canonical pairs, (4) collapsing internals all map to same surface, (5) internal-only verbs never appear as inverse map values, (6) mutating verbs cover full state-changing internal surface. |

Review gate (PRD v1.1 §A.6) routes through the iQube Registry cartridge admin tab. Adding a verb to either vocabulary without updating this map fails the CI build. Closes Stage 0 audit Deliverable 4 + checklist item #4.

### C3 — Reserve `iqube-registry` cartridge slug + scaffold 7 stub tabs

| File | Change |
|---|---|
| `data/codex-configs.ts` | New `IQUBE_REGISTRY_CARTRIDGE` config + registration in `CODEX_DEFINITIONS`. Slug `iqube-registry` verified free in Stage 0 audit D5. 7 tabs (all wired to `PlaceholderTab` with descriptive copy explaining the post-stage target): browse (Stage 8), receipts (Stage 6), mints (Stage 5 — absorbs the existing `CanonicalMintPanel` per the 2026-05-29 backlog), canonization (v1.1 §A.7 queue), vocabulary (v1.1 §A.6 review surface), health (orphan / dual-write / backfill status), docs (PRD trail + legibility profile). |

Closes Stage 0 audit Deliverable 5 + checklist item #5.

### C4 — Canonical registry plane v1.0 schema migration

File: `supabase/migrations/20260530000000_registry_canonical_plane_v1_0_stage_1.sql` (~500 lines)

Purely additive — no existing table or column dropped or renamed. All new columns NULL-safe; running application code unaffected until Stage 2 resolver lands.

**7 new tables (with RLS service-role-only policies):**

| Table | Purpose | Key constraint |
|---|---|---|
| `iqube_id_map` | Canonical UUID → source-surface join. `synthetic=true` for code-only sources. `legacy_primitive_type` for one-rev rollback (v1.1 §A.2). | `UNIQUE (source, source_id)` |
| `persona_token_qube_ownership` | Per-persona ownership ledger. Read substrate for `userOwnsAsset()`. `persona_id` is T0. | `UNIQUE (token_qube_id, persona_id, acquired_at)` |
| `mint_sagas` | 18-state saga state machine (PRD v1.0 §7). Partial index on `*_pending` states for background reconciliation. | FK to `iqube_id_map` |
| `dvn_receipt_blocks` | Logical block ledger (PRD v1.0 §8.2 / v1.1 §B.5). Status: open → sealed → anchored. `inscription_id` populates post-ordinal. | `UNIQUE (cartridge_scope, block_number)` + `UNIQUE partial index WHERE status='open'` (v1.1 §B.7 single-open-block-per-scope enforcement) |
| `dvn_receipt_block_items` | Per-block receipt membership. `item_hash` + `batch_hash` deterministic SHA-256 (v1.1 §B.7). | `PRIMARY KEY (block_id, sequence_in_block)` + `UNIQUE (block_id, receipt_source, receipt_id)` for idempotent INSERT ON CONFLICT |
| `iqube_canonization_requests` | Operator approval queue (v1.1 §A.7). `payment_authority_proposed` AigentQube-only (v1.1 §B.6). | partial index on `pending` |
| `registry_config` | Runtime config (feature flags, sealer cadences). Seeded with 3 defaults. | `PRIMARY KEY (config_key)` |

**Additive columns on existing tables:**

- `content_qubes` → `iqube_id` (uuid) + `internal_lifecycle` + `surface_lifecycle`
- `registry_assets` → `iqube_id` (uuid) + `primitive_type` + `tool_subtype` + `wrapper_strategy` + `internal_lifecycle` + `surface_lifecycle`. **UPDATE statements collapse 23 rows from `asset_class` enum into `(primitive_type, tool_subtype)`** per PRD v0.2 §A.1.
- `iq_meta_qubes` → `iqube_id` (uuid)
- `orchestration_events` → `iqube_id` (text) + composite indexes on `(iqube_id, created_at DESC)` and `(actor_alias_commitment, created_at DESC)` for v1.0 §8.1 cross-primitive receipt queries.

**Seed:**

```
feature_flag.REGISTRY_CANONICAL_PLANE_V1_0     → false  (gate; operator flips post-Stage-2)
dvn_block_sealer.default.size_threshold        → 1000   (v1.1 §A.5)
dvn_block_sealer.default.time_threshold_ms     → 3600000  (1 hour)
```

Privacy contract enforced (v1.1 §B.4 acceptance):

- All `persona_id` columns annotated as T0 in COMMENTs.
- All 7 new tables ENABLE ROW LEVEL SECURITY with `service_role`-only policies.
- No `anon` or `authenticated` role can SELECT T0 fields.

Closes PRD v1.1 §B.4 / §B.5 / §B.7 / §A.3 / §A.5 / §A.7 / §B.12 + v0.2 §A.1.

### C5 — `CanonicalIQubeInternalRecord` + 4 projection view models

File: `types/registry-canonical.ts` (new, ~490 lines). Re-exported from `types/registry.ts`.

Type surface:

- `CanonicalIQubeInternalRecord` — full server-only shape. T0 fields explicitly commented. `blak_qube_id` documented as REFERENCE only.
- `RegistryAdminView` — operator console; persona IDs surface as `{ identity_state, alias_commitment }`.
- `RegistryCartridgeView` — T1-only; optional `caller_owns` / `caller_can_read` populated by resolver calling `userOwnsAsset()` / `evaluateAccess()`.
- `RegistryPublicView` — T2-only; only `visibility_state ∈ {public, public_meta_private_payload}` records project.
- `IQubeCard` — shipped legibility surface, unchanged (the fourth projection).
- `CanonicalToolBlock` — connector / endpoint / OPAQUE `secret_ref` (never the secret per v0.2 §B.11).
- `CanonicalAigentBlock` — KNYT three-layer identity (root / deployment / persona) + governance.
- `AigentQubeGovernance` — rights / constraints / obligations / revocation. `payment_authority` defaults null per v1.1 §B.6.
- `CanonicalClusterBlock` — member graph + 5 aggregation strategies per v0.2 §B.8.
- `IQubeInternalLifecycleState` — universal 9-state (PRD v1.0 §4.2).
- `MintSagaState` mirrors the SQL `mint_sagas.current_state` enum.
- `IQubeIdMapSource` enum mirrors the SQL `iqube_id_map.source` set.

No application code consumes these yet — the shape is the contract for Stage 2.

---

## Stage 0 sign-off checklist — final state

| # | Item | Status |
|---|---|---|
| 1 | Per-surface row counts | ✅ Closed in audit follow-up commit `e5f64dd2` + orphan findings folded `e9c0ac75`. |
| 2 | 20 LiquidUI seed reclassification | ✅ Closed by Stage 1 C1. |
| 3 | ~30 cartridge tab migration priority order | **Open** — needs operator confirmation. Stage 4 work targets the 5 still-on-legacy surfaces (`KnytStoreEpisodesTab`, `KnytStoreCardsTab`, `KnytCardsGrid`, `SmartWalletDrawer`, `SmartWalletPanel`); Stage 8 covers ~25 more. |
| 4 | `actionMap.ts` spec | ✅ Closed by Stage 1 C2 (file + tests). |
| 5 | `iqube-registry` cartridge stub | ✅ Closed by Stage 1 C3 (icon: `Database`, color: `violet`, 7 tabs). |
| 6 | `iqube/persona/qripto/mint/route.ts` disposition | **Open** — operator decision (remove vs retain). Recommend: tag as `@deprecated` in Stage 2 alongside the `app/api/registry/iqube/route.ts` mock replacement; remove after observation window. |
| 7 | `bridge-core/dvnReceiptService.ts` retain-with-mirror | **Open** — operator confirmation needed. Stage 0 audit Deliverable 7 recommended NOT deprecating this file (it's clawhack-internal); instead, mirror its writes into `orchestration_events`. Stage 6 implements. |
| 8 | ContentQube-internal substate mapping | **Open** — operator confirmation needed for the proposed mapping (`semi_minted/review_ready/canon_pending → review_pending`, `chain_minted → canonized`, `superseded → deprecated`, `archived → archived`). Stage 3 codifies. |

---

## Operator actions before Stage 2

### Required (blocks Stage 2 resolver work)

**1. Apply the migration to dev Supabase.**

```bash
# In dev Supabase SQL editor, run the file:
supabase/migrations/20260530000000_registry_canonical_plane_v1_0_stage_1.sql
```

Migration is wrapped in `BEGIN; ... COMMIT;` so it's all-or-nothing. The `UPDATE` statements that split `registry_assets.asset_class` into `(primitive_type, tool_subtype)` touch 23 rows per Stage 0 audit. After apply:

```sql
-- Verify the 7 new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'iqube_id_map','persona_token_qube_ownership','mint_sagas',
    'dvn_receipt_blocks','dvn_receipt_block_items',
    'iqube_canonization_requests','registry_config'
  )
ORDER BY table_name;
-- Expect 7 rows.

-- Verify registry_assets backfill
SELECT primitive_type, tool_subtype, count(*) FROM registry_assets
GROUP BY primitive_type, tool_subtype
ORDER BY primitive_type, tool_subtype;
-- Expect:
--   AigentQube | null       | 4
--   DataQube   | null       | 1
--   ToolQube   | connector  | 1
--   ToolQube   | skill      | 19
--   ToolQube   | workflow   | 3

-- Verify registry_config seed
SELECT config_key, config_value FROM registry_config ORDER BY config_key;
-- Expect 3 rows including feature_flag.REGISTRY_CANONICAL_PLANE_V1_0 = false.
```

**2. Decide Finding F orphan triad meta disposition (4 records).**

From Stage 0 audit § Finding F. Per orphan, pick one of:

- **Backfill the missing master row** — appropriate for `mk-ep01-motion` and `mk-ep03-motion` (these are the records named in the operator's "missing motion tiles" complaint). Run an INSERT into `master_content_qubes` linking them, then they participate normally in the registry plane.
- **Register as standalone iQube** — appropriate for the `metaknyts-codex` cluster qube. Write its own `iqube_id_map` row with `source='triad_meta'`, `primitive_type='ClusterQube'`. Cluster composition lands in Stage 2.
- **Hard-delete** — appropriate for `mk-bronze-knyt-1-` if confirmed malformed. Removes the meta + cascades any orphan blak/token.

Choose per orphan; the disposition matters because **Stage 2 backfill writes `iqube_id_map` rows for everything in `iq_meta_qubes`** — orphans become entries with empty `notes` field unless explicitly handled.

**3. Confirm checklist items 3, 6, 7, 8.** Stage 2 work is partly shaped by these decisions:

- Item 3 priority order → defines Stage 4 vs Stage 8 scope split
- Item 6 → Stage 2 cleanup
- Item 7 → Stage 6 receipt convergence design
- Item 8 → Stage 3 lifecycle state-machine implementation

### Optional (helpful for Stage 2 design, not blocking)

**4. Inspect the new iQube Registry cartridge in dev.** After C3 lands on dev, navigate to `/triad/embed/codex/iqube-registry/...` (URL pattern per `buildCodexUrl`). Confirm: the 7 tabs render, the admin-only tabs are gated, the descriptions read sensibly, the icons land. Operator UX feedback shapes Stage 8.

**5. Inspect the new test file in your CI run.** `tests/iqube-legibility-actionmap.test.ts` should pass against the freshly-added `services/iqube/legibility/actionMap.ts`. Sandbox couldn't run npm; verify locally.

---

## Stage 2 preview

When operator unblocks Stage 1 ↑, Stage 2 implements:

1. **`services/registry/resolver.ts`** — `resolveIQube(iqube_id, opts)`, `resolveIQubeByChainAnchor(...)`, `listIQubes(filter, opts)`. Composes via primitive-specific adapters; never reimplements `userOwnsAsset` / `evaluateAccess`.
2. **`services/registry/projections/{admin,cartridge,public}.ts`** — three pure projection functions. Property-based tests assert no T0 leakage.
3. **`services/registry/backfill/runBackfill.ts`** — idempotent backfill driver that populates `iqube_id_map` from every source surface. Per-surface backfill gate per v1.1 §B.3.
4. **`services/registry/adapters/*`** — primitive-specific adapter modules. ContentQubeAdapter wraps the shipped `resolveContentQube`; ToolQube / AigentQube / DataQube / ClusterQube adapters new.
5. **Replace the mock** at `app/api/registry/iqube/route.ts` with a real POST that creates a draft via `services/registry/createDraft.ts` (new). GET at `app/api/registry/iqube/[id]/route.ts` delegates to the resolver.
6. **CI gates** — `tests/registry-authority.test.ts` (resolver never decides access/ownership/receipts), `tests/registry-projections.test.ts` (no T0 leak), grep gate blocking direct SELECTs on canonical backing tables in client-bundled code.

Stage 2 estimate: ~4–5 working days.

---

## Cross-references

- v1.0 PRD: `codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-registry-operating-plane-v1.0.md`
- v1.1 Guardrails: `codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-registry-operating-plane-v1.1-guardrails.md`
- Stage 0 Audit: `codexes/packs/agentiq/updates/2026-05-30_stage-0-audit-report.md`
- Migration file: `supabase/migrations/20260530000000_registry_canonical_plane_v1_0_stage_1.sql`
- Canonical types: `types/registry-canonical.ts`
- Action map: `services/iqube/legibility/actionMap.ts`
- Action map tests: `tests/iqube-legibility-actionmap.test.ts`
- New cartridge: `data/codex-configs.ts::IQUBE_REGISTRY_CARTRIDGE`

---

## Adjacent dev-side work to coordinate with

- **`components/admin/CanonicalMintPanel.tsx`** (shipped 2026-05-29) — its own backlog doc (`codexes/packs/agentiq/updates/2026-05-29_canonical-mint-panel-registry-integration.md`) explicitly designs it to lift-and-shift into the iQube Registry cartridge `mints` tab when Stage 5 wiring lands. No code change needed today; the cartridge config already names the receiving surface.
- **CRM identity asset enrichment plan** (`2026-05-26_crm-identity-asset-enrichment-plan.md`) — touches identity iQubes; Stage 2 resolver backfill for `identity_iqube` source should align.
- **Venture iQube v0.2 schema** (`2026-05-29_venture-iqube-schema-v0.2.md`) — venture iQubes use the `iqube-registry` cartridge slug as one of their `cartridgeSlug` enum values; this Stage 1 work reserves the slug they reference.

---

**End of Stage 1 Close Report. 5 commits + this doc on `claude/dreamy-gates-mMqNv`. Awaiting operator confirmation on the migration apply + 4 open checklist items before Stage 2 begins.**
