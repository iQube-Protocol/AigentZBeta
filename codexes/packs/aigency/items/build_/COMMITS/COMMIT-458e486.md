# Commit Brief: `458e486` — fix Track 2 Proceed navigation racing ahead of authoritative refresh

| Field | Value |
|-------|-------|
| SHA | [`458e486`](https://github.com/iQube-Protocol/AigentZBeta/commit/458e48619df67f546460a9ab35a293327c8e3eb4) |
| Author | Claude |
| Date | 2026-08-27T13:11:57Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix Track 2 Proceed navigation racing ahead of authoritative refresh

The Research Copilot's pending-decision CTA (violet "Open {stage}" button)
navigated to Track 2 using decision.deepLink captured earlier — either the
copilot's mount-time preview (refresh() runs once, never re-fires while the
tab stays open) or a prior POST /advance response — without ever
re-verifying it was still current at click time. Two concrete staleness
windows, both traced in track2ProceedNavigation.ts's header: (1) real Track 2
progress made directly in Track2ProgrammePanel never touches the Copilot's
own state, so a long-open Copilot tab shows an increasingly stale next-action
name; (2) codex:navigate-tab no-ops when the destination tab is already
active (CodexPanelDynamic's `target !== activeTabSlug` guard), so a deep-link
intent written for an already-open Experiment Lab tab is never consumed
(InvariantExperimentLab's mailbox read is a useState lazy initializer that
fires once per true mount) and the operator sees whatever was last rendered.

Fix: services/research/track2ProceedNavigation.ts's proceedToTrack2Stage —
a pure, dependency-injected sequence (mirrors track2DuplicateQueueSettle.ts's
house style) that awaits POST /advance, THEN awaits a fresh authoritative
Track 2 GET, and navigates only using the deep link THAT read names — never
the button's own (possibly stale) props. A failed advance or refresh returns
a distinguishable outcome; the UI shows the error with Retry and never
navigates on failure. Reuses the existing goToTrack2Stage/goToExperimentLab
primitives verbatim as its navigate/navigateGeneric dependencies — no second
navigation mechanism.

IRLResearchCopilotTab.tsx: the decision card's CTA is now async
(proceedToDecision), with proceeding/proceedError state and a Retry action.
tests/track2-copilot-deep-link.test.ts updated for the new onProceed contract
(the assertions this replaces encoded the exact stale-navigate shape being
fixed). tests/track2-proceed-navigation.test.ts behaviorally proves the
ordering contract: advance is awaited before the read, navigate only fires
after both resolve, a failed advance/read never navigates, and a genuinely
empty pending-decision read falls back to the generic navigation rather than
fabricating a deep link.
```

## Body

The Research Copilot's pending-decision CTA (violet "Open {stage}" button)
navigated to Track 2 using decision.deepLink captured earlier — either the
copilot's mount-time preview (refresh() runs once, never re-fires while the
tab stays open) or a prior POST /advance response — without ever
re-verifying it was still current at click time. Two concrete staleness
windows, both traced in track2ProceedNavigation.ts's header: (1) real Track 2
progress made directly in Track2ProgrammePanel never touches the Copilot's
own state, so a long-open Copilot tab shows an increasingly stale next-action
name; (2) codex:navigate-tab no-ops when the destination tab is already
active (CodexPanelDynamic's `target !== activeTabSlug` guard), so a deep-link
intent written for an already-open Experiment Lab tab is never consumed
(InvariantExperimentLab's mailbox read is a useState lazy initializer that
fires once per true mount) and the operator sees whatever was last rendered.

Fix: services/research/track2ProceedNavigation.ts's proceedToTrack2Stage —
a pure, dependency-injected sequence (mirrors track2DuplicateQueueSettle.ts's
house style) that awaits POST /advance, THEN awaits a fresh authoritative
Track 2 GET, and navigates only using the deep link THAT read names — never
the button's own (possibly stale) props. A failed advance or refresh returns
a distinguishable outcome; the UI shows the error with Retry and never
navigates on failure. Reuses the existing goToTrack2Stage/goToExperimentLab
primitives verbatim as its navigate/navigateGeneric dependencies — no second
navigation mechanism.

IRLResearchCopilotTab.tsx: the decision card's CTA is now async
(proceedToDecision), with proceeding/proceedError state and a Retry action.
tests/track2-copilot-deep-link.test.ts updated for the new onProceed contract
(the assertions this replaces encoded the exact stale-navigate shape being
fixed). tests/track2-proceed-navigation.test.ts behaviorally proves the
ordering contract: advance is awaited before the read, navigate only fires
after both resolve, a failed advance/read never navigates, and a genuinely
empty pending-decision read falls back to the generic navigation rather than
fabricating a deep link.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/composer/IRLResearchCopilotTab.tsx` |
| Added | `services/research/track2ProceedNavigation.ts` |
| Modified | `tests/track2-copilot-deep-link.test.ts` |
| Added | `tests/track2-proceed-navigation.test.ts` |

## Stats

 4 files changed, 418 insertions(+), 13 deletions(-)
