# CONSEQUENCE-ONTOLOGY-001

**Status:** findings + an operator decision needed. **No types module has been written.** This document exists specifically because writing one without first resolving what's below would violate the codebase's own core principle ("a parallel implementation of an existing capability is a defect," `CLAUDE.md` → Core Principle / `inv.engineering.037`) and the Prospective Evolution Capture rule (a candidate architectural refinement must be surfaced for operator approval before it is acted on).

## What the VELA-001 PRD asked for

Section 8 of the PRD suggests a shared TypeScript types module with (paraphrasing the governing invariants): `ConstitutionalAuthority`, `ProposedAction`, `ConsequenceProjection` (prospective — "what an action is expected to cause"), `ActionAuthorisation`, `CommerceExecution`, and `ObservedConsequence` (retrospective — "what an action actually caused"). The staged plan calls for this to land as `CONSEQUENCE-ONTOLOGY-001` before any MoneyPenny-facing code.

## What already exists, canonically, in this codebase — read before writing anything

A repo-wide search before starting this artifact surfaced an **already-ratified, already-implemented** ontology with the same shape and, in three places, the *same words*:

**`types/consequence.ts`** + **`services/consequence/{stages,operatingModel,pipeline,counterfactual,index}.ts`** implement **CFS-006a — the Consequence Operating Model**, described in its own header as: *"The canonical pipeline Intent → Knowledge Curation → Knowledge Compression → Risk → Value → Capability → Consequence Forecasting → Planning → Execution → Observation → Standing → Registry Update → Knowledge Evolution ... The pipeline is recursive: Standing produces new knowledge that feeds the next Intent (the flywheel)."*

Concretely, this is already live and typed:

| Existing type/function (CFS-006a) | What it does | Overlaps with PRD's proposal |
|---|---|---|
| `ConsequenceForecast` (`types/consequence.ts`) | A **prospective** forecast of what follows from an action — traverses an invariant graph over `enables`/`constrains`/`contradicts` edges, flags `forcesEscalation` and `constitutionalConstraint` | This is a *different mechanism* (graph traversal over the invariant substrate) arriving at the *same conceptual slot* as the PRD's `ConsequenceProjection` (prospective, "what is this action expected to cause") |
| `forecastConsequences()` (`services/consequence/stages.ts`) | Computes the above | Same slot as a would-be `projectConsequence()` |
| `'consequence_forecasting'`, `'execution'`, `'observation'` (members of `ConsequenceStage`) | Named pipeline stages | The PRD's `CommerceExecution` and `ObservedConsequence` land, by name and by concept, on top of stages that already exist and already have a name |
| `executeApproved()` (`services/consequence/operatingModel.ts`) | *"The post-approval arc: Execution → Observation → Standing → Registry Update → Knowledge Evolution. Closes the flywheel — observed outcome updates the ..."* returns `{ evolved: string[]; observation: 'confirmed' | 'contradicted' }` | This is, almost word for word, the PRD's own Consequence Projection / Observed Consequence distinction ("Consequence Projection describes what an action is expected to cause. Observed Consequence records what it actually caused.") — except CFS-006a already ships it, under the name `observation` |
| `StageReceiptRef`, `ConsequenceRun` | T1-safe run/receipt tracking through the pipeline | Same conceptual slot as whatever receipt/evidence shape a Vela-backed projection would need |

This is not a superficial naming coincidence. CFS-006a's pipeline and the PRD's five-plane runtime (Authority → Projection → Authorisation → Execution → Consequence) describe the **same causal shape** — propose an action, forecast/project its consequence, gate on that forecast, execute if cleared, observe what actually happened, feed the observation back — using two different vocabularies and two different projection mechanisms (graph traversal over invariants vs. a TEE-executed WASM comparison of financial limits).

## Why this is not a "just pick names that don't collide" problem

