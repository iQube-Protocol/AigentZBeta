# Commit Brief: `d81950a` — Build the Constitutional Internet Bridge as a v1 slice of the KNYTS Bridge architecture

| Field | Value |
|-------|-------|
| SHA | [`d81950a`](https://github.com/iQube-Protocol/AigentZBeta/commit/d81950a3e17b9fe18e9c07e5fcf1e7bb99a21831) |
| Author | Claude |
| Date | 2026-08-10T17:41:04Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Build the Constitutional Internet Bridge as a v1 slice of the KNYTS Bridge architecture

Clones the KNYTS Bridge Threshold Guide onto a sibling journey
(constitutionalInternetBridgeJourney: passport -> act -> stand, the only
stages with real completion evidence) at /bridge/constitutional-internet.
Composition and generalization over new subsystems, per the reuse-first
brief:

- Extracts the MoneyPenny/Horizen ExperienceQube disposition write path
  into experienceQubeDispositionService.ts (behavior-preserving refactor,
  verified against the existing aigentme-disposition-agent-scoping test);
  the CI Bridge's ACT stage reuses it under its own agent scope (aigent-z)
  and context tag so the two journeys' receipts never cross-read.
- STAND reads real Passport/disposition receipts and the canonical
  computeStandingScore, deliberately avoiding the KNYTS panel's own
  "engagement counters labeled as Standing" mislabeling.
- VIEW composes real CANONICAL_PLATES_V1 plates with verbatim manuscript
  excerpts (cited by line) via a data-driven content-block model.
- ORIENT is a deterministic, non-gating frontier surface persisting intent
  via the existing generic campaign_events log (recordCampaignEvent) --
  no new schema.
- CHOOSE captures book demand (book_interest, not a paid preorder -- the
  KNYT commerce engine has no wired SKU for this yet) and reuses
  SocialSharingModal for sharing.
- Generalizes KNYTS's inline HOMECOMING JSX into BridgeMediaStage and
  retrofits /bridge/knyts to use it (output unchanged).
- Fixes a real SocialSharingModal bug found during discovery: an explicit
  article.url bypassed the /api/social/track attribution proxy entirely,
  breaking click/signup/conversion tracking for any caller that passed one.

New focused tests for the CI journey's resolveJourneyState ladder and the
ACT route's agent-scoping/validation; full repo tsc --noEmit is clean.
```

## Body

Clones the KNYTS Bridge Threshold Guide onto a sibling journey
(constitutionalInternetBridgeJourney: passport -> act -> stand, the only
stages with real completion evidence) at /bridge/constitutional-internet.
Composition and generalization over new subsystems, per the reuse-first
brief:

- Extracts the MoneyPenny/Horizen ExperienceQube disposition write path
  into experienceQubeDispositionService.ts (behavior-preserving refactor,
  verified against the existing aigentme-disposition-agent-scoping test);
  the CI Bridge's ACT stage reuses it under its own agent scope (aigent-z)
  and context tag so the two journeys' receipts never cross-read.
- STAND reads real Passport/disposition receipts and the canonical
  computeStandingScore, deliberately avoiding the KNYTS panel's own
  "engagement counters labeled as Standing" mislabeling.
- VIEW composes real CANONICAL_PLATES_V1 plates with verbatim manuscript
  excerpts (cited by line) via a data-driven content-block model.
- ORIENT is a deterministic, non-gating frontier surface persisting intent
  via the existing generic campaign_events log (recordCampaignEvent) --
  no new schema.
- CHOOSE captures book demand (book_interest, not a paid preorder -- the
  KNYT commerce engine has no wired SKU for this yet) and reuses
  SocialSharingModal for sharing.
- Generalizes KNYTS's inline HOMECOMING JSX into BridgeMediaStage and
  retrofits /bridge/knyts to use it (output unchanged).
- Fixes a real SocialSharingModal bug found during discovery: an explicit
  article.url bypassed the /api/social/track attribution proxy entirely,
  breaking click/signup/conversion tracking for any caller that passed one.

New focused tests for the CI journey's resolveJourneyState ladder and the
ACT route's agent-scoping/validation; full repo tsc --noEmit is clean.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/journey/constitutional-internet-bridge/act/disposition/route.ts` |
| Added | `app/api/journey/constitutional-internet-bridge/choose/book-interest/route.ts` |
| Added | `app/api/journey/constitutional-internet-bridge/orient/route.ts` |
| Added | `app/api/journey/constitutional-internet-bridge/stand/route.ts` |
| Added | `app/api/journey/constitutional-internet-bridge/state/route.ts` |
| Modified | `app/api/journey/moneypenny-horizen/aigentme/disposition/route.ts` |
| Added | `app/bridge/constitutional-internet/page.tsx` |
| Modified | `app/bridge/knyts/page.tsx` |
| Added | `components/journey/BridgeMediaStage.tsx` |
| Added | `components/journey/ConstitutionalAgentDispositionSurface.tsx` |
| Added | `components/journey/ConstitutionalFrontierOrientSurface.tsx` |
| Added | `components/journey/ConstitutionalInternetBridgeChooseSurface.tsx` |
| Added | `components/journey/ConstitutionalInternetBridgeStandPanel.tsx` |
| Added | `components/journey/ConstitutionalInternetBridgeViewSequence.tsx` |
| Modified | `services/campaign/campaignRegistry.ts` |
| Added | `services/journey/constitutionalInternetBridgeJourney.ts` |
| Added | `services/journey/constitutionalInternetBridgeStand.ts` |
| Added | `services/journey/constitutionalInternetBridgeViewContent.ts` |
| Added | `services/journey/experienceQubeDispositionService.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Added | `tests/ci-bridge-act-disposition-route.test.ts` |
| Added | `tests/constitutional-internet-bridge-journey.test.ts` |

## Stats

 22 files changed, 2133 insertions(+), 115 deletions(-)
