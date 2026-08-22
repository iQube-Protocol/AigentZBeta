# CONSEQUENCE-ONTOLOGY-001

**Status:** RESOLVED (2026-08-22, on receipt of the full VELA-001 PRD text). See "Resolution" below. Kept in place as the record of the collision this document exists to make un-ignorable, and as the compatibility contract between the two mechanisms it names.

## Resolution

The full VELA-001 PRD §8 answers the open question directly: *"Existing mature code does not require indiscriminate renaming. All new Vela, Ian, MoneyPenny commerce and consequence-aware runtime code must use this ontology."* Read together with §14's execution flow — which names *"construct public projection context"* as a step distinct from *"identify private projection requirements … prepare Vela confidential projection"* — this resolves the collision as **Option 1 (compose), specifically**:

- **`types/consequence.ts` / `services/consequence/*` (CFS-006a) are not renamed and not superseded.** They remain the canonical invariant-graph-based forecasting mechanism (`forecastConsequences()`, `ConsequenceForecast`, the `execution`/`observation` pipeline stages) and continue to serve whatever already consumes them (`services/devCommandCenter/consequenceCanvas.ts`, `services/journey/consequenceForkProjection.ts`, the intent-chain template, existing tests).
- **A new module, `types/constitutionalCommerce.ts`, carries the PRD §8 ontology** (`ConstitutionalAuthority`, `ProposedAction`, `ConsequenceProjection`, `ActionAuthorisation`, `CommerceExecution`, `ObservedConsequence`) under names that do not collide with CFS-006a's. This is the ontology "All new Vela, Ian, MoneyPenny commerce and consequence-aware runtime code" is required to use.
- **The composition point is `ConsequenceProjection` itself**, at the exact seam the PRD's own flow names: CFS-006a's `forecastConsequences()` output is the natural implementation of the **public** half of a `ConsequenceProjection` (public/contextual conditions, invariant constraints, `forcesEscalation`/`constitutionalConstraint`), and a new `VelaConfidentialProjectionProvider` (Slice 2B) supplies the **confidential** half. Slice 2E's "Unified Consequence Projection" is precisely the place these two already-distinct mechanisms combine — not a third, independent forecasting engine.
- This is a reuse decision, not a rename: `forecastConsequences()` is called *from* the new Projection Plane as its public-projection component; nothing in CFS-006a's own contract, tests, or consumers changes.

No further operator input is needed to proceed on this basis. If a future slice's design reveals this composition doesn't hold cleanly (e.g. CFS-006a's `ConsequenceForecast` shape can't represent a case the financial domain needs), that is exactly the kind of thing to re-raise rather than silently work around — but the default, and the one this workstream proceeds under, is the composition above.

## Original findings (unchanged — the record of why this needed resolving)

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

## What was decided, mapped onto the three options this document originally posed

Of the three options originally laid out below, the PRD's §8 + §14 text resolves this as **option 1 (compose)**, in the specific, narrower form stated in "Resolution" above: not a merge of the two type systems, but `types/constitutionalCommerce.ts` as the new-code ontology with `ConsequenceProjection.public` populated by CFS-006a's existing `forecastConsequences()`, and `ConsequenceProjection.confidential` populated by the new Vela provider. `ObservedConsequence` (new ontology) and CFS-006a's `observation: 'confirmed' | 'contradicted'` follow the same pattern: MoneyPenny-originated runs produce an `ObservedConsequence` record, and if/when a run also passes through `executeApproved()`, that function's own `observation` field is a CFS-006a-internal detail, not something `ObservedConsequence` needs to import or wrap.

1. **Compose** (**adopted**, in the narrow form above) — no merge of type systems, a stated composition seam at `ConsequenceProjection`.
2. **Adjacent, explicitly related** — not needed as a separate posture; the adopted form already keeps Vela's types out of CFS-006a's own contract while still naming the relationship explicitly, which was this option's actual goal.
3. **Genuinely separate** — not adopted, for the reason originally stated (the `inv.engineering.037` failure shape).

The three options are kept below as the reasoning trail, not as a still-open menu.
