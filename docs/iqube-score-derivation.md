# iQube Score Derivation Reference

**Status:** Live. Reference doc for the per-primitive score derivation rules.
**Source code:** `services/registry/scoreBackfill/`
**Storage:** `public.iqube_scores` table (one row per canonical `iqube_id`)
**Surface:** `RegistryCartridgeView.scores` + `RegistryAdminView.scores` projections; Health tab Score Coverage section.

---

## What this doc is

Every iQube carries 4 trust/validation axes (sensitivity / accuracy / verifiability / risk) on a 0–10 scale, plus 2 derived scores (reliability / trust). The raw axes are derived per primitive type via dedicated strategy files in `services/registry/scoreBackfill/<primitive>Scores.ts`. The derived scores follow shared formulas in `services/registry/scoreBackfill/types.ts`.

This document specifies what a "5/10 risk" or "9/10 verifiability" actually means per primitive. Without it, scores look like arbitrary numbers; with it, operators have a shared baseline for what to override.

---

## Shared formulas

```
reliability = round((accuracy * 0.6 + verifiability * 0.4) * 10) / 10
trust       = round((10 - (sensitivity * 0.4 + risk * 0.6)) * 10) / 10
```

`reliability` weights *accuracy* over *verifiability* because operator decisions hinge more on "is this right?" than on "can I check?". `trust` weights *risk* over *sensitivity* because sensitivity is about the iQube's nature; risk is about consequences if it's wrong or misused.

All four raw axes clamp to integer 0–10 via `clampAxis()` (NaN → 5; <0 → 0; >10 → 10; otherwise rounded).

---

## Per-axis source flag

Each axis stores a `_source` value:

- **`derived`** — populated by the strategy. Re-running the backfill overwrites freely.
- **`operator_override`** — an operator set this value manually. Re-runs preserve it; only an explicit `PATCH /api/admin/registry/scores/[iqube_id]` (Phase B of legacy `/registry` integration) flips it back to `derived`.

The mix lets operators correct individual axes per iQube without losing the derived baseline on the others.

---

## ContentQube (`content_qube_v1`)

Reads `content_qubes.lifecycle_state` + `content_qube_access_policies.gating_kind`.

### Sensitivity (from `gating_kind`)

| `gating_kind` | sensitivity |
|---|---|
| `open` / `free` / null | 1 |
| `payment` | 5 |
| `token` | 7 |
| `persona`, `did`, `allowlist`, `role` | 8 |
| `custom` | 8 |
| (anything else) | 5 |

### Risk (from `gating_kind` + `lifecycle_state`)

| Condition | risk |
|---|---|
| Open + (`canonized` or `chain_minted`) | 1 |
| `token` + NOT canonized | 7 |
| `persona` or `did` | 6 |
| Default | 4 |

### Accuracy (from `lifecycle_state`)

| Lifecycle | accuracy |
|---|---|
| `canonized` / `chain_minted` | 9 |
| `semi_minted` / `review_ready` / `canon_pending` | 5 |
| `draft` | 3 |
| `superseded` / `archived` | 7 |
| (other) | 5 |

### Verifiability (from `lifecycle_state`)

| Lifecycle | verifiability |
|---|---|
| `chain_minted` | 10 |
| `canonized` | 9 |
| `semi_minted` / `review_ready` / `canon_pending` | 6 |
| `draft` | 4 |
| (other) | 5 |

### Worked example

A canonized, open-gated metaKnyts episode:
- sensitivity = 1 (open)
- accuracy = 9 (canonized)
- verifiability = 9 (canonized; bumps to 10 only if chain_minted)
- risk = 1 (open + canonized)
- reliability = 9.0, trust = 9.0

---

## ToolQube (`tool_qube_v1`)

Reads `registry_assets.wrapper_strategy` + stand-in `auth_scheme` (derived from wrapper until DB promotion lands richer secret metadata).

### Sensitivity (from `auth_scheme`)

| `auth_scheme` | sensitivity |
|---|---|
| `none` / null | 2 |
| `bearer` / `api_key` | 5 |
| `oauth2` | 6 |
| (other) | 4 |

### Risk (from `wrapper_strategy`)

| `wrapper_strategy` | risk |
|---|---|
| `skill` | 2 |
| `mcp` | 5 |
| `workflow` | 5 |
| `browser` | 7 |
| (other) | 4 |

### Accuracy + Verifiability

Both default **6** today. Backlog: when `ValidationPanel` results land on `registry_assets`, derive accuracy from validation pass rate + verifiability from source-provenance signal (signed npm package, verified GitHub repo, etc.).

### Worked example

An MCP-wrapped openclawCore tool (`tool-web-search`):
- sensitivity = 5 (bearer stand-in for MCP)
- accuracy = 6 (default)
- verifiability = 6 (default)
- risk = 5 (mcp wrapper)
- reliability = 6.0, trust = 5.0

---

## AigentQube (`aigent_qube_v1`)

Reads `iqube_id_map` + the `defaultGovernance()` shape from `aigentQubeAdapter`. The 5 canonical code-only aigents carry per-aigent overrides for `scopes_breadth` and `charter_accepted`.

### Per-aigent overrides (code-only baseline)

| Aigent | `scopes_breadth` | `charter_accepted` |
|---|---|---|
| `aigent-me` (orchestrator) | 8 | true |
| `aigent-marketa` (specialist + cartridge scopes) | 5 | true |
| `aigent-kn0w1` (specialist) | 2 | true |
| `aigent-moneypenny` (specialist) | 4 | true |
| `aigent-nakamoto` (specialist) | 2 | true |

