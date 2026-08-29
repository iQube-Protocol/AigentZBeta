# Commit Brief: `a7362d0` — Fix Communications People: independent scroll pane + 1,000-person ceiling

| Field | Value |
|-------|-------|
| SHA | [`a7362d0`](https://github.com/iQube-Protocol/AigentZBeta/commit/a7362d08b2d2961603e95255329d94c9a5cf4578) |
| Author | Claude |
| Date | 2026-08-29T04:34:44Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Communications People: independent scroll pane + 1,000-person ceiling

TWO defects reported live in metaMe Runtime's Communications > People panel:

1. Shared-scroll layout defect
   RuntimeQubeTalkDrawer's tab-content wrapper (min-h-0 flex-1 overflow-y-auto)
   was the ONLY scroll owner for every tab. RuntimePeoplePanel's two-column
   grid used h-full with neither column declaring min-h-0/overflow-y-auto —
   a CSS grid item's default min-height:auto lets content grow past its row
   instead of clipping, so the list's content pushed the whole grid past the
   wrapper's bounded height, making that wrapper the effective scroll owner
   for BOTH columns. Scrolling to a contact below the fold dragged the
   detail pane's rendered position away with it. Fixed by adding min-h-0 to
   the grid and both columns, plus overflow-y-auto on the list column (the
   detail column already had it) — each column now owns an independent,
   bounded scroll region. Outer drawer chrome (tab/header row, the shared
   wrapper) is untouched.

2. The 1,000-person ceiling
   listContactPersons (used by requestContactGraphProjection to resolve
   "everything this owner owns") issued one unbounded .select('*') with no
   .range()/.limit(). PostgREST's hosted default row cap (1,000) silently
   truncated the result, and the route used result.people.length — rows
   THIS response happened to carry — as the headline "graph people" count.
   An owner with 1,200+ contacts saw an immovable "1,000 graph people" and
   could never reach contact #1,001 through the UI.

   Fixed with a new requestContactGraphPeoplePage (services/contactGraph/
   projection.ts): a real `count: 'exact', head: true` query for the total
   (one indexed COUNT, never a full-table fetch) plus `.range()` pagination
   for the actual rows, reusing the existing batched+chunked
   listContactPersonasForOwner/listContactEndpointsForPersonas for exactly
   the requested page. Search runs server-side (.ilike on the same
   owner-scoped query) so it reaches contacts beyond whatever page is
   loaded. The full requestContactGraphProjection contract (delegation/
   consent-aware, used elsewhere) is completely unchanged — this is an
   additive sibling for the one case that doesn't need it: the owning
   principal reading their own People list.

   useContactGraphPeople now debounces search (300ms) into a server call,
   tracks totalCount/hasMore, and exposes loadMore() — wired to
   scroll-near-bottom in the Runtime drawer's (now independently
   scrollable) list column, plus a manual "Load more" button in both
   Runtime and the aigentMe compact panel (which shares the same hook and
   would otherwise silently regress to a single page).

"0 import records" investigated, not changed: summarizePersonaContactImports
is already correctly paginated (loops until a short page, never capped) and
scoped to the CURRENTLY ACTIVE persona (persona_contacts is persona-scoped
by design — the raw address-book/import substrate serving resolveRecipient.ts/
draftEmail.ts/searchContacts.ts — unlike contact_persons, which is
owner-auth-profile-wide). Zero import records for the active persona while
contact_persons has 1,000+ rows is architecturally consistent with those
rows having been created under a DIFFERENT persona owned by the same auth
profile, or seeded directly. Cannot be confirmed correct-vs-wrong without
live data (which persona actually ran the import); flagging rather than
guessing.

Also updated tests/contactgraph-people-stats.test.ts: one existing
assertion had encoded `graphPeople: result.value.people.length` (the exact
defect) as correct behavior — replaced with the exact-count requirement.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

TWO defects reported live in metaMe Runtime's Communications > People panel:

