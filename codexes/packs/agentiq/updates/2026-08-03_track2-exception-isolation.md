# Track 2 + crystal + experiment-prep — the exception-isolation operating model

**Status:** shipped, 2026-08-03. Shared model + Stage 2 + programme state + readiness disclosure.
Intermediate stages: model in place, wiring **not yet done** — precisely scoped in §9 below.

---

## 0. The invariant, recorded at the level the operator chose

> **"Constitutional control constrains the unsafe act; it does not immobilize the safe remainder."**

Recorded as a **constitutional-operational invariant governing workflow orchestration** — *not* as a
ratified structural or scientific claim. The operator was explicit:

> "The sentence is strong enough to become an operational invariant, but it should not yet be
> asserted as a scientific structural invariant without testing… For now, I would classify it as a
> CONSTITUTIONAL-OPERATIONAL INVARIANT governing workflow orchestration. The pipeline itself can then
> generate evidence about whether this pattern generalizes across domains and experiments."

So: whether this pattern generalises across domains and experiments is **an open empirical question
this pipeline may later produce evidence about**. It is not asserted here. This follows CLAUDE.md's
hypothesis-vs-canon discipline exactly — the same reason `inv.reasoning.329` and `333` remain
`proposed`.

The governing rule it derives from:

> "An exception blocks only the source, invariant, relationship or act to which the exception
> applies. It must not block unrelated eligible records unless the anomaly compromises the integrity
> of the whole batch."

And the diagnosis it answers:

> "The present interface is effectively making perfection the precondition for progress. That is
> neither scientifically necessary nor operationally constitutional."

---

## 1. The defect, concretely

Stage 2 confused **constitutional refusal** with **programme paralysis**. A handful of anomalous
sources made the entire admissible batch unactionable, and the operator had to find and deselect
each problem record by hand before anything could proceed.

The worst instance was one this session had itself introduced the same day. The first Stage 2
recommendation engine capped a source's **overall** confidence at `PROVISIONAL_CONFIDENCE_CAP` when
no invariant lineage traced to it — and **a source cannot have lineage until it has been admitted
and extracted**. So on the very first Track 2 batch, every source was provisional, every source was
quarantined, and the executable cohort was **zero**. The feature intended to prepare the operator's
decision had made the decision impossible.

---

## 2. Two axes, deliberately never conflated

Modelling these as one enum is what produces "the batch is blocked because a record is".

| Axis | Values | Applies to |
|---|---|---|
| **Record disposition** | `ready` · `ready-with-warning` · `exception` · `refused` | ONE record of **any** kind — source, candidate invariant, provenance record, validation outcome, edge, crystal assignment, review artifact |
| **Programme progression** | `not-started` · `in-progress` · `partially-complete` · `complete` · `blocked` | ONE stage |

> "A stage may be `partially-complete` because it contains unresolved `exception` records while still
> having processed all `ready` records."

`blocked` now means only what it says: **no valid subset can safely proceed.**

---

## 3. The typed, consequential exception

Not a warning string. Four separate `blocks*` booleans, because — the operator's words —
*"this is what stops the system from treating all amber notices alike."*

```ts
{
  scope: 'source' | 'invariant' | 'edge' | 'artifact' | 'batch',
  recordId, recordLabel, cause, causeGroup,
  disposition: 'exception' | 'refused',
  stage,
  blocksCurrentStage, blocksCrystalAssignment, blocksReadiness, blocksFreeze,
  consequence, recommendedAction, deferrableUntil,
}
```

An exception can block **nothing at all**, or block a freeze only, and the system can tell those
apart. A single `blocking: boolean` collapses exactly the distinction the record exists to carry.

---

## 4. `blocksFreeze` is DERIVED from the crystal that remains — never asserted per record

> "If the assigned crystal passes, unrelated exclusions remain disclosed limitations rather than
> blockers."

`computeFreezeBlocking(exceptions, remainingCrystal)` recomputes every exception's `blocksFreeze`
from whether the crystal that **actually remains** is failing a pre-registered readiness criterion.
An upstream stage that hardcoded `blocksFreeze: true` **cannot** make a passing crystal unfreezable —
there is a canary for exactly that.

A `source`-scope exception is never even a candidate: a source that never entered the corpus is not a
member of the crystal, so it cannot be the reason the crystal fails.

