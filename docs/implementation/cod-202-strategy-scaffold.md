# COD-202 — Strategy Sub-tab (Scaffold)

## Objective
Add a Strategy sub-tab under Studio Experience to capture and edit strategy primitives.

## Fields (initial)
- objective
- target personas
- target cohorts
- goals
- KPIs
- constraints
- owner

## UI scaffold
- `StrategySection` container
- editable form blocks for each field group
- save/update callback stubs

## Validation scaffold
- required: objective, owner
- optional arrays: personas/cohorts/goals/KPIs/constraints

## Implementation status
**DONE** — Claude Code implemented the Strategy sub-tab in AgenticDesignParityPanel.tsx (Sprint 2).
