# Commit Brief: `6a9cc6d` — Add the /bridge/ci redirect and update path references (rest of the rename)

| Field | Value |
|-------|-------|
| SHA | [`6a9cc6d`](https://github.com/iQube-Protocol/AigentZBeta/commit/6a9cc6db75136491c0300d2e470324670124c4aa) |
| Author | Claude |
| Date | 2026-08-10T19:26:21Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add the /bridge/ci redirect and update path references (rest of the rename)

Companion commit to df68a8fdb (the file rename itself, which landed alone
because an invalid pathspec in that git add silently dropped these
content changes): the actual next.config.js redirect, and the four
comment/deep-link updates from /bridge/constitutional-internet to
/bridge/ci.
```

## Body

Companion commit to df68a8fdb (the file rename itself, which landed alone
because an invalid pathspec in that git add silently dropped these
content changes): the actual next.config.js redirect, and the four
comment/deep-link updates from /bridge/constitutional-internet to
/bridge/ci.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/bridge/ci/page.tsx` |
| Modified | `components/journey/ConstitutionalInternetBridgeChooseSurface.tsx` |
| Modified | `next.config.js` |
| Modified | `services/journey/constitutionalInternetBridgeJourney.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |

## Stats

 5 files changed, 18 insertions(+), 4 deletions(-)