### The nine criteria — mapped honestly, nothing invented

The operator named nine by prose. All nine map onto check names `crystalReadiness.ts` **already**
emits. No criterion was invented, renamed, or dropped:

| Operator's name | Existing check |
|---|---|
| sufficient selection space | `selection-space` |
| derivational headroom | `derivation-headroom` |
| structural diversity | `structural-diversity` |
| provenance eligibility | `provenance-eligibility` |
| lifecycle integrity | `lifecycle-validation-integrity` |
| relationship density | `relationship-density` |
| graph connectivity | `graph-connectivity` |
| acceptable orphan rate | `orphan-detection` |
| duplicate control | `duplicate-detection` |

---

## 5. The population guardrail — the counterweight

> "Isolating exceptions must not allow the system to quietly reduce the corpus until readiness
> passes."

**Exception isolation without population disclosure is a worse failure than the batch-blocking it
replaces.** So the full population rides on every surface *and* every partial-progress receipt:

```
Discovered: 47 / Admitted: 32 / Excluded with warnings: 4 / Manual exceptions: 7 / Refused: 4 / Assigned to crystal: 26
```

Canaried both ways: the receipt must contain `Discovered:` and `Assigned to crystal:`, and the panel
must render `population.manualExceptions`.

---

## 6. Durable receipts for partial progress

The executable subset is **itself an authorized act**. `buildCohortAuthorization` records: which
records advanced, which were excluded and why, which warnings were accepted, the **cohort hash**, and
the **authorizing steward** (as a `personaPublicRef` commitment — the raw `personaId` is T0 and never
serialised).

The cohort hash is order-independent (`sha256` over the sorted id set), so the identity committed to
is the **set**, not the click order.

---

## 7. The provisional-placement reconciliation (a substantive interpretation, recorded)

The earlier brief required a no-lineage classification to be "routed below the normal confidence
threshold into the exception queue". This ruling requires the eligible cohort to proceed. Both are
honoured, because they were about **different numbers**:

- `domainConfidence` — the **sub-domain placement** — is still capped at `PROVISIONAL_CONFIDENCE_CAP`,
  still labelled `PROVISIONAL`, and still never presented as graph-derived.
- `confidence` — the **admission-quality** judgement — governs the disposition, and is not reduced by
  a provisional placement.

**The evidentiary basis for the split:** `ingestApprovedSource` writes the source's **own recorded
`campaignSubDomain`** to the evidence row (`services/corpusScout/ingestionBroker.ts:85`) — never the
lineage-derived placement. The lineage placement is advisory context for the steward, so admitting a
source with a provisional placement writes *exactly what it would have written anyway*. The
placement is recorded as a warning that rides into the receipt.

Two tests that asserted the old behaviour were replaced, each with a comment saying so and why. Per
**OS-9**, a green test that requires the defective shape is defending the defect.

---

## 8. Unresolved titles — §4 implemented as written

Ruling §4's operative conditions for the ready-with-warning path are: *bytes retrieved + extractable
content present + issuer/source host credible + content relevant + **artifact hash available***.

- **Content verifiable + title unresolved / metadata incomplete** → `ready-with-warning`, carrying
  the operator's verbatim text: *"Document title unresolved; source admitted on verified content,
  issuer, URL and artifact hash."*
- **No artifact hash** → stays `exception` (`unresolved-artifact-identity`). §4 makes the hash a
  *requirement* of the warning path, so a source without one cannot take it. It is quarantined, not
  refused: "never byte-verified" and "corrupted" are different findings and this signal cannot tell
  them apart.
- **Extraction below threshold** → stays `exception` (§1(c) lists "insufficient extracted content"
  explicitly).

Where the §1 aside ("a missing artifact hash / below-threshold extraction is often cohort (b)")
appeared to conflict with §4's own conditions and §1(c)'s own list, **§4's explicit conditions were
followed** and the divergence is recorded here rather than resolved by guessing.

`titleResolutionIssue` **moved** from `Track2ProgrammePanel.tsx` into
`services/corpusScout/admissionRecommendation.ts` so the server pass and the card give one answer
(inv.engineering.036). The panel keeps a one-line adapter.

**Two signals §4 names have no machine source and were NOT faked:** "content relevant" has no
recorded signal anywhere in Corpus Scout, and "issuer/source host credible" is approximated only by
the ratified Institutional Registry tier (`findRegistryEntry`), which is `undeclared` for most
issuers. Neither was invented.

