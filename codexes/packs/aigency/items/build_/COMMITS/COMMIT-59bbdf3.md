# Commit Brief: `59bbdf3` — Fix venture-report deliberation: inferred purpose was discarded, not saved

| Field | Value |
|-------|-------|
| SHA | [`59bbdf3`](https://github.com/iQube-Protocol/AigentZBeta/commit/59bbdf34585fbed0c69887281de8069a3a8fa02d) |
| Author | Claude |
| Date | 2026-09-04T20:36:27Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix venture-report deliberation: inferred purpose was discarded, not saved

Root-caused per operator's own diagnosis (verified against code, all three
defects confirmed real):

1. extractBriefContextFromPrompt() never extracted purpose/emphasis, only
   disclosure/period/audience. It now derives purpose:'custom' +
   customPurpose from the operator's own sentence, plus emphasis terms from
   a trailing "with A, B and C emphasis" clause when present — the full
   sentence is always preserved as customPurpose even when no emphasis
   clause matches.
2. The chat route imported extractBriefContextFromPrompt and
   suggestDeliberationFromPrompt but never called either — the deliberation
   action sent to the client carried only intent detection, never the
   extracted context. It now computes extractedBriefSpec and includes it.
3. AigentMeWelcomeSplitTab's handleSuggestedDeliberation (chat-intent path)
   and the NBE-approval deliberation branch both called
   initializeDeliberation() and discarded whatever context was available,
   producing a genuinely blank brief either way. Both now merge the
   extracted spec via updateBriefSpec + updateBriefCompleteness.

Also fixed in the same pass (same root cause class — inference results
computed but never actually reaching the operator):
- VentureReportBriefSpec.purpose is a closed category, never free text —
  VentureReportBriefLayout's Purpose Save handler was writing the raw
  sentence into it directly. Now normalizes to {purpose:'custom',
  customPurpose} for anything that isn't one of the five canonical
  keywords, and displays/edits customPurpose (not the literal word
  "custom") for that category.
- handleGenerateVentureReport read created?.id, but ArtifactCardData has no
  such field — the real field is artifactId. The brief was transitioning
  to 'drafted' with an empty artifact reference even on a successful
  create.
- deliberationError was only rendered by VentureReportBriefLayout's
  !deliberationBrief branch, so once a brief existed (always true once
  deliberation starts) a generation failure was recorded in state but
  never shown to the operator.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Root-caused per operator's own diagnosis (verified against code, all three
defects confirmed real):

1. extractBriefContextFromPrompt() never extracted purpose/emphasis, only
   disclosure/period/audience. It now derives purpose:'custom' +
   customPurpose from the operator's own sentence, plus emphasis terms from
   a trailing "with A, B and C emphasis" clause when present — the full
   sentence is always preserved as customPurpose even when no emphasis
   clause matches.
2. The chat route imported extractBriefContextFromPrompt and
   suggestDeliberationFromPrompt but never called either — the deliberation
   action sent to the client carried only intent detection, never the
   extracted context. It now computes extractedBriefSpec and includes it.
3. AigentMeWelcomeSplitTab's handleSuggestedDeliberation (chat-intent path)
   and the NBE-approval deliberation branch both called
   initializeDeliberation() and discarded whatever context was available,
   producing a genuinely blank brief either way. Both now merge the
   extracted spec via updateBriefSpec + updateBriefCompleteness.

Also fixed in the same pass (same root cause class — inference results
computed but never actually reaching the operator):
- VentureReportBriefSpec.purpose is a closed category, never free text —
  VentureReportBriefLayout's Purpose Save handler was writing the raw
  sentence into it directly. Now normalizes to {purpose:'custom',
  customPurpose} for anything that isn't one of the five canonical
  keywords, and displays/edits customPurpose (not the literal word
  "custom") for that category.
- handleGenerateVentureReport read created?.id, but ArtifactCardData has no
  such field — the real field is artifactId. The brief was transitioning
  to 'drafted' with an empty artifact reference even on a successful
  create.
- deliberationError was only rendered by VentureReportBriefLayout's
  !deliberationBrief branch, so once a brief existed (always true once
  deliberation starts) a generation failure was recorded in state but
  never shown to the operator.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `components/metame/welcome/layouts/VentureReportBriefLayout.tsx` |
| Modified | `services/deliberativeArtifact/deliberationIntentDetector.ts` |
| Added | `tests/venture-report-deliberation-inference.test.ts` |

## Stats

 5 files changed, 264 insertions(+), 14 deletions(-)
