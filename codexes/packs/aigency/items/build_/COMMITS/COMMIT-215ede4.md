# Commit Brief: `215ede4` — Fix iframe URL normalization in runtime shell-config

| Field | Value |
|-------|-------|
| SHA | [`215ede4`](https://github.com/iQube-Protocol/AigentZBeta/commit/215ede4d752ce8d9b98d1e4b2db1bc5380b1eac8) |
| Author | Kn0w-1 |
| Date | 2026-02-24T06:39:13Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix iframe URL normalization in runtime shell-config

- Normalize bad iframe paths (/runtime, /) to /metame/runtime
- Add embed=1 parameter when missing
- Prevents 404 errors in metaMe runtime shell

Fixes Lovable diagnosis of iframe.url causing 404 page
```

## Files Changed

_File details not available in backfill — see commit link above._
