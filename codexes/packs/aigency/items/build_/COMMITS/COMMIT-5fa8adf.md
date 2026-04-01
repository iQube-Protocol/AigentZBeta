# Commit Brief: `5fa8adf` — fix isVideoBundle/isImageBundle to check configuration.make_bundle

| Field | Value |
|-------|-------|
| SHA | [`5fa8adf`](https://github.com/iQube-Protocol/AigentZBeta/commit/5fa8adf8e791538f2e86f565941d77d04e2ec86e) |
| Author | Claude |
| Date | 2026-03-22T03:19:36Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix isVideoBundle/isImageBundle to check configuration.make_bundle

getAppliedExperienceBundle only reads metadata.composition_bundle, but
the bundle preset is also stored in configuration.make_bundle when saved
via completeSession. Check both sources so shouldAutoGenerateVideo fires
correctly for completed sessions.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
