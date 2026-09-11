# Commit Brief: `ea936da` — A2 completion: infographic slot + integrated asset selection/upload

| Field | Value |
|-------|-------|
| SHA | [`ea936da`](https://github.com/iQube-Protocol/AigentZBeta/commit/ea936da36cfb7d7a1eaea05b73a9e1ec2493c4f6) |
| Author | Claude |
| Date | 2026-09-02T06:07:41Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
A2 completion: infographic slot + integrated asset selection/upload

Extends PlacementSlot to video|poster|infographic. infographic publishes
placement bookkeeping only — no knyts_bridge_editorial_config column
exists for it yet, so no live bridge surface renders one; documented
honestly rather than silently treated as equivalent to video/poster.

PlacementAssetsPanel gains real asset selection/upload, replacing the
paste-a-URL-only first slice: browse already-uploaded bridge assets via
the now-gated assets-by-category route, or upload new via the existing
sign->PUT->register pipeline (series='bridge', reusing the existing
social_campaign_video/social_campaign_image asset kinds — no new kind
invented). codexStorageRegisterHandler.ts's encryption skip-list gains
series==='bridge' alongside the existing 'qriptopian' exemption, since
bridge media is served directly to unauthenticated visitors and must
stay genuinely public. Paste-a-URL kept as a fallback.

Migration-honesty: assignDraftAsset now throws a named
'bridge-placements-table-missing' error on a missing table instead of a
raw Postgres message; the route translates it to a clean 503
'bridge-placements-unavailable' rather than a confusing generic string.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Extends PlacementSlot to video|poster|infographic. infographic publishes
placement bookkeeping only — no knyts_bridge_editorial_config column
exists for it yet, so no live bridge surface renders one; documented
honestly rather than silently treated as equivalent to video/poster.

PlacementAssetsPanel gains real asset selection/upload, replacing the
paste-a-URL-only first slice: browse already-uploaded bridge assets via
the now-gated assets-by-category route, or upload new via the existing
sign->PUT->register pipeline (series='bridge', reusing the existing
social_campaign_video/social_campaign_image asset kinds — no new kind
invented). codexStorageRegisterHandler.ts's encryption skip-list gains
series==='bridge' alongside the existing 'qriptopian' exemption, since
bridge media is served directly to unauthenticated visitors and must
stay genuinely public. Paste-a-URL kept as a fallback.

Migration-honesty: assignDraftAsset now throws a named
'bridge-placements-table-missing' error on a missing table instead of a
raw Postgres message; the route translates it to a clean 503
'bridge-placements-unavailable' rather than a confusing generic string.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/journey/knyts-bridge/placements/route.ts` |
| Modified | `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` |
| Modified | `services/content/codexStorageRegisterHandler.ts` |
| Modified | `services/journey/bridgeContentPlacements.ts` |
| Modified | `supabase/migrations/20260901000000_bridge_content_placements.sql` |
| Added | `tests/bridge-asset-picker-completion.test.ts` |
| Modified | `tests/bridge-content-placements.test.ts` |

## Stats

 7 files changed, 324 insertions(+), 36 deletions(-)
