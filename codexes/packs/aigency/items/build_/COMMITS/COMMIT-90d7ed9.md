# Commit Brief: `90d7ed9` — Show ContactGraph state and import-source counts in People (#99)

| Field | Value |
|-------|-------|
| SHA | [`90d7ed9`](https://github.com/iQube-Protocol/AigentZBeta/commit/90d7ed99e75182c5b9385641220904fab7a35eeb) |
| Author | Kn0w1 |
| Date | 2026-08-26T03:24:14-04:00 |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Show ContactGraph state and import-source counts in People (#99)

Display canonical graph people and persona-scoped import counts by source in both Agent Me and Runtime People surfaces. Paginate source records beyond the PostgREST row cap and preserve the distinction between import provenance and reconciled identities.
```

## Body

Display canonical graph people and persona-scoped import counts by source in both Agent Me and Runtime People surfaces. Paginate source records beyond the PostgREST row cap and preserve the distinction between import provenance and reconciled identities.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/contactgraph/people/route.ts` |
| Added | `components/metame/contactgraph/ContactGraphStatsStrip.tsx` |
| Modified | `components/metame/contactgraph/useContactGraphPeople.ts` |
| Modified | `components/metame/runtime/RuntimeQubeTalkDrawer.tsx` |
| Modified | `components/metame/welcome/layouts/PeopleLayout.tsx` |
| Modified | `services/contactGraph/reconciliation.ts` |
| Added | `tests/contactgraph-people-stats.test.ts` |

## Stats

 7 files changed, 236 insertions(+), 5 deletions(-)
