# Commit Brief: `b226c88` — fix capsule disappearance + restore Pill pattern to Move-forward + Venture

| Field | Value |
|-------|-------|
| SHA | [`b226c88`](https://github.com/iQube-Protocol/AigentZBeta/commit/b226c88aa765d6e244364132ef53e2951f5d8d25) |
| Author | Claude |
| Date | 2026-05-28T05:43:50Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix capsule disappearance + restore Pill pattern to Move-forward + Venture

ComposerLayout: drop legacy onRequestLayout('stack') from dismiss/close handlers.
The composer mounts only as an overlay now; firing a foreground layout swap
was actively swapping activeLayoutId out from under the active Capsule
(Brief / Specialists), causing them to vanish after every 2nd/3rd Act+compose
cycle. Data persisted in state but the dedicated layout unmounted — clicking
the quick-action chip restored it by re-setting activeLayoutId.

DecisionBoardLayout + VentureCockpitLayout: replicate the BriefCard /
WelcomeRightPane Pill pattern — queued NBAs now render as ExpandedNBEPill
with the drafted artifact + second-tier approval folded inline, instead of
the legacy NextBestActionCard 'Queued' badge that bombed without the
lifecycle props wired.
```

## Body

ComposerLayout: drop legacy onRequestLayout('stack') from dismiss/close handlers.
The composer mounts only as an overlay now; firing a foreground layout swap
was actively swapping activeLayoutId out from under the active Capsule
(Brief / Specialists), causing them to vanish after every 2nd/3rd Act+compose
cycle. Data persisted in state but the dedicated layout unmounted — clicking
the quick-action chip restored it by re-setting activeLayoutId.

DecisionBoardLayout + VentureCockpitLayout: replicate the BriefCard /
WelcomeRightPane Pill pattern — queued NBAs now render as ExpandedNBEPill
with the drafted artifact + second-tier approval folded inline, instead of
the legacy NextBestActionCard 'Queued' badge that bombed without the
lifecycle props wired.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/welcome/layouts/ComposerLayout.tsx` |
| Modified | `components/metame/welcome/layouts/DecisionBoardLayout.tsx` |
| Modified | `components/metame/welcome/layouts/VentureCockpitLayout.tsx` |

## Stats

 3 files changed, 177 insertions(+), 44 deletions(-)
