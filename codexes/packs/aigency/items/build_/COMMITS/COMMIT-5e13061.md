# Commit Brief: `5e13061` — build Constitutional Observatory Field view in iQube Registry (CFS-035 §12)

| Field | Value |
|-------|-------|
| SHA | [`5e13061`](https://github.com/iQube-Protocol/AigentZBeta/commit/5e130612f5360b5fc24bdfcf9f8886ada83fcaaa) |
| Author | Claude |
| Date | 2026-07-16T18:10:15Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
build Constitutional Observatory Field view in iQube Registry (CFS-035 §12)

Add a third 'Field' view mode beside Table/Grid in the iQube Registry Browse
tab — the Observatory's first surface, showing the constitutional field as
nodes, projections, and health (invariants as a lens on state).

- Enrich GET /api/invariants/observatory: measurement rollup (per-namespace
  fields + adoption leaders), a Projection view computing the discovery node's
  live dimension weights via the SAME deriveDimensionWeights the projector uses
  (no fork), and derived Constitutional Observability health metrics. Reads the
  engine; never re-instruments. T1-safe, spine-gated.
- components/registry/FieldView.tsx: self-contained surface (personaFetch),
  four perspective pills (Health/Projection/Nodes/Field), slate+violet house
  style, honest empty-states for per-instance observations.
- IQubeRegistryBrowseTab: 'field' view mode + Radar toggle; iQube chrome
  suppressed in field mode.
- Export deriveDimensionWeights + DIMENSION_INVARIANT_SEED for API reuse.

Graph view + persisted observation history + the flip control are follow-ons.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Add a third 'Field' view mode beside Table/Grid in the iQube Registry Browse
tab — the Observatory's first surface, showing the constitutional field as
nodes, projections, and health (invariants as a lens on state).

- Enrich GET /api/invariants/observatory: measurement rollup (per-namespace
  fields + adoption leaders), a Projection view computing the discovery node's
  live dimension weights via the SAME deriveDimensionWeights the projector uses
  (no fork), and derived Constitutional Observability health metrics. Reads the
  engine; never re-instruments. T1-safe, spine-gated.
- components/registry/FieldView.tsx: self-contained surface (personaFetch),
  four perspective pills (Health/Projection/Nodes/Field), slate+violet house
  style, honest empty-states for per-instance observations.
- IQubeRegistryBrowseTab: 'field' view mode + Radar toggle; iQube chrome
  suppressed in field mode.
- Export deriveDimensionWeights + DIMENSION_INVARIANT_SEED for API reuse.

Graph view + persisted observation history + the flip control are follow-ons.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/invariants/observatory/route.ts` |
| Modified | `app/triad/components/codex/tabs/IQubeRegistryBrowseTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-18_constitutional-observatory-field-view.md` |
| Added | `components/registry/FieldView.tsx` |
| Modified | `services/invariants/nodes/discoveryRanking.ts` |

## Stats

 6 files changed, 553 insertions(+), 25 deletions(-)
