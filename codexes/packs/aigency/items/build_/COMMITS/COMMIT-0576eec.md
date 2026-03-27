# Commit Brief: `0576eec` — fix: Use Node.js to write .env.production (Amplify env vars not accessible to shell)

| Field | Value |
|-------|-------|
| SHA | [`0576eec`](https://github.com/iQube-Protocol/AigentZBeta/commit/0576eecc9e5fe45a26c9ac4a77dab75a56187c16) |
| Author | Kn0w-1 |
| Date | 2025-12-26T22:19:33Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Use Node.js to write .env.production (Amplify env vars not accessible to shell)

Root cause: Amplify environment variables are available to Node.js process.env
but NOT to shell variable expansion. The printf commands were writing empty
values because  etc. were undefined in shell context.

Solution: Use Node.js script to read from process.env and write .env.production.
This ensures all Amplify env vars are properly captured at build time.

The hard-fail check passed (confirming Node.js can see the vars) but the
diagnostic showed [EMPTY] (confirming shell cannot see them).
```

## Files Changed

_File details not available in backfill — see commit link above._
