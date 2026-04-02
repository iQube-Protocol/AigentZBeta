# Commit Brief: `51db6d8` — fix inspector showing wrong experience thumbnail on runtime_thin_client switch

| Field | Value |
|-------|-------|
| SHA | [`51db6d8`](https://github.com/iQube-Protocol/AigentZBeta/commit/51db6d8b93db2848ee99575017f644e089caa293) |
| Author | Claude |
| Date | 2026-03-24T16:21:49Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix inspector showing wrong experience thumbnail on runtime_thin_client switch

When switching to runtime_thin_client, resolveExperiencePrimaryMedia may return
null (e.g. legacy video proxy URLs fail canInlineVideoUri). loadInspectorMedia
then falls through to the section content API. Without a content_tag or
selectedIds, buildSectionLookupPlans returns generic sections (home-hero, etc.)
whose first item belongs to a different experience, causing the inspector card
to display the wrong experience's thumbnail and mislead the user.

Guard: skip the section fetch when neither content_tag nor selectedIds are set.
The card renders without a thumbnail rather than showing unrelated content.

https://claude.ai/code/session_017i9fiEGA3zMjxFonVYZCQT
```

## Files Changed

_File details not available in backfill — see commit link above._
