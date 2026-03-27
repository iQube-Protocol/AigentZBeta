# Commit Brief: `5c756ed` — fix 413 on experience list by excluding blak_qube from select

| Field | Value |
|-------|-------|
| SHA | [`5c756ed`](https://github.com/iQube-Protocol/AigentZBeta/commit/5c756ed348ae85d7bd816dc566608d5da4dd1e20) |
| Author | Claude |
| Date | 2026-03-25T19:52:53Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix 413 on experience list by excluding blak_qube from select

blak_qube contains a components[] array that causes the Lambda response
to exceed the 6 MB limit when multiple records are returned. list queries
now select only the columns needed for card rendering; full blak_qube is
still fetched in getExperienceRecord for single-record detail views.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
