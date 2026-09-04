# Commit Brief: `12055d5` — Stop computing readiness 3x per Track 2 state read; add finer phase timing

| Field | Value |
|-------|-------|
| SHA | [`12055d5`](https://github.com/iQube-Protocol/AigentZBeta/commit/12055d52944eaa083c5176c145426bfb70470a2b) |
| Author | Claude |
| Date | 2026-09-04T17:16:22Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Stop computing readiness 3x per Track 2 state read; add finer phase timing

Live-blocking symptom: POST .../advance ("Run until you need me") against
EXP-P1 hit the 15s programme-state-composition safety budget and a retry
returned a bare 504. The earlier classify-provenance N+1 fix this session
(213536298) was real but not the dominant cost for the FULL composition.

Root cause: loadTrack2ProgrammeState's resolveFrozenPredecessorContext runs
unconditionally on every read to recover the frozen predecessor's member
ids, and did so by calling buildFrozenCrystalManifest at full fidelity —
using only recoveredInvariants and discarding knownLimitations and
derivedTopology entirely. Full-mode knownLimitations calls
runCrystalReadinessReport directly, then runCrystalStatisticsReport (which
calls runCrystalReadinessReport AGAIN internally) — so one
loadTrack2ProgrammeState call computed the crystal's readiness report
(each with its own O(n^2) duplicate-detection + inferential-capacity
passes) three times over the identical domain, plus a further discarded
edge fetch for derivedTopology, for a caller that reads none of it.

Fix: buildFrozenCrystalManifest gains scope: 'full' | 'membership-only'
(default 'full', every existing caller unchanged) — the same bounded-
projection discipline crystalReadiness.ts's own scope: 'full' |
'acquisition-gate' already established for this identical class of
problem. resolveFrozenPredecessorContext now passes 'membership-only'.
Verified via mocked call-count tests: 1 listInvariants + 0
listEdgesForInvariants vs 'full' scope's several, with IDENTICAL
verification/membership results in both scopes.

Also adds six further named phases to loadTrack2ProgrammeState's existing
(but too coarse) PhaseTimer instrumentation — parallel-signals,
cohort-reconciliation, provenance-triage, acquisition-pending-decision,
review-promote-queue, admission-queue — so the next timeout's forensic log
names which sub-composition was actually slow instead of one lumped
"programme-state-derivation" number. Additive only: input.timer stays
optional and every phase falls through to a plain call when absent.

Not verified: a live, credentialed timing re-test against real EXP-P1 data
volume — no SUPABASE_SERVICE_ROLE_KEY or authenticated admin session is
reachable from this sandbox. Local profiling via direct function calls
against the live project (anon key) confirmed round-trip shape but returned
RLS-empty results, so it could not reproduce production-scale timing. The
query-count reduction is proven deterministically; the real-data wall-clock
improvement needs verification from an environment with service-role or
authenticated-admin access.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Live-blocking symptom: POST .../advance ("Run until you need me") against
EXP-P1 hit the 15s programme-state-composition safety budget and a retry
returned a bare 504. The earlier classify-provenance N+1 fix this session
(213536298) was real but not the dominant cost for the FULL composition.

Root cause: loadTrack2ProgrammeState's resolveFrozenPredecessorContext runs
unconditionally on every read to recover the frozen predecessor's member
ids, and did so by calling buildFrozenCrystalManifest at full fidelity —
using only recoveredInvariants and discarding knownLimitations and
derivedTopology entirely. Full-mode knownLimitations calls
runCrystalReadinessReport directly, then runCrystalStatisticsReport (which
calls runCrystalReadinessReport AGAIN internally) — so one
loadTrack2ProgrammeState call computed the crystal's readiness report
(each with its own O(n^2) duplicate-detection + inferential-capacity
passes) three times over the identical domain, plus a further discarded
edge fetch for derivedTopology, for a caller that reads none of it.

Fix: buildFrozenCrystalManifest gains scope: 'full' | 'membership-only'
(default 'full', every existing caller unchanged) — the same bounded-
projection discipline crystalReadiness.ts's own scope: 'full' |
'acquisition-gate' already established for this identical class of
problem. resolveFrozenPredecessorContext now passes 'membership-only'.
Verified via mocked call-count tests: 1 listInvariants + 0
listEdgesForInvariants vs 'full' scope's several, with IDENTICAL
verification/membership results in both scopes.

Also adds six further named phases to loadTrack2ProgrammeState's existing
(but too coarse) PhaseTimer instrumentation — parallel-signals,
cohort-reconciliation, provenance-triage, acquisition-pending-decision,
review-promote-queue, admission-queue — so the next timeout's forensic log
names which sub-composition was actually slow instead of one lumped
"programme-state-derivation" number. Additive only: input.timer stays
optional and every phase falls through to a plain call when absent.

Not verified: a live, credentialed timing re-test against real EXP-P1 data
volume — no SUPABASE_SERVICE_ROLE_KEY or authenticated admin session is
reachable from this sandbox. Local profiling via direct function calls
against the live project (anon key) confirmed round-trip shape but returned
RLS-empty results, so it could not reproduce production-scale timing. The
query-count reduction is proven deterministically; the real-data wall-clock
improvement needs verification from an environment with service-role or
authenticated-admin access.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/research/crystalCohortMembership.ts` |
| Modified | `services/research/crystalFrozenManifest.ts` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Modified | `tests/crystal-frozen-manifest.test.ts` |

## Stats

 4 files changed, 238 insertions(+), 64 deletions(-)
