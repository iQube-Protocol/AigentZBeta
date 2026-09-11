# Commit Brief: `1bac437` — Adaptive Financial Services entry CTA on KNYTS/CI, retire pilot framing [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`1bac437`](https://github.com/iQube-Protocol/AigentZBeta/commit/1bac437a69f14ce3681bf76d84bc9902d65e3136) |
| Author | Claude |
| Date | 2026-09-01T11:31:23Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Adaptive Financial Services entry CTA on KNYTS/CI, retire pilot framing [merge review/irl-scoped-restoration-2026-08-27]

"The destination remains stable; the invitation adapts." Both Bridges'
CHOOSE surfaces previously framed the Financial Services entry as an
application: KNYTS said "Apply to join the Constitutional Financial
Services Pilot" (with an "Email instead" mailto secondary), CI said
"Join Financial Services". Replaced with one shared, evidence-derived
presentation:

  no qualifying FS evidence          -> "Learn about Constitutional
                                          Financial Services"
                                          (intent: LEARN_FINANCIAL_SERVICES)
  fs-discover/fs-learn/fs-explore
  COMPLETE (real, evidence-backed
  today; fs-prepare/fs-cross are
  excluded — still gate-less)        -> "Constitutional Financial Services"
                                          (intent: JOIN_FINANCIAL_SERVICES)

services/journey/financialServicesEntryPresentation.ts is the ONE resolver
both Choose surfaces consume (client-bundle-safe: pure function over
JourneyRuntimeState, no server import) — no local heuristic duplicated per
bridge, no new receipt type, no Passport/Standing gating. The underlying
mechanics are unchanged: both presentations activate the SAME
financial-services branch at the SAME fs-discover entry stage via the SAME
activateJourneyBranch call every existing caller already used. No direct
/bridge/fs shortcut; CROSS remains the deliberate boundary after
DISCOVER -> LEARN -> EXPLORE -> PREPARE.

Removed the KNYTS card's now-redundant mailto secondary (the "apply to
pilot" model it belonged to no longer applies). Updated the tests/comments
that still named this the "CFS Pilot" card.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

"The destination remains stable; the invitation adapts." Both Bridges'
CHOOSE surfaces previously framed the Financial Services entry as an
application: KNYTS said "Apply to join the Constitutional Financial
Services Pilot" (with an "Email instead" mailto secondary), CI said
"Join Financial Services". Replaced with one shared, evidence-derived
presentation:

  no qualifying FS evidence          -> "Learn about Constitutional
                                          Financial Services"
                                          (intent: LEARN_FINANCIAL_SERVICES)
  fs-discover/fs-learn/fs-explore
  COMPLETE (real, evidence-backed
  today; fs-prepare/fs-cross are
  excluded — still gate-less)        -> "Constitutional Financial Services"
                                          (intent: JOIN_FINANCIAL_SERVICES)

services/journey/financialServicesEntryPresentation.ts is the ONE resolver
both Choose surfaces consume (client-bundle-safe: pure function over
JourneyRuntimeState, no server import) — no local heuristic duplicated per
bridge, no new receipt type, no Passport/Standing gating. The underlying
mechanics are unchanged: both presentations activate the SAME
financial-services branch at the SAME fs-discover entry stage via the SAME
activateJourneyBranch call every existing caller already used. No direct
/bridge/fs shortcut; CROSS remains the deliberate boundary after
DISCOVER -> LEARN -> EXPLORE -> PREPARE.

Removed the KNYTS card's now-redundant mailto secondary (the "apply to
pilot" model it belonged to no longer applies). Updated the tests/comments
that still named this the "CFS Pilot" card.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/bridge/ci/page.tsx` |
| Modified | `app/bridge/knyts/page.tsx` |
| Modified | `components/journey/ConstitutionalInternetBridgeChooseSurface.tsx` |
| Modified | `components/journey/KnytsBridgeChooseSurface.tsx` |
| Added | `services/journey/financialServicesEntryPresentation.ts` |
| Added | `tests/financial-services-entry-presentation.test.ts` |
| Modified | `tests/financial-sovereignty-main-spine.test.ts` |
| Modified | `tests/journey-branch-immediate-reevaluation.test.ts` |
| Modified | `tests/knyts-bridge-campaign-activation.test.ts` |
| Modified | `tests/knyts-bridge-choose-final-closure.test.ts` |

## Stats

 11 files changed, 263 insertions(+), 56 deletions(-)
