# Commit Brief: `bbaa8f3` — Author EXP-P1 CrystalRemediationProfile v1 from Review #001 + frozen protocol

| Field | Value |
|-------|-------|
| SHA | [`bbaa8f3`](https://github.com/iQube-Protocol/AigentZBeta/commit/bbaa8f3aba2b4e19354592b8f8311dfadba2eda2) |
| Author | Claude |
| Date | 2026-08-29T20:45:32Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Author EXP-P1 CrystalRemediationProfile v1 from Review #001 + frozen protocol

Populates BOUND_CRYSTAL_REMEDIATION_PROFILES (types/crystalRemediation.ts)
with a real profile instance -- the first this file has ever carried --
built entirely from re-readable, hash-verifiable repo artifacts, never
from prose:

  - IRL Review #001 (Austin) -- the review-cycle write-up quoting the
    reviewer's four findings verbatim
    (codexes/packs/agentiq/updates/2026-08-26_crystal-vp1-review-cycle-1-instrument-remediation.md)
  - RES-2026-08-26-CRYSTAL-INSTRUMENT-MEASUREMENT-LAYER-001 -- the
    structured resolution record
  - The frozen EXP-P1 protocol README (SS3.6/SS6 collection-size guard,
    SS5.2 task design, SS4 selection procedure, SS5.1/SS5.4 boundary
    requirements)

Each sourceRef's contentHash is a real sha256 of that file's bytes,
independently reproducible with sha256sum. The four checkMappings bind
each Austin finding to the exact hardened check that measures it
(duplicate-detection, derivation-headroom, selection-space,
boundary-coverage) -- all four confirmed against the LIVE
crystalReadinessCheckNames() contract, not asserted. populationFormula
and instrumentSuite are the REAL output of
deriveCrystalPopulationRequirement({}) and
crystalInstrumentSuiteIdentity() (run via tsx and copied verbatim -- 24
tasks -> 60-member floor, not the reviewer's illustrative 50-75).
boundaryRequirement names all 15 INVARIANT_NAMESPACES, mayNarrowBoundary
permanently false.

retrospective: null, deliberately. Computing
CrystalRetrospectiveFalsification requires a live read of the frozen
Crystal vP1 artifact via Supabase (runCrystalReadinessReport +
buildFrozenCrystalManifest), which this authoring pass had no live
database access to perform. remediationProfileBindingState() therefore
correctly derives 'unbound-retrospective-not-reproduced' for this
profile -- not 'bound', and not the old 'unbound-no-artifact' either:
a real, more specific, honestly-reported gap. The sequencing gate
(evaluateMeasurementLayerGate, researchProgrammeOrchestrator.ts) is
UNCHANGED -- this commit only authors the DATA it consumes as
configuration, per its own established design. No retrospective verdict
is asserted; none was observed.

To complete binding: GET /api/research/crystal/EXP-P1/instrument-falsification
(steward/admin auth) and, iff reproducedReviewerObjections === true,
replace retrospective: null with that response's retrospective object
verbatim -- documented in the profile's own comment.

Updates 2 pre-existing canaries that asserted the empty-registry state
(tests/research-programme-orchestrator.test.ts,
tests/crystal-instrument-remediation.test.ts) to assert the new,
correct state instead: EXP-P1 has a real, source-complete profile that
is still honestly unbound; a genuinely unregistered experiment id still
returns unbound-no-artifact. Adds tests/exp-p1-remediation-profile.test.ts
(12 tests): every sourceRef's contentHash matches a live re-hash of its
file, every checkMapping's bearsOnChecks exists in the live instrument
contract, the population formula and instrument suite identity match
their live functions' output exactly, and the boundary requirement
names the full 15-namespace ontology. Full crystal/orchestrator/parity
suite (307 tests across 7 files) plus tsc --noEmit verified clean
(680 pre-existing, unrelated errors unchanged).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

Populates BOUND_CRYSTAL_REMEDIATION_PROFILES (types/crystalRemediation.ts)
with a real profile instance -- the first this file has ever carried --
built entirely from re-readable, hash-verifiable repo artifacts, never
from prose:

  - IRL Review #001 (Austin) -- the review-cycle write-up quoting the
    reviewer's four findings verbatim
    (codexes/packs/agentiq/updates/2026-08-26_crystal-vp1-review-cycle-1-instrument-remediation.md)
  - RES-2026-08-26-CRYSTAL-INSTRUMENT-MEASUREMENT-LAYER-001 -- the
    structured resolution record
  - The frozen EXP-P1 protocol README (SS3.6/SS6 collection-size guard,
    SS5.2 task design, SS4 selection procedure, SS5.1/SS5.4 boundary
    requirements)

Each sourceRef's contentHash is a real sha256 of that file's bytes,
independently reproducible with sha256sum. The four checkMappings bind
each Austin finding to the exact hardened check that measures it
(duplicate-detection, derivation-headroom, selection-space,
boundary-coverage) -- all four confirmed against the LIVE
crystalReadinessCheckNames() contract, not asserted. populationFormula
and instrumentSuite are the REAL output of
deriveCrystalPopulationRequirement({}) and
crystalInstrumentSuiteIdentity() (run via tsx and copied verbatim -- 24
tasks -> 60-member floor, not the reviewer's illustrative 50-75).
boundaryRequirement names all 15 INVARIANT_NAMESPACES, mayNarrowBoundary
permanently false.

retrospective: null, deliberately. Computing
CrystalRetrospectiveFalsification requires a live read of the frozen
Crystal vP1 artifact via Supabase (runCrystalReadinessReport +
buildFrozenCrystalManifest), which this authoring pass had no live
database access to perform. remediationProfileBindingState() therefore
correctly derives 'unbound-retrospective-not-reproduced' for this
profile -- not 'bound', and not the old 'unbound-no-artifact' either:
a real, more specific, honestly-reported gap. The sequencing gate
(evaluateMeasurementLayerGate, researchProgrammeOrchestrator.ts) is
UNCHANGED -- this commit only authors the DATA it consumes as
configuration, per its own established design. No retrospective verdict
is asserted; none was observed.

To complete binding: GET /api/research/crystal/EXP-P1/instrument-falsification
(steward/admin auth) and, iff reproducedReviewerObjections === true,
replace retrospective: null with that response's retrospective object
verbatim -- documented in the profile's own comment.

Updates 2 pre-existing canaries that asserted the empty-registry state
(tests/research-programme-orchestrator.test.ts,
tests/crystal-instrument-remediation.test.ts) to assert the new,
correct state instead: EXP-P1 has a real, source-complete profile that
is still honestly unbound; a genuinely unregistered experiment id still
returns unbound-no-artifact. Adds tests/exp-p1-remediation-profile.test.ts
(12 tests): every sourceRef's contentHash matches a live re-hash of its
file, every checkMapping's bearsOnChecks exists in the live instrument
contract, the population formula and instrument suite identity match
their live functions' output exactly, and the boundary requirement
names the full 15-namespace ontology. Full crystal/orchestrator/parity
suite (307 tests across 7 files) plus tsc --noEmit verified clean
(680 pre-existing, unrelated errors unchanged).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `tests/crystal-instrument-remediation.test.ts` |
| Added | `tests/exp-p1-remediation-profile.test.ts` |
| Modified | `tests/research-programme-orchestrator.test.ts` |
| Modified | `types/crystalRemediation.ts` |

## Stats

 5 files changed, 439 insertions(+), 16 deletions(-)
