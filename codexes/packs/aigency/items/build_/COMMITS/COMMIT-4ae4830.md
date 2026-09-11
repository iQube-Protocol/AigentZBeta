# Commit Brief: `4ae4830` — Fix ContactGraph People "Bad Request" — chunk unbounded .in() filters

| Field | Value |
|-------|-------|
| SHA | [`4ae4830`](https://github.com/iQube-Protocol/AigentZBeta/commit/4ae4830217024b6a7286dbd40e5c19526151c003) |
| Author | Claude |
| Date | 2026-08-29T03:41:21Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix ContactGraph People "Bad Request" — chunk unbounded .in() filters

The 2026-08-27 People 504 fix replaced a per-row N+1 loop with a single
batched .in(...) query per read, but left that query unbounded: an owner
with a large address book (1,200+ ContactPersons observed live) produces
an IN-list long enough to exceed the upstream URL-length limit, surfacing
as a bare "Bad Request" in both the aigentMe People capsule and the
metaMe Runtime Communications > People panel (both consume the same
useContactGraphPeople hook -> GET /api/contactgraph/people).

listContactPersonasForOwner and listContactEndpointsForPersonas now chunk
their .in() filters (100 ids per request, merge-sorted back into the
documented order) — still O(ids / 100) round trips, never O(ids) like the
pre-504-fix code, but no single request's filter can grow unboundedly
with address-book size.

Updated tests/contactgraph-people-projection-batching.test.ts: three
assertions had encoded "zero for-loops" as the anti-N+1 invariant, which
a bounded chunk loop legitimately violates without being the per-row
regression they guard against. Replaced with assertions that verify the
loop iterates chunk pages (not individual rows) and added a check that
the chunk size is fixed, bounded, and greater than 1.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

The 2026-08-27 People 504 fix replaced a per-row N+1 loop with a single
batched .in(...) query per read, but left that query unbounded: an owner
with a large address book (1,200+ ContactPersons observed live) produces
an IN-list long enough to exceed the upstream URL-length limit, surfacing
as a bare "Bad Request" in both the aigentMe People capsule and the
metaMe Runtime Communications > People panel (both consume the same
useContactGraphPeople hook -> GET /api/contactgraph/people).

listContactPersonasForOwner and listContactEndpointsForPersonas now chunk
their .in() filters (100 ids per request, merge-sorted back into the
documented order) — still O(ids / 100) round trips, never O(ids) like the
pre-504-fix code, but no single request's filter can grow unboundedly
with address-book size.

Updated tests/contactgraph-people-projection-batching.test.ts: three
assertions had encoded "zero for-loops" as the anti-N+1 invariant, which
a bounded chunk loop legitimately violates without being the per-row
regression they guard against. Replaced with assertions that verify the
loop iterates chunk pages (not individual rows) and added a check that
the chunk size is fixed, bounded, and greater than 1.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/contactGraph/contactEndpoints.ts` |
| Modified | `services/contactGraph/contactPersonas.ts` |
| Modified | `tests/contactgraph-people-projection-batching.test.ts` |

## Stats

 3 files changed, 97 insertions(+), 21 deletions(-)
