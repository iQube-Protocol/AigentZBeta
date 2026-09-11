# Validation Programme — external reviewer guided journey, Phase 1

**Date:** 2026-08-01
**Branch:** `claude/tokenqube-minting-integration-ms2yjd`
**Trigger:** operator spec — a single guided experience (using the existing Journey component)
that lets an external reviewer complete EXP-P1 review without needing to understand the internal
platform architecture. Explicit framing: "nothing new here, just presented in one guided flow."

## What was actually found (research before code)

Before writing anything, three research passes + direct reads turned up a **complete, already-
ratified substrate** for exactly this use case — `SPEC-IRL-WORKSPACE-001_research-workspace.md`
already defines an `External Reviewer` role (substrate id `reviewer`), a real `access_grants` /
`access_invitations` system with experiment-level scoping
(`services/passport/participationAccess.ts`), a real authority table declaring what a reviewer may
and may never do (`services/research/researchWorkspaceRoles.ts`), an 8-view Research Workspace
matrix that already grants the `reviewer` role Overview/Pipeline/Review/Locker/QubeTalk/Activity
(`services/research/researchWorkspaceViews.ts`), and a named workspace —
`autonomi-review-exp-p1`, under the `autonomi-independent-review-programme` — whose declared
"Procedural role: External Reviewer" is this exact case (`services/research/researchWorkspace.ts`).

**The one real gap**: the render-level matrix already anticipated a `reviewer` grant reaching the
Review/Crystal evidence, but server enforcement on `app/api/research/crystal/[experimentId]/route.ts`
still required `cartridgeFlags.isAdmin` unconditionally. That is the one precise, narrow change this
phase makes — not a new access primitive, an extension that closes a gap the codebase's own
architecture had already declared.

This finding **replaced** an earlier, wrong plan (building a new reviewer-access module from
scratch) mid-session — worth recording so a future session doesn't repeat the near-duplication.

## What shipped

- **`services/passport/participationAccess.ts`** — new `callerMayReadExperimentReview(admin,
  personaId, experimentId)`: does this persona hold an active `research-lab` grant, in a role the
  Review view admits (`reviewer`/`research-steward`/`principal-investigator`/`faculty-lead`/
  `researcher` — never `research-participant`/`student-researcher`), scoped via `allowed_experiments`
  to this experiment? Read-only by construction — never touches freeze/canonise/publish.
- **`app/api/research/crystal/[experimentId]/route.ts`** — GET now admits a scoped reviewer grant
  alongside admin. The sibling `freeze-preview` route is **untouched** — reading readiness evidence
  and previewing a freeze ceremony are different authorities, and only the former belongs to a
  reviewer.
- **`app/triad/components/codex/tabs/PartnerProgrammesTab.tsx`** — new additive `lockedWorkspaceId`
  prop: renders exactly one workspace bare (no picker, no Command Center chrome), reusing the
  existing grant-scope filter first so locking can only narrow reach, never widen it. Same "rendered
  bare" convention the Guided Journey Runtime already uses for other Venture Lab modules.
- **`components/journey/JourneyRunSurface.tsx`** (new) — the Guided Journey Runtime's stepper +
  viewport, extracted from `PilotJourneyTab.tsx` so a second journey can reuse it instead of forking
  a second stepper. `PilotJourneyTab.tsx` is now a thin wrapper carrying only what's genuinely
  Horizen-specific (agent-slug carrying, its own component registry) — behaviour is byte-identical,
  verified by the existing `horizen-agent-page-surface-wiring.test.ts` canary passing unmodified.
- **`services/journey/validationProgrammeJourney.ts`** (new) — the 4-stage `JourneyDefinition`
  (Overview → Crystal Review → Submit Review → Experiment Progress), every stage composing an
  EXISTING surface: Overview/Locker/QubeTalk/Pipeline/Activity via `PartnerProgrammesTab` locked to
  `autonomi-review-exp-p1`; Crystal Review via an embed of the real IRL OS Laboratory Experiments
  surface (`InvariantExperimentLab` / `IndependentReviewPanel` / Crystal vP1).
- **`services/journey/journeySurfaceRegistry.ts`** — 6 new registry entries for the above.
- **`app/api/journey/validation-programme/state/route.ts`** (new) — resolves journey state from
  real signals: `reviewerAccessConfirmed` (via `callerMayReadExperimentReview`) and
  `reviewDecisionSubmitted` (via `listReviews`, checking `r1Decisions`/`r2Decisions` for this
  caller's `personaPublicRef`).
- **`app/triad/components/codex/tabs/ValidationProgrammeJourneyTab.tsx`** (new) — thin wrapper,
  same shape as `PilotJourneyTab.tsx`.
- Registered as `irl-os-validation-programme` in `IRL_OS_CARTRIDGE`'s `laboratory` tab group
  (`data/codex-configs.ts`) and in `TabRenderer.tsx`'s component registry. Not `adminOnly`.

## Honesty over completeness (explicitly NOT built this pass)

- **Submit Review stage evidence** (`collaborationAgreementAuthorized`) is declared but not
  computed — no existing route attributes a signed agreement to "this reviewer, for this
  programme." The stage correctly stays NOT_STARTED/READY rather than being fabricated as complete.
  A test (`validation-programme-journey.test.ts`) pins this absence so it can't silently regress
  into a false positive.
- **Reviewer-mode UI trim on `IndependentReviewPanel`**: the Crystal Review stage embeds the real
  Experiments surface as-is (a reviewer sees the same tab bar an operator does — New/Queue/
  Result/Crystal — with New/Queue/Result correctly 403ing via the untouched admin-only gate). A
  follow-up could add a reviewer-mode prop that deep-links straight to Crystal and hides the
  admin-only tabs; not built here to keep this pass to verified, narrow changes.
- **Self-service reviewer decision submission**: today a reviewer's structured decision is entered
  by an admin on their behalf (`IndependentReviewPanel`'s "New Review" form); there is no route yet
  where an authenticated reviewer submits their own decision directly. Real, separate follow-up
  work — not attempted here.
- **JSON Agent Package** (machine-readable manifest for an AI-agent reviewer): tracked as Phase 2,
  not built in this pass.

## Tests

- `tests/validation-programme-journey.test.ts` (new, 29 canaries): `callerMayReadExperimentReview`
  role/scope behavior, the crystal route's gate extension + freeze-preview non-widening,
  `lockedWorkspaceId`'s narrow-never-widen property, journey structure/surface-registration,
  `resolveJourneyState` behavioral tests over the real journey (including the "never fabricates
  COMPLETE" canaries for the two not-yet-wired stages), and tab registration/reachability.
- Full suite: 226 files / 3804 tests passing, including the pre-existing
  `horizen-agent-page-surface-wiring.test.ts` and `passport-connection-challenge.test.ts` canaries
  (untouched by this work, still green after the `PilotJourneyTab` extraction).
