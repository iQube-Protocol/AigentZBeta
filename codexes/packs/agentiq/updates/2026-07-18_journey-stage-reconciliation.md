# Journey stage reconciliation — ExperienceStage universal, KNYT journey its projection

**Date:** 2026-07-18
**Operator direction:** "KNYT Journey should really be the KNYT Cartridge version of the
ExperienceStage so reconcile as such with ExperienceStage surviving as the universal."

---

## What changed

The platform had **two parallel, unreconciled stage models** (flagged in the CFS-035 node map as
the `inv.progression.*` prerequisite):

- **ExperienceStage** (`services/iqube/experienceQube.ts`) — `setup → alpha_activation → launch →
  growth → scale` — the venture/experience lifecycle spine.
- **JourneyStage** (`types/orchestration.ts`) — `prospect → acolyte → keta → keji → first → zero`
  (+ side-state variants) — the KNYT world journey.

This increment makes **ExperienceStage the universal model** and expresses the KNYT journey as a
**bidirectional projection** of it — `services/journey/stageReconciliation.ts`:

| KNYT JourneyStage | projects from ExperienceStage |
|---|---|
| prospect | setup |
| acolyte | alpha_activation |
| keta | launch |
| keji | growth |
| first | scale |
| zero | scale (KNYT-internal deepening of `first`) |
| investor_reactivation_candidate | growth (side-state) |
| collector_only | alpha_activation (side-state) |
| creator_contributor | launch (side-state) |

Helpers: `experienceStageForJourney(j)`, `journeyStageForExperience(e)`, `UNIVERSAL_STAGE_ORDER`,
`universalStageIndex(e)`. Pure, deterministic, no I/O.

## Why this shape

The KNYT journey is now a **cartridge projection layered on the one universal progression axis**,
not a competing progression. The six linear KNYT stages map onto the five universal stages
(`first` and `zero` are both expressions of `scale` — `zero` a KNYT-internal mastery deepening the
cartridge owns, not the universal spine). Side-states map by engagement posture.

## Migration path (incremental follow-on)

The KNYT journey runtime surfaces still compute their stage in isolation today
(`app/api/runtime/nbe/route.ts`, `app/api/runtime/journey/cards/route.ts`, the `journey_states` /
`nbe_plans` tables). They migrate — incrementally, each its own change — to **derive** the KNYT
stage from the persona's universal ExperienceStage via `journeyStageForExperience`, and to report
a persona's universal stage from a KNYT stage via `experienceStageForJourney`. No big-bang
rewrite; the reconciliation module is the single seam they adopt.

## Unblocks

The CFS-035 **`inv.progression.*` journey-depth Invariant Decision Node** was blocked on this
reconciliation (a node can't project a coherent "next depth step" across two competing stage
models). With ExperienceStage universal, the progression node can now be built on the one axis
(`UNIVERSAL_STAGE_ORDER` + `ExperienceDepth`) — the next node in the engine rollout.
