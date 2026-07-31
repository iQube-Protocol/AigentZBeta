# Score Data Backfill — Close Report

**Status:** Complete on `claude/dreamy-gates-mMqNv`. Shipped before Phase A of the legacy `/registry` integration per operator request ("hold + start backfill first") so Phase A ships with real score data, not placeholders.
**Date:** 2026-05-31
**Branch commits this batch:** `d9923abb` (C1), `9895405e` (C2), `8e58706a` (C3), `04029289` (C4), `<this commit>` (C5 close report).
**Closes:** `codexes/packs/agentiq/updates/2026-05-31_iqube-score-data-backfill-backlog.md`

---

## What shipped

### C1 — Schema + per-primitive derivation services

`supabase/migrations/20260531000000_iqube_scores.sql`:
- New `iqube_scores` table keyed by canonical `iqube_id` (FK to `iqube_id_map`, ON DELETE CASCADE)
- 4 raw axes (smallint 0..10 CHECK), 2 derived (numeric(3,1))
- Per-axis `_source` columns (`derived | operator_override`)
- `derivation_strategy` column for selective re-runs when strategies version up
- Partial index on overrides for fast filtering
- RLS service-role-only; no T0 fields

`services/registry/scoreBackfill/`:
- `types.ts` — shared types + `computeReliability` + `computeTrust` + `clampAxis`
- `contentQubeScores.ts` — derives from `content_qubes.lifecycle_state` + `content_qube_access_policies.gating_kind`
- `toolQubeScores.ts` — derives from `registry_assets.wrapper_strategy` + stand-in `auth_scheme`
- `aigentQubeScores.ts` — derives from `defaultGovernance` + per-aigent code overrides for the 5 canonical aigents
- `dataQubeScores.ts` — LiquidUI templates get 1/8/10/1; other DataQubes get 5/5/5/5 + override note
- `clusterQubeScores.ts` — `aggregateClusterScores()` (mean for axes; 70% max + 30% mean for risk)
- `runBackfill.ts` — `backfillPrimitive` / `backfillAllPrimitives` / `getCoverageStatus`; per-axis operator-override preservation

### C2 — Admin endpoint + projection extension

`app/api/admin/registry/score-backfill/route.ts`:
- `GET` → coverage status + grand totals
- `POST` → backfill all primitives
- `POST ?source=<primitive>` → backfill one primitive
- Admin-gated. Idempotent.

`types/registry-canonical.ts`:
- New `IQubeScoreBlock` interface — 4 axes + 2 derived + 4 `_source` flags + strategy + updated_at
- `RegistryCartridgeView.scores?: IQubeScoreBlock` — surfaces to Phase A consumer
- `RegistryAdminView.scores?` — same shape; admin sees strategy + override flags
- `RegistryPublicView` deliberately unchanged (scores are operator-facing)

`services/registry/resolver.ts`:
- New `loadScoreBlock(iqube_id)` helper — best-effort SELECT
- `projectRecord()` loads scores for admin + cartridge projections; attaches to view
- Public projection unchanged
- Authority compliance preserved — pure read

### C3 — Health tab Score Coverage section

`app/triad/components/codex/tabs/IQubeRegistryHealthTab.tsx`:
- New "Score Coverage" section between main backfill table and Known notes
- Three summary cards (Total / Scored + % / Operator overrides)
- Per-primitive table with coverage badge (green ≥100% / amber ≥50% / rose <50%) + override count + Re-derive button
- "Re-derive all" header button
- Action result strip

### C4 — Tests + reference documentation

`tests/registry-score-backfill.test.ts`:
- Derived formula tests (reliability + trust + computeDerivedScores)
- `clampAxis` edge cases
- `aggregateClusterScores` correctness (empty, means, risk worst-case bias)
- 3 documented rule baselines as round-trip tests

`docs/iqube-score-derivation.md`:
- Full reference doc for every per-primitive rule + worked example
- Per-axis `_source` flag contract
- Strategy versioning convention
- What's deferred (operator override UI, validation-aware ToolQube, etc)
- Cross-references to every file in the subsystem

