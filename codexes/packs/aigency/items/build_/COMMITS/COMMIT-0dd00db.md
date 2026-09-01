# Commit Brief: `0dd00db` — Add ExperiencePrescription assembler bridging Experience Matrix/Guide into AEE

| Field | Value |
|-------|-------|
| SHA | [`0dd00db`](https://github.com/iQube-Protocol/AigentZBeta/commit/0dd00dbf2716589f12dbbf6603a36f11e44c6ff5) |
| Author | Claude |
| Date | 2026-09-01T13:02:14Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add ExperiencePrescription assembler bridging Experience Matrix/Guide into AEE

Phase 0 audit found CFS-007's renderer-neutral ExperiencePrescription seam
(types/experienceRenderer.ts) and SPEC-AEE-001's live AEE loop
(journeyAeeOrchestrator.ts) coexisting with zero cross-references — the
prescription contract had two renderer consumers (liquid, a2ui) but nothing
producing it. assembleExperiencePrescription is the first bridge: it reads
an already-computed JourneyAeeOutcome (WHICH reachable stage, never
recomputed) and the uncertainty-safe PersonaMatrixCalibration (HOW richly to
present it) and emits the existing ExperiencePrescription type — no second
matrix model, no second NBE engine, and nativeProvider.ts's ranking logic is
untouched (closed per c330c32ab).

Depth is derived from the Experience Matrix engagement axis
(Recipient/Selector -> pill, Modifier/Producer -> capsule, Builder/Steward
-> mini_runtime), substituted to the closest depth a host actually supports
when it can't render the preferred one. An uncertain matrix read still falls
back to the same safe pill a genuine beginner would see, but is marked
explicitly via props.matrixUncertain/matrixUnreadableSources so it never
masquerades as a confirmed beginner state.

Wired additively into both bridge state routes (KNYTS, CI) inside the same
fail-open try/catch as the existing AEE call — a prescription failure can
never block the response, same discipline as the AEE call itself. Tests
prove identical Journey/AEE outcome + different experience context yields
different depth while journeyId/stageId/disposition/ctaAction stay
byte-identical, across DISCOVER/LEARN/EXPLORE.

[merge review/irl-scoped-restoration-2026-08-27]
```

## Body

Phase 0 audit found CFS-007's renderer-neutral ExperiencePrescription seam
(types/experienceRenderer.ts) and SPEC-AEE-001's live AEE loop
(journeyAeeOrchestrator.ts) coexisting with zero cross-references — the
prescription contract had two renderer consumers (liquid, a2ui) but nothing
producing it. assembleExperiencePrescription is the first bridge: it reads
an already-computed JourneyAeeOutcome (WHICH reachable stage, never
recomputed) and the uncertainty-safe PersonaMatrixCalibration (HOW richly to
present it) and emits the existing ExperiencePrescription type — no second
matrix model, no second NBE engine, and nativeProvider.ts's ranking logic is
untouched (closed per c330c32ab).

Depth is derived from the Experience Matrix engagement axis
(Recipient/Selector -> pill, Modifier/Producer -> capsule, Builder/Steward
-> mini_runtime), substituted to the closest depth a host actually supports
when it can't render the preferred one. An uncertain matrix read still falls
back to the same safe pill a genuine beginner would see, but is marked
explicitly via props.matrixUncertain/matrixUnreadableSources so it never
masquerades as a confirmed beginner state.

Wired additively into both bridge state routes (KNYTS, CI) inside the same
fail-open try/catch as the existing AEE call — a prescription failure can
never block the response, same discipline as the AEE call itself. Tests
prove identical Journey/AEE outcome + different experience context yields
different depth while journeyId/stageId/disposition/ctaAction stay
byte-identical, across DISCOVER/LEARN/EXPLORE.

[merge review/irl-scoped-restoration-2026-08-27]

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/journey/constitutional-internet-bridge/state/route.ts` |
| Modified | `app/api/journey/knyts-bridge/state/route.ts` |
| Added | `services/adaptive/experiencePrescriptionAssembly.ts` |
| Modified | `tests/ci-bridge-state-aee-wiring.test.ts` |
| Added | `tests/experience-prescription-assembly.test.ts` |
| Modified | `tests/knyts-bridge-state-aee-wiring.test.ts` |

## Stats

 7 files changed, 495 insertions(+), 9 deletions(-)
