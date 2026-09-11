# Commit Brief: `a11c9f6` — Fix CCRL copilot regression: make the research fence contract conditional, not mandatory

| Field | Value |
|-------|-------|
| SHA | [`a11c9f6`](https://github.com/iQube-Protocol/AigentZBeta/commit/a11c9f6585813a617915ad30584bca8e93d9efa5) |
| Author | Claude |
| Date | 2026-07-07T17:01:26Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix CCRL copilot regression: make the research fence contract conditional, not mandatory

CCRL got stuck describing how to run an experiment (operator report) — a
regression introduced by C2.1. buildResearchInstructionBlock copied the Dev
Command Center's fence contract verbatim, including "Fence contract (MANDATORY
— this outranks everything above): You MUST end your reply with exactly ONE
research_data fence." On the DCC that is correct — every stage turn has a
proposal kind. On CCRL, narration is the primary mandate and proposals are the
exception, and "run an experiment" is NOT a proposal kind at all (running
happens in the Experiment Lab runner). The unconditional mandate trapped the
model: told it must emit a fence with no legal fence to emit, it looped
describing the run mechanics.

Fix (prompt text only — extraction logic unchanged):
- The fence contract is now CONDITIONAL: emit exactly one research_data fence
  IF AND ONLY IF the operator asked to design / ratify / record / draft. For
  narrate / status / how-to and for RUN requests, emit NO fence — narration is
  the complete answer.
- Explicit RUN guidance: running is executed in the Experiment Lab runner, not
  through the copilot; name the tab, say what the run produces, optionally offer
  the closest real proposal, and stop — do not loop on the mechanics.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

CCRL got stuck describing how to run an experiment (operator report) — a
regression introduced by C2.1. buildResearchInstructionBlock copied the Dev
Command Center's fence contract verbatim, including "Fence contract (MANDATORY
— this outranks everything above): You MUST end your reply with exactly ONE
research_data fence." On the DCC that is correct — every stage turn has a
proposal kind. On CCRL, narration is the primary mandate and proposals are the
exception, and "run an experiment" is NOT a proposal kind at all (running
happens in the Experiment Lab runner). The unconditional mandate trapped the
model: told it must emit a fence with no legal fence to emit, it looped
describing the run mechanics.

Fix (prompt text only — extraction logic unchanged):
- The fence contract is now CONDITIONAL: emit exactly one research_data fence
  IF AND ONLY IF the operator asked to design / ratify / record / draft. For
  narrate / status / how-to and for RUN requests, emit NO fence — narration is
  the complete answer.
- Explicit RUN guidance: running is executed in the Experiment Lab runner, not
  through the copilot; name the tab, say what the run produces, optionally offer
  the closest real proposal, and stop — do not loop on the mechanics.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/research/proposals.ts` |

## Stats

 1 file changed, 6 insertions(+), 9 deletions(-)
