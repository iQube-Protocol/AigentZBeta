# Commit Brief: `569205f` — add single-invariant detail api route for the registry browser

| Field | Value |
|-------|-------|
| SHA | [`569205f`](https://github.com/iQube-Protocol/AigentZBeta/commit/569205f53ca826a60c33504e6239f15c1fef5cc3) |
| Author | Claude |
| Date | 2026-07-04T03:06:27Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add single-invariant detail api route for the registry browser

GET /api/invariants/[id] -- invariant record + contexts + immediate edges (both directions) in one call, for the upcoming Invariant Registry browsing tab's detail view. Spine-gated, read-only.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

GET /api/invariants/[id] -- invariant record + contexts + immediate edges (both directions) in one call, for the upcoming Invariant Registry browsing tab's detail view. Spine-gated, read-only.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/invariants/[id]/route.ts` |

## Stats

 1 file changed, 38 insertions(+)
