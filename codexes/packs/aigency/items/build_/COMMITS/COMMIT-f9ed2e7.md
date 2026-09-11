# Commit Brief: `f9ed2e7` — Lock CFS split viewport, add real infographics + activity/capsule composition

| Field | Value |
|-------|-------|
| SHA | [`f9ed2e7`](https://github.com/iQube-Protocol/AigentZBeta/commit/f9ed2e7b923f052ccc9de6865c5d6c242731c3cd) |
| Author | Claude |
| Date | 2026-09-03T17:07:46Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Lock CFS split viewport, add real infographics + activity/capsule composition

Discover, Learn and Explore now use a locked split viewport at desktop
width: the media column (BridgeMediaCarouselPane, keyboard-navigable)
stays fixed while only the Learning Rail column scrolls internally
(relying on JourneyRunSurface's existing bounded-height contract, not
a hardcoded vh figure) — mobile/tablet fall back to ordinary page
scroll with no nested scroll panes. The media carousel now carries the
stage's real, verified production infographics (services/journey/
fsCanonicalMedia.ts, resolved live against codex_media_assets — all 8
CFS pack assets confirmed active/shareable) alongside the placeholder
video, replacing the "not yet published" fallback.

The right column is rebuilt on a new reusable activity/capsule model
(services/journey/bridgeActivity.ts, BridgeActivityCarousel/Capsule/
GroupRail) — each lesson moment is a horizontally-scrollable group of
capsules (goal/comparison/simulation/knowledge-check/capability/
action/example/reflection), every capsule kept mounted for the
group's lifetime so scrolling never resets a slider, selection, or
acknowledged concept. Learn is migrated onto the same locked-viewport
+ carousel pattern used by Discover/Explore, carrying all three real
lesson infographics and its existing Advisor/Architect/Runtime
evidence gate unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Discover, Learn and Explore now use a locked split viewport at desktop
width: the media column (BridgeMediaCarouselPane, keyboard-navigable)
stays fixed while only the Learning Rail column scrolls internally
(relying on JourneyRunSurface's existing bounded-height contract, not
a hardcoded vh figure) — mobile/tablet fall back to ordinary page
scroll with no nested scroll panes. The media carousel now carries the
stage's real, verified production infographics (services/journey/
fsCanonicalMedia.ts, resolved live against codex_media_assets — all 8
CFS pack assets confirmed active/shareable) alongside the placeholder
video, replacing the "not yet published" fallback.

The right column is rebuilt on a new reusable activity/capsule model
(services/journey/bridgeActivity.ts, BridgeActivityCarousel/Capsule/
GroupRail) — each lesson moment is a horizontally-scrollable group of
capsules (goal/comparison/simulation/knowledge-check/capability/
action/example/reflection), every capsule kept mounted for the
group's lifetime so scrolling never resets a slider, selection, or
acknowledged concept. Learn is migrated onto the same locked-viewport
+ carousel pattern used by Discover/Explore, carrying all three real
lesson infographics and its existing Advisor/Architect/Runtime
evidence gate unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `components/journey/BridgeActivityCapsule.tsx` |
| Added | `components/journey/BridgeActivityCarousel.tsx` |
| Added | `components/journey/BridgeActivityGroupRail.tsx` |
| Modified | `components/journey/BridgeMediaCarouselPane.tsx` |
| Modified | `components/journey/BridgeMediaInteractionSection.tsx` |
| Modified | `components/journey/FinancialSovereigntyIntroStage.tsx` |
| Added | `services/journey/bridgeActivity.ts` |
| Added | `services/journey/fsCanonicalMedia.ts` |
| Modified | `tests/cfs-content-pack-integration.test.ts` |

## Stats

 9 files changed, 631 insertions(+), 339 deletions(-)
