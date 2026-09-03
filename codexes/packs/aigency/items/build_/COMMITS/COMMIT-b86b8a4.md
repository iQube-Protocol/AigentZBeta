# Commit Brief: `b86b8a4` — Give metaMe's MoneyPenny mount a real submenu, fix expand target, fix embed viewport collapse

| Field | Value |
|-------|-------|
| SHA | [`b86b8a4`](https://github.com/iQube-Protocol/AigentZBeta/commit/b86b8a424b234775eb3c922d815bdb6264eeec35) |
| Author | Claude |
| Date | 2026-09-03T10:37:02Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Give metaMe's MoneyPenny mount a real submenu, fix expand target, fix embed viewport collapse

metaMe's own MoneyPenny group had one fixed 'Orchestration' tab with no
siblings, so its tier-2 sub-header never rendered a domain submenu — the
copilot/orchestration workspace showed with nothing to navigate between
areas. Extracted MONEYPENNY_AREA_TABS (data/codex-configs.ts) as the one
canonical Home/My Money/Plan/Markets/Activity/Admin submenu definition,
spread verbatim into both MONEYPENNY_CARTRIDGE and METAME_CODEX, so every
host renders the identical native tabs instead of a hand-copied duplicate.

Moved the Admin tab into that group immediately after Activity (was a
standalone tab beside the group chip) — still adminOnly-gated via the same
shared predicate, so non-admins never see it.

Fixed Horizen's moneypenny-orchestration-focused registry descriptor:
removed expandedCodexSlug/expandedTab (which swapped Explore-metaMe expand
to the standalone moneypenny-codex shell — wrong now that metaMe's own
mount has a real submenu to expand into), updated its tab to the new
'home' slug, and raised focusedNavDepth from 0 to 1 so the submenu stays
visible in focused view, matching MoneyPennyBridgeEmbed's own depth for
CI/Knightsbridge. Added a LEGACY_TAB_SLUGS alias plus direct fixes to
every primary source (ACTIVATION_CATALOG, catalogueDestinationHelper.ts,
SpecialistsLayout.tsx's non-URL navigation) that referenced the retired
single-tab slug.

Root-caused and fixed the still-collapsed CI/Knightsbridge focused
viewport: JourneyRunSurface's stage-content wrapper divs had no height of
their own (flex flex-col, height:auto) inside their flex-1/overflow-y-auto
parent, so a mounted stage's own h-full (FinancialSovereigntyOperateStage's
embedOpen branch) had no definite containing-block height to resolve
against and collapsed to the iframe's intrinsic size. Added min-h-0/flex-1
propagation through that chain, gated on single-surface stages so
multi-surface stages keep their existing stacking. Verified live against
the running dev server across desktop/tablet-landscape/tablet-portrait/
narrow-mobile on both CI and Knightsbridge: the embed now fills
1302x659/926x527/670x783/292x571 respectively instead of collapsing to a
short band.

Documented the reusable 'Operate means operating within metaMe' principle
this correction establishes (codexes/packs/agentiq/updates/).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

metaMe's own MoneyPenny group had one fixed 'Orchestration' tab with no
siblings, so its tier-2 sub-header never rendered a domain submenu — the
copilot/orchestration workspace showed with nothing to navigate between
areas. Extracted MONEYPENNY_AREA_TABS (data/codex-configs.ts) as the one
canonical Home/My Money/Plan/Markets/Activity/Admin submenu definition,
spread verbatim into both MONEYPENNY_CARTRIDGE and METAME_CODEX, so every
host renders the identical native tabs instead of a hand-copied duplicate.

Moved the Admin tab into that group immediately after Activity (was a
standalone tab beside the group chip) — still adminOnly-gated via the same
shared predicate, so non-admins never see it.

Fixed Horizen's moneypenny-orchestration-focused registry descriptor:
removed expandedCodexSlug/expandedTab (which swapped Explore-metaMe expand
to the standalone moneypenny-codex shell — wrong now that metaMe's own
mount has a real submenu to expand into), updated its tab to the new
'home' slug, and raised focusedNavDepth from 0 to 1 so the submenu stays
visible in focused view, matching MoneyPennyBridgeEmbed's own depth for
CI/Knightsbridge. Added a LEGACY_TAB_SLUGS alias plus direct fixes to
every primary source (ACTIVATION_CATALOG, catalogueDestinationHelper.ts,
SpecialistsLayout.tsx's non-URL navigation) that referenced the retired
single-tab slug.

Root-caused and fixed the still-collapsed CI/Knightsbridge focused
viewport: JourneyRunSurface's stage-content wrapper divs had no height of
their own (flex flex-col, height:auto) inside their flex-1/overflow-y-auto
parent, so a mounted stage's own h-full (FinancialSovereigntyOperateStage's
embedOpen branch) had no definite containing-block height to resolve
against and collapsed to the iframe's intrinsic size. Added min-h-0/flex-1
propagation through that chain, gated on single-surface stages so
multi-surface stages keep their existing stacking. Verified live against
the running dev server across desktop/tablet-landscape/tablet-portrait/
narrow-mobile on both CI and Knightsbridge: the embed now fills
1302x659/926x527/670x783/292x571 respectively instead of collapsing to a
short band.

Documented the reusable 'Operate means operating within metaMe' principle
this correction establishes (codexes/packs/agentiq/updates/).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-09-03_operate-means-operating-within-metame.md` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `components/metame/welcome/layouts/SpecialistsLayout.tsx` |
| Modified | `data/activation-catalog.ts` |
| Modified | `data/codex-configs.ts` |
| Modified | `services/adaptive/applicationProjectionManifest.ts` |
| Modified | `services/journey/catalogueDestinationHelper.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Modified | `tests/financial-services-bridge-frontend-operate-projection.test.ts` |
| Modified | `tests/fs-operate-embed-viewport-parity.test.ts` |
| Modified | `tests/moneypenny-agentme-entry.test.ts` |
| Modified | `tests/moneypenny-capability-navigation.test.ts` |
| Modified | `tests/moneypenny-catalogue-operate-destination.test.ts` |

## Stats

 16 files changed, 423 insertions(+), 246 deletions(-)
