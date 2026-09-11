# iQube Score Data Backfill — Backlog

**Date:** 2026-05-31
**Status:** Fast-follow item to Phase A of the legacy `/registry` integration. Filed because operator decision (2026-05-31 §0 item 5) is "all iQubes need risk / sensitivity / verifiability / accuracy scores."
**Phase A behaviour:** the projection surfaces score fields with placeholder UX where data is missing. This backlog item populates the data.

---

## Why this exists

The legacy `IQubeTemplate` shape (`types/registry.ts`) carries four scoring axes on every record:

- `sensitivityScore` (0–10)
- `accuracyScore` (0–10)
- `verifiabilityScore` (0–10)
- `riskScore` (0–10)

And `scoreUtils.tsx` derives two composite scores from those:

- `reliability = accuracy × 0.6 + verifiability × 0.4`
- `trust = 10 − (sensitivity × 0.4 + risk × 0.6)`

Today only **legacy templates** seeded through the old `/api/registry/templates` POST carry these fields. The canonical record (`CanonicalIQubeInternalRecord`, Stage 1 C5) has no equivalent slot — non-legacy iQubes (ContentQubes from `content_qubes`, AigentQubes from `RUNTIME_AGENT_IDS`, ToolQubes from `openclawCore`, DataQubes from registry_assets, the 20 LiquidUI seeds, the 87 triad metas) have NO score data anywhere.

Operator confirmed: **every iQube must carry these scores** so that Trust/Validation panels render universally + the legacy `/registry` cards display consistent dot strips.

The legacy `/registry` integration plan (Phase A A4) surfaces score fields in the cartridge projection as `scores?: {...}` + `derived_scores?: {...}` — optional, undefined when no data, rendered as "—" placeholder. **This backlog item populates the data so the placeholders go away.**

---

## What needs to happen per primitive

Each primitive type has a different natural source for the four axes. The backlog work decides + implements the source per primitive:

### ContentQube (49 today)

Reasonable defaults from existing fields:

- **`sensitivity`** — derived from `gating_kind`: `open` → 1; `payment` → 5; `token` → 7; `persona`/`did`/`allowlist`/`role` → 8; `custom` → 8. Default 5.
- **`risk`** — derived from `gating_kind` + `content_class`: free + public → 1; token-gated + private → 7; private creative content → 6. Default 4.
- **`accuracy`** — for canonized ContentQubes: 9 (operator-approved canon). For semi-minted/draft: 5. Default 7.
- **`verifiability`** — for chain_minted: 10 (on-chain anchor). For canonized: 9. For draft: 4. Default 7.

These are reasonable defaults. Operator may want a more sophisticated assessment per content_kind (episodes vs activation_tabs vs powers_sheets vs characters) — that's the Phase 2 risk/value assessment workstream (see Stage 9 stubs at `services/registry/phase2/risk.ts` + `value.ts`).

### ToolQube (currently 0 in registry; 23 ingestion-factory legacy classes; future code-source tools)

- **`sensitivity`** — from the tool's `auth_scheme`: `none` → 2; `bearer`/`api_key` → 5; `oauth2` → 6. Default 4.
- **`risk`** — from `wrapper_strategy`: `skill` (in-process) → 2; `mcp`/`workflow` → 5; `browser` → 7 (live web access). Default 4.
- **`accuracy`** — derived from validation status (per `ValidationPanel` results when ingestion-factory ran a validation pass): all-pass → 9; some-warn → 7; some-fail → 4. Default 6.
- **`verifiability`** — derived from source provenance: signed npm package → 8; verified GitHub repo → 7; manual upload → 4. Default 6.

### AigentQube (5 code-only today)

- **`sensitivity`** — from `governance.constraints.identifiability_floor` + `must_disclose_as_agent`: anonymous → 8; semi_anonymous → 6; semi_identifiable → 4; identifiable → 2. Default 5.
- **`risk`** — from `governance.rights.payment_authority`: null → 2; non-null + max_per_tx < 100 Q¢ → 4; >= 100 Q¢ → 7. Plus `cartridge_scopes.length` (broader scope → higher risk). Default 3.
- **`accuracy`** — proportional to `trust_band`: band 0 → 3; band 4 → 10. Default 5.
- **`verifiability`** — `charter_accepted` + `root_agent_id` lineage: accepted + DB-promoted → 9; accepted + code-only → 7; no charter → 4. Default 6.

