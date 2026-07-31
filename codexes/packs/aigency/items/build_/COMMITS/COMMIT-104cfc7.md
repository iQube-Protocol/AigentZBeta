# Commit Brief: `104cfc7` — fix Open Experience button: route to consumer viewer instead of re-opening runtime

| Field | Value |
|-------|-------|
| SHA | [`104cfc7`](https://github.com/iQube-Protocol/AigentZBeta/commit/104cfc7a165c9ea71b385b048cdcc63d7d2dd333) |
| Author | Claude |
| Date | 2026-06-18T10:51:32Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix Open Experience button: route to consumer viewer instead of re-opening runtime

consumerExperienceHref was pointing back to /metame/runtime?experienceId=...
which just re-opened the admin capsule carousel. Now routes to
/studio/composer/experience/[id]?from=runtime which mounts
ComposerExperienceViewer → ExperienceLiquidRenderer with canEdit=false,
surfacing the consumer task runner, reward badges, and completion grant.
```

## Body

consumerExperienceHref was pointing back to /metame/runtime?experienceId=...
which just re-opened the admin capsule carousel. Now routes to
/studio/composer/experience/[id]?from=runtime which mounts
ComposerExperienceViewer → ExperienceLiquidRenderer with canEdit=false,
surfacing the consumer task runner, reward badges, and completion grant.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |

## Stats

 1 file changed, 9 insertions(+), 6 deletions(-)
