# Commit Brief: `13de68d` — Reconcile journey models: ExperienceStage universal, KNYT journey its projection

| Field | Value |
|-------|-------|
| SHA | [`13de68d`](https://github.com/iQube-Protocol/AigentZBeta/commit/13de68d45eadea60827cf29bd08c6aefbf807099) |
| Author | Claude |
| Date | 2026-07-16T16:57:47Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Reconcile journey models: ExperienceStage universal, KNYT journey its projection

Operator direction #2: KNYT Journey becomes the KNYT-cartridge projection of
ExperienceStage, with ExperienceStage surviving as the universal model.

- services/journey/stageReconciliation.ts: the canonical bidirectional mapping
  KNYT JourneyStage <-> universal ExperienceStage (prospect->setup, acolyte->
  alpha_activation, keta->launch, keji->growth, first/zero->scale; side-states
  by engagement posture) + experienceStageForJourney/journeyStageForExperience +
  UNIVERSAL_STAGE_ORDER. Pure, deterministic.
- Establishes ExperienceStage as the one progression axis; KNYT stages are a
  projection layered on it, not a competing progression. The runtime KNYT
  surfaces migrate to derive their stage from it incrementally (each its own
  change — no big-bang rewrite).
- Unblocks the CFS-035 inv.progression.* journey-depth node (was blocked on the
  two-model conflict). Run record registered.

Round-trip mapping verified 12/12 via harness + parse gate.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator direction #2: KNYT Journey becomes the KNYT-cartridge projection of
ExperienceStage, with ExperienceStage surviving as the universal model.

- services/journey/stageReconciliation.ts: the canonical bidirectional mapping
  KNYT JourneyStage <-> universal ExperienceStage (prospect->setup, acolyte->
  alpha_activation, keta->launch, keji->growth, first/zero->scale; side-states
  by engagement posture) + experienceStageForJourney/journeyStageForExperience +
  UNIVERSAL_STAGE_ORDER. Pure, deterministic.
- Establishes ExperienceStage as the one progression axis; KNYT stages are a
  projection layered on it, not a competing progression. The runtime KNYT
  surfaces migrate to derive their stage from it incrementally (each its own
  change — no big-bang rewrite).
- Unblocks the CFS-035 inv.progression.* journey-depth node (was blocked on the
  two-model conflict). Run record registered.

Round-trip mapping verified 12/12 via harness + parse gate.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-18_journey-stage-reconciliation.md` |
| Added | `services/journey/stageReconciliation.ts` |

## Stats

 3 files changed, 147 insertions(+)
