# Commit Brief: `dcda7bc` — Enforce fence production server-side: retry on promised-but-missing stage proposals (operator field report)

| Field | Value |
|-------|-------|
| SHA | [`dcda7bc`](https://github.com/iQube-Protocol/AigentZBeta/commit/dcda7bc99d0995d523e23fa1011d297454c6f200) |
| Author | Claude |
| Date | 2026-07-07T05:56:49Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Enforce fence production server-side: retry on promised-but-missing stage proposals (operator field report)

Operator deployed-test finding (2026-07-06, gpt-4o-mini): the Dev Command
Center copilot NARRATED creating a stage proposal ("I will now prepare a
context proposal… This proposal is now awaiting your approval") while
emitting ZERO ```stage_data fences — no pending card, empty right pane,
stalled loop (worst at gap analysis, the largest payload). The lenient
fence repair only fixes fences that ARRIVE; this failure is zero fences.

Three layers:
1. Server-side fence enforcement retry (model-agnostic core): in the chat
   route, for aigent-z turns on the dev-command-center surface only
   (ccrl-research is narrate-only and excluded by construction — its
   branch never sets fenceRetryKind), when extraction yields zero
   proposals AND the reply matches the promise heuristic AND the
   effective stage has a proposal kind, make exactly ONE follow-up call
   via the same executeProviderAttempt helper (same provider/model/
   messages + an appended user-role instruction demanding only the
   fenced stage_data JSON). Recovered proposals attach to the ORIGINAL
   visible reply; if the retry still fails, an honest "(No structured
   proposal was produced — say 'try again' to regenerate.)" line is
   appended — the promise never stands unfulfilled silently.
2. Never-promise rule in buildStageInstructionBlock: never claim a card
   is awaiting approval unless THIS reply contains the fence — the fence
   IS the preparation; there is no separate preparation step.
3. Worked example fence (minimal intent proposal, EXAMPLE FORMAT ONLY)
   appended for few-shot anchoring of small-model fence compliance.

Canaries: looksLikeUnfulfilledProposalPromise (pure, exported) — promise
phrases match, plain narration does not, fence-carrying text never
triggers; instruction block pins the never-promise rule + example.
detectRequestedStage patterns and PROPOSAL_KIND_TO_CAPSULE untouched.
CFS-015 gains the field-report record: the Feedback Coordinator's first
server-side guarantee.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator deployed-test finding (2026-07-06, gpt-4o-mini): the Dev Command
Center copilot NARRATED creating a stage proposal ("I will now prepare a
context proposal… This proposal is now awaiting your approval") while
emitting ZERO ```stage_data fences — no pending card, empty right pane,
stalled loop (worst at gap analysis, the largest payload). The lenient
fence repair only fixes fences that ARRIVE; this failure is zero fences.

Three layers:
1. Server-side fence enforcement retry (model-agnostic core): in the chat
   route, for aigent-z turns on the dev-command-center surface only
   (ccrl-research is narrate-only and excluded by construction — its
   branch never sets fenceRetryKind), when extraction yields zero
   proposals AND the reply matches the promise heuristic AND the
   effective stage has a proposal kind, make exactly ONE follow-up call
   via the same executeProviderAttempt helper (same provider/model/
   messages + an appended user-role instruction demanding only the
   fenced stage_data JSON). Recovered proposals attach to the ORIGINAL
   visible reply; if the retry still fails, an honest "(No structured
   proposal was produced — say 'try again' to regenerate.)" line is
   appended — the promise never stands unfulfilled silently.
2. Never-promise rule in buildStageInstructionBlock: never claim a card
   is awaiting approval unless THIS reply contains the fence — the fence
   IS the preparation; there is no separate preparation step.
3. Worked example fence (minimal intent proposal, EXAMPLE FORMAT ONLY)
   appended for few-shot anchoring of small-model fence compliance.

Canaries: looksLikeUnfulfilledProposalPromise (pure, exported) — promise
phrases match, plain narration does not, fence-carrying text never
triggers; instruction block pins the never-promise rule + example.
detectRequestedStage patterns and PROPOSAL_KIND_TO_CAPSULE untouched.
CFS-015 gains the field-report record: the Feedback Coordinator's first
server-side guarantee.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `codexes/packs/ccrl/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `services/devCommandCenter/index.ts` |
| Modified | `services/devCommandCenter/stageOrchestrator.ts` |
| Modified | `tests/dev-command-center.test.ts` |

## Stats

 5 files changed, 183 insertions(+), 4 deletions(-)
