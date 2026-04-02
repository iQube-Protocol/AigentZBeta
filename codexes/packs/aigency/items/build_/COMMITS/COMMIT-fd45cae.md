# Commit Brief: `fd45cae` — fix video bundle auto-generation by reading config from completed experience

| Field | Value |
|-------|-------|
| SHA | [`fd45cae`](https://github.com/iQube-Protocol/AigentZBeta/commit/fd45cae303c71edb51da7416d8f6eb5907fe3431) |
| Author | Claude |
| Date | 2026-03-22T02:45:28Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix video bundle auto-generation by reading config from completed experience

The image bundle reads prompts from completedExperience.configuration.image_generation
(saved to DB by the session API, reliable).  The video bundle was reading from
mergedData.video_prompt (React state snapshot), which can be empty or stale by
the time handleComplete runs.

Since composerService.completeSession saves session.data directly as the
experience configuration, completedExperience.configuration.video_prompt is the
authoritative source.  Mirror the image pattern: read video_prompt and
skill_selection from completedExperience.configuration first, then fall back to
bundleCheckSource.configuration, then mergedData as last resort.

Also hoists skillSelectionRecord to the same scope so it doesn't shadow the
outer declaration inside the auto-gen block.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
