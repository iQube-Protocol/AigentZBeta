# Commit Brief: `841a64e` — fix amplify build — remove literal @worldcoin/idkit dynamic import

| Field | Value |
|-------|-------|
| SHA | [`841a64e`](https://github.com/iQube-Protocol/AigentZBeta/commit/841a64e7b413ad40563f40cb6cfbd58f2824923d) |
| Author | Claude |
| Date | 2026-06-13T19:48:50Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix amplify build — remove literal @worldcoin/idkit dynamic import

webpack still resolves dynamic import('@worldcoin/idkit') at build time
even when wrapped in .catch(). the package isn't installed yet (stub
mode is the demo cut for sprint 2), so the build fails with
'Module not found: @worldcoin/idkit'.

amplify build log:
  Failed to compile.
  ./app/components/content/SmartWalletDrawer.tsx
  Module not found: Can't resolve '@worldcoin/idkit'

fix: drop the dynamic import entirely. always emit a dev-worldid-orb
proof bundle from the wallet drawer; the server-side verifyWorldIdProof
in services/passport/personhoodProof.ts already handles the dev token
when WORLD_ID_APP_ID env var is unset. when @worldcoin/idkit is
installed (sprint 2 follow-up: a dedicated WorldIdButton component
will mount IDKitWidget inline), that component will own the real
modal flow; this drawer path stays as the dev-mode fallback.

verified locally: next build no longer errors on this module.
```

## Body

webpack still resolves dynamic import('@worldcoin/idkit') at build time
even when wrapped in .catch(). the package isn't installed yet (stub
mode is the demo cut for sprint 2), so the build fails with
'Module not found: @worldcoin/idkit'.

amplify build log:
  Failed to compile.
  ./app/components/content/SmartWalletDrawer.tsx
  Module not found: Can't resolve '@worldcoin/idkit'

fix: drop the dynamic import entirely. always emit a dev-worldid-orb
proof bundle from the wallet drawer; the server-side verifyWorldIdProof
in services/passport/personhoodProof.ts already handles the dev token
when WORLD_ID_APP_ID env var is unset. when @worldcoin/idkit is
installed (sprint 2 follow-up: a dedicated WorldIdButton component
will mount IDKitWidget inline), that component will own the real
modal flow; this drawer path stays as the dev-mode fallback.

verified locally: next build no longer errors on this module.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/components/content/SmartWalletDrawer.tsx` |

## Stats

 1 file changed, 15 insertions(+), 30 deletions(-)
