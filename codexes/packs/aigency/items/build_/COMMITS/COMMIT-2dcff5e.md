# Commit Brief: `2dcff5e` — style(workspace): green container around expanded intent pills

| Field | Value |
|-------|-------|
| SHA | [`2dcff5e`](https://github.com/iQube-Protocol/AigentZBeta/commit/2dcff5ed123474a6e7bf0605946dddcf6da2c5b0) |
| Author | Claude |
| Date | 2026-06-04T04:06:48Z |
| Branch | dev (direct push) |
| Type | `style` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
style(workspace): green container around expanded intent pills

When an Active Intent is expanded, the whole pill (collapsed header
+ chain-of-intent panel + open-full-chain footer) now sits inside
an emerald-bordered container with a subtle green tint and 1px
emerald ring. Visually separates the pill and all its embedded
chips / receipt rows from the rest of the list so the operator can
see at a glance which intent is "active" and where its boundary
sits.

Collapsed pills keep the existing slate look. Hover state stays
violet when collapsed, switches to a softer emerald hover when
expanded so the container doesn't fight the active state.

The "Open full chain" footer (visible only when an intent_chains
row is attached) also adopts the emerald palette so it reads as
part of the expanded container rather than an alien slate strip.

IntentChainPanel internals untouched — kept theme-neutral so the
same component still looks right when mounted inside the myLedger
ActivityReceiptCard (where green would be wrong).
```

## Body

When an Active Intent is expanded, the whole pill (collapsed header
+ chain-of-intent panel + open-full-chain footer) now sits inside
an emerald-bordered container with a subtle green tint and 1px
emerald ring. Visually separates the pill and all its embedded
chips / receipt rows from the rest of the list so the operator can
see at a glance which intent is "active" and where its boundary
sits.

Collapsed pills keep the existing slate look. Hover state stays
violet when collapsed, switches to a softer emerald hover when
expanded so the container doesn't fight the active state.

The "Open full chain" footer (visible only when an intent_chains
row is attached) also adopts the emerald palette so it reads as
part of the expanded container rather than an alien slate strip.

IntentChainPanel internals untouched — kept theme-neutral so the
same component still looks right when mounted inside the myLedger
ActivityReceiptCard (where green would be wrong).

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/MyWorkspaceTab.tsx` |

## Stats

 1 file changed, 17 insertions(+), 6 deletions(-)