### DataQube (1 in registry + 20 LiquidUI seeds)

- LiquidUI templates: structural schemas with no payload. Defaults: sensitivity 1, accuracy 8, verifiability 10 (open-source UI schemas), risk 1.
- Other DataQubes: defaults per source — typically schema/data with operator-defined characteristics. Default 5/5/5/5.

### ClusterQube (1 orphan today)

- Aggregate scores from `cluster.member_iqubes`: mean of each axis across members; risk is weighted toward max member risk (cluster risk is worst-case).

### ModelQube (none today; future)

- Defer until first ModelQube ships. Defaults based on model provenance (open-weight vs. proprietary), training data audit status, and known capability risk.

---

## Implementation outline

When picked up:

1. **Add `scores: jsonb` + `derived_scores: jsonb` columns to `iq_meta_qubes`** (or extend `metadata` JSONB schema). One migration.
2. **Per-primitive populator scripts** in `services/registry/scoreBackfill/`:
   - `contentQubeScores.ts` — derives from `content_qubes.lifecycle_state` + access policy
   - `toolQubeScores.ts` — derives from `registry_assets.wrapper_strategy` + ingestion validation results
   - `aigentQubeScores.ts` — derives from governance block (Stage 7 surface)
   - `dataQubeScores.ts` — derives from id-prefix recognition
   - `clusterQubeScores.ts` — aggregates from member scores
3. **`POST /api/admin/registry/score-backfill`** admin endpoint:
   - `?source=<primitive>` runs the per-primitive populator
   - `?source=all` runs all
   - Idempotent; re-runs only update rows whose `scores` field is null OR whose source data has changed
4. **Surface in cartridge `RegistryHealthTab`** — show per-primitive score-coverage percentage; "Re-run backfill" button per primitive
5. **Tests** — `tests/registry-score-backfill.test.ts`: per-primitive derivation rules tested with synthetic inputs; idempotent re-run produces no diffs
6. **Documentation update** — `docs/iqube-score-derivation.md` documents the per-primitive derivation rules canonically so operators know what a "5/10 risk" means for a ContentQube vs an AigentQube

---

## When this becomes urgent

- **Now-ish:** as soon as the legacy `/registry` Phase A ships and operators see "—" placeholders on every non-legacy iQube card. The visual noise will trigger the request.
- **Mid-priority:** before Phase 2 (intent/calibration/risk/value/pricing/exchange) work begins — the Phase 2 risk + value assessments are sophisticated successors to these basic axes, and they need a starting baseline. The defaults here are the baseline.

---

## Estimated effort

~3 days for v1 (defaults-only, no operator override UI):
- 1 day: migration + populator scripts + admin endpoint
- 1 day: cartridge UI for coverage status + re-run
- 0.5 day: tests
- 0.5 day: per-primitive derivation rule documentation

Adds ~1 day if operator wants a per-iQube score override UI in `IQubeDetailModal.tsx`. The operator-set value overrides the derived default; the canonical record carries both `scores.<axis>` (effective value) and `scores.<axis>_source` ("derived" / "operator_override").

---

## Cross-references

- Score utilities (legacy): `components/registry/scoreUtils.tsx`
- Trust/Validation panels: `components/registry/TrustPanel.tsx` + `ValidationPanel.tsx`
- Canonical record: `types/registry-canonical.ts::CanonicalIQubeInternalRecord` (Stage 1 C5)
- Cartridge projection: `services/registry/projections/cartridge.ts` (Stage 2 C7)
- Phase 2 risk/value stubs: `services/registry/phase2/risk.ts` + `value.ts` (Stage 9)
- Related plan: `2026-05-31_legacy-registry-canonical-integration-plan.md` §0 item 5 + Phase A A4

---

**End of backlog item.**
