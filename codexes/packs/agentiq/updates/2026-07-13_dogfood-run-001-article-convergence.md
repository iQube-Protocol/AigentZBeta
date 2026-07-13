# Dogfood Run 001 — Article Convergence through the Constitutional Capability Pipeline

**Date:** 2026-07-13 · **Harness:** Claude Code (D1 — execution stays human) · **CS-001 remediation**

The first end-to-end run of the completed pipeline (CFS-029) on a real goal — executed in the
pipeline's own stage order, with the pack authored FROM the evidence and the decision taken
BEFORE the plan. This run is also **D1 operating-history cycle #1** toward D2 ratification.

## Intent

> Converge article generation on one shared service: extract the route-inlined article-draft
> generator into a composable service, route it through callSovereign, converge the
> video-article skill's drafter onto it, and fix the catalog endpoint drift.

## Capability Evidence (gathered by reconnaissance, not asserted)

- EXISTING · `/api/composer/article-draft` route — 252-line inlined generator, OpenAI-direct client [extract]
- EXISTING · `skill:article_generation` catalog entry — `invokeEndpoint` pointed at `/api/composer/article/generate`, a route that never existed [fix]
- EXISTING · `services/skills/videoArticleSkill.ts` `draftArticleFromBrief` — the CS-001 duplicate drafter [converge]
- EXISTING · `callSovereign` (constitutional model router) [use_directly]
- Consumers verified: ComposerStudio, MetaMeRuntimeClient, composerStore, chat route, packet route — none branch on the `provider` response value (safe to widen)
- MISSING · `services/composer/articleDraftService.ts` — the shared home
- NEVER · duplicate capabilities · break the route's response shape (`{ ok, articleDraft, provider }`) · weaken the skill's correspondence contract

## Constitutional Decision (taken before the plan)

**Mechanism: `code` — extract + converge.** `noBuildRequired: false`. Rationale: the capability
exists but carries extract/converge dispositions — two independent drafters live today, which is
the drift itself. Alternative `none` rejected: leaving both drafters in place perpetuates CS-001.

## What was built (areas from the evidence, verbatim)

1. **`services/composer/articleDraftService.ts`** — the one drafting home. Pure builders
   (fallback artifact + lenient validation) moved VERBATIM from the route. One sovereign seam
   (`callSovereign('draft', …)` — this call site migrated off the OpenAI-direct client), two
   presentations: `draftArticleArtifact` (structured editorial artifact) and
   `draftCompanionMarkdown` (caller-supplied mandate + prompt, verbatim).
2. **The route** became a thin wrapper — response shape unchanged; `provider: 'fallback'`
   semantics preserved; real provider name reported when routed.
3. **`videoArticleSkill.draftArticleFromBrief`** converged onto `draftCompanionMarkdown` — its
   mandate and brief-grounded prompt pass byte-identically, so the correspondence contract
   (validation plan #2 of its own pack) is untouched; template fallback retained.
4. **Catalog drift fixed** — `invokeEndpoint` now points at the real route.

## Constitutional Validation

- esbuild parse gates: 5/5 files.
- Stub-bundle drill 8/8: structured mode (provider up → parsed artifact + real provider; down →
  fallback artifact + `provider: 'fallback'`), companion mode (up → body + sovereign metadata;
  down → null, caller falls back), skill prompt still brief-only, mandate unchanged, skill drafts
  through the shared seam, template fallback on seam failure.
- Canary suite: `tests/article-draft-service.test.ts` (moved builders + degradation contract).

## Constitutional Receipt

- The implementation receipts are the commits on `claude/agentiq-onboarding-docs-jrbeha`
  (this run's commit + this record). In-app receipted twin: regenerate the pack for this goal in
  the DCC — the evidence above (once entered through the session stages) persists via
  `capability_evidence` with its `knowledge_curated` receipt, and the pack generation writes
  `implementation_pack_generated`.
- **D1 cycle #1**: propose the deployment from the Capability Pipeline tab with this goal + the
  commit range once deployed — the `deployment_proposed` receipt closes the chain.

## Honest limits

- The pipeline's in-app stages (receipted pack, persisted evidence row) require the deployed
  surface; this run executed the same stage ORDER and contracts from the harness, with the run
  record standing in for the session artifacts until the operator replays the cycle in the DCC.
- The two article presentations remain distinct BY DESIGN (structured bundle artifact vs
  brief-grounded companion) — convergence unified the drafting seam, not the artifact classes.