Renaming around the collision (e.g. calling the new module's type `VelaConsequenceProjection` instead of `ConsequenceProjection`) would dodge the naming clash but not the actual question, which is architectural: **is a Vela-backed projection a *new, independent* consequence-projection mechanism that MoneyPenny's execution path chooses between, or is it a *new provider* feeding the existing `forecastConsequences()` slot in CFS-006a's already-ratified pipeline?** Those have materially different implementations:

- **If independent:** MoneyPenny's invocation path would need to decide, per action, *which* projection mechanism applies (graph-traversal forecast for governance/invariant-shaped questions, Vela-TEE projection for financial-limit-shaped questions) — this needs an explicit selection rule, or every future reader of the codebase has two "the forecast of this action" answers with no stated relationship between them.
- **If composed:** `forecastConsequences()` (or a new sibling stage) would need to be able to call out to a Vela-backed provider as one of potentially several projection strategies, and `ConsequenceForecast`'s existing shape (`nodes`, `enables`/`constrains`/`contradicts` counts, `constitutionalConstraint`) would need to either accommodate a financial-limit-style verdict or the pipeline would need a second forecast-shaped field alongside it. This extends the existing type rather than adding a parallel one, consistent with `inv.engineering.036`/`037`, but changes CFS-006a's contract — which is a ratified, ceremony-governed pipeline, not something to extend unilaterally without the operator's sign-off given how many other stages/tests key off it (`tests/consequence-*.test.ts`, `services/devCommandCenter/consequenceCanvas.ts`, `services/journey/consequenceForkProjection.ts`, `services/intentChains/templates/consequence-operating-model.v1.json`).

The same question recurs for `ObservedConsequence` vs. the existing `observation: 'confirmed' | 'contradicted'` result of `executeApproved()`, and for `CommerceExecution` vs. the existing `'execution'` stage.

## What this document is NOT proposing

It is not proposing to rename or restructure CFS-006a unilaterally, and it is not proposing to build a second, same-named ontology beside it. Per the codebase's Resolution → Invariant Loop and Prospective Evolution Capture rules, this is exactly the class of finding — *"two subsystems disagreed about the same canonical state"* (trigger #4 in the Resolution → Invariant Loop) and a genuine candidate architectural refinement — that must be surfaced for explicit operator direction before any types module or Slice 2E/2F code is written, rather than silently resolved by an agent's own judgment call.

## Proposed options (for the operator to choose between, not a recommendation ranked above the others without input)

1. **Compose:** treat Vela as a new *projection provider* plugged into the existing CFS-006a `forecastConsequences()`/`ConsequenceForecast` slot (extend the type with an optional financial-projection field or a discriminated-union `via` source; extend `executeApproved()`'s observation step similarly for MoneyPenny-originated runs). No new top-level ontology; `CONSEQUENCE-ONTOLOGY-001` becomes a design note on *how* to extend CFS-006a, not a new module.
2. **Adjacent, explicitly related:** keep a distinct `services/vela/` projection type for the TEE-specific verdict shape (evidence, confidentiality properties, WASM-specific fields that don't belong in the invariant-graph shape), but require every MoneyPenny call site to route through CFS-006a's existing stage functions as the single entry point — i.e., Vela's types are an *implementation detail* of one branch inside `forecastConsequences()`, never a parallel public API a caller could reach directly instead of the canonical pipeline.
3. **Genuinely separate (not recommended without a stated reason):** treat financial/commerce consequence projection as out of CFS-006a's scope entirely and stand up a parallel pipeline for it. This is flagged as the option most likely to reproduce the exact `inv.engineering.037` failure mode the codebase has already paid for three times (`EXPERIMENT_REGISTRY`, pack-corpus URL sniff, `ASSIGNABLE_EXPERIMENTS` — see CLAUDE.md's "Source-of-truth parity is canary-enforced" section) — listed for completeness, not as a live recommendation.

This finding, and the choice between the above (or another option the operator prefers), is being raised directly rather than assumed, per standing instruction.
