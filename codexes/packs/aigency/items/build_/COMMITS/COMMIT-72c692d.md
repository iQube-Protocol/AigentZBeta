# Commit Brief: `72c692d` — Add Crystal-wide internal-pilot execution designation (frozen generations are immutable; lineages are evolutionary)

| Field | Value |
|-------|-------|
| SHA | [`72c692d`](https://github.com/iQube-Protocol/AigentZBeta/commit/72c692dc7b0da25ad53cfd0c9d72ed7052fbfb72) |
| Author | Claude |
| Date | 2026-09-05T21:37:39Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add Crystal-wide internal-pilot execution designation (frozen generations are immutable; lineages are evolutionary)

Operator ruling: a Crystal freeze makes that generation immutable; it does
not decide whether the generation may be used for a smaller, explicitly-
designated, non-confirmatory purpose while known scientific-readiness
limitations remain on the record. checkFreezeGate previously required
readiness.ok (every scientific-readiness check passing) unconditionally,
with no way to freeze "for pilot use only" while honestly-measured
deficiencies stayed recorded.

types/research.ts adds ArtifactExecutionDesignation ('confirmatory' |
'internal-pilot', default 'confirmatory' — zero behavior change for every
existing/untouched artifact) and ScientificDeviation (one named, still-
failing check + the operator's rationale + measuredDetail computed
server-side from the live report, never caller input). Generalized as a
Crystal-wide invariant, not an EXP-P1 special case.

checkFreezeGate: an 'internal-pilot' freeze proceeds only when EVERY
currently-failing scientific-readiness check is individually named in
scientificDeviations — an unnamed failure still blocks unconditionally,
and readiness.ok/every check's passed/detail are never altered. No check
text, tier, threshold, namespace ontology, remediation profile, or the
40% guard was touched.

freezeArtifact now persists freezeRationale, executionDesignation,
scientificDeviations, and the full readinessReportAtFreeze (previously
validated-then-discarded / never captured) — the freeze act commits to
exactly what was measured, never a redone or re-argued version.

nextGovernedActionForFrozenCrystal exposes "Run EXP-P1 internally (pilot)"
/ "Run EXP-P1 (confirmatory)" as the next governed action from a frozen
crystal-version artifact — exposure only (`executed: false` always); no
execution-run runner exists anywhere in this codebase, and building one is
a separate, larger change.

Resolution record + candidate invariant recorded per the Resolution ->
Invariant Loop (status: candidate, not auto-ratified). The live freeze of
EXP-P1/crystal-vP2 itself is NOT performed here — needs an admin persona/
service-role session, which this one lacks; a 63-vs-64-invariant count
discrepancy between the operator's ruling and a same-day update doc was
found and should be reconciled before that freeze is invoked.

33 new tests + 707 across the full Crystal/research test surface (38
files) pass; tsc --noEmit baseline holds at 679, zero new errors.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EGP1sZh5ka4XcFutt5UAsc
```

## Body

Operator ruling: a Crystal freeze makes that generation immutable; it does
not decide whether the generation may be used for a smaller, explicitly-
designated, non-confirmatory purpose while known scientific-readiness
limitations remain on the record. checkFreezeGate previously required
readiness.ok (every scientific-readiness check passing) unconditionally,
with no way to freeze "for pilot use only" while honestly-measured
deficiencies stayed recorded.

types/research.ts adds ArtifactExecutionDesignation ('confirmatory' |
'internal-pilot', default 'confirmatory' — zero behavior change for every
existing/untouched artifact) and ScientificDeviation (one named, still-
failing check + the operator's rationale + measuredDetail computed
server-side from the live report, never caller input). Generalized as a
Crystal-wide invariant, not an EXP-P1 special case.

checkFreezeGate: an 'internal-pilot' freeze proceeds only when EVERY
currently-failing scientific-readiness check is individually named in
scientificDeviations — an unnamed failure still blocks unconditionally,
and readiness.ok/every check's passed/detail are never altered. No check
text, tier, threshold, namespace ontology, remediation profile, or the
40% guard was touched.

freezeArtifact now persists freezeRationale, executionDesignation,
scientificDeviations, and the full readinessReportAtFreeze (previously
validated-then-discarded / never captured) — the freeze act commits to
exactly what was measured, never a redone or re-argued version.

nextGovernedActionForFrozenCrystal exposes "Run EXP-P1 internally (pilot)"
/ "Run EXP-P1 (confirmatory)" as the next governed action from a frozen
crystal-version artifact — exposure only (`executed: false` always); no
execution-run runner exists anywhere in this codebase, and building one is
a separate, larger change.

Resolution record + candidate invariant recorded per the Resolution ->
Invariant Loop (status: candidate, not auto-ratified). The live freeze of
EXP-P1/crystal-vP2 itself is NOT performed here — needs an admin persona/
service-role session, which this one lacks; a 63-vs-64-invariant count
discrepancy between the operator's ruling and a same-day update doc was
found and should be reconciled before that freeze is invoked.

33 new tests + 707 across the full Crystal/research test surface (38
files) pass; tsc --noEmit baseline holds at 679, zero new errors.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EGP1sZh5ka4XcFutt5UAsc

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/research/crystal/[experimentId]/freeze/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-05-FROZEN-GENERATIONS-IMMUTABLE-LINEAGES-EVOLUTIONARY-001.json` |
| Added | `codexes/packs/agentiq/resolution-records/records/RES-2026-09-05-CRYSTAL-FREEZE-EXECUTION-DESIGNATION-001.json` |
| Added | `codexes/packs/agentiq/updates/2026-09-05_crystal-vp2-internal-pilot-execution-designation.md` |
| Modified | `services/research/artifacts.ts` |
| Modified | `tests/crystal-freeze-route.test.ts` |
| Added | `tests/crystal-internal-pilot-execution-designation.test.ts` |
| Modified | `types/research.ts` |

## Stats

 9 files changed, 1016 insertions(+), 12 deletions(-)
