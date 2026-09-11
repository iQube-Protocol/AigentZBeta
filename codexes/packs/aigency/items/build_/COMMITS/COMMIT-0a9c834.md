# Commit Brief: `0a9c834` — metaMe cartridge: swap myArtifacts and Activations top-menu order

| Field | Value |
|-------|-------|
| SHA | [`0a9c834`](https://github.com/iQube-Protocol/AigentZBeta/commit/0a9c8349c11353c82c1a6ba318efd2d53db05abd) |
| Author | Claude |
| Date | 2026-05-31T20:58:02Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
metaMe cartridge: swap myArtifacts and Activations top-menu order

Operator-requested: myArtifacts (the new chip for myCanvas / myWorkspace
/ myLedger) belongs immediately after aigentMe in the top menu since
it's where the persona spends most of their hands-on time. Activations
slots one position back. Order values flipped: myArtifacts 0.5 → 0.6
was the wrong direction; correct is myArtifacts now at 0.5 (slots
between aigentMe at 0 and Activations at 0.6).

Two-line change in data/codex-configs.ts tabGroups for metame-codex.
```

## Body

Operator-requested: myArtifacts (the new chip for myCanvas / myWorkspace
/ myLedger) belongs immediately after aigentMe in the top menu since
it's where the persona spends most of their hands-on time. Activations
slots one position back. Order values flipped: myArtifacts 0.5 → 0.6
was the wrong direction; correct is myArtifacts now at 0.5 (slots
between aigentMe at 0 and Activations at 0.6).

Two-line change in data/codex-configs.ts tabGroups for metame-codex.

## Files Changed

| Change | File |
|--------|------|
| Modified | `data/codex-configs.ts` |

## Stats

 1 file changed, 2 insertions(+), 2 deletions(-)
