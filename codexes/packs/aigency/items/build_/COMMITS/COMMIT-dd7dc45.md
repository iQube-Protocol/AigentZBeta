# Commit Brief: `dd7dc45` — Make Dev Command Center quick actions intelligent via the DCIR affordance service

| Field | Value |
|-------|-------|
| SHA | [`dd7dc45`](https://github.com/iQube-Protocol/AigentZBeta/commit/dd7dc453fdcf6d72ab1c7cfc92bbbc04a8bcbbc1) |
| Author | Claude |
| Date | 2026-07-07T10:40:52Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Make Dev Command Center quick actions intelligent via the DCIR affordance service

The pulsating quick-action chips consulted only a raw suggestion flag, so they
kept pulsing for actions already executed, completed, or no longer relevant
(operator finding, 2026-07-07). They now become intelligent through the same
DCIR D3 affordance service:

- devLoop.ts gains pure, canary-pinned liveness helpers: stageArtifactExists,
  isStageActionStale (artifact done AND loop moved past it), isStageActionIrrelevant
  (remediation only when the consequence test fails; deployment authorization only
  once the constitutional threshold is met or the loop reaches it), and stageActionLive.
- DevCommandCenterTab derives liveAffordanceScopes from generateAffordances(events,
  snapshot) and gates every chip through chipShouldPulse: a D3 positively-live
  affordance always pulses; a standing suggestion pulses only when the action is
  neither completed-and-past nor contextually irrelevant. Both the quick-prompt
  highlights and the chip/stage-strip pulsing map read the intelligent gate.

Same affordance service, two halves: observed-event liveness (D3) + session-state
relevance. No more pulsating done/irrelevant actions.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The pulsating quick-action chips consulted only a raw suggestion flag, so they
kept pulsing for actions already executed, completed, or no longer relevant
(operator finding, 2026-07-07). They now become intelligent through the same
DCIR D3 affordance service:

- devLoop.ts gains pure, canary-pinned liveness helpers: stageArtifactExists,
  isStageActionStale (artifact done AND loop moved past it), isStageActionIrrelevant
  (remediation only when the consequence test fails; deployment authorization only
  once the constitutional threshold is met or the loop reaches it), and stageActionLive.
- DevCommandCenterTab derives liveAffordanceScopes from generateAffordances(events,
  snapshot) and gates every chip through chipShouldPulse: a D3 positively-live
  affordance always pulses; a standing suggestion pulses only when the action is
  neither completed-and-past nor contextually irrelevant. Both the quick-prompt
  highlights and the chip/stage-strip pulsing map read the intelligent gate.

Same affordance service, two halves: observed-event liveness (D3) + session-state
relevance. No more pulsating done/irrelevant actions.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/DevCommandCenterTab.tsx` |
| Modified | `services/devCommandCenter/devLoop.ts` |
| Modified | `services/devCommandCenter/index.ts` |
| Modified | `tests/dev-command-center.test.ts` |

## Stats

 4 files changed, 173 insertions(+), 11 deletions(-)