---

## 9. Stage 8, the freeze schema, and Stage 3 (added 2026-08-03, second pass)

### 9.1 Stage 8 — assignment is DERIVED, not pasted

> "Stage 8 is the highest-value next commit because it turns all earlier
> classifications into an actual crystal rather than leaving the operator to paste invariant IDs."
> "Do not accept pasted invariant IDs as the primary path."

`GET /api/research/crystal/[experimentId]/assign` derives every candidate from the substrate —
each invariant carrying the **acquisition-domain** context `promoteCandidate` writes — and evaluates
it through the **same `evaluateCrystalAssignment`** the write path uses. It writes nothing.

Per invariant the surface shows the three facts the decision rests on: **evidence provenance**,
**validation count**, **intra-corpus relationship count**. The panel preselects exactly the
executable cohort, shows the server-generated rationale and cohort hash, and keeps
dry-run-then-confirm. The paste box is a **collapsed, labelled fallback** whose ids still go
through the same evaluation — it cannot admit what the derived view refused.

**An ineligible invariant is an `exception`, never `refused`.** Both per-record refusals are
recoverable and the remedy is named on the row (validate it / classify it). `refused` means a
constitutional refusal with no path forward; asserting one where a remedy exists would misreport
recoverable work as a dead end.

**The gate moved from the stage to the record.** The old rule required every earlier stage
`complete` — correct while the control was a textarea, because pasting bypassed provenance and
validation. The derived surface cannot bypass anything, so a **partially-complete** earlier stage
no longer withholds assignment of the cohort that *is* eligible.

### 9.2 The governed freeze-package amendment

> "Changing the freeze package is a governed artifact change, but it is now justified and should be
> made deliberately BEFORE the first real freeze — not deferred until after it."
> "Without this, an independently verifiable crystal hash could still conceal how much of the
> original population disappeared before freeze."

**What changed.** `FreezeCeremonyPackage` gains four fields:

| Field | What it carries |
|---|---|
| `population` | the eight-field disclosure (`discovered`, `admitted`, `candidatesExtracted`, `validated`, `assignedToCrystal`, `excludedWithWarnings`, `exceptions`, `refused`) |
| `assignedCohortHash` | commitment over the invariant ids that ARE in the crystal |
| `excludedRecordsHash` | **NEW class of guarantee** — commitment over the ids that were EXCLUDED |
| `excludedRecords` | the typed exceptions themselves, which the hash commits to |

All four sit inside `packageHash`, so they are as tamper-evident as the corpus statistics.

**Why it was authorized.** `contentHash` commits to the corpus that *survived*. A crystal of 26
drawn from 26 candidates and one drawn from 300 produce equally clean, equally verifiable hashes —
a reviewer could check the hash perfectly and never see the attrition.

**What a verifier can now check that they could not before:**

1. **How much of the population disappeared** — the eight counts, on the frozen artifact itself.
2. **That the exclusion list is the one that existed at freeze time** — `excludedRecordsHash` makes
   exclusions tamper-evident. Previously only inclusions were.
3. **That the frozen cohort is the cohort that was authorized at assignment** — both hashes use the
   same `computeCohortHash` as the cohort-authorization receipts, so the digests are directly
   comparable across stages.
4. **That two freezes over the same crystal with different exclusions are distinguishable** — they
   produce different `packageHash` values.

**The division of labour is preserved and canaried.** These fields are REPORTING, never gating:
`eligibleForRatification` is unchanged by any number of exclusions, exactly as readiness `ok` is
unchanged by `excludedFromCrystal`. Readiness assesses the actual assigned crystal; the freeze
package preserves the acquisition and exclusion history. A canary asserts eligibility is identical
with 0 and with 50 exclusions.

**Omitting the history yields `null`, never zeros** — "nothing was excluded" and "nobody told us
what was excluded" are different facts, and only one is evidence of a complete corpus.

### 9.3 Stage 3 — a real defect found and fixed

`runConstitutionalDiscovery` capped its extraction context at 24,000 chars with 6,000-char chunks —
**at most four evidence rows** — and `break`ed out of the loop, **silently dropping every remaining
row**. A 32-source corpus would be compressed from four of them and report `ok: true` with no
indication that 28 were never read. That is "safe read as finished" at Stage 3, and an operator
watching candidates appear would reasonably conclude the corpus had been extracted from.

