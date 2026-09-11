# Commit Brief: `56b0748` — turn Review & Promote into a real Copilot decision surface, not prose

| Field | Value |
|-------|-------|
| SHA | [`56b0748`](https://github.com/iQube-Protocol/AigentZBeta/commit/56b074876dfe1e3f6f15e458613c8a05c0cc30f7) |
| Author | Claude |
| Date | 2026-08-30T22:44:19Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
turn Review & Promote into a real Copilot decision surface, not prose

The review-and-promote stop rendered only a capability string ("POST
/api/invariants/discovery { action: 'promote' } -> promoteCandidate") with
no actual queue -- an operator with 3 candidates awaiting review had no way
to resolve the judgment from the Copilot.

services/research/researchProgrammeOrchestrator.ts: enrich
PendingGovernanceDecision with an optional `reviewQueue` field, populated
only for the review-and-promote stop, built from the SAME
successorScopedCandidates array Stage 3/4's own counts already derive from
(no second candidate query, no vP1/historical leakage). Each entry resolves
evidence (listEvidence, joined by evidenceIds), a pre-flight duplicate check
(findDuplicates -- the exact instrument promoteCandidate itself uses before
writing) and a deterministic, advisory-only recommendation from existing
signals (confidence, convergence, the duplicate check) -- never a new
promotion/rejection classifier, and never binding on either button.

components/composer/IRLResearchCopilotTab.tsx: renders one bounded review
card per candidate (statement, source/evidence excerpt, proposed namespace,
classification, confidence/convergence, duplicate warning, recommendation)
with Promote/Reject/Exception-Inspect. Promote and Reject call the EXISTING
canonical POST /api/invariants/discovery route directly (promoteCandidate /
rejectCandidate server-side) -- no new promotion or rejection path. After
each disposition, a fresh Track2 read decides the count (2 -> 1 -> 0,
server-derived, never client-decremented) and, once the queue is empty,
automatically continues via the same runProgramme() "Run until you need me"
already uses -- the operator never has to navigate back and manually
restart the programme. "Exception / Inspect" performs no write; it reuses
the existing onProceed navigation.

The pending-decision identity (experimentId, stage, candidateIds) needs no
new persistence: the successor-scoped awaiting-review set is already fully
re-derivable from discovery_candidates + the frozen-predecessor manifest on
every read, so refresh/navigation naturally preserves it -- the durable-fact
discipline this repo already follows (crystal_acquisition_approvals' own
migration header).

8 new orchestrator tests + 7 new UI source-authority canaries; full suite
matches the pre-existing 17-file/49-test baseline with zero new
regressions; typecheck clean.

Track 2 cohort/acquisition/extraction/remediation/readiness logic is
untouched -- this is a decision-surface-layer change only.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

The review-and-promote stop rendered only a capability string ("POST
/api/invariants/discovery { action: 'promote' } -> promoteCandidate") with
no actual queue -- an operator with 3 candidates awaiting review had no way
to resolve the judgment from the Copilot.

services/research/researchProgrammeOrchestrator.ts: enrich
PendingGovernanceDecision with an optional `reviewQueue` field, populated
only for the review-and-promote stop, built from the SAME
successorScopedCandidates array Stage 3/4's own counts already derive from
(no second candidate query, no vP1/historical leakage). Each entry resolves
evidence (listEvidence, joined by evidenceIds), a pre-flight duplicate check
(findDuplicates -- the exact instrument promoteCandidate itself uses before
writing) and a deterministic, advisory-only recommendation from existing
signals (confidence, convergence, the duplicate check) -- never a new
promotion/rejection classifier, and never binding on either button.

components/composer/IRLResearchCopilotTab.tsx: renders one bounded review
card per candidate (statement, source/evidence excerpt, proposed namespace,
classification, confidence/convergence, duplicate warning, recommendation)
with Promote/Reject/Exception-Inspect. Promote and Reject call the EXISTING
canonical POST /api/invariants/discovery route directly (promoteCandidate /
rejectCandidate server-side) -- no new promotion or rejection path. After
each disposition, a fresh Track2 read decides the count (2 -> 1 -> 0,
server-derived, never client-decremented) and, once the queue is empty,
automatically continues via the same runProgramme() "Run until you need me"
already uses -- the operator never has to navigate back and manually
restart the programme. "Exception / Inspect" performs no write; it reuses
the existing onProceed navigation.

The pending-decision identity (experimentId, stage, candidateIds) needs no
new persistence: the successor-scoped awaiting-review set is already fully
re-derivable from discovery_candidates + the frozen-predecessor manifest on
every read, so refresh/navigation naturally preserves it -- the durable-fact
discipline this repo already follows (crystal_acquisition_approvals' own
migration header).

8 new orchestrator tests + 7 new UI source-authority canaries; full suite
matches the pre-existing 17-file/49-test baseline with zero new
regressions; typecheck clean.

Track 2 cohort/acquisition/extraction/remediation/readiness logic is
untouched -- this is a decision-surface-layer change only.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `components/composer/IRLResearchCopilotTab.tsx` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Modified | `tests/research-programme-orchestrator.test.ts` |
| Modified | `tests/track2-copilot-deep-link.test.ts` |

## Stats

 5 files changed, 677 insertions(+), 6 deletions(-)