### Sensitivity (from `identifiability_floor` + `must_disclose_as_agent`)

`must_disclose_as_agent=true` adds **+1** to whichever base value below.

| `identifiability_floor` | sensitivity (base) |
|---|---|
| `anonymous` | 8 |
| `semi_anonymous` | 6 |
| `semi_identifiable` | 4 |
| `identifiable` | 2 |
| (default) | 5 |

### Risk (from `payment_authority` + `scopes_breadth`)

```
base = payment_authority == null ? 2
     : payment_authority.max < 100 Q¢ ? 4
     : 7

risk = clamp(base + min(scopes_breadth / 4, 2))
```

### Accuracy (from `trust_band`)

| `trust_band` | accuracy |
|---|---|
| 0 | 3 |
| 1 | 5 |
| 2 | 6 |
| 3 | 8 |
| 4 | 10 |

### Verifiability (from `charter_accepted` + provenance)

| `charter_accepted` | DB-backed? | verifiability |
|---|---|---|
| true | true | 9 |
| true | false (code-only) | 7 |
| false | (any) | 4 |

### Worked example

`aigent-marketa` today (code-only, default governance, trust band 0):
- sensitivity = 6 + 1 = 7 (semi_anonymous + disclose)
- risk = 2 + min(5/4, 2) = 2 + 1.25 → clamp 3 (null payment, breadth 5)
- accuracy = 3 (trust_band 0)
- verifiability = 7 (charter true, code-only)
- reliability = 4.6, trust = 5.4

Once `aigent_qubes` DB promotion lands (legibility fast-follow #3), the strategy version bumps to `aigent_qube_v2`, real per-aigent governance (charter version, trust_band progression history, payment_authority changes) flows in, and the backfill re-runs to refresh.

---

## DataQube (`data_qube_v1`)

Reads `iqube_id_map` + `legacy_primitive_type` flag.

### LiquidUI templates

Identified by `id` prefix `liquidui-template-` OR `source='code:liquidui-template'` OR `legacy_primitive_type='LiquidUITemplateArchetypeQube'`.

| Axis | Value | Rationale |
|---|---|---|
| sensitivity | 1 | UI schemas; no payload |
| accuracy | 8 | Hand-authored, operator-reviewed |
| verifiability | 10 | Open-source; trivially auditable |
| risk | 1 | No payload, no chain, no spend |
| reliability | 8.8 | derived |
| trust | 9 | derived |

### Other DataQubes

Default **5 / 5 / 5 / 5** with a `notes` field flagging that operator override or richer source signal is needed. Realistically every non-LiquidUI DataQube today is a per-record case that the operator should evaluate manually.

---

## ClusterQube (`cluster_qube_v1`)

No ClusterQube records exist today (one orphan trinity meta has `qube_type='cluster'` but isn't promoted). When cluster records land, the deriver reads the cluster's `member_iqubes` block + aggregates each member's scores:

```
sensitivity, accuracy, verifiability = mean(members)
risk                                  = clamp(max(members) * 0.7 + mean(members) * 0.3)
```

Risk biases worst-case because a cluster's risk is bounded by its riskiest member.

The aggregation logic is exported as `aggregateClusterScores(memberScores)` for tests + future re-aggregation when cluster compositions change.

---

## Strategy versioning

Each strategy file declares a `STRATEGY` constant (e.g. `'content_qube_v1'`). When the rules change, increment the version. Re-running the backfill updates the `derivation_strategy` column on every affected row; operators can query for stale strategies via:

```sql
SELECT iqube_id, derivation_strategy, updated_at
FROM iqube_scores
WHERE derivation_strategy LIKE 'aigent_qube_%'
  AND derivation_strategy != 'aigent_qube_v2';
```

The Health tab Score Coverage section surfaces total / scored / overrides per primitive but doesn't yet split by strategy version; that's a backlog item for when v2 strategies first ship.

---

## What's deferred

- Per-axis **operator override UI** in `IQubeDetailModal.tsx` — lands in Phase B of the legacy `/registry` integration.
- **Validation-result-aware ToolQube accuracy** — once `registry_assets` carries validation pass rate data.
- **ContentQube content-kind-specific derivation** — episodes vs. activation_tabs vs. powers_sheets might need different sensitivity baselines.
- **Phase 2 risk/value assessments** — the Stage 9 stubs at `services/registry/phase2/risk.ts` + `value.ts` succeed these basic axes; this doc + table is the baseline they elaborate.

---

## Cross-references

- Schema: `supabase/migrations/20260531000000_iqube_scores.sql`
- Types: `services/registry/scoreBackfill/types.ts`
- Per-primitive: `services/registry/scoreBackfill/{content,tool,aigent,data,cluster}QubeScores.ts`
- Driver: `services/registry/scoreBackfill/runBackfill.ts`
- Admin API: `app/api/admin/registry/score-backfill/route.ts`
- Tests: `tests/registry-score-backfill.test.ts`
- Health UI: `app/triad/components/codex/tabs/IQubeRegistryHealthTab.tsx` (Score Coverage section)
- Legacy scoreUtils (still in use): `components/registry/scoreUtils.tsx`
- Backlog item: `codexes/packs/agentiq/updates/2026-05-31_iqube-score-data-backfill-backlog.md`
