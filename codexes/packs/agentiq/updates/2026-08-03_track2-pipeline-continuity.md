# Track 2 — every stage declares the population it is reasoning about

**Date:** 2026-08-03
**Capability:** Track 2 — corpus acquisition → frozen crystal (the eleven-stage programme projection)
**Resolution record:** `RES-2026-08-03-TRACK2-PIPELINE-CONTINUITY-001`
**Candidate invariant:** `CI-2026-08-03-PIPELINE-CONTINUITY-001` (family: constitutional · status: **candidate**)
**Canary:** `tests/pipeline-continuity.test.ts`

---

## 1. What the operator saw

One screen — Laboratory → Experiments → Track 2 Programme → Experiment Pipeline:

| Stage | Reported |
|---|---|
| 2 · Review & Admit | 2 admitted · 33 awaiting review — scope `financial-services` |
| 3 · Extract Candidates | 17 candidate(s) extracted |
| 4 · Review & Promote | 17 promoted · 0 awaiting review |
| 5 · Classify Provenance | **68** promoted invariant(s) carry no recorded evidence provenance |
| 5 · Classify Provenance | "Domain **`financial-risk-value-systems`** holds no invariants, so this check has nothing to assess" |

Three numbers — 17, 68, zero — and two domain names, on one stage. The operator's
diagnosis, verbatim:

> This is a state-model defect, not a UI wording issue. Stage 2, Stage 3 and Stage 4 are
> operating over the current experimental crystal. Stage 5 appears to have reverted to
> querying the ratified domain registry instead of the crystal it inherited. Those are
> different populations. Consequently the UI simultaneously reports: 17 promoted
> invariants exist; there are no invariants to classify. **Both cannot be true.**

---

## 2. The audit — stage → declared population → actual query

Every number on that screen was correct about the set it was computed over. That was the
problem: no stage said which set.

| # | Stage | Population it works over | What it actually read (pre-fix) | Substituted? |
|---|---|---|---|---|
| 1 | Discover Sources | admitted corpus | `corpus_candidate_sources WHERE campaign_domain='financial-services'` | no |
| 2 | Review & Admit | admitted corpus | same, partitioned by review status | no |
| 3 | Extract Candidates | admitted corpus → **current crystal** | `discovery_candidates WHERE domain='financial-services' AND sub_domain IS NULL` | no (declared transform) |
| 4 | Review & Promote | current crystal | same rows, `status='promoted'` → **17** | no |
| 5 | Classify Provenance | current crystal | `listInvariants({domain:'financial-services', limit:500})` → **68** | **YES — ratified corpus** |
| 5 | *(remedy channel)* | current crystal | `readiness` over `financial-risk-value-systems` → **0** | **YES — assigned crystal** |
| 6 | Validate | current crystal | `readiness.invariantCount` over the crystal domain | **YES — assigned crystal** |
| 7 | Add Relationships | current crystal | `readiness.graph` over the crystal domain | **YES — assigned crystal** |
| 8 | Assign to Crystal | current crystal → **assigned crystal** | `invariant_contexts WHERE domain=<crystalDomain>` | no (declared transform) |
| 9 | Run Readiness | assigned crystal | `runCrystalReadinessReport` over the crystal domain | no |
| 10 | Prepare Independent Review | assigned crystal | `crystalReviewStageStatus` | no |
| 11 | Freeze | assigned crystal | the persisted crystal-version artifact | no |

**The substitution is at stages 5, 6 and 7 — the whole span between promotion and
assignment.** Two distinct routes into the same defect:

- **The count channel.** `listInvariants({ domain })` filters `invariant_contexts` — the
  standing domain registry, all-time, every sub-domain, capped at 500. `listCandidates`
  filters `discovery_candidates` to `sub_domain IS NULL` — this run's domain-baseline
  cohort. 68 and 17 were both true.
- **The remedy channel.** `CHECKS_BY_STAGE` hung readiness checks computed over the
  **assigned** crystal onto three **current**-crystal stages, so the empty-domain notice
  about `financial-risk-value-systems` rendered on a stage holding 17. A stage can be
  handed a foreign population by any channel that carries prose, not only by arithmetic.

Stages 6 and 7 are the same defect made invisible by plausibility: validation and
relationships happen *before* assignment, so measuring the assigned crystal there reads as
"not started" rather than as a fault.

---

## 3. The fix

**The population is now a required, typed declaration on every stage** — it cannot be
implied.

```ts
type DeclaredPopulation =
  | 'admitted-corpus' | 'current-crystal' | 'assigned-crystal'
  | 'ratified-corpus' | 'excluded-records';

interface PopulationDeclaration {
  consumes: DeclaredPopulation;   // must equal the previous stage's `produces`
  produces: DeclaredPopulation;   // differs only at a DECLARED transform
  source: string;                 // the substrate actually read — checkable, not believed
}
```

