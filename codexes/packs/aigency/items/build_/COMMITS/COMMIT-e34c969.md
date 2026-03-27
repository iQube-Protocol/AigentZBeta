# Commit Brief: `e34c969` — Fix video badge, thumbnail, and preview scroll for non-selected experiences

| Field | Value |
|-------|-------|
| SHA | [`e34c969`](https://github.com/iQube-Protocol/AigentZBeta/commit/e34c96964aff5f13f3310ae4b8ea590f1ad7c5da) |
| Author | Claude |
| Date | 2026-03-23T01:31:10Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix video badge, thumbnail, and preview scroll for non-selected experiences

- Batch-check status on mount for all proxy-video experiences without a
  portrait thumbnail; on ready, persist thumbnail and refresh experience
  so the configurator badge flips from "Video generating" to "Video ready"
  without requiring the experience to be selected first

- Include portrait image as coverImageUri fallback (after landscape/image)
  so video thumbnails render in carousel chips and hero rather than
  showing the failsafe placeholder

- Pass portrait as experienceContextImage fallback in both runtimePreviewSrc
  and buildRuntimeLaunchUrl when no landscape or other media is available,
  routing the thumbnail through contextImageUri → coverImageUri pipeline

- In embed/preview mode put the carousel panel first in the messages array
  so scrollChatToBottom() lands on the hero/context content rather than
  the thumbnail strip, matching the user's expected scroll position

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
