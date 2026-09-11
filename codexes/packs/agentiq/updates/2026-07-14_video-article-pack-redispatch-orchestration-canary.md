# Video + Article skill — pack re-dispatch finding + orchestration canary

**Date:** 2026-07-14
**Pack:** `f34e7ed6-39f7-4ac0-8df6-275395677bf1` — "Develop a skill that generates a 24-second video and a corresponding article."
**Branch:** `aigentz/pack-f34e7ed6-…`

## Finding: this pack was already implemented and merged

The dispatched pack's goal, invariant bindings, and "areas to touch" match work
that had **already been executed and merged to `dev`** on 2026-07-13:

| Area listed in the pack | State on arrival |
|---|---|
| `services/skills/videoArticleSkill.ts` (the skill) | Present, merged (`81b05b26`) |
| `services/content/alignmentService.ts` (MISSING #1) | Present, merged (`de5ac19f`) |
| `services/rendering/optimization.ts` (MISSING #2) | Present, merged (`de5ac19f`) |
| `app/api/skills/video-article/route.ts` (receipts) | Present, merged |
| `components/composer/VideoArticleSkillRunner.tsx` (surface) | Present, merged |
| `tests/video-article-skill.test.ts` (builders) | Present, merged |
| `tests/alignment-and-render-plan.test.ts` (the two services) | Present, merged |

At dispatch time `HEAD == origin/dev`, working tree clean. Per **Extend, Don't
Duplicate** and the append-only rule the pack itself binds
(`inv.constitutional.023` — supersession replaces deletion), **no existing code
was re-created or rewritten.** The `registry_assets/agentiq-native-*` entries in
the pack are registry capability records, not repo files — nothing to create.

## Genuine increment made

One layer of the pack's validation plan had **no coverage**: item #2, "Test the
end-to-end process to ensure a 24-second video and corresponding article are
generated correctly." Every lower layer was pinned (pure builders, the two
MISSING services in isolation, the invariant brief), but the composition
function `buildVideoArticlePlan` — which wires brief → article → measured
alignment → render plan — was untested.

Added `tests/video-article-plan-orchestration.test.ts` (5 tests), mirroring the
established mock pattern in `tests/video-invariant-brief.test.ts`
(`getInvariantsByIds` / `listMembers` mocked; `useLlm:false` forces the
deterministic template path — no network, no provider key). It verifies:

- the 24s / 2-segment contract holds end-to-end (`totalSeconds` 24,
  `renderPlan` = 2×12s with exactly one stitch pass);
- the article is drafted from the SAME brief (each segment beat appears verbatim
  in the template article body — correspondence is structural);
- alignment is **measured against the drafted article body**, not asserted
  (score 1, pass earned, `basis: 'heuristic'`);
- the coherence quality gate runs and is degradation-safe (null, never a faked
  pass);
- no forbidden T0 identifier (`personaId`, `authProfileId`, `rootDid`) appears
  anywhere in the serialised plan.

## Validation

`npm test -- tests/video-article-plan-orchestration.test.ts
tests/video-article-skill.test.ts tests/alignment-and-render-plan.test.ts`
→ **18 passed** (5 new + 13 existing). No `typecheck` npm script exists in this
repo; the test file is type-checked and executed by the vitest esbuild transform
during the run.

## Honest limits

- The new coverage exercises the **deterministic template path** end-to-end. The
  LLM drafting path (`draftCompanionMarkdown` via the shared drafter) and the
  Anthropic segment-prompt composer are not exercised here (they need a provider
  key and are non-deterministic); their seams are covered by
  `tests/article-draft-service.test.ts`.
- `buildVideoArticlePlan` plans and drafts; the actual clip generation + stitch
  runs client-side in `SkillVideoPlayer` and is not unit-tested from Node.
- The alignment score remains a `basis: 'heuristic'` coverage measure; the LLM
  judge pass noted in `alignmentService.ts` is still a future increment.
