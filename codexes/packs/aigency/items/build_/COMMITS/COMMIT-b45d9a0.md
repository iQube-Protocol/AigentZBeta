# Commit Brief: `b45d9a0` — fix(intent chains): add code:chainTemplate to backfill route VALID_SOURCES

| Field | Value |
|-------|-------|
| SHA | [`b45d9a0`](https://github.com/iQube-Protocol/AigentZBeta/commit/b45d9a0979aa181edc24e72cfaa299c4771e7ded) |
| Author | Claude |
| Date | 2026-06-02T03:04:51Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix(intent chains): add code:chainTemplate to backfill route VALID_SOURCES

Commit 5 added the loader + extended SOURCE_LOADERS in runBackfill.ts
but missed the admin route's own VALID_SOURCES allowlist. The POST
/api/admin/registry/backfill?source=code:chainTemplate request 400'd
with invalid_source as a result.

One-line list extension. After redeploy the backfill call seeds the
marketa.ask-partner-proposal template into iqube_id_map.
```

## Body

Commit 5 added the loader + extended SOURCE_LOADERS in runBackfill.ts
but missed the admin route's own VALID_SOURCES allowlist. The POST
/api/admin/registry/backfill?source=code:chainTemplate request 400'd
with invalid_source as a result.

One-line list extension. After redeploy the backfill call seeds the
marketa.ask-partner-proposal template into iqube_id_map.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/admin/registry/backfill/route.ts` |

## Stats

 1 file changed, 3 insertions(+)
