# Commit Brief: `ae6bb66` — fix toggle persistence — remove admin gate from persistRuntimeContext

| Field | Value |
|-------|-------|
| SHA | [`ae6bb66`](https://github.com/iQube-Protocol/AigentZBeta/commit/ae6bb6671bf3023c54d5374fa18ae971afab3b1b) |
| Author | Claude |
| Date | 2026-06-19T12:10:36Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix toggle persistence — remove admin gate from persistRuntimeContext

The admin guard (runtimeAdminModeRef.current check) prevented localStorage
and server writes when runtimeAdminMode hadn't resolved yet (async email
check). On refresh, both getRuntimeContextPreference() and the server GET
returned 'knyt' (default) because the PUT was never called. Now every
toggle writes to both localStorage and server unconditionally.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

The admin guard (runtimeAdminModeRef.current check) prevented localStorage
and server writes when runtimeAdminMode hadn't resolved yet (async email
check). On refresh, both getRuntimeContextPreference() and the server GET
returned 'knyt' (default) because the PUT was never called. Now every
toggle writes to both localStorage and server unconditionally.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |

## Stats

 1 file changed, 4 insertions(+), 14 deletions(-)
