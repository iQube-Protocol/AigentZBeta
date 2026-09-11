# Commit Brief: `320f389` — CFS-035: Constitutional Observatory doctrine + node registry + journey node

| Field | Value |
|-------|-------|
| SHA | [`320f389`](https://github.com/iQube-Protocol/AigentZBeta/commit/320f389e80a7f5d382096170215e8f6972cd0ebf) |
| Author | Claude |
| Date | 2026-07-16T17:25:51Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CFS-035: Constitutional Observatory doctrine + node registry + journey node

Folds the operator×Aletheon "Constitutional Observatory" round into doctrine and
builds the journey-progression node (unblocked by the stage reconciliation) plus
the Observatory data backbone.

Doctrine (CFS-035 amendment + plan):
- "the constitutional field is the perimeter of the Constitutional Internet" —
  the field is the live shared state of the constitutional network.
- three constitutional layers = State (Field) / Computation (Engine) /
  Observation (Observatory, initially the iQube Registry's 3rd "Field" view).
- Constitutional Observability as a telemetry category; 5 perspectives (Node/
  Field/Graph/Projection/Health); Claude improvements (Observatory reads the
  engine, metrics derived from existing signals, persist observations, flip
  control lives in the dashboard).

Build:
- engine: node registry (registerNodeMeta/listRegisteredNodes) + per-node last-
  observation recording in the shadow runners — the single Node-View source.
- nodes/journeyProgression.ts: projects next depth + disposition on the UNIVERSAL
  ExperienceStage axis (via the reconciliation); shadow-wired into the nbe route.
- all four nodes now self-register metadata at load; nodes/index barrel.
- app/api/invariants/observatory/route.ts: read-only Observatory v0 — Node View
  + field summary + derived health (projection accuracy = shadow agreement).
  Reads the engine, never re-instruments; T1-safe; any authed persona.

Journey node verified 7/7 + parse gates on all files. Observe-only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Folds the operator×Aletheon "Constitutional Observatory" round into doctrine and
builds the journey-progression node (unblocked by the stage reconciliation) plus
the Observatory data backbone.

Doctrine (CFS-035 amendment + plan):
- "the constitutional field is the perimeter of the Constitutional Internet" —
  the field is the live shared state of the constitutional network.
- three constitutional layers = State (Field) / Computation (Engine) /
  Observation (Observatory, initially the iQube Registry's 3rd "Field" view).
- Constitutional Observability as a telemetry category; 5 perspectives (Node/
  Field/Graph/Projection/Health); Claude improvements (Observatory reads the
  engine, metrics derived from existing signals, persist observations, flip
  control lives in the dashboard).

Build:
- engine: node registry (registerNodeMeta/listRegisteredNodes) + per-node last-
  observation recording in the shadow runners — the single Node-View source.
- nodes/journeyProgression.ts: projects next depth + disposition on the UNIVERSAL
  ExperienceStage axis (via the reconciliation); shadow-wired into the nbe route.
- all four nodes now self-register metadata at load; nodes/index barrel.
- app/api/invariants/observatory/route.ts: read-only Observatory v0 — Node View
  + field summary + derived health (projection accuracy = shadow agreement).
  Reads the engine, never re-instruments; T1-safe; any authed persona.

Journey node verified 7/7 + parse gates on all files. Observe-only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/invariants/observatory/route.ts` |
| Modified | `app/api/runtime/nbe/route.ts` |
| Modified | `codexes/packs/irl/foundation/CFS-035_the-invariant-engine.md` |
| Modified | `services/invariants/engine.ts` |
| Modified | `services/invariants/nodes/discoveryRanking.ts` |
| Added | `services/invariants/nodes/index.ts` |
| Added | `services/invariants/nodes/journeyProgression.ts` |
| Modified | `services/invariants/nodes/nbeRanking.ts` |
| Modified | `services/invariants/nodes/standingScore.ts` |

## Stats

 9 files changed, 310 insertions(+)
