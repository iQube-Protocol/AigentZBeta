# Commit Brief: `fc82cb7` — remix expands inline like Customize banner — no popout dialog

| Field | Value |
|-------|-------|
| SHA | [`fc82cb7`](https://github.com/iQube-Protocol/AigentZBeta/commit/fc82cb789744c104d38217c0af9b284099a60611) |
| Author | Claude |
| Date | 2026-04-29T20:48:53Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
remix expands inline like Customize banner — no popout dialog

Continues the consistency pass on the per-capsule editor banners. The
admin Customize banner expands in place; Remix should match.

Three coordinated changes:

1. RemixDialog: new variant prop ('modal' | 'inline', defaults to 'modal'
   for backward compat). Inline variant skips the fixed-position overlay
   and the close X — host provides the surrounding banner. All state,
   action handlers (submit, discard, publish), and footer buttons render
   identically to the modal path.

2. RuntimeCapsuleRemixEditor (new component): mirrors the shape of
   RuntimeCapsuleAdminEditor — thin amber-tinted banner with a
   Sparkles + Remix toggle on the right; click expands the same banner
   in place to render <RemixDialog variant="inline" />. Close swaps the
   icon to X and the label to "Close editor".

3. MetaMeRuntimeClient: replaced the per-capsule Remix banner with the
   new wrapper. Removed the global remixDialogState and the three modal
   RemixDialog mounts at the bottom of the component — state is now
   per-capsule, owned inside the wrapper. Sign-in still flows through
   onSignInRequest -> setWalletDrawerOpen(true).

End result: clicking Remix on a capsule now expands the same banner
inline (matching Customize) instead of popping a centered modal.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Continues the consistency pass on the per-capsule editor banners. The
admin Customize banner expands in place; Remix should match.

Three coordinated changes:

1. RemixDialog: new variant prop ('modal' | 'inline', defaults to 'modal'
   for backward compat). Inline variant skips the fixed-position overlay
   and the close X — host provides the surrounding banner. All state,
   action handlers (submit, discard, publish), and footer buttons render
   identically to the modal path.

2. RuntimeCapsuleRemixEditor (new component): mirrors the shape of
   RuntimeCapsuleAdminEditor — thin amber-tinted banner with a
   Sparkles + Remix toggle on the right; click expands the same banner
   in place to render <RemixDialog variant="inline" />. Close swaps the
   icon to X and the label to "Close editor".

3. MetaMeRuntimeClient: replaced the per-capsule Remix banner with the
   new wrapper. Removed the global remixDialogState and the three modal
   RemixDialog mounts at the bottom of the component — state is now
   per-capsule, owned inside the wrapper. Sign-in still flows through
   onSignInRequest -> setWalletDrawerOpen(true).

End result: clicking Remix on a capsule now expands the same banner
inline (matching Customize) instead of popping a centered modal.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |
| Modified | `components/metame/runtime/RemixDialog.tsx` |
| Added | `components/metame/runtime/RuntimeCapsuleRemixEditor.tsx` |

## Stats

 3 files changed, 216 insertions(+), 61 deletions(-)
