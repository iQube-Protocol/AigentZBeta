# Commit Brief: `447396c` — Fix EXP-P1 retrospective dataflow: assess the recovered frozen population

| Field | Value |
|-------|-------|
| SHA | [`447396c`](https://github.com/iQube-Protocol/AigentZBeta/commit/447396c25ffdd5b75fe958b84c88739719cbf0fb) |
| Author | Claude |
| Date | 2026-08-30T00:55:31Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix EXP-P1 retrospective dataflow: assess the recovered frozen population

buildFrozenCrystalManifest now correctly recovers all 15 frozen vP1
members (including 4 now superseded), but the instrument-falsification
route still fed the retrospective's four hardened instruments an
INDEPENDENT runCrystalReadinessReport({experimentId, crystalDomain})
call, which re-applies its own status: ['validated','canonical'] filter
and silently substituted today's 11-member corpus for the 15-member
population the manifest had just recovered.

- crystalFrozenManifest.ts: expose the raw recovered population
  unconditionally as `recoveredInvariants`, regardless of
  verifiedAgainstFreeze — distinct from the strict, hash-gated `members`
  field, which stays null until the hash genuinely verifies.
- crystalReadiness.ts: add an optional `invariants` override to
  CrystalReadinessInput. When supplied, listInvariants is never called;
  every check (duplicate detection, inferential capacity, selection-space,
  boundary-coverage, the graph checks) runs completely unchanged over
  whatever population it receives. Every live/current-state caller omits
  it and is unaffected.
- instrument-falsification/route.ts: thread manifest.recoveredInvariants
  into runCrystalReadinessReport instead of letting it re-query. Falls
  back to a live query only when no frozen artifact exists at all.

verifiedAgainstFreeze remains fail-closed — composeCrystalRetrospectiveFalsification
already gates reproducedReviewerObjections on it independently of the
assessed population, so this dataflow fix does not touch that gate.

No change to Austin mappings, duplicate detector thresholds, the
relational instrument, the population formula, the namespace
requirement, the measurement-layer gate, the remediation profile, or
any historical invariant row.
```

## Body

buildFrozenCrystalManifest now correctly recovers all 15 frozen vP1
members (including 4 now superseded), but the instrument-falsification
route still fed the retrospective's four hardened instruments an
INDEPENDENT runCrystalReadinessReport({experimentId, crystalDomain})
call, which re-applies its own status: ['validated','canonical'] filter
and silently substituted today's 11-member corpus for the 15-member
population the manifest had just recovered.

- crystalFrozenManifest.ts: expose the raw recovered population
  unconditionally as `recoveredInvariants`, regardless of
  verifiedAgainstFreeze — distinct from the strict, hash-gated `members`
  field, which stays null until the hash genuinely verifies.
- crystalReadiness.ts: add an optional `invariants` override to
  CrystalReadinessInput. When supplied, listInvariants is never called;
  every check (duplicate detection, inferential capacity, selection-space,
  boundary-coverage, the graph checks) runs completely unchanged over
  whatever population it receives. Every live/current-state caller omits
  it and is unaffected.
- instrument-falsification/route.ts: thread manifest.recoveredInvariants
  into runCrystalReadinessReport instead of letting it re-query. Falls
  back to a live query only when no frozen artifact exists at all.

verifiedAgainstFreeze remains fail-closed — composeCrystalRetrospectiveFalsification
already gates reproducedReviewerObjections on it independently of the
assessed population, so this dataflow fix does not touch that gate.

No change to Austin mappings, duplicate detector thresholds, the
relational instrument, the population formula, the namespace
requirement, the measurement-layer gate, the remediation profile, or
any historical invariant row.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/research/crystal/[experimentId]/instrument-falsification/route.ts` |
| Modified | `services/research/crystalFrozenManifest.ts` |
| Modified | `services/research/crystalReadiness.ts` |
| Added | `tests/crystal-instrument-falsification-route.test.ts` |

## Stats

 5 files changed, 270 insertions(+), 4 deletions(-)
