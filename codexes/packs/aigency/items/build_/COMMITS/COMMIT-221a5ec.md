# Commit Brief: `221a5ec` — fix upload-asset route silently dropping isShareable on individual-form-fields path

| Field | Value |
|-------|-------|
| SHA | [`221a5ec`](https://github.com/iQube-Protocol/AigentZBeta/commit/221a5ec8000fababf180aa7d7c1d61da3524aa15) |
| Author | Claude |
| Date | 2026-08-22T09:22:17Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix upload-asset route silently dropping isShareable on individual-form-fields path

services/threshold/uploadContentAsset.ts appends isShareable='true' as a
form field for cover/thumbnail/hero/social roles, but the
individual-form-fields parsing branch of
app/api/admin/codex/upload-asset/route.ts never read it. Every asset
uploaded through the shared Threshold executor since that pipeline existed
silently landed with is_shareable=false in codex_media_assets, which the
essay-cover and content-media display routes reject with 403
asset-not-shareable regardless of whether the image itself is valid.

Discovered while re-uploading corrected Qriptopian essay covers through the
now-fixed base64/image-validation path: the upload succeeded, but the
freshly-uploaded asset would still have failed to display for this reason.

Adds isShareable extraction alongside the other individual form fields.
Canary added to tests/threshold-upload-path-invariant.test.ts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

services/threshold/uploadContentAsset.ts appends isShareable='true' as a
form field for cover/thumbnail/hero/social roles, but the
individual-form-fields parsing branch of
app/api/admin/codex/upload-asset/route.ts never read it. Every asset
uploaded through the shared Threshold executor since that pipeline existed
silently landed with is_shareable=false in codex_media_assets, which the
essay-cover and content-media display routes reject with 403
asset-not-shareable regardless of whether the image itself is valid.

Discovered while re-uploading corrected Qriptopian essay covers through the
now-fixed base64/image-validation path: the upload succeeded, but the
freshly-uploaded asset would still have failed to display for this reason.

Adds isShareable extraction alongside the other individual form fields.
Canary added to tests/threshold-upload-path-invariant.test.ts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/admin/codex/upload-asset/route.ts` |
| Modified | `tests/threshold-upload-path-invariant.test.ts` |

## Stats

 2 files changed, 18 insertions(+)