The fix is **disclosure, not a raised budget** (the context limit is real): the loop now `continue`s
rather than breaking — so a later row that fits is still included, and inclusion no longer depends on
list order — and every dropped row becomes a typed exception naming how many of how many were read.
Nothing is blocked; the candidates that WERE extracted still advance.

**Not done, and named:** batching extraction across several passes so the whole corpus is read is
the real remedy. That changes the function's execution model (multiple LLM calls, cross-pass
deduplication) and is a deliberate separate change.

### 9.4 Stages 4–7 — the honest finding

**These stages already isolate correctly at the record level, and there is no batch operation to
fix.** `promoteCandidate`, `applyProvenanceReclassification`, the validation gate and `addEdge` each
act on ONE record, per invocation, from a UI that submits one at a time. A failure in one cannot
affect another because they are separate requests — the property the ruling requires is already
structurally true.

What they lack is not isolation but **aggregation**: none of them summarises a run through
`summarizeIsolation`, and none emits a cohort-authorization receipt, because none has a cohort. That
work becomes meaningful when (and only when) each grows a batch surface like Stage 2's and Stage 8's.

Building `summarizeIsolation` plumbing into four stages that have nothing to summarise would be
speculative — the "no over-engineering / no speculative features" rule — so it is **reported rather
than half-built**, which is what the instruction asked for.

**Also still outstanding:**

- **No caller threads Stage-2 exceptions into `runCrystalReadinessReport`.** `excludedFromCrystal`
  is populated only when a caller passes `exclusions`; the Track 2 route does not yet. Small, and
  not written.
- **The freeze route does not yet POPULATE the four new fields.** The schema accepts them and the
  builder commits to them; wiring the real counts from the pipeline into
  `runFreezeCeremonyPreview` is the next step. The fields are `null` until then — which is the
  honest state, not a silent zero.

## 9.5 Stage 3 — deterministic batched extraction (the real remedy)

> **The operator's framing, which supersedes "truncation":** *"Partial evidence was processed as
> though the full population had been processed."*

The conservative fix in §9.3 made the result HONEST. The operator's verdict was that it *"does not
solve extraction completeness"* — an honest partial is still partial. `services/invariants/batchedExtraction.ts`
is the completeness half, built to the operator's own pipeline:

```
partition full admitted population → process deterministic batches → receipt each batch
  → record failures and exclusions → reconcile all batch outputs
  → deduplicate candidates globally → report total input / processed / excluded
```

### The hard completion rule, as executable arithmetic

> Stage 3 may only become `complete` when **processed + explicitly excluded = admitted population**.
> Otherwise it stays `partially-complete`.

`extractionProgression` is the only place this is evaluated. Two properties worth stating because
they are easy to get subtly wrong:

- **Reconciling is necessary, not sufficient.** A run that reconciles but excluded rows is
  `partially-complete` — `complete` means every admitted row was *read*.
- **A broken identity can never be `complete`,** whatever else looks fine. An unaccounted row means
  the accounting itself is wrong, and a stage cannot claim to have finished a population it cannot
  count.

### Determinism, and the order-dependence bug that is not coming back

Partitioning sorts by evidence id **before** packing, so batches are a function of the SET, never of
fetch order — a re-run over the same population yields identical batches. A row that does not fit
the current batch opens a new one rather than ending the loop. That second property has its own
canary because **I caused that exact bug in this area**: the pre-fix loop `break`ed, so a small row
that would have fitted was dropped because a larger row earlier in the list did not.

### Isolation inside Stage 3

A failed batch quarantines **only its own rows**: the loop continues, its rows are recorded as an
explicit exclusion with the failure named, and every other batch's candidates stand. Treating a
failed batch as a failed run would reintroduce, inside Stage 3, precisely the paralysis the
exception-isolation ruling abolished at Stage 2 — one timeout discarding a whole population's work.

### Global dedup, after reconciliation

Two batches can independently surface the same invariant from different evidence. That is a
**convergence signal**, so the surviving candidate carries the UNION of the contributing evidence ids
and the higher confidence, rather than whichever batch happened to be first. Candidates are inserted
**once**, after dedup — inserting per batch would persist the duplicate before dedup could run.

