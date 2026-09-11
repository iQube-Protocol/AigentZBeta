# Commit Brief: `c9514f6` — Build CCRL Phase C2.1: structured research proposal kinds for the research copilot

| Field | Value |
|-------|-------|
| SHA | [`c9514f6`](https://github.com/iQube-Protocol/AigentZBeta/commit/c9514f65593771225ef8a0cf451e1bf3d692def1) |
| Author | Claude |
| Date | 2026-07-07T13:31:28Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Build CCRL Phase C2.1: structured research proposal kinds for the research copilot

Applies the Dev Command Center ICE engine pattern (services/devCommandCenter/
stageOrchestrator.ts) to the CCRL research copilot. aigentZ can now propose —
suggest-only, operator-gated — the research objects the lab works with, each
mapping to CREATING or ADVANCING an object within its legal lifecycle.

ResearchProposalKind (services/research/proposals.ts, RESEARCH_PROPOSAL_EFFECT
canary-pinned):
- experiment_proposal -> creates a ResearchExperiment at lifecycle `designed`
- protocol_draft      -> advances an experiment `designed -> protocol-ratified`
                         (via isLegalExperimentTransition; lifecycle NOT forked)
- finding             -> creates a ResearchFinding at lifecycle `observed`
- publication_draft   -> creates a ResearchPublication at lifecycle `draft`

ICE-mirrored fence/extract/apply architecture:
- SCHEMAS + buildResearchInstructionBlock (```research_data fence contract,
  strict-JSON + never-promise rules carried over from the dev side).
- extractResearchProposals REUSES the exact stageOrchestrator lenient parser
  (parseFenceBody -> repairFenceJson, now exported) — no weaker fork. A
  nearly-valid fence still parses; unrepairable / unknown-kind fences are
  dropped with a warn, never silently.
- applyResearchProposal is PURE (returns new state, never side-effects — no
  DB/receipt/DVN in this slice). Lifecycle-legality is enforced on apply: an
  illegal transition is REJECTED with state returned unchanged, never silently
  committed. T2-safe payloads only (no T0 identifiers).

Types: ResearchFinding, ResearchPublication, PublicationKind added to
types/research.ts (the CFS-019 §4 object model, contract-first).

Surface wiring: the chat route's ccrl-research branch (narration still primary)
appends the research instruction block and extracts proposals into the shared
stage_proposals channel (surface-scoped — never collides with dev stage_data).
CCRLResearchCopilotTab renders each as a pending approval card (preview-then-
approve, mirroring PendingProposalCard); Approve commits via applyResearchProposal
into in-memory research state; approved objects render in a working-objects panel.
Persistence + research_lifecycle_transition receipting on approve is the named
follow-on (recordExperimentTransition already provides the DVN-anchorable path).

Canary: tests/ccrl-research-proposals.test.ts — 12 drills pinning the
kind->lifecycle mapping, resilient extraction, illegal-transition rejection,
and apply purity. Verified via esbuild parse gate + node drill (vitest
unavailable in-sandbox): 12/12 pass; dev stage extraction regression-checked.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Applies the Dev Command Center ICE engine pattern (services/devCommandCenter/
stageOrchestrator.ts) to the CCRL research copilot. aigentZ can now propose —
suggest-only, operator-gated — the research objects the lab works with, each
mapping to CREATING or ADVANCING an object within its legal lifecycle.

ResearchProposalKind (services/research/proposals.ts, RESEARCH_PROPOSAL_EFFECT
canary-pinned):
- experiment_proposal -> creates a ResearchExperiment at lifecycle `designed`
- protocol_draft      -> advances an experiment `designed -> protocol-ratified`
                         (via isLegalExperimentTransition; lifecycle NOT forked)
- finding             -> creates a ResearchFinding at lifecycle `observed`
- publication_draft   -> creates a ResearchPublication at lifecycle `draft`

ICE-mirrored fence/extract/apply architecture:
- SCHEMAS + buildResearchInstructionBlock (```research_data fence contract,
  strict-JSON + never-promise rules carried over from the dev side).
- extractResearchProposals REUSES the exact stageOrchestrator lenient parser
  (parseFenceBody -> repairFenceJson, now exported) — no weaker fork. A
  nearly-valid fence still parses; unrepairable / unknown-kind fences are
  dropped with a warn, never silently.
- applyResearchProposal is PURE (returns new state, never side-effects — no
  DB/receipt/DVN in this slice). Lifecycle-legality is enforced on apply: an
  illegal transition is REJECTED with state returned unchanged, never silently
  committed. T2-safe payloads only (no T0 identifiers).

Types: ResearchFinding, ResearchPublication, PublicationKind added to
types/research.ts (the CFS-019 §4 object model, contract-first).

Surface wiring: the chat route's ccrl-research branch (narration still primary)
appends the research instruction block and extracts proposals into the shared
stage_proposals channel (surface-scoped — never collides with dev stage_data).
CCRLResearchCopilotTab renders each as a pending approval card (preview-then-
approve, mirroring PendingProposalCard); Approve commits via applyResearchProposal
into in-memory research state; approved objects render in a working-objects panel.
Persistence + research_lifecycle_transition receipting on approve is the named
follow-on (recordExperimentTransition already provides the DVN-anchorable path).

Canary: tests/ccrl-research-proposals.test.ts — 12 drills pinning the
kind->lifecycle mapping, resilient extraction, illegal-transition rejection,
and apply purity. Verified via esbuild parse gate + node drill (vitest
unavailable in-sandbox): 12/12 pass; dev stage extraction regression-checked.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `codexes/packs/ccrl/foundation/CFS-019_ccrl-charter.md` |
| Modified | `components/composer/CCRLResearchCopilotTab.tsx` |
| Modified | `services/devCommandCenter/stageOrchestrator.ts` |
| Added | `services/research/proposals.ts` |
| Added | `tests/ccrl-research-proposals.test.ts` |
| Modified | `types/research.ts` |

## Stats

 7 files changed, 990 insertions(+), 30 deletions(-)
