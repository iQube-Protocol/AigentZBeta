# Commit Brief: `9b7f469` — A2 completion: infographic publishes AND renders through the real bridge reader

| Field | Value |
|-------|-------|
| SHA | [`9b7f469`](https://github.com/iQube-Protocol/AigentZBeta/commit/9b7f469a4f9d1caafc0e2ba0153a884f49a2a736) |
| Author | Claude |
| Date | 2026-09-02T12:38:11Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
A2 completion: infographic publishes AND renders through the real bridge reader

Previously the infographic slot only updated bridge_content_placements
bookkeeping — no bridge page rendered one. Extends the ACTUAL shared
media contract (knyts_bridge_editorial_config, the same table/route
video_url and poster_url already use) with an infographic_url column
(migration 20260902010000, additive) and threads it through
BridgeMediaStage -> KnytsBridgeMediaStage/ConstitutionalInternetBridgeMediaStage,
so a published infographic now actually appears on the bridge page.

Migration-safe: getKnytsBridgeEditorialSection does a two-tier read (full
column list, falls back to the legacy list on a 42703) so headline/copy/
video/poster keep working even before this migration lands in a given
environment; only infographicUrl degrades to null. A write that actually
sets infographicUrl on a missing column throws a named
KnytsBridgeInfographicColumnMissingError, surfaced by the placements
route as a clean 503 rather than a raw Postgres error.

Also fixes a real bug: the placements route's isPlacementSlot validator
never accepted 'infographic' at all — every infographic assign/publish
built in this session's earlier A2 pass would have 400'd. Wires the
caller-side makePublic: true (previous commit's decoupling fix) into the
bridge asset-picker's upload call.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Previously the infographic slot only updated bridge_content_placements
bookkeeping — no bridge page rendered one. Extends the ACTUAL shared
media contract (knyts_bridge_editorial_config, the same table/route
video_url and poster_url already use) with an infographic_url column
(migration 20260902010000, additive) and threads it through
BridgeMediaStage -> KnytsBridgeMediaStage/ConstitutionalInternetBridgeMediaStage,
so a published infographic now actually appears on the bridge page.

Migration-safe: getKnytsBridgeEditorialSection does a two-tier read (full
column list, falls back to the legacy list on a 42703) so headline/copy/
video/poster keep working even before this migration lands in a given
environment; only infographicUrl degrades to null. A write that actually
sets infographicUrl on a missing column throws a named
KnytsBridgeInfographicColumnMissingError, surfaced by the placements
route as a clean 503 rather than a raw Postgres error.

Also fixes a real bug: the placements route's isPlacementSlot validator
never accepted 'infographic' at all — every infographic assign/publish
built in this session's earlier A2 pass would have 400'd. Wires the
caller-side makePublic: true (previous commit's decoupling fix) into the
bridge asset-picker's upload call.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/journey/knyts-bridge/placements/route.ts` |
| Modified | `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` |
| Modified | `components/journey/BridgeMediaStage.tsx` |
| Modified | `components/journey/ConstitutionalInternetBridgeMediaStage.tsx` |
| Modified | `components/journey/KnytsBridgeMediaStage.tsx` |
| Modified | `services/journey/bridgeContentPlacements.ts` |
| Modified | `services/journey/knytsBridgeEditorialConfig.ts` |
| Added | `supabase/migrations/20260902010000_knyts_bridge_editorial_config_infographic_url.sql` |
| Modified | `tests/bridge-content-placements.test.ts` |
| Added | `tests/knyts-bridge-infographic-render.test.ts` |

## Stats

 10 files changed, 349 insertions(+), 54 deletions(-)
