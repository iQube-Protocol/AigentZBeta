# Commit Brief: `f0315bc` — fix: KNYT store sign-in gate, balance flicker, and EVM KNYT display

| Field | Value |
|-------|-------|
| SHA | [`f0315bc`](https://github.com/iQube-Protocol/AigentZBeta/commit/f0315bc42f43174e729bbd4e2fb574229badbe5b) |
| Author | Claude |
| Date | 2026-05-01T14:00:19Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: KNYT store sign-in gate, balance flicker, and EVM KNYT display

Three distinct bugs:

1. KnytTab sign-in gate broken — store showed 'Sign In Required' even when the
   user was already signed in. Root cause: KnytTab called getActivePersonaId()
   which reads localStorage 'active_persona_id' (legacy key), while
   PersonaContext.setActivePersonaId writes to 'currentPersonaId' (canonical
   key). KnytTab never saw persona changes after mount. Fix: replace local
   activePersonaId state with usePersonaSafe() so persona updates propagate
   immediately from the same context that SmartWalletDrawer writes to.

2. KNYT balance flickered between 0 and real value — useKnytBalance reset
   balance to null before each refetch, causing the display to flash 0. Fix:
   keep the previous balance value during refetch; only update after a
   successful response.

3. ContentPurchaseModal showed no KNYT option for users who have on-chain EVM
   KNYT but no DVN KNYT. Fix: add evmKnyt prop, pass balance?.evmKnyt from
   KnytTab, and show clear messaging: 'X KNYT on-chain — not yet available
   in-app'. On-chain KNYT purchases require DVN bridging (Phase 2).
```

## Body

Three distinct bugs:

1. KnytTab sign-in gate broken — store showed 'Sign In Required' even when the
   user was already signed in. Root cause: KnytTab called getActivePersonaId()
   which reads localStorage 'active_persona_id' (legacy key), while
   PersonaContext.setActivePersonaId writes to 'currentPersonaId' (canonical
   key). KnytTab never saw persona changes after mount. Fix: replace local
   activePersonaId state with usePersonaSafe() so persona updates propagate
   immediately from the same context that SmartWalletDrawer writes to.

2. KNYT balance flickered between 0 and real value — useKnytBalance reset
   balance to null before each refetch, causing the display to flash 0. Fix:
   keep the previous balance value during refetch; only update after a
   successful response.

3. ContentPurchaseModal showed no KNYT option for users who have on-chain EVM
   KNYT but no DVN KNYT. Fix: add evmKnyt prop, pass balance?.evmKnyt from
   KnytTab, and show clear messaging: 'X KNYT on-chain — not yet available
   in-app'. On-chain KNYT purchases require DVN bridging (Phase 2).

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/hooks/useKnytBalance.ts` |
| Modified | `app/triad/components/codex/tabs/KnytTab.tsx` |
| Modified | `app/triad/components/content/ContentPurchaseModal.tsx` |

## Stats

 3 files changed, 30 insertions(+), 25 deletions(-)
