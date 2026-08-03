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

## 9. What is NOT done — per stage, precisely

The shared vocabulary is in place and every stage below can adopt it **without inventing anything**.
What each still needs, honestly:

| Stage | State | What remains |
|---|---|---|
| **2 · Review & Admit** | **Done** | — |
| **9 · Run Readiness** | **Done** (disclosure) | `excludedFromCrystal` is populated only when a caller passes `exclusions`; **no caller does yet**. The Track 2 route must thread Stage-2 exceptions + population through to `runCrystalReadinessReport`. Small, but not written. |
| **Programme state** | **Done** | — |
| **3 · Extract Candidates** | Not wired | `runConstitutionalDiscovery` returns `{ok:false}` for the whole run on any failure. Needs per-source try/catch emitting a `source`-scope exception and continuing. Genuinely a change to that function's contract — **not half-built**. |
| **4 · Review & Promote** | Not wired | `promoteCandidate` already isolates correctly per candidate (the `already-exists` path proves it); it just does not emit `IsolationException`. Adapter only. |
| **5 · Classify Provenance** | Not wired | `applyProvenanceReclassification` already refuses per invariant. Needs the queue to summarise via `summarizeIsolation` instead of its own counts. |
| **6 · Validate** | Not wired | Per-invariant already. Needs disposition mapping + cohort receipt. |
| **7 · Add Relationships** | Not wired | `addEdge` already quarantines contradictions per edge. Needs `edge`-scope exceptions surfaced. |
| **8 · Assign to Crystal** | **Partially** | `evaluateCrystalAssignment` already produces per-invariant refusals with reasons — the closest existing analogue of this model. Needs its outcomes mapped to `RecordDisposition` and a cohort-authorization receipt. **This is the highest-value next commit.** |

Also not done, and deliberately:

- **The freeze package does not yet embed `PopulationDisclosure`.** §5 requires it ("the freeze
  package must preserve those totals and exclusions"). The disclosure exists and is receipted at
  Stage 2, but `crystalFreezeCeremony` was not touched — it is a governed artifact under the
  freeze-gate rules and changing its contents is a separate, deliberate act.
- **No migration, no new table, no new `ActivityActionType`.** Cohort authorizations ride the
  existing `writeLifecycleReceipt` summary, the same named trade-off the bulk-review receipt makes.

---

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

Two **pre-existing** canaries failed against the new code and were updated with recorded reasons —
both had pinned the defective shape (the ordinal lock rule; the title heuristic's location in the
panel).

**Test results:** `exception-isolation` 20 new · `corpus-scout-admission-recommendation` 20 ·
`track2-steward-workflow` 51 (11 new) · `source-of-truth-parity` 91. Full suite unchanged from
baseline. `npm run type-check:research` — **the same 10 pre-existing errors in the same 7 files**;
zero new.

---

## 11. Files

| File | Change |
|---|---|
| `services/research/exceptionIsolation.ts` | **NEW** — the shared model: both axes, the typed exception, population disclosure, global stop, `computeFreezeBlocking`, critical path |
| `services/research/cohortAuthorization.ts` | **NEW** — cohort hash + partial-progress authorization record |
| `services/corpusScout/admissionRecommendation.ts` | disposition mapping; confidence decoupling; `titleResolutionIssue` moved in; typed exceptions |
| `services/research/track2Programme.ts` | `partially-complete`; `unblockedStageIds`; Stage 2 honest status |
| `services/research/crystalReadiness.ts` | `excludedFromCrystal` — separate disclosure, never gating |
| `app/api/corpus-scout/candidates/prepare-recommendations/route.ts` | server-computed executable batch, population, critical path |
| `components/research/Track2ProgrammePanel.tsx` | `ExecutableBatchSummary`, `ExceptionsSurface`, unblocked-stage locks, partial-completion rendering |
| `tests/exception-isolation.test.ts` | **NEW** — 20 canaries incl. the end-to-end acceptance test |
| `tests/track2-steward-workflow.test.ts` | 11 new; 2 superseded and replaced with reasons |
| `tests/corpus-scout-admission-recommendation.test.ts` | fixture + 1 superseded assertion replaced |

---

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
