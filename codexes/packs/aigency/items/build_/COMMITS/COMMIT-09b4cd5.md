# Commit Brief: `09b4cd5` — fix: FIO SDK registerFioAddress signature - remove publicKey parameter

| Field | Value |
|-------|-------|
| SHA | [`09b4cd5`](https://github.com/iQube-Protocol/AigentZBeta/commit/09b4cd5d134139b7683adfa2cdfb2371c92accdf) |
| Author | Know1 |
| Date | 2025-10-17T22:05:24Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: FIO SDK registerFioAddress signature - remove publicKey parameter

- FIO SDK's registerFioAddress only takes (handle, maxFee)
- Public key is already set during SDK initialization
- Resolves TypeScript compilation error in Amplify build
```

## Files Changed

_File details not available in backfill — see commit link above._
