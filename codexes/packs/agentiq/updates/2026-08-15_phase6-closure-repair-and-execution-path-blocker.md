# Homecoming III Phase 6 Closure — Repair Verified; Execution-Path Correction Blocked

**Date:** 2026-08-15
**Programme:** Homecoming III — Phase 6 Closure (bounded repair of `RES-2026-08-15-PHASE6-COMPRESSION-CROWDOUT-001`)
**Status:** repair complete and verified; the execution-path correction is blocked on a real, disclosed
tooling constraint, reported rather than worked around.

---

## What was repaired

`composeImplementationContext()` (`services/devCommandCenter/implementationContext.ts`) admitted
established/signal/discovery members by array/registry order within a sequential, per-bucket budget
cut. Repaired to admit by **causal relevance**, not accumulation or order:

- `causalRelevanceScore()` — tiered: proven risk-field relevance (via a real `ProofOfRisk`) > this
  run's own structural discovery tie (`recoveries.route`) > an actually-assessed materiality > a
  bounded keyword-overlap fallback (`tokenOverlapScore`, reusing `bearingDiscovery.ts`'s tokenizer —
  extracted as `tokenizeStatement`, not duplicated).
- `deriveRiskDrivenRefs()` — the refs a `ProofOfRisk` ties to a vector actually IN the current
  `IntentRiskField` (a retired/foreign vector's proof lends no borrowed relevance).
- Established is still admitted before signals/discoveries (protected), now internally
  relevance-ranked. Signals and discoveries POOL into one relevance-ranked competition for the shared
  remaining budget, then split back into their own sections by `provenance` for rendering — the
  repair is admission/ranking; lifecycle/provenance separation in the rendered output is untouched.
- `INVARIANT_BUDGET` is unchanged. Capacity was never the defect.

A caller supplying no relevance context still reproduces prior behavior for ordinary retrieved
material (proven in `tests/homecoming-iii-phase6-closure-causal-relevance.test.ts`); live discoveries
carry a structural relevance signal intrinsically (via their own `recoveries`), independent of
caller-supplied context — a stronger property than originally scoped, verified rather than assumed.

## Regression fixture + mutation test

`tests/homecoming-iii-phase6-closure-causal-relevance.test.ts` — a 30-unrelated-signal population
comparable in scale to the real Phase 6 registry, plus established/constitutional members and live
discoveries (one risk-driven, tied to the current field via a real `ProofOfRisk`). 10 tests, one per
repair requirement plus two unit tests on `causalRelevanceScore`'s tier ordering.

**Mutation-tested against the actual defect**: the allocation logic was reverted to the pre-repair
sequential/array-order `take()` calls. Exactly the three tests encoding the crowd-out behavior
(requirements 3, 4, 5 — live discovery survival, risk-driven survival, relevance-over-order
competition) reddened; the other four requirements (constitutional protection, established
protection, honest `omittedRefs`, lifecycle/provenance intact) stayed green, because the crowd-out
defect never touched those properties. The repair was then restored from backup and confirmed
byte-identical to the pre-mutation state.

## Rerun of the UNALTERED Crystal 2.0 dogfood intent

`scripts/homecoming-iii-phase6-closure-rerun.ts` copies every intent/risk-vector/discovery statement
VERBATIM from the original `scripts/homecoming-iii-phase6-dogfood.ts` — nothing about the acceptance
task changed after seeing the prior result. Result, against the real 33-member registry:

| | Before (original Phase 6 run, on record) | After (repaired, full relevance context) |
|---|---|---|
| Live discoveries carried | 0 / 6 | **6 / 6** |
| `CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001` carried | No (omitted) | **Yes — rank #1 among signals** |
| Established carried | 3 (unchanged, protected) | 3 (unchanged, protected) |

Full output: `codexes/packs/agentiq/updates/2026-08-15_phase6-closure-rerun-trace.json`. The repaired
compressed context's "Candidate signals" section now opens with
`CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001`'s full statement — the exact ruling this assignment
implements, previously invisible to anything reading only the compressed context.

## Execution-path correction — blocked, reported rather than substituted

Per the instruction, "final Homecoming acceptance" requires exercising the REAL seam:
`Implementation Pack → /api/dev-command-center/implement → repository_dispatch: claude-implement →
aigentz/pack-* → Claude Code CI → PR to dev → human merge gate`, and explicitly forbids substituting
a `claude/**` session branch or the auto-merge-to-dev workflow and calling it equivalent.

Confirmed real and ready:
- `.github/workflows/claude-implement.yml` exists on `main` (verified via the GitHub API) — the
  workflow is live and would receive a `repository_dispatch` correctly.
- An Implementation Pack was composed (bounded, doc-only: cite
  `CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001`'s statement verbatim in `types/contextBinding.ts`'s
  header, demonstrating the repair's material effect on a real pack) — full text in
  `scripts/homecoming-iii-phase6-closure-dispatch.ts`.

**Blocked**: firing the actual `repository_dispatch` (event_type `claude-implement`) requires either
calling the live route (`POST /api/dev-command-center/implement`, admin-gated, needs a running,
authenticated Next.js session) or a `GITHUB_TOKEN` valid for the raw `POST /repos/.../dispatches` REST
endpoint. Neither is available in this sandboxed CLI session:
- The GitHub MCP server exposes `actions_run_trigger`, but its `run_workflow` method calls the
  `workflow_dispatch` REST endpoint — `claude-implement.yml` only declares
  `on: repository_dispatch`, a different trigger type `workflow_dispatch` cannot fire. No MCP tool
  exposes the raw repository-dispatch endpoint.
- This session's own `GITHUB_TOKEN` env var returned `401 Bad credentials` against
  `api.github.com` directly (verified, not assumed) — it is scoped for this session's own git/MCP
  operations, not a general-purpose PAT.

**What the operator needs to do**: fire this dispatch from a context that has it — the deployed app's
admin UI (Dev Command Center → Implement), or `curl` with a valid `GITHUB_TOKEN`, using the exact
payload in `scripts/homecoming-iii-phase6-closure-dispatch.ts` (`packId`,
`goal`, `packMarkdown`). Once dispatched, watch GitHub → Actions → "Claude Implement (DCC dispatch)";
it opens a PR from `aigentz/pack-phase6-closure-contextbinding-governing--1946e43e` to `dev`. **That PR
is the human merge gate** — nothing in this session merges it.

## Disposition

Per the instruction to stop and report exactly what is needed when operator action is required: this
is that stop. The repair itself is complete, verified, mutation-tested, and regression-clean (17
failed / 41 failed, byte-identical to the Phase 5 baseline, +11 new tests all passing). The final
PASS / NOT YET verdict is deliberately withheld until the execution-path correction actually completes
— rendering it now, with the real seam unexercised, would be exactly the kind of substitution the
instruction forbade.
