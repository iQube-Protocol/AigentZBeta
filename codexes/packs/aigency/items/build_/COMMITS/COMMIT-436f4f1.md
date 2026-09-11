# Commit Brief: `436f4f1` — Fix Track 2 Stage 7: relate to the target Crystal, adjudicate the successor cohort

| Field | Value |
|-------|-------|
| SHA | [`436f4f1`](https://github.com/iQube-Protocol/AigentZBeta/commit/436f4f1310f8df15711f3260c3043803c819fef7) |
| Author | Claude |
| Date | 2026-08-31T02:55:32Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Track 2 Stage 7: relate to the target Crystal, adjudicate the successor cohort

Operator ruling: "successor cohort" (the newly promoted candidates for this
acquisition pass) and "successor Crystal" (inherited predecessor substrate +
the successor cohort) are not the same thing. A new member's scientifically
valid relationship to an INHERITED Crystal member is a valid Crystal-v2
relationship and must satisfy Stage 7 — but a relationship to some other
arbitrary promoted invariant elsewhere in the acquisition domain must not.

Extracts the frozen-generation/successor-scoping logic (previously a private
closure only inside researchProgrammeOrchestrator.ts) into the ONE shared
resolver, services/research/crystalCohortMembership.ts, now consumed by
every route that needs "the current cohort": the orchestrator itself,
suggest-relationships, validate-all, and relationship-adjudication. Two of
those three previously called an unscoped reconcilePromotedCohort over every
historic promoted candidate in the domain — the actual root cause of the
live incident: the Relationship Queue could offer, and a steward could
accept, a relationship the Stage 7 bookkeeping had no way to recognize.

reconcilePromotedCohort's edge-counting now widens "the other endpoint may
legitimately be" from the successor cohort alone to the target-Crystal
membership universe (successor cohort ∪ inherited predecessor members),
while degree/orphan detection still only asks the question of the successor
cohort's own members. The no-defensible-edge adjudication fingerprint is
keyed on that same wider universe, so it reopens if either half changes.

suggest-relationships' candidate pool now spans the same universe (never an
arbitrary out-of-Crystal invariant); validate-all is now explicitly scoped
to the successor cohort only, never re-running validation over the frozen
predecessor's own already-validated members.

No edge was touched: the live accepted Record 3 edge and both existing
no-defensible-edge adjudications are read exactly as they already stand.
```

## Body

Operator ruling: "successor cohort" (the newly promoted candidates for this
acquisition pass) and "successor Crystal" (inherited predecessor substrate +
the successor cohort) are not the same thing. A new member's scientifically
valid relationship to an INHERITED Crystal member is a valid Crystal-v2
relationship and must satisfy Stage 7 — but a relationship to some other
arbitrary promoted invariant elsewhere in the acquisition domain must not.

Extracts the frozen-generation/successor-scoping logic (previously a private
closure only inside researchProgrammeOrchestrator.ts) into the ONE shared
resolver, services/research/crystalCohortMembership.ts, now consumed by
every route that needs "the current cohort": the orchestrator itself,
suggest-relationships, validate-all, and relationship-adjudication. Two of
those three previously called an unscoped reconcilePromotedCohort over every
historic promoted candidate in the domain — the actual root cause of the
live incident: the Relationship Queue could offer, and a steward could
accept, a relationship the Stage 7 bookkeeping had no way to recognize.

reconcilePromotedCohort's edge-counting now widens "the other endpoint may
legitimately be" from the successor cohort alone to the target-Crystal
membership universe (successor cohort ∪ inherited predecessor members),
while degree/orphan detection still only asks the question of the successor
cohort's own members. The no-defensible-edge adjudication fingerprint is
keyed on that same wider universe, so it reopens if either half changes.

suggest-relationships' candidate pool now spans the same universe (never an
arbitrary out-of-Crystal invariant); validate-all is now explicitly scoped
to the successor cohort only, never re-running validation over the frozen
predecessor's own already-validated members.

No edge was touched: the live accepted Record 3 edge and both existing
no-defensible-edge adjudications are read exactly as they already stand.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/research/track2/[experimentId]/relationship-adjudication/route.ts` |
| Modified | `app/api/research/track2/[experimentId]/suggest-relationships/route.ts` |
| Modified | `app/api/research/track2/[experimentId]/validate-all/route.ts` |
| Added | `services/research/crystalCohortMembership.ts` |
| Modified | `services/research/populationReconciliation.ts` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Modified | `services/research/track2Programme.ts` |
| Added | `tests/crystal-cohort-membership.test.ts` |
| Modified | `tests/population-reconciliation.test.ts` |
| Modified | `tests/track2-relationship-adjudication-route.test.ts` |
| Modified | `tests/track2-suggest-relationships-route.test.ts` |
| Modified | `tests/track2-validate-all-route.test.ts` |

## Stats

 13 files changed, 789 insertions(+), 142 deletions(-)
