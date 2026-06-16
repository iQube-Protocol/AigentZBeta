# Commit Brief: `7dcfb89` — fix steward review auth + add collapsible wallet cards

| Field | Value |
|-------|-------|
| SHA | [`7dcfb89`](https://github.com/iQube-Protocol/AigentZBeta/commit/7dcfb899a97b58fd3a368f829bb57a9979bb3590) |
| Author | Claude |
| Date | 2026-06-14T19:19:54Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix steward review auth + add collapsible wallet cards

Steward review queue:
- Switch personaFetch → authedFetchHeaders for iframe embed auth
  (same fix applied to LockerTab/BoundedDelegationTab/PassportEnsTab)
- Both queue load and decide actions now carry Bearer token

Wallet drawer collapsible cards:
- PersonaQube section: add chevron toggle to collapse/expand the
  on-chain identity details
- AgentQube cards: each agent card gets its own chevron for
  collapse/expand (matching the PassportQube pattern)
- All three iQube sections now have consistent collapse UX

Locker items:
- Return encryption_iv and encryption_auth_tag in GET response
- Show AES-256-GCM encryption badge with IV/tag proof

https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

Steward review queue:
- Switch personaFetch → authedFetchHeaders for iframe embed auth
  (same fix applied to LockerTab/BoundedDelegationTab/PassportEnsTab)
- Both queue load and decide actions now carry Bearer token

Wallet drawer collapsible cards:
- PersonaQube section: add chevron toggle to collapse/expand the
  on-chain identity details
- AgentQube cards: each agent card gets its own chevron for
  collapse/expand (matching the PassportQube pattern)
- All three iQube sections now have consistent collapse UX

Locker items:
- Return encryption_iv and encryption_auth_tag in GET response
- Show AES-256-GCM encryption badge with IV/tag proof

https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/components/content/SmartWalletDrawer.tsx` |
| Modified | `app/triad/components/codex/tabs/PassportBureauStewardTab.tsx` |

## Stats

 2 files changed, 47 insertions(+), 13 deletions(-)
