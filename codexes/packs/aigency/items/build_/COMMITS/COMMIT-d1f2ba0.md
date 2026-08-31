# Commit Brief: `d1f2ba0` — close Classify Provenance omission defect: machine recommendation != steward decision

| Field | Value |
|-------|-------|
| SHA | [`d1f2ba0`](https://github.com/iQube-Protocol/AigentZBeta/commit/d1f2ba082264c38fc0fb27889bb3a656358aeeda) |
| Author | Claude |
| Date | 2026-08-31T00:00:46Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
close Classify Provenance omission defect: machine recommendation != steward decision

Incident: a steward classifying 3 newly-promoted EXP-P1 invariants clicked
through Record 1 with no evidence-provenance class ever explicitly selected
or reviewed -- the write still succeeded and Track 2 marked Classify
Provenance complete. Root cause: ClassificationQueue's per-record "Accept"
and batch "Accept All High-Confidence" controls submitted the machine's own
suggestedClass directly, bypassing the guarded dropdown/`to` state (and its
disabled-until-selected check) entirely -- and nothing server-side
distinguished that from a genuine steward selection.

services/research/experimentalPopulations.ts: ProvenanceReclassification
gains a REQUIRED `classDisposition: 'operator-selected' | 'recommendation-
accepted'` -- no default, no third value. applyProvenanceReclassification
refuses any event that omits it or declares 'recommendation-accepted'
without a structurally-consistent `acceptedRecommendation` (suggestedClass
matching `to`, non-blank reason, 0-100 confidence) -- enforced server-side,
not merely a disabled UI button. The existing same-value dedup guard gains
a narrow, one-time grandfather allowance: a record whose CURRENT class
predates (or bypassed) this field may be re-affirmed once through this same
canonical function, recording real governance -- the repair door, never a
standing exception.

app/api/invariants/discovery/route.ts: thin pass-through for the two new
fields, matching this route's existing "no logic here" design.

components/research/Track2ProgrammePanel.tsx (ClassificationQueue): the
manual "Classify & next" path declares operator-selected; the per-record
"Accept" and batch "Accept All High-Confidence" both declare recommendation-
accepted and carry the exact suggestion card being endorsed -- one
deliberate steward click still authorizes a batch, but confidence alone is
never what completes a classification; the server independently verifies
each accepted recommendation. components/composer/InvariantDiscoveryTab.tsx
(the other classify surface, manual-only) declares operator-selected.

Deliberately did NOT touch Track2's completion predicate
(populationReconciliation.ts/track2Programme.ts) or readiness criteria: the
invariant "Track 2 cannot mark provenance complete without a valid explicit
classification" now holds by construction of the one write gate, so a
read-time re-check would either be a no-op for all future records or would
retroactively re-flag the two already-correctly-classified records --
neither is wanted.

15 new tests (10 server-side in evidence-provenance-populations.test.ts
covering every refusal/success/repair path, 5 UI source-authority canaries
in track2-steward-workflow.test.ts including Accept-All). Full suite
matches the pre-existing 17-file/49-test baseline with zero new
regressions; typecheck clean.

scripts/repair-classify-provenance-record.ts: a dry-run-by-default repair
tool for the operator to run themselves (this session has no live Supabase
access) -- calls the SAME applyProvenanceReclassification + updateInvariant
functions the real route uses, never a raw Supabase write.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

Incident: a steward classifying 3 newly-promoted EXP-P1 invariants clicked
through Record 1 with no evidence-provenance class ever explicitly selected
or reviewed -- the write still succeeded and Track 2 marked Classify
Provenance complete. Root cause: ClassificationQueue's per-record "Accept"
and batch "Accept All High-Confidence" controls submitted the machine's own
suggestedClass directly, bypassing the guarded dropdown/`to` state (and its
disabled-until-selected check) entirely -- and nothing server-side
distinguished that from a genuine steward selection.

services/research/experimentalPopulations.ts: ProvenanceReclassification
gains a REQUIRED `classDisposition: 'operator-selected' | 'recommendation-
accepted'` -- no default, no third value. applyProvenanceReclassification
refuses any event that omits it or declares 'recommendation-accepted'
without a structurally-consistent `acceptedRecommendation` (suggestedClass
matching `to`, non-blank reason, 0-100 confidence) -- enforced server-side,
not merely a disabled UI button. The existing same-value dedup guard gains
a narrow, one-time grandfather allowance: a record whose CURRENT class
predates (or bypassed) this field may be re-affirmed once through this same
canonical function, recording real governance -- the repair door, never a
standing exception.

app/api/invariants/discovery/route.ts: thin pass-through for the two new
fields, matching this route's existing "no logic here" design.

components/research/Track2ProgrammePanel.tsx (ClassificationQueue): the
manual "Classify & next" path declares operator-selected; the per-record
"Accept" and batch "Accept All High-Confidence" both declare recommendation-
accepted and carry the exact suggestion card being endorsed -- one
deliberate steward click still authorizes a batch, but confidence alone is
never what completes a classification; the server independently verifies
each accepted recommendation. components/composer/InvariantDiscoveryTab.tsx
(the other classify surface, manual-only) declares operator-selected.

Deliberately did NOT touch Track2's completion predicate
(populationReconciliation.ts/track2Programme.ts) or readiness criteria: the
invariant "Track 2 cannot mark provenance complete without a valid explicit
classification" now holds by construction of the one write gate, so a
read-time re-check would either be a no-op for all future records or would
retroactively re-flag the two already-correctly-classified records --
neither is wanted.

15 new tests (10 server-side in evidence-provenance-populations.test.ts
covering every refusal/success/repair path, 5 UI source-authority canaries
in track2-steward-workflow.test.ts including Accept-All). Full suite
matches the pre-existing 17-file/49-test baseline with zero new
regressions; typecheck clean.

scripts/repair-classify-provenance-record.ts: a dry-run-by-default repair
tool for the operator to run themselves (this session has no live Supabase
access) -- calls the SAME applyProvenanceReclassification + updateInvariant
functions the real route uses, never a raw Supabase write.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/invariants/discovery/route.ts` |
| Modified | `components/composer/InvariantDiscoveryTab.tsx` |
| Modified | `components/research/Track2ProgrammePanel.tsx` |
| Added | `scripts/repair-classify-provenance-record.ts` |
| Modified | `services/research/experimentalPopulations.ts` |
| Modified | `tests/evidence-provenance-populations.test.ts` |
| Modified | `tests/track2-steward-workflow.test.ts` |

## Stats

 8 files changed, 656 insertions(+), 12 deletions(-)