### A second instance of the same defect, found by this work's own canary

While asserting the `unprocessable` branch, a canary failed and exposed the same shape one level
down: **a row longer than 6,000 characters is capped, while one `discovery_evidence` row holds up to
200,000** (`ingestionBroker.ts`'s chunk size). So up to **97% of a source can go unread while the
candidate derived from it cites that source as its basis**.

It is **disclosed, not fixed**. Every capped row is reported with how much was read, counts as
processed (it did contribute), and rides on the exception list. Splitting a row across batches and
reconciling partial readings of one document is a distinct mechanism; building it under cover of this
change would be the speculative build the rules forbid. **Recorded as outstanding, and as an open
question for the operator:** a processor that reads part of a record and counts the record as
processed satisfies the invariant's letter through disclosure — whether that should be permitted at
all is not an agent's call.

### The resolution loop (mandatory preflight performed)

Preflight reviewed the whole registry plus a targeted search on `extract|population|truncat|batch|bounded`.
Six existing candidates bear on this work; the closest, `CI-2026-08-03-NO-SILENT-POPULATION-SHRINK-001`,
governs a governed *artifact* passing over a shrunken population — the two new ones govern the
*processor* that shrinks it, upstream of any artifact.

| Output | Id |
|---|---|
| Resolution record | `RES-2026-08-03-STAGE3-POPULATION-COMPLETENESS-001` (trigger: `multi-cycle-repair`) |
| Candidate invariant | `CI-2026-08-03-BOUNDED-PROCESSOR-PARTIAL-COMPLETION-001` |
| Candidate invariant | `CI-2026-08-03-CAPACITY-LIMIT-BATCHES-NOT-TRUNCATES-001` |

Both are `candidate` and **not ratified** — that is the operator's act. The second carries one
occurrence and the milestone check correctly flags its `cross-capability` scope as an unearned
generality claim; the note records that `scope` is a claim about where the rule *applies*, not about
demonstrated recurrence.

## 10. Verification

**Canaries verified to FAIL before the change** (OS-9: *"a canary must be written against real
evidence, not against the assumptions of the code it guards"*). Each was checked by mutating the
production code, running, and restoring:

| # | Mutation | Canary that caught it |
|---|---|---|
| 1 | `primaryActionEnabled` also requires `counts.exceptions === 0` | headline 33→29 acceptance test |
| 2 | drop `ready-with-warning` from `EXECUTABLE_DISPOSITIONS` | executable-count + amber-is-not-refusal (3 tests) |
| 3 | `computeFreezeBlocking` ignores crystal scope | source-scope-never-blocks-freeze |
| 4 | revert panel lock to `s.ordinal > current.ordinal` | 2 tests, incl. the pre-existing one |
| 5 | Stage 2 returns `in-progress` instead of `partially-complete` | Stage-2-partial-completion |
| 6 | `PASSES_THROUGH` drops `partially-complete` | stage-after-partially-complete-is-unblocked |
| 7 | Stage 8 `blocksCrystalAssignment: true` | ineligible-does-not-block-the-cohort |
| 8 | Stage 8 GET hand-rolls eligibility instead of `evaluateCrystalAssignment` | same-eligibility-function |
| 9 | paste box shown by default | paste-is-a-fallback |
| 10 | drop the cohort preselect | panel-preselects-the-executable-cohort |
| 11 | `excludedRecordsHash` forced `null` | 2 freeze-schema tests |
| 12 | exclusions folded into `eligibleForRatification` | disclosure-never-gates |
| 13 | unsupplied history defaults to zeros | omitting-yields-null |
| 14 | restore Stage 3's silent `break` | budget-loop-continues |
| 15 | remove the `!reconciles` guard from `extractionProgression` | looks-complete-but-does-not-reconcile |
| 16 | drop the sort-by-id before packing | same-population-any-order |
| 17 | reintroduce `break` in the batch packing loop | 4 tests, incl. row-that-fits-is-never-excluded |
| 18 | dedup per batch instead of globally | union-of-evidence |
| 19 | abort the run on the first failed batch | surviving-batch-keeps-its-candidates |
| 20 | drop the `truncatedRows` disclosure | 3 row-truncation tests |

**Five pre-existing canaries** failed against the new code and were updated with recorded reasons —
each had pinned a defective shape: the ordinal lock rule; the title heuristic's location in the
panel; the provisional-source quarantine; the "every earlier stage complete" Stage 8 gate; and the
paste-primary assignment control. Per OS-9, a green test that requires the defective shape is
defending the defect.

One fixture was rebuilt from production shape after a thin stub threw inside
`composeCrystalFreezeRecommendation` on first run — the same OS-9 rule applied to a fixture rather
than an assertion.

**OS-9 caught one of my own canaries mid-flight.** Mutation 15 initially did NOT fail: the
completion canary I first wrote passed with *and* without the guard it claimed to protect, because
an adjacent condition (`processed !== totalInput`) already forced the same answer in the case it
tested. That is exactly `CI-2026-08-03-CANARY-REPRODUCES-DEFECT-001`. It was replaced with the case
where **only** the guard prevents a false `complete` — a batch reporting an evidence id outside the
admitted population, driving `processed` to `totalInput` while a genuinely admitted row goes unread.
The replacement fails when the guard is removed.

**Test results:** `exception-isolation` 20 new · `corpus-scout-admission-recommendation` 20 ·
`track2-steward-workflow` 51 (11 new) · `source-of-truth-parity` 91. Full suite unchanged from
baseline. `npm run type-check:research` — **the same 10 pre-existing errors in the same 7 files**;
zero new.

---

## 11. Files

| File | Change |
|---|---|
| `services/research/exceptionIsolation.ts` | **NEW** — the shared model: both axes, the typed exception, population disclosure (eight fields), global stop, `computeFreezeBlocking`, critical path |
| `services/research/cohortAuthorization.ts` | **NEW** — cohort hash + partial-progress authorization record |
| `services/research/crystalFreezeCeremony.ts` | **GOVERNED SCHEMA AMENDMENT** — `population`, `assignedCohortHash`, `excludedRecordsHash`, `excludedRecords` |
| `app/api/research/crystal/[experimentId]/assign/route.ts` | **NEW GET** — the derived Stage 8 assignment surface |
| `services/invariants/discoveryEngine.ts` | reverse lineage; **Stage 3 silent-drop fix** + `excludedEvidence` |
| `services/corpusScout/admissionRecommendation.ts` | disposition mapping; confidence decoupling; `titleResolutionIssue` moved in; typed exceptions |
| `services/research/track2Programme.ts` | `partially-complete`; `unblockedStageIds`; Stage 2 honest status |
| `services/research/crystalReadiness.ts` | `excludedFromCrystal` — separate disclosure, never gating |
| `app/api/corpus-scout/candidates/prepare-recommendations/route.ts` | server-computed executable batch, population, critical path |
| `components/research/Track2ProgrammePanel.tsx` | `ExecutableBatchSummary`, `ExceptionsSurface`, derived `AssignmentControl`, unblocked-stage locks |
| `tests/exception-isolation.test.ts` | **NEW** — 28 canaries incl. the extended end-to-end and the freeze schema |
| `tests/track2-steward-workflow.test.ts` | 22 new; 4 superseded and replaced with reasons |
| `tests/corpus-scout-admission-recommendation.test.ts` | fixture + 1 superseded assertion replaced |

## 12. Acceptance criteria

| # | Criterion | State |
|---|---|---|
| 1 | Three anomalous sources cannot disable admission of thirty eligible | **Met** — headline canary, mutation-verified |
| 2 | Exact duplicates isolated by duplicate group | **Met** — per-source `exact-duplicate` cause; group quarantined, batch unaffected |
| 3 | Missing titles with verifiable content become warnings | **Met** — §8 |
| 4 | Operator admits the unaffected cohort in ONE governed act | **Met** — preselected cohort → existing `bulk-review` |
| 5 | Every source still receives an individual receipt | **Met** — unchanged; `applyCandidateReviewDecision` per source |
| 6 | Exceptions remain visible and auditable | **Met** — `ExceptionsSurface` + cohort receipt |
| 7 | Downstream stages process the admitted subset immediately | **Met at the projection** (`unblockedStageIds`); **per-stage wiring outstanding** — §9 |
| 8 | Programme shows partial completion honestly | **Met** |
| 9 | Only true batch-integrity failures create a global stop | **Met** — five enumerated reasons, no open member |
| 10 | The interface always presents the next safe forward action | **Met** — `buildCriticalPath` |
