# Commit Brief: `db332a4` — Fix Track 2 Stage 7: a crystal member may legitimately have zero relationships

| Field | Value |
|-------|-------|
| SHA | [`db332a4`](https://github.com/iQube-Protocol/AigentZBeta/commit/db332a45978669f93de16b7d54cdcd422b8292ce) |
| Author | Claude |
| Date | 2026-08-31T02:08:44Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Track 2 Stage 7: a crystal member may legitimately have zero relationships

Stage 7's pending derivation read only intra-crystal edge degree, so a
reviewed member with no defensible edge was indistinguishable from one
nobody had looked at yet — rejecting every proposed relationship for a
member could never satisfy the stage without inventing an edge.

Adds an append-only durable fact (crystal_relationship_adjudications) for
"reviewed, none warranted admission", keyed by a cohort-membership
fingerprint so the verdict automatically reopens if the cohort later
changes. reconcilePromotedCohort now folds still-valid adjudications into
orphan detection via an opt-in adjudicationContext param (only the Stage 7
orchestrator call site passes it — every other caller and existing test is
unaffected). Adds the steward-facing "Confirm — No Defensible Relationship"
action and its backing route, which persists the fact only, never an edge.

Also audited relationship-suggestion admission: it currently rests on model
confidence + generated rationale only, with no required evidence references
tying the typed/directed relationship to source text.
```

## Body

Stage 7's pending derivation read only intra-crystal edge degree, so a
reviewed member with no defensible edge was indistinguishable from one
nobody had looked at yet — rejecting every proposed relationship for a
member could never satisfy the stage without inventing an edge.

Adds an append-only durable fact (crystal_relationship_adjudications) for
"reviewed, none warranted admission", keyed by a cohort-membership
fingerprint so the verdict automatically reopens if the cohort later
changes. reconcilePromotedCohort now folds still-valid adjudications into
orphan detection via an opt-in adjudicationContext param (only the Stage 7
orchestrator call site passes it — every other caller and existing test is
unaffected). Adds the steward-facing "Confirm — No Defensible Relationship"
action and its backing route, which persists the fact only, never an edge.

Also audited relationship-suggestion admission: it currently rests on model
confidence + generated rationale only, with no required evidence references
tying the typed/directed relationship to source text.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `app/api/research/track2/[experimentId]/relationship-adjudication/route.ts` |
| Modified | `components/research/Track2ProgrammePanel.tsx` |
| Added | `services/research/crystalRelationshipAdjudication.ts` |
| Modified | `services/research/populationReconciliation.ts` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Added | `supabase/migrations/20260831220000_crystal_relationship_adjudications.sql` |
| Added | `tests/crystal-relationship-adjudication.test.ts` |
| Modified | `tests/population-reconciliation.test.ts` |
| Added | `tests/track2-relationship-adjudication-route.test.ts` |

## Stats

 10 files changed, 820 insertions(+), 5 deletions(-)
