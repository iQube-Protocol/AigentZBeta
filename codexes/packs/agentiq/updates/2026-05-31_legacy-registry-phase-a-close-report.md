# Legacy `/registry` Integration — Phase A Close Report

**Status:** Phase A complete on `claude/dreamy-gates-mMqNv`. Legacy `/registry` page now reads through the canonical resolver via a thin adapter; legacy modals share unchanged; Identity filter surfaces tracked; analytics page carries deprecation banner.
**Date:** 2026-05-31
**Phase A commits:** `558d94bb` (C1), `7be63c6d` (C2), `ec5843ab` (C3), `d420ce27` (C5 banner + C4 verification note), `<this commit>` (C6 close report).
**Plan:** `codexes/packs/agentiq/updates/2026-05-31_legacy-registry-canonical-integration-plan.md`

---

## What shipped — Phase A (read path)

### C1 — List fetch swapped to canonical resolver

`services/registry/legacy/legacyAdapter.ts` (new):
- `cartridgeViewToLegacyTemplate(entry)` — maps `RegistryCartridgeView` → legacy `IQubeTemplate` (including all 4 score axes from the canonical `scores` block)
- `adminViewToLegacyTemplate(entry)` — extends cartridge mapping with createdAt + version + identity_state
- `legacyFiltersToCanonicalParams(filters, page, limit)` — translates legacy `FilterState` → canonical resolver query string
- `buildLegacyListResponse(all, filters, page, limit)` — client-side pagination + filter pass (resolver list endpoint doesn't paginate yet; Phase B work)
- `fetchRegistryAsLegacyShape(filters, page, limit)` — primary list fetcher; calls `GET /api/registry/iqube?expand=cartridge`; falls back to legacy `/api/registry/templates` on canonical miss for the observation window

`components/registry/RegistryHome.tsx`:
- Imported `fetchRegistryAsLegacyShape`; swapped 3 list-fetch sites to the adapter
- `IQubeCard` renders Rel + Trust dots from the canonical `scores` block (mapped by adapter, computed by `calculateReliabilityScore` / `calculateTrustScore`)

### C2 — Detail fetch swapped to canonical resolver

`services/registry/legacy/legacyAdapter.ts`:
- `fetchTemplateDetailAsLegacyShape(templateId)` — calls `GET /api/registry/iqube/{id}?projection=admin`; falls back to legacy `/api/registry/templates/{id}` on canonical miss

`components/registry/IQubeDetailModal.tsx`:
- Replaced the multi-step single-fetch + list-find fallback (~37 lines) with a single adapter call (~5 lines)
- Edit/View modal unchanged — still operates on the same legacy `IQubeTemplate` shape; canonical resolver supplies it

### C3 — Identity filter wiring

`components/registry/RegistryHome.tsx`:
- `FilterState` extended with `persona?: string` + `reputation?: number`
- Inline Persona + Reputation selects update both local state AND filters object
- Phase A scope tooltips on both selects explain the limitation:
  - **Persona:** "Phase A: selection is tracked but server-side ownership filtering lands in Phase B."
  - **Reputation:** "Filters AigentQubes by trust_band ≥ selected bucket. Non-Aigent primitives don't carry a trust band; they appear regardless of this filter (Phase A scope)."

`services/registry/legacy/legacyAdapter.ts::buildLegacyListResponse`:
- Documents the persona+reputation no-op behaviour + the Phase B implementation path inline

### C4 — Score display (verification only)

No code change. The canonical `scores` block flows through:

```
resolver.projectRecord() loadScoreBlock(iqube_id)
  → RegistryCartridgeView.scores { sensitivity, accuracy, verifiability, risk, ... }
  → cartridgeViewToLegacyTemplate() → IQubeTemplate { sensitivityScore, accuracyScore, ... }
  → IQubeCard <Dots value={calculateReliabilityScore/TrustScore(...)} />
```

With the score backfill complete (98/98 expected entries scored, per the Score Data Backfill close report), every card in `/registry` renders real Rel + Trust dots from canonical data — no placeholders.

### C5 — Analytics deprecation banner

`app/(shell)/registry/analytics/page.tsx`:
- Amber banner at the top of the page with link to `/triad/embed/codex/iqube-registry/health` (the canonical Health tab)
- Page logic unchanged — full retirement happens in Phase C per `2026-05-31_registry-analytics-backend-backlog.md`

---

## Authority compliance

Every Phase A touchpoint preserves the PRD v1.0 §3 Source-of-Authority Matrix:

| Authority | Phase A behaviour |
|---|---|
| Identity spine — caller resolution | Untouched. Adapter calls `/api/registry/iqube` which calls `getActivePersona` |
| Access spine — ownership / can-read | Untouched. Persona filter is no-op today; Phase B will route through `evaluateAccess` via the resolver |
| Resolver — canonical projection | The only data layer the legacy page calls. No parallel resolver in the legacy code |
| Score block — derivation | Operator overrides preserved per-axis. Page is read-only against scores |
| Mint saga | Not touched — legacy mint flow continues to call its existing path; Phase B canonicalises |

No spine files modified. No access gates removed.

---

## What changed for the operator

The legacy `/registry` page now:
- Pulls data through the canonical resolver, so the page reflects the canonical record state immediately
- Shares Rel + Trust scores with every cartridge surface (Health tab + Browse tab + future surfaces) — single source of truth
- Surfaces Persona + Reputation filter selections in URL-stable state (ready for Phase B server-side wiring without UI changes)
- Carries a deprecation banner on the analytics page pointing to the canonical Health tab

Visible behaviour parity with pre-Phase-A: identical card grid, identical detail modal, identical filter chips. The change is data-layer-only, by design.

---

## What's deferred to Phase B

| Surface | Phase B work |
|---|---|
| Write path (create/edit) | Adapter for write — currently RegistryHome still writes via legacy `/api/registry/templates` POST/PUT |
| Mint canonicalisation | `POST /api/registry/canonization` for legacy mint → canonical saga |
| Batch mint (Cart) | New saga state `batch_mint_pending`; cart UI carries through |
| Persona ownership filter | Wire `caller_owns` resolver flag → server-side filter |
| AigentQube reputation filter | Wire `trust_band` (Stage 7 governance block) → server-side filter |
| Resolver list pagination | Currently capped at 500; server-side page/limit needed |
| Resolver list text search | `?search=` param on `/api/registry/iqube` |

Plan: `2026-05-31_legacy-registry-canonical-integration-plan.md` §Phase B (8 commits, ~3–4 days).

---

## What's deferred to Phase C

- Lift shared `IQubeCard` / detail modal / filter UI primitives into `components/registry/_shared/` so cartridge surfaces consume the same components
- Retire `app/(shell)/registry/analytics/page.tsx` entirely (banner becomes a redirect)
- Retire legacy `/api/registry/templates` GET/POST/PUT routes after observation window
- Remove legacy fallback paths from `legacyAdapter.ts`

Plan: §Phase C (5 commits, ~2–3 days).

---

## Branch state

48 commits on `claude/dreamy-gates-mMqNv` since dev merge:

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
Legacy /registry integration Phase A                (4 + this close report)
```

---

**End of Legacy `/registry` Phase A close report.**
