# Commit Brief: `a33205e` — repair mcp gateway upload endpoint routing to canonical /api/content/assets/upload

| Field | Value |
|-------|-------|
| SHA | [`a33205e`](https://github.com/iQube-Protocol/AigentZBeta/commit/a33205e4bad63587e1f10c27440e2ae8cb119893) |
| Author | Claude |
| Date | 2026-08-22T01:55:26Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
repair mcp gateway upload endpoint routing to canonical /api/content/assets/upload

Phase 2 of MCP gateway upload fix:

- Switch gateway.ts upload_content_asset from /api/admin/codex/upload-asset to canonical /api/content/assets/upload
- Extend upload_content_asset MCP parameters with bundle metadata: bundleId, bundleLabel, bundleType, bundleOrder, assetUse, setPrimary
- Forward complete binary/metadata multipart to canonical endpoint without synthesis
- Fix mergeAssetManifest() to support unbounded asset model (identity-based append, not role-based replacement)
- Implement setPrimary:true flag to establish a primary cover for the content
- Support multiple assets with same role coexisting without removal
- Add comprehensive regression test covering all bundling scenarios (8 tests, all passing)
- Verified TypeScript compilation (no errors)
- Regression test confirms: uploads succeed, content binding succeeds, bundles created, assets append not replace, setPrimary establishes primary, no max asset count

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

Phase 2 of MCP gateway upload fix:

- Switch gateway.ts upload_content_asset from /api/admin/codex/upload-asset to canonical /api/content/assets/upload
- Extend upload_content_asset MCP parameters with bundle metadata: bundleId, bundleLabel, bundleType, bundleOrder, assetUse, setPrimary
- Forward complete binary/metadata multipart to canonical endpoint without synthesis
- Fix mergeAssetManifest() to support unbounded asset model (identity-based append, not role-based replacement)
- Implement setPrimary:true flag to establish a primary cover for the content
- Support multiple assets with same role coexisting without removal
- Add comprehensive regression test covering all bundling scenarios (8 tests, all passing)
- Verified TypeScript compilation (no errors)
- Regression test confirms: uploads succeed, content binding succeeds, bundles created, assets append not replace, setPrimary establishes primary, no max asset count

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/content/assets/upload/route.ts` |
| Modified | `services/threshold/gateway.ts` |
| Added | `tests/content-asset-unbounded-bundling.test.ts` |

## Stats

 3 files changed, 278 insertions(+), 61 deletions(-)
