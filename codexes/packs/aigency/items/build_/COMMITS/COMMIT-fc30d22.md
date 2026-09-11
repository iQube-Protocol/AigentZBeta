# Commit Brief: `fc30d22` — Bind EXP-P1 remediation profile: populate the canonical retrospective

| Field | Value |
|-------|-------|
| SHA | [`fc30d22`](https://github.com/iQube-Protocol/AigentZBeta/commit/fc30d229f0054fe865375fc13d4a8060988279a4) |
| Author | Claude |
| Date | 2026-08-30T03:15:24Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Bind EXP-P1 remediation profile: populate the canonical retrospective

types/crystalRemediation.ts: EXP_P1_REMEDIATION_PROFILE_V1.retrospective
is populated from the canonical endpoint's reported result
(reproducedReviewerObjections: true, verifiedAgainstFreeze: false,
admitted via the 2026-08-30 legacy-substrate governance ruling
GOV-2026-08-30-EXP-P1-VP1-LEGACY-SUBSTRATE-001). RetrospectiveFalsificationRef
is extended (all-optional, so a ref predating this change stays valid)
with instrument-suite identity, invariant/distinct-statement counts,
per-concern results, and substrateAdmissibility/legacyContentVerification
refs, so this evidentiary provenance travels with the STORED profile,
never only a live route response. remediationProfileBindingState is
UNMODIFIED and independently derives 'bound' from these contents; this
change does not hand-set binding, bound, or the measurement-layer
gate anywhere.

Verified locally (pure functions, no DB):
  - remediationProfileBindingState(profile) => { binding: 'bound', bindingGaps: [] }
  - evaluateMeasurementLayerGate(await resolveMeasurementLayerReadiness('EXP-P1'))
    => { satisfied: true, binding: 'bound', gaps: [] }

Two fields are honestly reconstructed rather than a byte-copy of the
live endpoint's raw JSON (the operator's report was a structured
summary): computedAt (the profile-population timestamp; nothing
downstream reads it) and each concern's instrumentFinding (the
operator's own reported summary phrase). Every other value is either
the operator's literal reported figure or this file's own
already-verified constant.

instrument-falsification/route.ts: corrected the now-inaccurate
readOnlyNote/inline comment that called legacyContentVerification
disclosure-only — it can now contribute to
retrospective.substrateAdmissibility under the ratified governing
ruling.

Tests updated/added across 4 files: fail-closed proofs using the REAL
EXP-P1 profile (removing or corrupting the stored retrospective
returns binding/gate to fail-closed); two orchestrator tests whose
premise was 'EXP-P1's default gate is closed' now force it closed
explicitly, since that is no longer EXP-P1's natural state.

No change to composeCrystalRetrospectiveFalsification,
crystalRetrospectiveSubstrateAdmissibility.ts,
remediationProfileBindingState, evaluateMeasurementLayerGate, or any
other gate logic in this commit — only the profile's stored data and
test coverage.
```

## Body

types/crystalRemediation.ts: EXP_P1_REMEDIATION_PROFILE_V1.retrospective
is populated from the canonical endpoint's reported result
(reproducedReviewerObjections: true, verifiedAgainstFreeze: false,
admitted via the 2026-08-30 legacy-substrate governance ruling
GOV-2026-08-30-EXP-P1-VP1-LEGACY-SUBSTRATE-001). RetrospectiveFalsificationRef
is extended (all-optional, so a ref predating this change stays valid)
with instrument-suite identity, invariant/distinct-statement counts,
per-concern results, and substrateAdmissibility/legacyContentVerification
refs, so this evidentiary provenance travels with the STORED profile,
never only a live route response. remediationProfileBindingState is
UNMODIFIED and independently derives 'bound' from these contents; this
change does not hand-set binding, bound, or the measurement-layer
gate anywhere.

Verified locally (pure functions, no DB):
  - remediationProfileBindingState(profile) => { binding: 'bound', bindingGaps: [] }
  - evaluateMeasurementLayerGate(await resolveMeasurementLayerReadiness('EXP-P1'))
    => { satisfied: true, binding: 'bound', gaps: [] }

Two fields are honestly reconstructed rather than a byte-copy of the
live endpoint's raw JSON (the operator's report was a structured
summary): computedAt (the profile-population timestamp; nothing
downstream reads it) and each concern's instrumentFinding (the
operator's own reported summary phrase). Every other value is either
the operator's literal reported figure or this file's own
already-verified constant.

instrument-falsification/route.ts: corrected the now-inaccurate
readOnlyNote/inline comment that called legacyContentVerification
disclosure-only — it can now contribute to
retrospective.substrateAdmissibility under the ratified governing
ruling.

Tests updated/added across 4 files: fail-closed proofs using the REAL
EXP-P1 profile (removing or corrupting the stored retrospective
returns binding/gate to fail-closed); two orchestrator tests whose
premise was 'EXP-P1's default gate is closed' now force it closed
explicitly, since that is no longer EXP-P1's natural state.

No change to composeCrystalRetrospectiveFalsification,
crystalRetrospectiveSubstrateAdmissibility.ts,
remediationProfileBindingState, evaluateMeasurementLayerGate, or any
other gate logic in this commit — only the profile's stored data and
test coverage.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/research/crystal/[experimentId]/instrument-falsification/route.ts` |
| Modified | `tests/crystal-instrument-falsification-route.test.ts` |
| Modified | `tests/crystal-instrument-remediation.test.ts` |
| Modified | `tests/exp-p1-remediation-profile.test.ts` |
| Modified | `tests/research-programme-orchestrator.test.ts` |
| Modified | `types/crystalRemediation.ts` |

## Stats

 7 files changed, 314 insertions(+), 76 deletions(-)
