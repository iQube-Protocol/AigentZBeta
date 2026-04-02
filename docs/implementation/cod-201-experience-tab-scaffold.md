# COD-201 — Studio Experience Tab (Scaffold)

## Objective
Add the Experience tab UI to Studio in the correct tab order and parity panel container pattern.

## Scope (Packet 1B)
- Add Experience tab route/entry point in Studio shell.
- Add placeholder panel content with explicit TODO sections for Strategy, Model, Matrix, NBE, Status, Analysis.
- Preserve existing tab behavior and ordering constraints.

## Proposed app-level contract
- Tab key: `experience`
- Label: `Experience`
- Placement: before `DiS`
- Container: existing parity panel container pattern

## Implementation status
**DONE** — Claude Code implemented the full Experience tab in `components/composer/AgenticDesignParityPanel.tsx`
as part of Sprint 2. All 6 sub-tabs (Status, Strategy, Model, Matrix, NBE, Analysis) are live on `dev`.
API route: `app/api/runtime/experience/route.ts`.

## Next payloads
- Packet 1C: Strategy + Model sub-tab initial components (covered by Claude Code implementation)
- Packet 1D: Matrix visualizer skeleton + cell inspector placeholder (covered)

## Notes
This packet arrived after implementation was complete. Scaffold doc recorded for traceability.
COD-208 (parity modal) and COD-209 (pipeline visualization) are the remaining Sprint 2 items.
