# Commit Brief: `0132bdb` — soft-launch grooming pass: Constitutional Internet Bridge + KNYTS Bridge refinements

| Field | Value |
|-------|-------|
| SHA | [`0132bdb`](https://github.com/iQube-Protocol/AigentZBeta/commit/0132bdbf95c5cbbabcb883b2aa4f0075a9bc032e) |
| Author | Claude |
| Date | 2026-08-14T03:46:46Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
soft-launch grooming pass: Constitutional Internet Bridge + KNYTS Bridge refinements

Journey definition updates:
  - Renamed CI Bridge 'act' stage to 'personify' (tell your Constitutional story)
  - Updated all stage descriptions to match grooming brief exactly (7 stages)
  - Renamed KNYTS Bridge final 'buy' stage to 'choose' (7 stages canonical)
  - Updated stage descriptions for both bridges

Surface registry and components:
  - Created ConstitutionalInternetBridgePersonifyMyCanvas: embeds myCanvas with campaign tagging
  - Created KnytsBridgeChooseSurface: 4 destination cards (KNYT Store, research, partner, Pilot)
  - Updated surface registry refs: 'ci-bridge-act' → 'ci-bridge-personify', 'knyts-bridge-buy' → 'knyts-bridge-choose'

Passport and auth improvements:
  - Removed duplicate page-level Passport gate from CI Bridge page (surface-level gate only)
  - Updated Passport room banner text and animations (fade-out over 2.5s)
  - Fixed stale stage references (selectStage calls updated)

CI Bridge CHOOSE destination updates:
  - Added Constitutional Financial Services Pilot mailto destination
  - Added Explore the Mythos link to KNYTS Bridge (cross-bridge navigation)
  - Changed Continue Reading from polity-core to Qriptopian Papers

CI Bridge VIEW sequence improvements:
  - Added rail-driven video selection + .play() on user gesture
  - Video playback triggered by click or focus (never auto-play)

UI/UX refinements:
  - Added stage number chip {activeIdx + 1} to compact journey header
  - Maintained slate house style (border-slate-800, bg-slate-900/40)

Remaining items (deferred for follow-up):
  - Article Zero synthetic entry pattern (myCanvas changes)
  - Media furniture quiet pattern (opacity animations)
  - Email CTA layout refinement (CI Choose)
  - PDF modal clipping boundary fix (component pending)
```

## Body

Journey definition updates:
  - Renamed CI Bridge 'act' stage to 'personify' (tell your Constitutional story)
  - Updated all stage descriptions to match grooming brief exactly (7 stages)
  - Renamed KNYTS Bridge final 'buy' stage to 'choose' (7 stages canonical)
  - Updated stage descriptions for both bridges

Surface registry and components:
  - Created ConstitutionalInternetBridgePersonifyMyCanvas: embeds myCanvas with campaign tagging
  - Created KnytsBridgeChooseSurface: 4 destination cards (KNYT Store, research, partner, Pilot)
  - Updated surface registry refs: 'ci-bridge-act' → 'ci-bridge-personify', 'knyts-bridge-buy' → 'knyts-bridge-choose'

Passport and auth improvements:
  - Removed duplicate page-level Passport gate from CI Bridge page (surface-level gate only)
  - Updated Passport room banner text and animations (fade-out over 2.5s)
  - Fixed stale stage references (selectStage calls updated)

CI Bridge CHOOSE destination updates:
  - Added Constitutional Financial Services Pilot mailto destination
  - Added Explore the Mythos link to KNYTS Bridge (cross-bridge navigation)
  - Changed Continue Reading from polity-core to Qriptopian Papers

CI Bridge VIEW sequence improvements:
  - Added rail-driven video selection + .play() on user gesture
  - Video playback triggered by click or focus (never auto-play)

UI/UX refinements:
  - Added stage number chip {activeIdx + 1} to compact journey header
  - Maintained slate house style (border-slate-800, bg-slate-900/40)

Remaining items (deferred for follow-up):
  - Article Zero synthetic entry pattern (myCanvas changes)
  - Media furniture quiet pattern (opacity animations)
  - Email CTA layout refinement (CI Choose)
  - PDF modal clipping boundary fix (component pending)

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/bridge/ci/page.tsx` |
| Modified | `components/journey/ConstitutionalInternetBridgeChooseSurface.tsx` |
| Modified | `components/journey/ConstitutionalInternetBridgePassportRoom.tsx` |
| Added | `components/journey/ConstitutionalInternetBridgePersonifyMyCanvas.tsx` |
| Modified | `components/journey/ConstitutionalInternetBridgeViewSequence.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Added | `components/journey/KnytsBridgeChooseSurface.tsx` |
| Modified | `components/journey/KnytsBridgePassportRoom.tsx` |
| Modified | `services/journey/constitutionalInternetBridgeJourney.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Modified | `services/journey/knytsBridgeCrossingJourney.ts` |

## Stats

 11 files changed, 272 insertions(+), 110 deletions(-)
