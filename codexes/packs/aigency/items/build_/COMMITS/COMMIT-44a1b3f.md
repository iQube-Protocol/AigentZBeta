# Commit Brief: `44a1b3f` — Fix Buffer client-bundle defect breaking live FS crossing + cap stage carousel at 8 [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`44a1b3f`](https://github.com/iQube-Protocol/AigentZBeta/commit/44a1b3fdcd386934fa5543ff92c675b8e9c9d539) |
| Author | Claude |
| Date | 2026-09-01T11:18:24Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Buffer client-bundle defect breaking live FS crossing + cap stage carousel at 8 [merge review/irl-scoped-restoration-2026-08-27]

Two targeted AEE/Journey UX corrections, live-verified per the operator's request:

1. Journey stage carousel now caps at 8 visible stages (MAX_VISIBLE_SPINE_STAGES)
   instead of being purely content-width-driven. KNYTS/CI's twelve-stage journeys
   fit uncompressed on a wide desktop screen, so the carousel never engaged. The
   strip's inner content row now gets a minWidth proportional to
   visibleStageUnitCount/8 past the cap, forcing real overflow-x-auto scrolling
   regardless of viewport width. No virtualization; short journeys are unaffected.

2. Fixed a real, live-breaking defect in the PREPARE -> CROSS -> ExperienceHandoff
   -> /bridge/fs -> REGISTER chain: experienceHandoffService.ts used
   Buffer.from(...) for base64url encode/decode, but its only two live callers
   (FinancialSovereigntyPrepareCrossStage.tsx, FinancialServicesBridgeFrontDoor.tsx)
   are 'use client', and Buffer has no browser equivalent or polyfill in this repo.
   This silently threw in the browser, so clicking "Cross to Financial Services"
   did nothing and /bridge/fs's handoff decode failed silently. Replaced with
   btoa/atob + TextEncoder/TextDecoder (standard Web APIs, global in browser and
   Node 18+), byte-compatible with the old token format. Every other seam in the
   chain (KNYTS/CI prop-threading parity, surface registry, decode->register
   wiring, agent-candidate validation) was already correct on inspection.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Two targeted AEE/Journey UX corrections, live-verified per the operator's request:

1. Journey stage carousel now caps at 8 visible stages (MAX_VISIBLE_SPINE_STAGES)
   instead of being purely content-width-driven. KNYTS/CI's twelve-stage journeys
   fit uncompressed on a wide desktop screen, so the carousel never engaged. The
   strip's inner content row now gets a minWidth proportional to
   visibleStageUnitCount/8 past the cap, forcing real overflow-x-auto scrolling
   regardless of viewport width. No virtualization; short journeys are unaffected.

2. Fixed a real, live-breaking defect in the PREPARE -> CROSS -> ExperienceHandoff
   -> /bridge/fs -> REGISTER chain: experienceHandoffService.ts used
   Buffer.from(...) for base64url encode/decode, but its only two live callers
   (FinancialSovereigntyPrepareCrossStage.tsx, FinancialServicesBridgeFrontDoor.tsx)
   are 'use client', and Buffer has no browser equivalent or polyfill in this repo.
   This silently threw in the browser, so clicking "Cross to Financial Services"
   did nothing and /bridge/fs's handoff decode failed silently. Replaced with
   btoa/atob + TextEncoder/TextDecoder (standard Web APIs, global in browser and
   Node 18+), byte-compatible with the old token format. Every other seam in the
   chain (KNYTS/CI prop-threading parity, surface registry, decode->register
   wiring, agent-candidate validation) was already correct on inspection.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `services/journey/experienceHandoffService.ts` |
| Added | `tests/financial-sovereignty-crossing-chain.test.ts` |

## Stats

 3 files changed, 235 insertions(+), 3 deletions(-)