1. Shared-scroll layout defect
   RuntimeQubeTalkDrawer's tab-content wrapper (min-h-0 flex-1 overflow-y-auto)
   was the ONLY scroll owner for every tab. RuntimePeoplePanel's two-column
   grid used h-full with neither column declaring min-h-0/overflow-y-auto —
   a CSS grid item's default min-height:auto lets content grow past its row
   instead of clipping, so the list's content pushed the whole grid past the
   wrapper's bounded height, making that wrapper the effective scroll owner
   for BOTH columns. Scrolling to a contact below the fold dragged the
   detail pane's rendered position away with it. Fixed by adding min-h-0 to
   the grid and both columns, plus overflow-y-auto on the list column (the
   detail column already had it) — each column now owns an independent,
   bounded scroll region. Outer drawer chrome (tab/header row, the shared
   wrapper) is untouched.

2. The 1,000-person ceiling
   listContactPersons (used by requestContactGraphProjection to resolve
   "everything this owner owns") issued one unbounded .select('*') with no
   .range()/.limit(). PostgREST's hosted default row cap (1,000) silently
   truncated the result, and the route used result.people.length — rows
   THIS response happened to carry — as the headline "graph people" count.
   An owner with 1,200+ contacts saw an immovable "1,000 graph people" and
   could never reach contact #1,001 through the UI.

   Fixed with a new requestContactGraphPeoplePage (services/contactGraph/
   projection.ts): a real `count: 'exact', head: true` query for the total
   (one indexed COUNT, never a full-table fetch) plus `.range()` pagination
   for the actual rows, reusing the existing batched+chunked
   listContactPersonasForOwner/listContactEndpointsForPersonas for exactly
   the requested page. Search runs server-side (.ilike on the same
   owner-scoped query) so it reaches contacts beyond whatever page is
   loaded. The full requestContactGraphProjection contract (delegation/
   consent-aware, used elsewhere) is completely unchanged — this is an
   additive sibling for the one case that doesn't need it: the owning
   principal reading their own People list.

   useContactGraphPeople now debounces search (300ms) into a server call,
   tracks totalCount/hasMore, and exposes loadMore() — wired to
   scroll-near-bottom in the Runtime drawer's (now independently
   scrollable) list column, plus a manual "Load more" button in both
   Runtime and the aigentMe compact panel (which shares the same hook and
   would otherwise silently regress to a single page).

"0 import records" investigated, not changed: summarizePersonaContactImports
is already correctly paginated (loops until a short page, never capped) and
scoped to the CURRENTLY ACTIVE persona (persona_contacts is persona-scoped
by design — the raw address-book/import substrate serving resolveRecipient.ts/
draftEmail.ts/searchContacts.ts — unlike contact_persons, which is
owner-auth-profile-wide). Zero import records for the active persona while
contact_persons has 1,000+ rows is architecturally consistent with those
rows having been created under a DIFFERENT persona owned by the same auth
profile, or seeded directly. Cannot be confirmed correct-vs-wrong without
live data (which persona actually ran the import); flagging rather than
guessing.

Also updated tests/contactgraph-people-stats.test.ts: one existing
assertion had encoded `graphPeople: result.value.people.length` (the exact
defect) as correct behavior — replaced with the exact-count requirement.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/contactgraph/people/route.ts` |
| Modified | `components/metame/contactgraph/useContactGraphPeople.ts` |
| Modified | `components/metame/runtime/RuntimeQubeTalkDrawer.tsx` |
| Modified | `components/metame/welcome/layouts/PeopleLayout.tsx` |
| Modified | `services/contactGraph/projection.ts` |
| Added | `tests/contactgraph-people-pagination.test.ts` |
| Modified | `tests/contactgraph-people-projection-batching.test.ts` |
| Added | `tests/contactgraph-people-runtime-scroll.test.ts` |
| Modified | `tests/contactgraph-people-stats.test.ts` |

## Stats

 9 files changed, 674 insertions(+), 52 deletions(-)
