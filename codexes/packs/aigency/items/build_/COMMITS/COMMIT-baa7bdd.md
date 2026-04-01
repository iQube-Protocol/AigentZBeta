# Commit Brief: `baa7bdd` — fix: add tpid parameter to FIO handle registration

| Field | Value |
|-------|-------|
| SHA | [`baa7bdd`](https://github.com/iQube-Protocol/AigentZBeta/commit/baa7bdd2d5f3d59a4192041a16c0c33d3555b0fd) |
| Author | Know1 |
| Date | 2025-10-18T00:13:16Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: add tpid parameter to FIO handle registration

- Add tpid (Technology Provider ID) parameter to registerFioAddress
- Use empty string as valid tpid value
- Resolves validation error: tpid must match FIO address format
- FIO SDK requires tpid parameter even if empty
```

## Files Changed

_File details not available in backfill — see commit link above._
