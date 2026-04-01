# Commit Brief: `288fbc0` — Fix persona loading and tenant selection

| Field | Value |
|-------|-------|
| SHA | [`288fbc0`](https://github.com/iQube-Protocol/AigentZBeta/commit/288fbc0e34d24b517a6768f9009909fc6467b57b) |
| Author | Kn0w-1 |
| Date | 2025-11-30T06:40:42Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix persona loading and tenant selection

- Fixed tasks page to use correct API response format (data.data instead of data.personas)
- Fixed TenantSwitcher to properly trigger onTenantChange on initial load
- Skip default 't1' tenant ID when looking for existing tenant
```

## Files Changed

_File details not available in backfill — see commit link above._