Lives in `services/research/exceptionIsolation.ts`, beside `PopulationDisclosure` and
`ProgrammeProgression`, so the pipeline has one population model rather than two.
`ratified-corpus` is deliberately in the vocabulary: it is a legitimate population to read
and was never a legitimate silent *substitute*, and keeping it named is what makes the
defect describable.

**Stages 5–7 now inherit Stage 4's output.** The cohort is resolved by following
`discovery_candidates.promoted_invariant_id` — the link `promoteCandidate` already writes —
from the same `candidates` array Stage 4 is counted from. A promotion with no recorded
invariant id, or an id that does not resolve, becomes an **explicit exclusion carrying its
reason**, never a silent shortfall.

**The arithmetic is enforced, not asserted:**

```
received + explicitly excluded === Stage 4's declared output
```

Same identity as `batchedExtraction`'s `processed + excluded === admitted population`, one
level up: there it holds *within* a stage, here *between* two. A handover that does not
reconcile **blocks** stages 5–7 and leads `nextActions`, so the operator meets the
discontinuity itself rather than its symptom ("there are no invariants to classify").

Readiness remedies moved to `run-readiness`, the only stage declaring `assigned-crystal`.
Nothing was lost — the orphan-detection remedy is still carried verbatim, and a canary pins
it to the stage whose subject it describes.

---

## 4. The canary, and proof it fails against the defect

`tests/pipeline-continuity.test.ts` — 19 assertions. With the fix stashed, **all 19 go
red**. The load-bearing one:

```
× blocks Stages 5–7 rather than letting them report a foreign population
  → classify-provenance must refuse a population it cannot account for:
    expected 'in-progress' to be 'blocked'
```

The pre-fix programme, fed a 68-record cohort against a declared 17, renders it as a count
without complaint. It covers: every stage declares a population and a substrate; adjacent
stages are continuous; the population changes at exactly two declared transforms and
nowhere else; the route resolves the cohort from Stage 4's output rather than by domain
query (asserted against the route source, comments stripped); `received + excluded ===
declaredOut`; Stage 5 reporting nothing to do while Stage 4 reports > 0 is impossible
across `[1, 2, 5, 17, 68, 500]`; and the observed screen reproduced and refused.

---

## 5. The candidate invariant

Operator-named, verbatim:

> **Pipeline continuity invariant:** Every stage consumes the declared output population of
> the previous stage. A stage may narrow that population only through explicit, receipted
> exclusions. It may never silently substitute a different population.

Recorded as `CI-2026-08-03-PIPELINE-CONTINUITY-001`, **family `constitutional`** on the
operator's reading that it "guarantees every constitutional decision remains traceable
through the computation, because each stage is operating on the same declared
constitutional subject."

**Status stays `candidate`, `ratifiedSource` stays null.** Naming an invariant is not
ratifying it; raising a candidate above `validated` requires a named operator act.
**Scope stays `local`** against the operator's own instinct about its reach: all three
occurrences are stages of one capability found in one pass — one defect discovered once,
not a shape that recurred across capabilities. The second capability that meets this shape
is what earns the upgrade.

**Where it sits relative to the Constitutional Execution Principles.** It is not a seventh
sibling — it is upstream of all six. Each of those governs how an *act* behaves; this one
governs whether successive acts are about the *same subject*. An exception correctly
isolated in a population that was silently swapped is a correct decision about the wrong
thing. Its nearest kin, `NO-SILENT-POPULATION-SHRINK-001` and
`FREEZE-POPULATION-DISCLOSURE-001`, protect a population **at rest** inside one governed
artifact; neither compares two stages, so neither could have detected 17 handed on and 68
received. This one protects the population **in motion**.

---

## 6. Files

| File | Change |
|---|---|
| `services/research/exceptionIsolation.ts` | `DeclaredPopulation`, `PopulationDeclaration`, `checkPopulationContinuity`, `PopulationHandover`, `handoverReconciles`, `handoverBreach`, `renderHandover` |
| `services/research/track2Programme.ts` | required `population` per stage; `PromotedCohort` signal; shared cohort gate for stages 5–7; `populationContinuity` on the payload; `CHECKS_BY_STAGE` narrowed to assigned-crystal stages |
| `app/api/research/track2/[experimentId]/route.ts` | `resolvePromotedCohort` — follows `promoted_invariant_id`; `listInvariants({domain})` removed |
| `components/research/Track2ProgrammePanel.tsx` | per-stage population line; rose discontinuity banner above the stage list |
| `tests/pipeline-continuity.test.ts` | the canary (new) |
| `tests/crystal-freeze-rehearsal.test.ts` | fixture hands on exactly what Stage 4 declares; orphan remedy pinned to `run-readiness` |
| `tests/track2-steward-workflow.test.ts` | source-slice window ends at the next stage rather than a byte budget |
