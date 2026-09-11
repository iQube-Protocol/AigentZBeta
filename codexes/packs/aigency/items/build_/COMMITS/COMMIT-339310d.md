# Commit Brief: `339310d` — Add retrospective substrate admissibility (governance ruling 2026-08-30)

| Field | Value |
|-------|-------|
| SHA | [`339310d`](https://github.com/iQube-Protocol/AigentZBeta/commit/339310d0e336a0595068100e08238f6460052a02) |
| Author | Claude |
| Date | 2026-08-30T02:42:02Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add retrospective substrate admissibility (governance ruling 2026-08-30)

verifiedAgainstFreeze is unchanged: it stays the strict byte-exact
answer. This adds an explicit admissibility layer deciding what
retrospective SUBSTRATE composeCrystalRetrospectiveFalsification may
score, and tightens reproducedReviewerObjections to require: (1) the
retrospective substrate is admissible; (2) all four mapped reviewer
concerns are independently reproduced; (3) the CURRENT instrument-suite
identity matches the remediation profile's own recorded one; (4) no
blocking gap remains.

services/research/crystalRetrospectiveSubstrateAdmissibility.ts:
derives 'byte-exact' | 'legacy-scientific-content' | 'inadmissible'.
legacy-scientific-content ONLY for the ONE (experimentId, artifactId)
pair a ratified governance ruling names explicitly (EXP-P1 /
crystal-vP1) — an identical legacyContentVerification.state for any
other experiment/artifact is never automatically admissible.

crystalInstrumentFalsification.ts / instrument-falsification/route.ts:
threads artifactId, legacyContentVerification and
remediationProfileInstrumentSuite through (all optional, so any older
caller keeps its exact prior behavior). Reports substrateAdmissibility
(with the governing ruling, when one applies) and
instrumentSuiteMatchesProfile on the retrospective, so the governing
rule/version is visible in the evidence rather than implied by a
boolean.

types/crystalRemediation.ts is NOT touched — EXP_P1_REMEDIATION_PROFILE_V1.retrospective
stays null until a live rerun of the canonical endpoint confirms
reproducedReviewerObjections: true, at which point that exact result
is copied in verbatim and the existing remediationProfileBindingState
derivation (unmodified) determines binding on its own.

16 new/updated tests prove: byte-exact substrates remain admissible
without any legacy rule; vP1 is admissible specifically under the
versioned ruling; any legacy blocking gap fails closed; all four
objections must still independently reproduce; instrument-suite
mismatch fails closed; verifiedAgainstFreeze stays false through the
legacy-admissible path; and profile binding tracks a REAL
composer-produced verdict end-to-end, never a hand-authored boolean.
```

## Body

verifiedAgainstFreeze is unchanged: it stays the strict byte-exact
answer. This adds an explicit admissibility layer deciding what
retrospective SUBSTRATE composeCrystalRetrospectiveFalsification may
score, and tightens reproducedReviewerObjections to require: (1) the
retrospective substrate is admissible; (2) all four mapped reviewer
concerns are independently reproduced; (3) the CURRENT instrument-suite
identity matches the remediation profile's own recorded one; (4) no
blocking gap remains.

services/research/crystalRetrospectiveSubstrateAdmissibility.ts:
derives 'byte-exact' | 'legacy-scientific-content' | 'inadmissible'.
legacy-scientific-content ONLY for the ONE (experimentId, artifactId)
pair a ratified governance ruling names explicitly (EXP-P1 /
crystal-vP1) — an identical legacyContentVerification.state for any
other experiment/artifact is never automatically admissible.

crystalInstrumentFalsification.ts / instrument-falsification/route.ts:
threads artifactId, legacyContentVerification and
remediationProfileInstrumentSuite through (all optional, so any older
caller keeps its exact prior behavior). Reports substrateAdmissibility
(with the governing ruling, when one applies) and
instrumentSuiteMatchesProfile on the retrospective, so the governing
rule/version is visible in the evidence rather than implied by a
boolean.

types/crystalRemediation.ts is NOT touched — EXP_P1_REMEDIATION_PROFILE_V1.retrospective
stays null until a live rerun of the canonical endpoint confirms
reproducedReviewerObjections: true, at which point that exact result
is copied in verbatim and the existing remediationProfileBindingState
derivation (unmodified) determines binding on its own.

16 new/updated tests prove: byte-exact substrates remain admissible
without any legacy rule; vP1 is admissible specifically under the
versioned ruling; any legacy blocking gap fails closed; all four
objections must still independently reproduce; instrument-suite
mismatch fails closed; verifiedAgainstFreeze stays false through the
legacy-admissible path; and profile binding tracks a REAL
composer-produced verdict end-to-end, never a hand-authored boolean.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/research/crystal/[experimentId]/instrument-falsification/route.ts` |
| Modified | `services/research/crystalInstrumentFalsification.ts` |
| Added | `services/research/crystalRetrospectiveSubstrateAdmissibility.ts` |
| Modified | `tests/crystal-instrument-falsification-route.test.ts` |
| Modified | `tests/crystal-instrument-remediation.test.ts` |
| Added | `tests/crystal-retrospective-substrate-admissibility.test.ts` |

## Stats

 7 files changed, 613 insertions(+), 19 deletions(-)
