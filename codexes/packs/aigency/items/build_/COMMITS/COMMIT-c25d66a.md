# Commit Brief: `c25d66a` — add public viewer page for community-generated content

| Field | Value |
|-------|-------|
| SHA | [`c25d66a`](https://github.com/iQube-Protocol/AigentZBeta/commit/c25d66abc658e13b580f9dff525e1498a8fdb6c1) |
| Author | Claude |
| Date | 2026-04-29T20:44:01Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add public viewer page for community-generated content

Restores the public viewer that was reverted in 4404cbb. Does not touch
the runtime — only adds two new files (one route + one page).

The KNYT Community tab's share menu was already generating
/community-content/[id] URLs (X intent, mailto, copy link) but the
route didn't exist, so every share landed on a 404.

GET /api/community-content/[id]: single-row read scoped to
status IN ('shared', 'runtime_promoted'); drafts and rejected rows
404. Hydrates creator first-name + handle from nakamoto_knyt_personas.

app/community-content/[id]/page.tsx: server component, dark theme,
skill badge + Runtime/Free badges, hero image, byline, prose body
(whitespace-pre-wrap), back link to the KNYT community tab, and
OpenGraph metadata so X/social previews render the title and image.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Restores the public viewer that was reverted in 4404cbb. Does not touch
the runtime — only adds two new files (one route + one page).

The KNYT Community tab's share menu was already generating
/community-content/[id] URLs (X intent, mailto, copy link) but the
route didn't exist, so every share landed on a 404.

GET /api/community-content/[id]: single-row read scoped to
status IN ('shared', 'runtime_promoted'); drafts and rejected rows
404. Hydrates creator first-name + handle from nakamoto_knyt_personas.

app/community-content/[id]/page.tsx: server component, dark theme,
skill badge + Runtime/Free badges, hero image, byline, prose body
(whitespace-pre-wrap), back link to the KNYT community tab, and
OpenGraph metadata so X/social previews render the title and image.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/community-content/[id]/route.ts` |
| Added | `app/community-content/[id]/page.tsx` |

## Stats

 2 files changed, 274 insertions(+)
