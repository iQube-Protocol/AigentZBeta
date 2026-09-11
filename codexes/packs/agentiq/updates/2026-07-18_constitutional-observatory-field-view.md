# Constitutional Observatory — iQube Registry "Field" view (CFS-035 §12)

**Date:** 2026-07-18
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Workstream:** CFS-035 The Invariant Engine — Observatory amendment (Level 3, OBSERVATION)

## What shipped

The Constitutional Observatory's first surface: a **"Field"** view in the iQube
Registry cartridge's Browse tab, a peer of the existing Table / Grid view modes.
It realises the operator's framing — *the constitutional field is the perimeter
of the Constitutional Internet, and invariants are a lens/substrate on state* —
by rendering the field as nodes, projections, and health beside the asset views.

Per the CFS-035 discipline, the Observatory **reads the engine; it never
re-instruments.** Every metric is derived from signals the engine and store
already produce.

### Backbone — `GET /api/invariants/observatory` (enriched)

Read-only, spine-gated (any authenticated persona), T1-safe (no personaId —
invariants carry no persona data). Now returns four of the five perspectives:

- **Node** — every registered Invariant Decision Node (`listRegisteredNodes`) +
  its last in-instance shadow observation.
- **Field** — the namespace rollup from `computeMeasurementRollup` (per-namespace
  invariant count, avgStanding, avgReach, consequenceAccuracy) + adoption leaders
  (`topReused`) + canon version stamp.
- **Projection** — the discovery-ranking node's live dimension weights, computed
  with the **same** `deriveDimensionWeights` over the **same** cached discovery
  Field Snapshot the runtime projector uses, so the Observatory shows exactly
  what the runtime projects. Flags `diverges` when weights leave faithful (all-1).
- **Platform Health** — Constitutional Observability metrics derived from the
  collected observations: `meanRankAgreement` (projection accuracy), `meanValueDelta`,
  nodes observed/registered, grounded-receipt count.

`Graph` (edge traversal) and persisted observation history remain follow-ons.

### Surface — `components/registry/FieldView.tsx`

A self-contained client component reading the endpoint via `personaFetch`
(Bearer-token attaching — the route is spine-gated). Four perspective pills
(Health · Projection · Nodes · Field), slate/violet house style, standing bars
with the red→yellow→purple ramp. Honest empty-states: when no shadow
observations exist in the instance yet, it says so (they are per-instance
in-memory) rather than showing a fake zero.

### Wiring — `IQubeRegistryBrowseTab.tsx`

Added `'field'` to the local `viewMode` union, a third toggle button (Radar
icon) beside Table/Grid, and a render block. The iQube-specific chrome (filter
chips, loading/error/empty gates) is suppressed in Field mode; the Field view
owns its own data source and chrome.

## Files

- `app/api/invariants/observatory/route.ts` — enriched (measurement rollup +
  projection view + discovery dimensions).
- `services/invariants/nodes/discoveryRanking.ts` — exported `deriveDimensionWeights`
  + `DIMENSION_INVARIANT_SEED` so the route reuses the real weight logic (no fork).
- `components/registry/FieldView.tsx` — NEW, the Observatory surface.
- `app/triad/components/codex/tabs/IQubeRegistryBrowseTab.tsx` — third view mode.

## Discipline honoured

- **Reads the engine, never re-instruments** (CFS-035 §12 / Artifact Production
  observer rule): every figure is derived from `engine.ts`, the store, and
  `measurement.ts` — no new telemetry pipeline.
- **Extend, don't duplicate**: the projection weights come from the canonical
  `deriveDimensionWeights`, not a re-implementation.
- **T1-safe**: statement/score meta only; no personaId ever serialised.
- **Slate/violet house style**; `personaFetch` for the spine-gated route.

## Follow-ons (offered, not built)

1. Persist shadow observations (so Health shows history, not per-instance snapshots).
2. The Graph perspective (invariant edge traversal / field physics view).
3. The operator-gated shadow→authoritative flip control, sited in the Projection
   view where the divergence evidence is visible.
