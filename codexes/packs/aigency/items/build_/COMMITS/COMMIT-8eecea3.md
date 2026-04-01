# Commit Brief: `8eecea3` — Claude/find latest commit q qy rq (#86)

| Field | Value |
|-------|-------|
| SHA | [`8eecea3`](https://github.com/iQube-Protocol/AigentZBeta/commit/8eecea36257288a24bda0581422da5303c6f6e8a) |
| Author | Kn0w1 |
| Date | 2026-03-20T13:37:33Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Claude/find latest commit q qy rq (#86)

* restore standalone launcher and add generate images button to experience viewer

- revert launchExperience() to route to /studio/composer/experience/[id]
- remove Open Experience button from MetaMeRuntimeClient embed view
- add Generate Images button in ExperienceLiquidRenderer when no images exist
- when images are present, SkillImagePlayer renders directly without auto-invoke

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM

* revert ExperienceLiquidRenderer and add generate images button to experience card

- restore ExperienceLiquidRenderer to original (launcher already handles image gen logic)
- add Sparkles generate images button to ExperienceQube card when image bundle exists but not yet accepted
- button opens the launcher same as launch experience, directing user to generate images there

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM

* trigger amplify dev deploy

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM

* document deploy process in CLAUDE.md

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM

* re-trigger merge-claude-to-dev workflow

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM

---------

Co-authored-by: Claude <noreply@anthropic.com>
```

## Files Changed

_File details not available in backfill — see commit link above._
