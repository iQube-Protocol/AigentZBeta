# Commit Brief: `32ab01b` — Build CCRL Phase C3: the research ICE loop — experiments get develop→run→validate→publish parity

| Field | Value |
|-------|-------|
| SHA | [`32ab01b`](https://github.com/iQube-Protocol/AigentZBeta/commit/32ab01be82ab44b36ce2f173cb595689cb802917) |
| Author | Claude |
| Date | 2026-07-07T17:54:30Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Build CCRL Phase C3: the research ICE loop — experiments get develop→run→validate→publish parity

Bring experiments to the same staged cadence the Dev Command Center gives
software, reusing the proposals + lifecycle + persistence + run-lifecycle
machinery rather than forking it.

- services/research/researchLoop.ts (new, pure, canary-pinned): the research
  analog of devLoop. ResearchLoopStage = design|protocol|run|analyze|publish|
  replicated, DERIVED from the active experiment's lifecycle
  (researchStageForExperiment/researchStageForLifecycle). researchStageProposalKind
  maps design→experiment_proposal, protocol→protocol_draft, analyze→finding,
  publish→publication_draft, and run→null (the constitutional boundary — running
  is not a copilot action). researchStageActionable ('run-in-lab' at
  protocol-ratified/running, 'propose' at design/protocol/analyze/publish,
  'complete' at replicated); nextResearchStage advances forward-only (a re-run
  never drags the strip back).
- CCRLResearchCopilotTab: active-experiment concept (operator-selectable, default
  most-recently-touched), stage strip (design→protocol→run→analyze→publish),
  flow-through on approve (advances the loop + surfaces next action), the Run
  stage rendered as an honest Experiment Lab hand-off (execution stays in the
  lab — no clean intra-cartridge tab switch exists, so an explicit pointer, not
  a fake in-copilot run), and the Feedback Coordinator autoPrompt ([observed]
  auto-turn on a stage-advancing approval). Approve→apply→persist→receipt path
  unchanged; stage advance layered on top.
- chat route: ccrl-research ground context carries activeExperimentStage; the
  branch passes that stage's expected proposal kind into
  buildResearchInstructionBlock(kind). CONDITIONAL fence contract intact — at the
  run stage (null kind) no kind is passed and the copilot narrates the lab
  hand-off; the researchFenceRetry stays as-is.
- tests/ccrl-research-loop.test.ts: pins lifecycle→stage (every state), stage→
  proposal-kind (run→null), nextResearchStage advancement + forward-only,
  researchStageActionable, and the Run-stage no-proposal-kind boundary.
- CFS-019 charter: C3 note (the ICE loop cadence, Run stage as lab hand-off, reuse
  of the existing machinery, single receipt path held).

Verification (vitest unavailable — esbuild + node): esbuild transform parse gates
pass on all four touched files; node drill on researchLoop (bundled with @ alias +
@supabase stub, external packages) = 42/42 assertions pass.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Bring experiments to the same staged cadence the Dev Command Center gives
software, reusing the proposals + lifecycle + persistence + run-lifecycle
machinery rather than forking it.

- services/research/researchLoop.ts (new, pure, canary-pinned): the research
  analog of devLoop. ResearchLoopStage = design|protocol|run|analyze|publish|
  replicated, DERIVED from the active experiment's lifecycle
  (researchStageForExperiment/researchStageForLifecycle). researchStageProposalKind
  maps design→experiment_proposal, protocol→protocol_draft, analyze→finding,
  publish→publication_draft, and run→null (the constitutional boundary — running
  is not a copilot action). researchStageActionable ('run-in-lab' at
  protocol-ratified/running, 'propose' at design/protocol/analyze/publish,
  'complete' at replicated); nextResearchStage advances forward-only (a re-run
  never drags the strip back).
- CCRLResearchCopilotTab: active-experiment concept (operator-selectable, default
  most-recently-touched), stage strip (design→protocol→run→analyze→publish),
  flow-through on approve (advances the loop + surfaces next action), the Run
  stage rendered as an honest Experiment Lab hand-off (execution stays in the
  lab — no clean intra-cartridge tab switch exists, so an explicit pointer, not
  a fake in-copilot run), and the Feedback Coordinator autoPrompt ([observed]
  auto-turn on a stage-advancing approval). Approve→apply→persist→receipt path
  unchanged; stage advance layered on top.
- chat route: ccrl-research ground context carries activeExperimentStage; the
  branch passes that stage's expected proposal kind into
  buildResearchInstructionBlock(kind). CONDITIONAL fence contract intact — at the
  run stage (null kind) no kind is passed and the copilot narrates the lab
  hand-off; the researchFenceRetry stays as-is.
- tests/ccrl-research-loop.test.ts: pins lifecycle→stage (every state), stage→
  proposal-kind (run→null), nextResearchStage advancement + forward-only,
  researchStageActionable, and the Run-stage no-proposal-kind boundary.
- CFS-019 charter: C3 note (the ICE loop cadence, Run stage as lab hand-off, reuse
  of the existing machinery, single receipt path held).

Verification (vitest unavailable — esbuild + node): esbuild transform parse gates
pass on all four touched files; node drill on researchLoop (bundled with @ alias +
@supabase stub, external packages) = 42/42 assertions pass.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `codexes/packs/ccrl/foundation/CFS-019_ccrl-charter.md` |
| Modified | `components/composer/CCRLResearchCopilotTab.tsx` |
| Added | `services/research/researchLoop.ts` |
| Added | `tests/ccrl-research-loop.test.ts` |

## Stats

 5 files changed, 615 insertions(+), 8 deletions(-)
