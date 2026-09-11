# Commit Brief: `803a207` — Add typed asset placements with draft/publish for bridge media (A2)

| Field | Value |
|-------|-------|
| SHA | [`803a207`](https://github.com/iQube-Protocol/AigentZBeta/commit/803a207a48bb44114603fa096e4460bd27c1886d) |
| Author | Claude |
| Date | 2026-09-01T23:48:14Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add typed asset placements with draft/publish for bridge media (A2)

QRP-BRIDGE-ADMIN A2: select an already-uploaded asset -> assign it to a
bridge media slot as a draft -> preview -> publish -> the existing public
bridge reader shows it, with zero reader-side changes.

New: bridge_content_placements table (one row per section+slot, draft and
published asset fields kept separate) and bridgeContentPlacements.ts's pure
functions (assignDraftAsset, publishPlacement, getPlacement/
getPlacementsForSection). publishPlacement is the ONLY writer that touches
knyts_bridge_editorial_config, and it does so through the EXISTING
upsertKnytsBridgeEditorialSection function unchanged - every public bridge
reader keeps consuming that table exactly as before. Refuses (never
silently no-ops) when there is no draft to publish, so an empty publish
can never blank a live video/poster URL.

New POST/GET /api/journey/knyts-bridge/placements route, admin-gated via
requireAdminPersona on BOTH methods (drafts are pre-publication content,
unlike editorial-config's intentionally-public GET). Designed as a thin
HTTP boundary so A3's authorized-agent path can call
assignDraftAsset/publishPlacement directly in-process, matching the fix
already applied to the Threshold upload executor's own admin-hop pattern
elsewhere in this codebase.

Extracted KNYTS_BRIDGE_ALLOWED_SECTIONS into knytsBridgeEditorialConfig.ts
(was a route-local const) so the new placements route reuses the exact
same section allow-list as editorial-config - no second hand-copied list,
no drift risk between the two routes.

New PlacementAssetsPanel in QriptopianAdminTab.tsx renders alongside (never
inside) the existing KnytsBridgeAdminPanel copy/URL editor for each
section: paste an already-uploaded asset's URL as a draft, see a live
preview, publish. First-slice scope: assigning a draft takes a URL rather
than embedding a full upload form inline - the existing Codex Manager/
CodexUploadModal on this same tab remains the real upload surface.

Fixed a real, pre-existing defect while already in this file: both
editorial-config PUT and the new placements route now wrap their ENTIRE
handler body (including the admin check) in try/catch, so an unanticipated
throw from requireAdminPersona itself cannot produce an empty response
body - the exact defect class tests/journey-response-honesty.test.ts's own
header describes ("the operator, three times"). This resolves that route's
pre-existing baseline failure rather than merely avoiding a new one.

Migration supabase/migrations/20260901000000_bridge_content_placements.sql
is NOT yet applied to any Supabase project - see session notes for the
exact SQL and the open question of which project is authoritative for
this environment.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

QRP-BRIDGE-ADMIN A2: select an already-uploaded asset -> assign it to a
bridge media slot as a draft -> preview -> publish -> the existing public
bridge reader shows it, with zero reader-side changes.

New: bridge_content_placements table (one row per section+slot, draft and
published asset fields kept separate) and bridgeContentPlacements.ts's pure
functions (assignDraftAsset, publishPlacement, getPlacement/
getPlacementsForSection). publishPlacement is the ONLY writer that touches
knyts_bridge_editorial_config, and it does so through the EXISTING
upsertKnytsBridgeEditorialSection function unchanged - every public bridge
reader keeps consuming that table exactly as before. Refuses (never
silently no-ops) when there is no draft to publish, so an empty publish
can never blank a live video/poster URL.

New POST/GET /api/journey/knyts-bridge/placements route, admin-gated via
requireAdminPersona on BOTH methods (drafts are pre-publication content,
unlike editorial-config's intentionally-public GET). Designed as a thin
HTTP boundary so A3's authorized-agent path can call
assignDraftAsset/publishPlacement directly in-process, matching the fix
already applied to the Threshold upload executor's own admin-hop pattern
elsewhere in this codebase.

Extracted KNYTS_BRIDGE_ALLOWED_SECTIONS into knytsBridgeEditorialConfig.ts
(was a route-local const) so the new placements route reuses the exact
same section allow-list as editorial-config - no second hand-copied list,
no drift risk between the two routes.

New PlacementAssetsPanel in QriptopianAdminTab.tsx renders alongside (never
inside) the existing KnytsBridgeAdminPanel copy/URL editor for each
section: paste an already-uploaded asset's URL as a draft, see a live
preview, publish. First-slice scope: assigning a draft takes a URL rather
than embedding a full upload form inline - the existing Codex Manager/
CodexUploadModal on this same tab remains the real upload surface.

Fixed a real, pre-existing defect while already in this file: both
editorial-config PUT and the new placements route now wrap their ENTIRE
handler body (including the admin check) in try/catch, so an unanticipated
throw from requireAdminPersona itself cannot produce an empty response
body - the exact defect class tests/journey-response-honesty.test.ts's own
header describes ("the operator, three times"). This resolves that route's
pre-existing baseline failure rather than merely avoiding a new one.

Migration supabase/migrations/20260901000000_bridge_content_placements.sql
is NOT yet applied to any Supabase project - see session notes for the
exact SQL and the open question of which project is authoritative for
this environment.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/journey/knyts-bridge/editorial-config/route.ts` |
| Added | `app/api/journey/knyts-bridge/placements/route.ts` |
| Modified | `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` |
| Added | `services/journey/bridgeContentPlacements.ts` |
| Modified | `services/journey/knytsBridgeEditorialConfig.ts` |
| Added | `supabase/migrations/20260901000000_bridge_content_placements.sql` |
| Added | `tests/bridge-content-placements.test.ts` |
| Modified | `tests/ci-personify-qriptopian-pulse-pipeline.test.ts` |

## Stats

 8 files changed, 705 insertions(+), 24 deletions(-)
