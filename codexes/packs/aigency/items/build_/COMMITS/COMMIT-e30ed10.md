# Commit Brief: `e30ed10` — Update TenantSwitcher to fetch real data from API

| Field | Value |
|-------|-------|
| SHA | [`e30ed10`](https://github.com/iQube-Protocol/AigentZBeta/commit/e30ed108b3958892b63e1924c1ffc72df3035f79) |
| Author | Kn0w-1 |
| Date | 2025-11-30T06:22:17Z |
| Branch | dev (direct push) |
| Type | `chore` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Update TenantSwitcher to fetch real data from API

- Replaced mock data with API calls to /api/crm/franchises and /api/crm/tenants
- Added loading and error states
- Groups tenants by franchise, with 'Unassigned' category for orphaned tenants
- Auto-selects first tenant and notifies context on initial load
```

## Files Changed

_File details not available in backfill — see commit link above._
