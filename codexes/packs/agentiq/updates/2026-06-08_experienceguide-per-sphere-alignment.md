# Personal ExperienceGuide — per-sphere alignment + richer copy & tooltips

**Date:** 2026-06-08
**Status:** shipped

The ExperienceGuide setup wizard now collects an alignment state (`aligned` /
`drifting` / `at_risk` / `repair`) **per sphere** — not just as a single
overall headline. The overall alignment is derived from the per-sphere
states by taking the worst (highest-ordinal) value: one sphere in repair
forces the headline to repair, so the nudge engine reacts to the weakest
link rather than the average.

Each sphere section now carries a fuller paragraph describing what is being
assessed, and every maturity / alignment / precedence chip has a tooltip
explaining its meaning. A little more work for the user during setup, but
the Experience Matrix, the ladder, and the NBE engine now have real status
at every sphere × maturity intersection.

## Type changes — `types/experienceGuide.ts`

- `PersonalGuideData.sphereAlignment: Record<SphereAxis, AlignmentState>` —
  new required field.
- `PersonalGuideData.alignmentState` retained as a **derived** roll-up
  (computed on read in the service layer + recomputed on every upsert).
- New `defaultSphereAlignment()`, `deriveOverallAlignment(...)`,
  `backfillSphereAlignment(...)` helpers.
- New `ALIGNMENT_DESCRIPTION` map for tooltip copy.
- `SPHERE_DESCRIPTION` strings rewritten — each sphere now reads as
  "what this sphere is + what you are being asked to rate".
- New `ALIGNMENT_ORDINAL` map for the worst-of comparison.
- New stub `GoalAlignmentPattern` + optional `goalAlignmentPattern` field
  on `PersonalGuideData`. Reserved so we can write the goal → alignment
  pattern weights without a migration once the catalogue is worked out.

## Backfill rule (legacy guides)

Existing guides only have the single `alignmentState`. On read in
`getPersonalGuide()`, when `sphereAlignment` is absent the helper
`backfillSphereAlignment(overall)` fans the global value out to every
sphere. The user sees their previous snapshot mirrored across all seven
spheres and can refine it on next assessment. The overall is then
re-derived from the per-sphere map so the headline always tracks the parts.

The same backfill runs in the wizard's `emptyForm()` so reopening the
setup dialog shows the per-sphere chips already populated with the
operator's prior state.

## Wizard changes — `PersonalGuideSetupWizard.tsx`

- `SphereStep` now renders **two chip rows** per sphere:
  - Maturity (7 levels) — existing chips with tooltips
  - Alignment (4 states) — new emerald / amber / orange / rose toned chips
    matching the matrix tab's colour language
- Each sphere section opens with a richer description paragraph (from
  `SPHERE_DESCRIPTION`).
- Every chip has `title=` + `aria-label=` tooltip text.
- Step 5 used to ask for global alignment + precedence; it now asks for
  precedence only and shows the **derived** overall in a small preview
  panel above the precedence radio group, with copy explaining the
  weakest-link roll-up rule.
- Step 6 Review shows per-sphere rows with both maturity and alignment,
  plus the derived overall.
- POST body now carries `sphereAlignment` and a client-computed
  `alignmentState` (the server re-derives anyway).

## API changes — `app/api/assistant/experience-guide/route.ts`

- POST accepts `sphereAlignment: Partial<Record<SphereAxis, AlignmentState>>`.
- Seeds from the existing record's per-sphere map; falls back to fanning
  out the legacy overall if that is all we ever stored; falls back to
  `defaultSphereAlignment()` if neither exists.
- `alignmentState` is always re-derived from the per-sphere map. Any
  contradicting `alignmentState` in the request body is ignored.
- `goalAlignmentPattern` is preserved across upserts (write-through).

## Matrix tab — `PersonalExperienceMatrixTab.tsx`

- Each row's cells are now tinted by **that sphere's** alignment instead
  of a single page-wide tint.
- New per-sphere alignment badge next to the row label so the operator
  can read the status at a glance without hovering.
- Cell tooltip now includes the sphere alignment alongside the
  prescription text.
- Header badge changed from "Alignment" → "Overall" with a tooltip
  explaining the weakest-link rule.

## Goal-alignment pattern — stub only

A `GoalAlignmentPattern` interface and optional `goalAlignmentPattern`
field on `PersonalGuideData` are now in place but unused. The intent —
captured here so future agents do not re-invent it — is that different
goal classes weight spheres differently (e.g. athletic performance weights
body + energy; creative-output weights mind + emotion; relationship-led
goals weight relationship + emotion + energy). Once the canonical pattern
catalogue is defined, the NBE engine can read both `sphereAlignment` AND
`goalAlignmentPattern.weights` to rank which misalignments matter most for
the user's stated goals.

## Files

| File | Status |
|---|---|
| `types/experienceGuide.ts` | extended (per-sphere alignment + helpers + tooltip copy + goal-pattern stub) |
| `components/metame/setup/PersonalGuideSetupWizard.tsx` | per-sphere alignment chips, richer copy, tooltips everywhere |
| `app/api/assistant/experience-guide/route.ts` | accepts `sphereAlignment`, derives overall |
| `services/iqube/experienceQube.ts` | `getPersonalGuide` backfills `sphereAlignment` + re-derives overall |
| `app/triad/components/codex/tabs/PersonalExperienceMatrixTab.tsx` | per-row tint + per-sphere badge |

## No DB migration

`PersonalGuideData` lives inside the ExperienceQube BlakQube JSON payload,
not a typed column. The new field rides along with the existing JSON. No
SQL needed.
