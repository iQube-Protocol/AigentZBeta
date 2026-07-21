# Video + Article skill — remediation: Studio service integration + marketer/creator UX

**Date:** 2026-07-15
**Pack:** `f34e7ed6-39f7-4ac0-8df6-275395677bf1` — "Develop a skill that generates a 24-second video and a corresponding article." (remediation pass)
**Branch:** `aigentz/pack-f34e7ed6-…`

The skill, its services, route, runner, and tests shipped 2026-07-13/14 and were
merged (PR #89). This pass addresses two validation-judge remedies against that
merged work — additively, per **Extend, Don't Duplicate**. No existing code was
re-created or rewritten.

## Remedy #1 — marketer/creator-facing UX surface

**Finding:** the generation controls existed only in `VideoArticleSkillRunner`,
mounted in the **metaMe IRL — Invariant Research Lab** (`InvariantExperimentLab`)
with research-lab vocabulary (invariant namespaces, style-continuity CFS-011,
"experiment"). No confirmed touchpoint framed for the marketer/creator persona.

**Fix — one generation path, two persona surfaces:**

- `components/composer/VideoArticleSkillRunner.tsx` — added an `audience`
  prop (`"lab"` default | `"creator"`). Creator mode reframes copy and control
  labels in plain language (theme → not "semantic namespace"; "Create my video +
  article" → not "Generate plan"; "keep a consistent look" → not "style
  continuity layer CFS-011"). Same controls, same `POST /api/skills/video-article`
  contract — no forked implementation.
- `components/composer/VideoArticleCreatorFlow.tsx` (new) — a thin,
  self-contained collapsible launcher that expands into
  `<VideoArticleSkillRunner audience="creator" />`. It owns its own open/closed
  state so ComposerStudio's state tree is untouched.
- `components/composer/ComposerStudio.tsx` — mounted `<VideoArticleCreatorFlow />`
  at the top of the **Workflows** tab (the surface marketers/creators actually
  work in) and added the `skill:video_article_24s` card to that tab's skill list
  so the skill is discoverable there.

This confirms UX delivery for the target persona: a creator opens Studio →
Workflows → **Guided Creator Flow → 24-Second Video + Article**, picks a theme,
names the piece, and generates the video + companion article inline.

## Remedy #2 — wire alignmentService outputs to the Studio service

**Finding:** the Registry integration was explicit (`studioSkillCatalog` →
`buildStudioRegistryIntakes`), but the **Studio service** integration
(`services/composer/studioArtifactTiering.ts`, the AR/CPS artifact-record seam)
was not — the article production's alignment verdict stayed in the API response
and never reached the Studio artifact record store.

**Fix — alignment output now crosses into the Studio artifact seam:**

- `services/content/alignmentService.ts` — added the explicit, documented Studio
  integration point: `StudioAlignmentFields` (the T2-safe projection the Studio
  record carries) + `alignmentToStudioFields(report)` (pure adapter). The module
  stays pure/node-drillable (no DB, no clock, no network); the dependency is
  one-directional (Studio → alignment).
- `services/composer/studioArtifactTiering.ts` — `StudioRecordBodyInput` now
  accepts an optional `alignment` field, whitelist-copied field-by-field in
  `buildStudioRecordBody` (same T0-inexpressibility guarantee — no object spread).
- `app/api/skills/video-article/route.ts` — the plan branch now calls
  `tierStudioArtifact({ kind: 'studio.article.draft.completed', …, alignment:
  alignmentToStudioFields(plan.alignment) })`, persisting the article production
  as an operational Studio artifact record carrying the alignment score; the
  video-complete branch calls `tierStudioArtifact({ kind:
  'studio.video.stitch.completed', … })`. Both are best-effort and never sink the
  plan. The response now surfaces `studioArtifactRecordId`.
- `services/composer/studioSkillCatalog.ts` — documented the new
  `studioArtifactRecordId` output on the `skill:video_article_24s` interface.

## Validation

`npx vitest run tests/alignment-and-render-plan.test.ts
tests/studio-artifact-tiering.test.ts tests/video-article-skill.test.ts
tests/video-article-plan-orchestration.test.ts
tests/studio-skill-catalog-video-article.test.ts` → **32 passed** (3 new + 29
existing). New tests:

- `alignment-and-render-plan.test.ts` — `alignmentToStudioFields` mirrors the
  report and is `findForbiddenObjectKey`-clean.
- `studio-artifact-tiering.test.ts` — `buildStudioRecordBody` carries the
  alignment verdict whitelist-copied (smuggled T0 keys dropped) and null when
  absent.

`npx tsc --noEmit` → the only errors are two pre-existing repo-config issues
(missing `iqube` type def; an `--ignoreDeprecations` value) — none in the files
touched here.

## Honest limits

- Studio integration depth and marketer UX usability remain untested with real
  creator personas end-to-end (the pack's residual risk). The persistence path
  (`saveArtifactRecord` → Supabase) is best-effort and exercised by a post-deploy
  drive, not from Node — the unit tests pin the pure classification + body
  builder only.
- The creator flow reuses the lab runner's controls verbatim; a bespoke
  creator-only intake (e.g. free-text topic → auto-selected grounding) is a
  future increment, not this pass.
- Alignment remains a `basis: 'heuristic'` coverage measure; the LLM judge pass
  is still deferred.
