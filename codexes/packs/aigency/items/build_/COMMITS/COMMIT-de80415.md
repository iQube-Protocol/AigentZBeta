# Commit Brief: `de80415` — Close storage/sign + assets-by-category authorization gaps

| Field | Value |
|-------|-------|
| SHA | [`de80415`](https://github.com/iQube-Protocol/AigentZBeta/commit/de8041574b1cc7afd2f895d6332539d85518ad0d) |
| Author | Claude |
| Date | 2026-09-02T06:02:24Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Close storage/sign + assets-by-category authorization gaps

Both had zero auth check. storage/sign was the most severe: it hands
out a signed Supabase Storage UPLOAD URL (a write capability, including
an existingPath overwrite of an arbitrary object) to any caller.
assets-by-category leaked internal asset titles/CIDs/status to any
caller. Both now gated by requireAdminPersona, mirroring the
upload-asset/storage/register fix from earlier this session — extracted
into codexStorageSignHandler.ts for the same reason storage/register's
logic was extracted.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Both had zero auth check. storage/sign was the most severe: it hands
out a signed Supabase Storage UPLOAD URL (a write capability, including
an existingPath overwrite of an arbitrary object) to any caller.
assets-by-category leaked internal asset titles/CIDs/status to any
caller. Both now gated by requireAdminPersona, mirroring the
upload-asset/storage/register fix from earlier this session — extracted
into codexStorageSignHandler.ts for the same reason storage/register's
logic was extracted.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/admin/codex/assets-by-category/route.ts` |
| Modified | `app/api/admin/codex/storage/sign/route.ts` |
| Added | `services/content/codexStorageSignHandler.ts` |
| Added | `tests/codex-storage-sign-and-assets-by-category-authorization.test.ts` |

## Stats

 4 files changed, 276 insertions(+), 114 deletions(-)
