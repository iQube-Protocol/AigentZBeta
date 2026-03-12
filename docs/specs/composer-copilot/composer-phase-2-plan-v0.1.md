# Composer Copilot Phase 2 Plan v0.1

## Purpose

Phase 2 moves the Composer golden path from generation-only alpha into a persistent, owned, context-aware experience design flow.

The main themes are:

- ownership and persistence
- editable generation
- codex-context specialization
- provider binding
- inference economics visibility

## 1. Ownership and Persistence

Phase 2 should formalize who created an ExperienceQube and where generated assets live after creation.

Required additions:

- bind the creator persona to the ExperienceQube
- preserve active codex context on the ExperienceQube
- persist generated image/video assets as stable asset references
- attach receipt references to generated assets when available

Initial metadata targets:

- `creator_persona`
- `codex_context`
- `generated_assets`

## 2. Editable Generation

The alpha already seeds experience names and generation prompts through the Composer and Customizer.

Phase 2 should make these fields explicit first-class state:

- editable experience name
- editable portrait prompt
- editable landscape prompt
- editable video prompt

The user should be able to refine copilot-generated prompts without breaking the continuity of the Studio flow.

## 3. Codex Context Specialization

Composer behavior should vary by active codex.

Current target hierarchy:

- `Qriptopian` as the base domain context
- `metaKnyts` as a focused inherited sub-context within Qriptopian
- `metaMe` as a later system-level context layer

Resolution rule:

- active codex `Qriptopian`: apply Qriptopian base context
- active codex `metaKnyts`: apply Qriptopian base context, then metaKnyts overrides

This context should influence:

- template ranking
- prompt style
- resource recommendations
- DesignQube guidance
- ExperienceQube framing

## 4. Provider Binding

Chat inference may still allow controlled provider failover.

Generation skills should not.

Phase 2 should enforce:

- skill-selected provider determines generation endpoint
- no silent cross-provider substitution for generation
- selected provider recorded in generated asset metadata

## 5. Inference Economics

Cost should become visible during design, even before routing is automated.

Phase 2 should surface:

- estimated generation cost envelopes
- likely provider cost notes
- creator-paid vs user-paid implications
- cost as part of resource review

Phase 3 should then extend this into trust-and-cost routing and ClawRouter-style orchestration.

## 6. Implementation Scaffolding

The first implementation step is to thread these concepts through Composer session context and ExperienceQube metadata without changing the existing alpha flow.

Initial scaffolding includes:

- codex context in Composer session context
- editable generation state in Composer session context
- creator persona fields in ExperienceQube metadata
- generated asset references in ExperienceQube metadata

## 7. Phase 2 and Beyond: Composable Blocks

Phase 2 should prepare the current golden paths to become production-grade composable blocks.

The immediate objective is not broad composition yet.
It is to make the current image and video experiences persistent, owned, editable, and deployable enough that they can later be treated as reliable building blocks.

This means:

- finish the current golden paths through Phase 2 and Phase 3
- define a standalone deployment block
- then extract common block contracts for composition

Reference:

- `composable-experience-blocks-plan-v0.1.md`
