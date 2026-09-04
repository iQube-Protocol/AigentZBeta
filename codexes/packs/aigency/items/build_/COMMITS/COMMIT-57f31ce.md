# Commit Brief: `57f31ce` — Record MPY2-7 priority backlog: scope-keyed controller, snapshot/session binding, Expand-defect diagnosis

| Field | Value |
|-------|-------|
| SHA | [`57f31ce`](https://github.com/iQube-Protocol/AigentZBeta/commit/57f31ce43281384ced97d77d9d4228489258ce4d) |
| Author | Claude |
| Date | 2026-09-04T22:46:21Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Record MPY2-7 priority backlog: scope-keyed controller, snapshot/session binding, Expand-defect diagnosis

Operator review of the tranche-2 live atomic-surface work flagged
three architectural gaps that take priority over the five-overlay
backlog: the session controller is a single unscoped global (needs a
keyed registry over personaScope/capabilityId/environment/sessionId
with an eviction policy); atomic blocks other than the market-status
capsule have no way to declare themselves live vs. a frozen snapshot
(needs a binding.mode field + a per-kind live-mount path in the
renderer); and the tranche-2 report left an Expand-button test timeout
unexplained. This commit records the diagnosis for that last point
(hideToggle correctly hides the control on the HFTConsole embedding;
the test script looked for a button that was correctly absent, not a
component defect) and registers all three as the priority items to
close before the live atomic-surface exemplar is complete -- no
implementation in this commit, backlog registration only.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Operator review of the tranche-2 live atomic-surface work flagged
three architectural gaps that take priority over the five-overlay
backlog: the session controller is a single unscoped global (needs a
keyed registry over personaScope/capabilityId/environment/sessionId
with an eviction policy); atomic blocks other than the market-status
capsule have no way to declare themselves live vs. a frozen snapshot
(needs a binding.mode field + a per-kind live-mount path in the
renderer); and the tranche-2 report left an Expand-button test timeout
unexplained. This commit records the diagnosis for that last point
(hideToggle correctly hides the control on the HFTConsole embedding;
the test script looked for a button that was correctly absent, not a
component defect) and registers all three as the priority items to
close before the live atomic-surface exemplar is complete -- no
implementation in this commit, backlog registration only.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/updates/2026-09-04_moneypenny002-atomic-surface-capsule-harvest.md` |

## Stats

 1 file changed, 71 insertions(+), 12 deletions(-)
