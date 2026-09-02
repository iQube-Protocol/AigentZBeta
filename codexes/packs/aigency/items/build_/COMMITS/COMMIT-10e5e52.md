# Commit Brief: `10e5e52` — Authenticate the codex upload/register admin endpoints

| Field | Value |
|-------|-------|
| SHA | [`10e5e52`](https://github.com/iQube-Protocol/AigentZBeta/commit/10e5e52295b794fc7dc68889612f3fd2f67eea08) |
| Author | Claude |
| Date | 2026-09-02T00:44:55Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Authenticate the codex upload/register admin endpoints

Both /api/admin/codex/upload-asset and /api/admin/codex/storage/register
had NO authorization check at all (confirmed by reading them directly - a
deliberate but unsafe "URL-protected" design, per their own prior comments).
Both existing browser callers (this app's CodexUploadModal.tsx and
apps/theqriptopian-web's own copy) already attach a real Supabase bearer
token when a session exists, so gating with requireAdminPersona makes that
already-sent token do something rather than asking either caller to change
how it calls these routes.

Extracted the core upload/register logic into
services/content/codexAssetUploadHandler.ts and
codexStorageRegisterHandler.ts so the routes can gate BEFORE delegating,
with each handler raising a typed error carrying its own HTTP status
instead of flattening every failure to 500.

The Threshold executor (services/threshold/uploadContentAsset.ts)
previously made an unauthenticated internal HTTP hop to
/api/admin/codex/upload-asset - now gated, which it has no session to
satisfy. It now calls handleCodexAssetUpload() directly, in-process, since
its own Threshold bearer authorization already succeeded upstream (its own
header comment: "Authority is established before entry") - no HTTP
boundary, authenticated or not, belongs between that authorization and
this execution. No caller for storage/register needs an equivalent
in-process path (browser-only, confirmed by grep).

19 new/updated tests prove both directions behaviorally: an unauthenticated
or non-admin request is refused with 403 BEFORE the upload/register logic
ever runs (including when requireAdminPersona itself throws - the whole
handler is wrapped, never an empty body), and an authorized admin request
reaches that logic and gets its real result back.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Both /api/admin/codex/upload-asset and /api/admin/codex/storage/register
had NO authorization check at all (confirmed by reading them directly - a
deliberate but unsafe "URL-protected" design, per their own prior comments).
Both existing browser callers (this app's CodexUploadModal.tsx and
apps/theqriptopian-web's own copy) already attach a real Supabase bearer
token when a session exists, so gating with requireAdminPersona makes that
already-sent token do something rather than asking either caller to change
how it calls these routes.

Extracted the core upload/register logic into
services/content/codexAssetUploadHandler.ts and
codexStorageRegisterHandler.ts so the routes can gate BEFORE delegating,
with each handler raising a typed error carrying its own HTTP status
instead of flattening every failure to 500.

The Threshold executor (services/threshold/uploadContentAsset.ts)
previously made an unauthenticated internal HTTP hop to
/api/admin/codex/upload-asset - now gated, which it has no session to
satisfy. It now calls handleCodexAssetUpload() directly, in-process, since
its own Threshold bearer authorization already succeeded upstream (its own
header comment: "Authority is established before entry") - no HTTP
boundary, authenticated or not, belongs between that authorization and
this execution. No caller for storage/register needs an equivalent
in-process path (browser-only, confirmed by grep).

19 new/updated tests prove both directions behaviorally: an unauthenticated
or non-admin request is refused with 403 BEFORE the upload/register logic
ever runs (including when requireAdminPersona itself throws - the whole
handler is wrapped, never an empty body), and an authorized admin request
reaches that logic and gets its real result back.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/admin/codex/storage/register/route.ts` |
| Modified | `app/api/admin/codex/upload-asset/route.ts` |
| Added | `services/content/codexAssetUploadHandler.ts` |
| Added | `services/content/codexStorageRegisterHandler.ts` |
| Modified | `services/threshold/uploadContentAsset.ts` |
| Added | `tests/codex-upload-authorization.test.ts` |
| Modified | `tests/threshold-upload-path-invariant.test.ts` |

## Stats

 7 files changed, 687 insertions(+), 513 deletions(-)