Also added to the Docs tab allowlist (`Primary` section) + Lambda file-trace.

---

## What operator action this needs

### 1. Apply the migration to dev Supabase

```sql
-- Paste the contents of supabase/migrations/20260531000000_iqube_scores.sql
-- into the Supabase SQL editor and run.
```

Migration is wrapped in `BEGIN; ... COMMIT;` so it's all-or-nothing. Verify:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'iqube_scores';
-- Expect 1 row.
```

### 2. Run the backfill

```bash
# Refresh token from DevTools first
export ADMIN_TOKEN="<paste>"

# Backfill all 5 primitives
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://dev-beta.aigentz.me/api/admin/registry/score-backfill | jq

# Expected per Stage 0 baseline:
# - ContentQube: 49 processed, 49 populated
# - ToolQube: 23 processed (19 SkillQube + 3 WorkflowQube + 1 ConnectorQube), 23 populated
# - AigentQube: 5 processed, 5 populated
# - DataQube: 20 processed (LiquidUI seeds) + 1 other, 21 populated
# - ClusterQube: 0 processed (no records exist today)
# Total: 98 populated
```

### 3. Verify coverage in the Health tab

Navigate to `/triad/embed/codex/iqube-registry/health`. The new "Score Coverage" section should show:

- Total iQubes: ~218 (Stage 2 baseline) — wait, **but only DB-backed iQubes get scores** today. Code-only ToolQube and the 5 code-only AigentQubes get rows; legacy bridge rows (16 master_content_qubes + 120 codex_media_assets) don't have dedicated iqube_id_map entries today (they bridge via content_qubes). So expected scored: ContentQube 49 + ToolQube 23 + AigentQube 5 + DataQube 21 = **98 scored** out of the ~98 DB-backed iqube_id_map entries that correspond to scoreable primitives.

If any primitive shows <100%, click "Re-derive" on that row to retry.

### 4. Spot-check via the resolver

```bash
# Resolve a canonized ContentQube — should show scores
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://dev-beta.aigentz.me/api/registry/iqube/<some-uuid>?projection=admin" \
  | jq '.scores'
```

Expected: a `scores` object with all 4 axes + 2 derived + 4 `_source` flags all set to `derived` + `derivation_strategy: 'content_qube_v1'`.

---

## Now Phase A of legacy `/registry` integration is unblocked

The integration plan's Phase A A4 said:

> When the score data is missing... the field is `undefined`. Card components render placeholder dots ("—") + a "score data pending" tooltip.

After this backfill ships + operator runs the populator:

- Every ContentQube, ToolQube, AigentQube, and DataQube in `iqube_id_map` carries scores
- The cartridge resolver surfaces them via `RegistryCartridgeView.scores`
- Legacy `/registry` consumers (after Phase A) see real Rel + Trust dot strips on every card, not placeholders

ClusterQube remains uncovered until cluster records land (0 today). Operator can ignore.

---

## Branch state

44 commits on `claude/dreamy-gates-mMqNv` since dev merge:

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
Score Data Backfill                                 (4 + this close report)
```

---

## What's next

When operator confirms the migration applied + backfill ran clean + spot-checks pass, the **legacy `/registry` integration Phase A** is unblocked.

Phase A scope (5 commits, ~2 days):
- A1: Wrap legacy template fetch to canonical resolver (`GET /api/registry/iqube?expand=cartridge`)
- A2: Wrap legacy detail fetch to canonical projection (`GET /api/registry/iqube/[id]?projection=admin`)
- A3: Identity filter wiring (Persona via `creator_identity_state`; Reputation via AigentQube `trust_band`)
- A4: Score display — scores now flow through the cartridge projection (this backfill closes the data gap)
- A5: Analytics page deprecation banner + retire (backlog already filed)

---

**End of Score Data Backfill close report.**
