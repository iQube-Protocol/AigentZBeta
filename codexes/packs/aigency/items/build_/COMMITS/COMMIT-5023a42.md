# Commit Brief: `5023a42` — Fix Research Copilot targeted-acquisition approval timeout

| Field | Value |
|-------|-------|
| SHA | [`5023a42`](https://github.com/iQube-Protocol/AigentZBeta/commit/5023a42a971b1e63ada7d55f636e8797d2a1ed8c) |
| Author | Claude |
| Date | 2026-08-31T03:48:19Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Research Copilot targeted-acquisition approval timeout

POST .../acquisition/approve recomposed a FULL CrystalReadinessReport
synchronously before writing — ten checks including duplicate-detection's
two O(n^2) pairwise passes and an intra-crystal edge fetch, none of which
acquisitionBriefApplies/buildCrystalAcquisitionBrief ever read. At Crystal
v2's now-larger corpus (inherited predecessor + successor material through
Stage 8/9), that unnecessary recomposition alone could exceed a 15s request
budget with no deadline racing it.

Adds runCrystalReadinessReport({ scope: 'acquisition-gate' }) — a bounded
projection that skips exactly those two computations while computing every
field the brief actually reads identically to the full report. Adds
composeAcquisitionPreconditions, which races that composition against the
same STATE_COMPOSITION_DEADLINE_MS the orchestrator's own hard backstop
already uses (reused, never duplicated) and fails closed with a clean,
retryable 503 on timeout — never widens or removes the pre-write freshness
check; a stale acquisitionBriefApplies verdict is still refused with 409.

Also closes a real safety-bypass gap an audit surfaced: the Laboratory's
"Approve & start acquisition" control called the raw corpus-scout
institution-discovery route directly, with no acquisitionBriefApplies
precondition and no crystal_acquisition_approvals write at all — a
lower-level path that bypassed every safety semantic the Copilot's button
enforces. It now drives the same two canonical routes the Copilot uses.
Removes the "N institution(s) attempted ... N found" wording that could
misread a zero count as "the approved acquisition produced zero results";
the legacy institution-discovery route is untouched for its own unrelated
Corpus Scout use.

No acquisition, invariant, edge, readiness threshold, remediation profile,
or EXP-P1 scientific state was changed.
```

## Body

POST .../acquisition/approve recomposed a FULL CrystalReadinessReport
synchronously before writing — ten checks including duplicate-detection's
two O(n^2) pairwise passes and an intra-crystal edge fetch, none of which
acquisitionBriefApplies/buildCrystalAcquisitionBrief ever read. At Crystal
v2's now-larger corpus (inherited predecessor + successor material through
Stage 8/9), that unnecessary recomposition alone could exceed a 15s request
budget with no deadline racing it.

Adds runCrystalReadinessReport({ scope: 'acquisition-gate' }) — a bounded
projection that skips exactly those two computations while computing every
field the brief actually reads identically to the full report. Adds
composeAcquisitionPreconditions, which races that composition against the
same STATE_COMPOSITION_DEADLINE_MS the orchestrator's own hard backstop
already uses (reused, never duplicated) and fails closed with a clean,
retryable 503 on timeout — never widens or removes the pre-write freshness
check; a stale acquisitionBriefApplies verdict is still refused with 409.

Also closes a real safety-bypass gap an audit surfaced: the Laboratory's
"Approve & start acquisition" control called the raw corpus-scout
institution-discovery route directly, with no acquisitionBriefApplies
precondition and no crystal_acquisition_approvals write at all — a
lower-level path that bypassed every safety semantic the Copilot's button
enforces. It now drives the same two canonical routes the Copilot uses.
Removes the "N institution(s) attempted ... N found" wording that could
misread a zero count as "the approved acquisition produced zero results";
the legacy institution-discovery route is untouched for its own unrelated
Corpus Scout use.

No acquisition, invariant, edge, readiness threshold, remediation profile,
or EXP-P1 scientific state was changed.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/research/programme/[experimentId]/acquisition/approve/route.ts` |
| Modified | `app/api/research/programme/[experimentId]/acquisition/run-step/route.ts` |
| Modified | `components/research/Track2ProgrammePanel.tsx` |
| Added | `services/research/crystalAcquisitionPrecondition.ts` |
| Modified | `services/research/crystalReadiness.ts` |
| Modified | `tests/crystal-acquisition-approve-route.test.ts` |
| Added | `tests/crystal-acquisition-precondition.test.ts` |
| Added | `tests/crystal-readiness-acquisition-gate-scope.test.ts` |

## Stats

 9 files changed, 849 insertions(+), 245 deletions(-)
