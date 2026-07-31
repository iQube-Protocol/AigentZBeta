# Commit Brief: `36c8181` — Build CCRL C2: DCIR-conforming research copilot (narrate-only, CFS-019)

| Field | Value |
|-------|-------|
| SHA | [`36c8181`](https://github.com/iQube-Protocol/AigentZBeta/commit/36c81819e7ff85f40a7b606310b1a86ec645efc6) |
| Author | Claude |
| Date | 2026-07-06T20:38:39Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Build CCRL C2: DCIR-conforming research copilot (narrate-only, CFS-019)

Aigent Z joins the CCRL as a grounded research copilot — deliberately
NARRATE-ONLY: it observes and narrates live lab state (experiment
lifecycles derived from the canonical record, series claims,
hash-committed results); research stage-proposal kinds (experiment
design, finding drafts) are C2.1 after usage observation, per the
dev-loop misroute precedent (CFS-015).

- components/composer/CCRLResearchCopilotTab.tsx: two-pane (aigentZ
  copilot + compact live lab panel), overview/results fetched via
  experimentGet with honest degradation
- services/dcir/eventStream.ts: generic surface helpers by composition
  (surfaceOpenedEvent, surfaceDataRefreshedEvent,
  surfacePromptSelectedEvent) — existing DCC vocabulary untouched;
  ccrl-research becomes the second DCIR-instrumented surface
- app/api/codex/chat/route.ts: aigent-z ccrl-research ground branch
  ("CCRL research ground truth — narrate THIS, do not invent" +
  observation list via renderObservationLines); NO stage instruction
  block, NO proposal contract on this surface
- data/codex-configs.ts + TabRenderer: tab ccrl-research-copilot
  registered (institution group, order 0.5)
- tests/constitutional-contracts.test.ts: canary pins the new helpers'
  event shape (kinds on the union, surface as capsuleScope, T1 ceiling,
  summary bound, T0 identifiers inexpressible)
- Records: CFS-019 C2 marked delivered (C2.1 split out), CFS-020 D4
  operator-directed expansion order noted, CFS-015 record paragraph

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Aigent Z joins the CCRL as a grounded research copilot — deliberately
NARRATE-ONLY: it observes and narrates live lab state (experiment
lifecycles derived from the canonical record, series claims,
hash-committed results); research stage-proposal kinds (experiment
design, finding drafts) are C2.1 after usage observation, per the
dev-loop misroute precedent (CFS-015).

- components/composer/CCRLResearchCopilotTab.tsx: two-pane (aigentZ
  copilot + compact live lab panel), overview/results fetched via
  experimentGet with honest degradation
- services/dcir/eventStream.ts: generic surface helpers by composition
  (surfaceOpenedEvent, surfaceDataRefreshedEvent,
  surfacePromptSelectedEvent) — existing DCC vocabulary untouched;
  ccrl-research becomes the second DCIR-instrumented surface
- app/api/codex/chat/route.ts: aigent-z ccrl-research ground branch
  ("CCRL research ground truth — narrate THIS, do not invent" +
  observation list via renderObservationLines); NO stage instruction
  block, NO proposal contract on this surface
- data/codex-configs.ts + TabRenderer: tab ccrl-research-copilot
  registered (institution group, order 0.5)
- tests/constitutional-contracts.test.ts: canary pins the new helpers'
  event shape (kinds on the union, surface as capsuleScope, T1 ceiling,
  summary bound, T0 identifiers inexpressible)
- Records: CFS-019 C2 marked delivered (C2.1 split out), CFS-020 D4
  operator-directed expansion order noted, CFS-015 record paragraph

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Modified | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `codexes/packs/agentiq/foundation/CFS-019_ccrl-charter.md` |
| Modified | `codexes/packs/agentiq/foundation/CFS-020_dcir-charter.md` |
| Added | `components/composer/CCRLResearchCopilotTab.tsx` |
| Modified | `data/codex-configs.ts` |
| Modified | `services/dcir/eventStream.ts` |
| Modified | `tests/constitutional-contracts.test.ts` |

## Stats

 9 files changed, 454 insertions(+), 1 deletion(-)
