# Commit Brief: `5d62e58` — LEARN/EXPLORE: kind-discriminated FS evidence, not a bare Continue click

| Field | Value |
|-------|-------|
| SHA | [`5d62e58`](https://github.com/iQube-Protocol/AigentZBeta/commit/5d62e582dbdff44bdcf7a4e81349363fa214386b) |
| Author | Claude |
| Date | 2026-09-01T11:04:59Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
LEARN/EXPLORE: kind-discriminated FS evidence, not a bare Continue click

DISCOVER's "any observed Continue" bar stays deliberately weak. LEARN now
requires all three Advisor/Architect/Runtime concept cards individually
acknowledged (BridgeMediaStage gains a generic children slot +
primaryCtaDisabled to host them); EXPLORE requires at least one real
MoneyPenny serviceCatalog capability actually clicked, not a joined display
string. Both reuse the same generic experience_interaction_observed receipt
family via a new interactionKind/capabilityId discriminator on actionInput
(services/journey/experienceObservationPromotion.ts's
hasQualifyingExperienceInteraction), never a new action type.

services/journey/financialSovereigntyEvidence.ts is the single source of
truth for the FS concept-id/interactionKind literals so KNYTS/CI's state
routes can't drift from each other; the component duplicates the same
literals by necessity (it's 'use client' and cannot import the
Supabase-touching promotion module without breaking the client bundle) with
a source-level parity canary guarding the two copies.

fs-learn/fs-explore now carry real completionEvidence
(learnExperienceQualified/exploreCapabilityInteracted) on both KNYTS and CI
journeys, read via three parallel Promise.all reads in each state route.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

DISCOVER's "any observed Continue" bar stays deliberately weak. LEARN now
requires all three Advisor/Architect/Runtime concept cards individually
acknowledged (BridgeMediaStage gains a generic children slot +
primaryCtaDisabled to host them); EXPLORE requires at least one real
MoneyPenny serviceCatalog capability actually clicked, not a joined display
string. Both reuse the same generic experience_interaction_observed receipt
family via a new interactionKind/capabilityId discriminator on actionInput
(services/journey/experienceObservationPromotion.ts's
hasQualifyingExperienceInteraction), never a new action type.

services/journey/financialSovereigntyEvidence.ts is the single source of
truth for the FS concept-id/interactionKind literals so KNYTS/CI's state
routes can't drift from each other; the component duplicates the same
literals by necessity (it's 'use client' and cannot import the
Supabase-touching promotion module without breaking the client bundle) with
a source-level parity canary guarding the two copies.

fs-learn/fs-explore now carry real completionEvidence
(learnExperienceQualified/exploreCapabilityInteracted) on both KNYTS and CI
journeys, read via three parallel Promise.all reads in each state route.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/journey/constitutional-internet-bridge/state/route.ts` |
| Modified | `app/api/journey/experience-observation/route.ts` |
| Modified | `app/api/journey/knyts-bridge/state/route.ts` |
| Modified | `components/journey/BridgeMediaStage.tsx` |
| Modified | `components/journey/FinancialSovereigntyIntroStage.tsx` |
| Modified | `services/journey/constitutionalInternetBridgeJourney.ts` |
| Modified | `services/journey/experienceObservationPromotion.ts` |
| Added | `services/journey/financialSovereigntyEvidence.ts` |
| Modified | `services/journey/knytsBridgeCrossingJourney.ts` |
| Modified | `tests/constitutional-internet-bridge-journey.test.ts` |
| Modified | `tests/experience-observation-promotion-loop.test.ts` |
| Modified | `tests/financial-sovereignty-main-spine.test.ts` |

## Stats

 12 files changed, 517 insertions(+), 78 deletions(-)
