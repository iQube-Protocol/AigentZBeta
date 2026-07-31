# Commit Brief: `8a41c01` — move citizen/participant application badge to tier-3 right-justified

| Field | Value |
|-------|-------|
| SHA | [`8a41c01`](https://github.com/iQube-Protocol/AigentZBeta/commit/8a41c0185a06034c24e41301ccb54cfffdb53b1f) |
| Author | Claude |
| Date | 2026-06-13T16:27:38Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
move citizen/participant application badge to tier-3 right-justified

remove single-entry subTabs getter from both agentiq-passport-apply and
agentiq-os-passport-apply tabs in data/codex-configs.ts. same bug pattern
as the registry tab fix from 2026-06-12: a single-entry subTabs array
blocks the SubHeaderSlot portal that PassportBureauApplyTab now uses to
inject its class badge.

PassportBureauApplyTab portals a context badge (citizen / participant)
into SubHeaderSlot with ml-auto for right-justification. badge only shows
after the user has chosen a class — the class chooser screen leaves the
slot empty so the operator can pick freely without a stale label.
```

## Body

remove single-entry subTabs getter from both agentiq-passport-apply and
agentiq-os-passport-apply tabs in data/codex-configs.ts. same bug pattern
as the registry tab fix from 2026-06-12: a single-entry subTabs array
blocks the SubHeaderSlot portal that PassportBureauApplyTab now uses to
inject its class badge.

PassportBureauApplyTab portals a context badge (citizen / participant)
into SubHeaderSlot with ml-auto for right-justification. badge only shows
after the user has chosen a class — the class chooser screen leaves the
slot empty so the operator can pick freely without a stale label.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/PassportBureauApplyTab.tsx` |
| Modified | `data/codex-configs.ts` |

## Stats

 2 files changed, 19 insertions(+), 7 deletions(-)
