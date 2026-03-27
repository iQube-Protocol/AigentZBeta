# Commit Brief: `f92d03d` — auto-generate video bundle artifacts on customization completion

| Field | Value |
|-------|-------|
| SHA | [`f92d03d`](https://github.com/iQube-Protocol/AigentZBeta/commit/f92d03dda634ed903db4ae9edb0c67522f653c8f) |
| Author | Claude |
| Date | 2026-03-21T19:56:46Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
auto-generate video bundle artifacts on customization completion

- add requestVideoBundleArtifacts() to ComposerStudio — calls POST
  /api/skills/invoke with skill_id, prompt, duration, aspect_ratio, and
  style extracted from mergedData; persists the invocation receipt and
  the proxied video URL as a generated asset on the experience
- add shouldAutoGenerateVideo condition (isVideoBundle && hasVideoPrompt)
  parallel to shouldAutoGenerateImages; fires after customization
  completes, refreshes experience from server after invocation

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
