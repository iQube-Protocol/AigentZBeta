# SmartTemplates Design Intent Spec (DIS)

## Purpose
Define layout behavior and non-negotiable constraints for SmartTemplates used by Codex surfaces, starting with `knyt:drawer_grid_v1`.

## Scope (v0.1)
- Applies to KNYT Codex drawer rendering in AigentZ.
- Covers template behavior, not content sourcing rules.
- Establishes baseline constraints for Smart Template Registry migration.

## Constraint Manifest (Initial)

### 1) Template Selection Authority
- Codex must retain automatic template selection from orchestration/coplay policy.
- Tab-level forcing can exist for non-Codex tabs when required, but Codex itself remains auto-selected.

### 2) Symmetry Requirement
- Grid layouts must maintain visual symmetry across primary modules.
- In `drawer_grid_v1` / `1C` stage layouts, the featured landscape block and adjacent side stack must resolve to equal total stage height.
- Large empty grid blocks are disallowed unless explicitly defined via an intentional invisible module.

### 3) `1C` Side-Stack Behavior
- Preferred behavior: render two tall portrait side modules (poster treatment) whenever at least 1 portrait candidate exists.
- If only one portrait candidate exists, mirror/reuse it for the second poster slot to keep stage symmetry.
- Fallback behavior: if no portrait candidates are available, render a 2x2 short-card side stack (4 modules) instead of mixed/partial tall cards.
- Fallback stack must preserve symmetry with the featured landscape stage.

### 4) Consistency Across Tabs Using Same Template
- When Codex and Lore both use `drawer_grid_v1`, they must follow the same geometric rules for stage symmetry and fallback behavior.
- Content can differ by tab; layout constraints do not.

### 5) Mobile Geometry for `1C` (`drawer_grid_v1`)
- Mobile uses an explicit `4x5` stage grid (20 cells), not a simple responsive shrink.
- Rows 1-2 (`8` cells): featured landscape module spans full width (`4x2`).
- Rows 3-4 (`8` cells): two side modules rendered side-by-side, each occupying `2x2`.
- Row 5 (`4` cells): thumbnail rail where each item is `2x1`, rendered as horizontal swipe carousel.

### 6) Tablet Orientation Rules for `1C`
- Tablet landscape mirrors desktop `1C` geometry and hierarchy.
- Tablet portrait mirrors mobile `1C` geometry (`4x5` stage + thumbnail carousel).
- Module sizing must fill available viewport space for the active orientation rather than simply shrinking desktop cards.

## Implementation Notes (Current)
- Template: `knyt:drawer_grid_v1`
- Primary variant in Codex/Lore: `1C` (when selected by orchestration)
- Featured stage should stretch to stage height on desktop to avoid short-landscape mismatch against side modules.

## Backlog Hooks
- Persist these constraints as first-class metadata in Smart Template Registry.
- Add template constraint validation tests (symmetry, fallback, no-empty-block checks).
- Add admin-facing template inspector view showing active constraint set and resolved fallback path.
