# Prospective Evolution Capture — Agent Rule

**Status:** Operating rule  
**Governs:** all agents working in AigentZBeta  
**Composes:** `docs/agent-harness/metaproof-core.md`, `codexes/packs/irl/foundation/CFS-051_experiment-constitutional-registry.md`, `codexes/packs/irl/foundation/CFS-051A_prospective-evolution-roadmaps.md`

## Purpose

Research, implementation, debugging, product refinement, partner conversations and free-form exploration continuously surface ideas that belong in the platform's prospective evolution pipeline. The operator should not have to remember to ask an agent to capture them after the fact.

## Mandatory proactive behaviour

During any material discussion or implementation task, every agent must remain alert for a credible candidate in any of the four prospective roadmap classes:

1. **Candidate invariant** — a proposition about what must remain true.
2. **Candidate experiment** — a falsifiable uncertainty that warrants structured testing.
3. **Candidate architectural refinement** — a proposed change to system structure, boundaries, custody, composition or runtime design.
4. **Candidate capability** — a proposed new ability, integration or service the system may need.

When one surfaces, the agent must **proactively call it out to the operator** and recommend the appropriate prospective roadmap. The operator should not need to prompt the agent to notice or classify it.

## Approval boundary — proposal is not registration

Agents are delegated to **identify, classify and propose capture**, not to silently promote ideas into the prospective pipeline.

Unless the operator has explicitly authorized capture in the current turn or has given a standing instruction that clearly covers the item, the agent must ask for or obtain operator approval before writing a new candidate into the CFS-051 pipeline or related roadmap artifact.

Acceptable pattern:

> "This appears to surface two candidate invariants and one architectural refinement. I recommend adding them to the prospective pipeline. Shall I capture them?"

If the operator says yes, capture them without requiring the operator to restate the content.

If the operator has already said, for example, "capture these as candidate invariants", that is sufficient authorization for those identified candidates; do not ask again.

## Classification discipline

Do not force every idea into every roadmap.

- A candidate invariant does **not** automatically require an experiment.
- A design idea does **not** automatically become a capability proposal.
- A capability idea does **not** imply that architecture or implementation has been approved.
- An observation may warrant no registry entry at all.

Classify only what the discussion actually supports, and preserve epistemic status explicitly.

## Existing homes and promotion targets

- Candidate invariants → CFS-051 `research_candidate_invariants` → canonical invariant corpus only after the existing canonization ceremony.
- Candidate experiments → CFS-051 `research_candidate_experiments` → formal `EXPERIMENT_REGISTRY` only through the existing experimental process.
- Candidate architectural refinements → currently CFS-051 research backlog with an explicit architecture marker/provenance → later real CFS/SPEC/PRD if reviewed and adopted.
- Candidate capabilities → currently CFS-051 research backlog with explicit capability marker/provenance → Constitutional Capability Pipeline / `capabilityRegistry` only after implementation, validation and constitutional acceptance.

Never use the shipped capability registry as an ideas backlog. Never write candidate claims directly into canon.

## Conversation-to-pipeline closeout

At a natural milestone or close of a substantive turn, an agent should perform a lightweight prospective scan:

- Did we discover a rule that may need to remain true?
- Did we expose a falsifiable uncertainty worth testing?
- Did we identify a structural refinement worth tracking?
- Did we identify a capability the platform may need?

If yes, surface the candidates and their proposed classifications before moving on. This applies equally to idea exploration, partner/research discussion, code review, debugging, UX refinement and implementation work.

## Relation to the Resolution → Invariant Loop

This rule is broader than the existing Resolution → Invariant Loop. The Resolution loop remains mandatory when a resolved defect or repeated repair produces reusable engineering knowledge and an executable canary. Prospective Evolution Capture also applies **before there is a defect or resolution** — to new research hypotheses, architectural deductions, partner-driven insights and capability opportunities.

The two processes compose; neither replaces the other.
