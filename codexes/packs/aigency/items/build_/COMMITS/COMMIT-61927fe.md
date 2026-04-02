# Commit Brief: `61927fe` — restore standalone launcher and add generate images button to experience viewer

| Field | Value |
|-------|-------|
| SHA | [`61927fe`](https://github.com/iQube-Protocol/AigentZBeta/commit/61927fe63e4bd69f2503fc1ce79409d95a26ae0a) |
| Author | Claude |
| Date | 2026-03-20T13:03:47Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
restore standalone launcher and add generate images button to experience viewer

- revert launchExperience() to route to /studio/composer/experience/[id]
- remove Open Experience button from MetaMeRuntimeClient embed view
- add Generate Images button in ExperienceLiquidRenderer when no images exist
- when images are present, SkillImagePlayer renders directly without auto-invoke

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
