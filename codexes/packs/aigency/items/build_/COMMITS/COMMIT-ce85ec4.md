# Commit Brief: `ce85ec4` — Fix DCC loop: proposal preview-before-approve, flow-through on approval, resilient fence extraction (operator findings)

| Field | Value |
|-------|-------|
| SHA | [`ce85ec4`](https://github.com/iQube-Protocol/AigentZBeta/commit/ce85ec409569ac5afc644c158419e4626fecc6f9) |
| Author | Claude |
| Date | 2026-07-07T05:14:36Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix DCC loop: proposal preview-before-approve, flow-through on approval, resilient fence extraction (operator findings)

Operator live-test findings 2026-07-06, fixed per finding:

1. No preview before approval -> PendingProposalCard now renders a full
   per-kind content preview (intent fields; context items with paths +
   scores; gap existing/missing tables; canvas should/should-never lists;
   brief markdown; validation verdicts + evidence) above Approve/Dismiss,
   scrollable + expandable — review-then-approve is the flow.
2. Weak left/right correlation -> stage instruction requires the visible
   narrative to mirror the fence content and name the right-pane card.
3. No flow-through on progression -> approval applies + advances, then
   auto-closes the approved capsule and auto-opens the NEW session
   stage's capsule (stageCapsuleId, derived from the canary-pinned maps);
   DCIR capsule closed/opened events emitted on the transition.
4. Right pane doesn't follow free conversation -> buildStageGroundData's
   stage now resolves the SAME effective stage as the instruction block
   (requested > viewed capsule > session; implementation capsule mapping
   added); fence contract moved LAST, mandates exactly ONE stage_data
   fence for any produce/assemble/analyze/model/brief/validate request,
   alternate schema explicitly subordinate (emit one-of, never both).
5. REGRESSION at gap analysis -> root cause: strict JSON.parse dropped
   nearly-valid fences (trailing commas, literal newlines in strings)
   SILENTLY; extraction now repairs them inline (string-aware, no
   provider-module import), warns on unrepairable drops, tolerates a
   missing newline after the fence tag, parses dual fences
   deterministically; applyStageProposal('gap_analysis') coerces
   existingCapabilities/missingCapabilities variants; empty payloads
   still satisfy the advance gate and flow through per (3).
6. Proactive progressive conversation -> first Feedback Coordinator
   slice (CFS-020 #12): approval-advance mints a one-shot [observed]
   auto-turn through the copilot's normal send path (autoPrompt prop,
   one turn per id, never from an auto-prompted turn, never on
   dismissal); chat route instructs [observed] turns to answer as a
   short proactive guide and produce the next stage's fence.

Canaries: resilient extraction (prose+fence, dual fences, trailing-comma
+ newline repair, malformed-drop-without-throw, unknown-kind drop), gap
coercion + advance gate, stageCapsuleId mapping, fence-contract-last.
Records appended to CFS-015 (findings->fixes) and CFS-020 (D2
observation note: the operator report IS the DCIR loop operating).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator live-test findings 2026-07-06, fixed per finding:

1. No preview before approval -> PendingProposalCard now renders a full
   per-kind content preview (intent fields; context items with paths +
   scores; gap existing/missing tables; canvas should/should-never lists;
   brief markdown; validation verdicts + evidence) above Approve/Dismiss,
   scrollable + expandable — review-then-approve is the flow.
2. Weak left/right correlation -> stage instruction requires the visible
   narrative to mirror the fence content and name the right-pane card.
3. No flow-through on progression -> approval applies + advances, then
   auto-closes the approved capsule and auto-opens the NEW session
   stage's capsule (stageCapsuleId, derived from the canary-pinned maps);
   DCIR capsule closed/opened events emitted on the transition.
4. Right pane doesn't follow free conversation -> buildStageGroundData's
   stage now resolves the SAME effective stage as the instruction block
   (requested > viewed capsule > session; implementation capsule mapping
   added); fence contract moved LAST, mandates exactly ONE stage_data
   fence for any produce/assemble/analyze/model/brief/validate request,
   alternate schema explicitly subordinate (emit one-of, never both).
5. REGRESSION at gap analysis -> root cause: strict JSON.parse dropped
   nearly-valid fences (trailing commas, literal newlines in strings)
   SILENTLY; extraction now repairs them inline (string-aware, no
   provider-module import), warns on unrepairable drops, tolerates a
   missing newline after the fence tag, parses dual fences
   deterministically; applyStageProposal('gap_analysis') coerces
   existingCapabilities/missingCapabilities variants; empty payloads
   still satisfy the advance gate and flow through per (3).
6. Proactive progressive conversation -> first Feedback Coordinator
   slice (CFS-020 #12): approval-advance mints a one-shot [observed]
   auto-turn through the copilot's normal send path (autoPrompt prop,
   one turn per id, never from an auto-prompted turn, never on
   dismissal); chat route instructs [observed] turns to answer as a
   short proactive guide and produce the next stage's fence.

Canaries: resilient extraction (prose+fence, dual fences, trailing-comma
+ newline repair, malformed-drop-without-throw, unknown-kind drop), gap
coercion + advance gate, stageCapsuleId mapping, fence-contract-last.
Records appended to CFS-015 (findings->fixes) and CFS-020 (D2
observation note: the operator report IS the DCIR loop operating).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `app/triad/components/codex/tabs/DevCommandCenterTab.tsx` |
| Modified | `codexes/packs/ccrl/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `codexes/packs/ccrl/foundation/CFS-020_dcir-charter.md` |
| Modified | `components/devcommandcenter/layouts/PendingProposalCard.tsx` |
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |
| Modified | `services/devCommandCenter/index.ts` |
| Modified | `services/devCommandCenter/stageOrchestrator.ts` |
| Modified | `tests/dev-command-center.test.ts` |

## Stats

 9 files changed, 620 insertions(+), 64 deletions(-)
