# Commit Brief: `1cb6490` — persist shadow observations for Observatory history (CFS-035 §12)

| Field | Value |
|-------|-------|
| SHA | [`1cb6490`](https://github.com/iQube-Protocol/AigentZBeta/commit/1cb6490c5d8414702817c4bb896a0933ff1feac8) |
| Author | Claude |
| Date | 2026-07-16T18:17:33Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
persist shadow observations for Observatory history (CFS-035 §12)

Durable history for the Constitutional Observatory so Platform Health reads a
real time series (projection accuracy over time), not a per-instance snapshot.

- migration 20260718000000_invariant_shadow_observations: node_id, kind,
  rank_agreement/top_agreement (rank nodes), value_delta (value nodes),
  cited_ids, observed_at.
- services/invariants/observationStore.ts: persistObservation (best-effort,
  fire-and-forget, never throws) + getObservationHistory (per-node rollup,
  reports persistenceAvailable honestly when the table is absent).
- engine.recordObservation fires persistObservation fire-and-forget — never
  blocks or throws on the observed surface (CFS-035 §11).
- Observatory API: Health prefers persisted means (durable) over the in-instance
  snapshot; nodeView carries per-node history; exposes persistedObservations +
  persistenceAvailable.
- FieldView: Observations metric + per-node history; amber prompt to apply the
  migration when persistence is unavailable.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Durable history for the Constitutional Observatory so Platform Health reads a
real time series (projection accuracy over time), not a per-instance snapshot.

- migration 20260718000000_invariant_shadow_observations: node_id, kind,
  rank_agreement/top_agreement (rank nodes), value_delta (value nodes),
  cited_ids, observed_at.
- services/invariants/observationStore.ts: persistObservation (best-effort,
  fire-and-forget, never throws) + getObservationHistory (per-node rollup,
  reports persistenceAvailable honestly when the table is absent).
- engine.recordObservation fires persistObservation fire-and-forget — never
  blocks or throws on the observed surface (CFS-035 §11).
- Observatory API: Health prefers persisted means (durable) over the in-instance
  snapshot; nodeView carries per-node history; exposes persistedObservations +
  persistenceAvailable.
- FieldView: Observations metric + per-node history; amber prompt to apply the
  migration when persistence is unavailable.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/invariants/observatory/route.ts` |
| Modified | `components/registry/FieldView.tsx` |
| Modified | `services/invariants/engine.ts` |
| Added | `services/invariants/observationStore.ts` |
| Added | `supabase/migrations/20260718000000_invariant_shadow_observations.sql` |

## Stats

 5 files changed, 234 insertions(+), 7 deletions(-)
