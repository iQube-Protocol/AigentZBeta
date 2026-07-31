# Commit Brief: `25cf4de` — persist metaMe/KNYT takeover context toggle across sessions

| Field | Value |
|-------|-------|
| SHA | [`25cf4de`](https://github.com/iQube-Protocol/AigentZBeta/commit/25cf4de867fca693b9ec6f3cf947ee08cbfb4783) |
| Author | Claude |
| Date | 2026-06-19T00:55:11Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
persist metaMe/KNYT takeover context toggle across sessions

Route every runtime takeover context change (in-runtime Play-menu KNYT
toggle + RUNTIME_CONTEXT_CHANGE shell messages) through a single
persistRuntimeContext helper. Previously only the admin Settings tab
persisted the choice; the in-runtime/shell toggles flipped live state
only, so the selection reverted to the server/launch default on the next
session. Persistence (localStorage + PUT /api/runtime/settings/context +
storage event) is gated on runtimeAdminMode read via a ref to avoid a
stale closure in the once-mounted message handlers.
```

## Body

Route every runtime takeover context change (in-runtime Play-menu KNYT
toggle + RUNTIME_CONTEXT_CHANGE shell messages) through a single
persistRuntimeContext helper. Previously only the admin Settings tab
persisted the choice; the in-runtime/shell toggles flipped live state
only, so the selection reverted to the server/launch default on the next
session. Persistence (localStorage + PUT /api/runtime/settings/context +
storage event) is gated on runtimeAdminMode read via a ref to avoid a
stale closure in the once-mounted message handlers.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |

## Stats

 2 files changed, 37 insertions(+), 8 deletions(-)
