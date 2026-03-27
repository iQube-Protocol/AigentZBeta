# Commit Brief: `1ccde99` — preserve article_draft through image generation refresh

| Field | Value |
|-------|-------|
| SHA | [`1ccde99`](https://github.com/iQube-Protocol/AigentZBeta/commit/1ccde9989fa3360f437b1f2cee030a5058509c1b) |
| Author | Claude |
| Date | 2026-03-20T18:10:08Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
preserve article_draft through image generation refresh

requestImageBundleArtifacts writes images to the editing experience on
the server; the subsequent refreshExperienceFromServer returns that
experience with the new images but with its old configuration (no
article_draft.generated from the current session). This overwrote the
in-memory article. Capture article_draft before the refresh and merge
it back so the PUT at completion saves both images and article.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
