# IRL Review #001 — Instrument Remediation (Cycle 1)

**Date:** 2026-08-26
**Subject:** EXP-P1 · Crystal vP1 · the crystal readiness instrument suite
**Status:** instruments hardened; retrospective harness built; remediation profile shape defined and DELIBERATELY UNPOPULATED
**Governing rule:** the measurement layer is fixed before the corpus is touched

---

## 0. What happened, in one paragraph

An independent external reviewer reviewed the **frozen Crystal vP1** and returned
`changes_requested`. The freeze and verification machinery worked exactly as designed — the content
hash verified, the frozen projection was serveable, nothing about the ceremony failed. What failed
was the **readiness instruments**: they certified a substrate that did not possess the properties
those gates purported to establish. Three of the four gates scored classificatory labels or lexical
distance rather than statement content; the fourth had drifted below a constraint the experiment's
own protocol had frozen, with worked arithmetic, months earlier.

The operator accepted all findings and treated this as **IRL Review #001 / Remediation Cycle 1**.
This document records the cycle.

---

## 1. The four findings

Recorded as the reviewer put them, in the parts that bear on implementation.

**1 · Duplicates.** *"statements 1/3, 2/8, 5/10, and 4/7 are near-identical variants — ~11 distinct
statements, not 15. The lexical dedup threshold passed a set a human catches on first read; it needs
to be semantic, and the pairs need merging."*

**2 · Statement quality.** *"all 15 are 'X is essential for Y' generalities. None encode the
causal/conditional relationships your own orientation note defines as the standard (the hydrogen
example). Conjunctions of these entail nothing unstated — the 12 derivation tasks and the sufficiency
probe cannot be built on them. The extraction needs to produce relational invariants: propagation
mechanics, conditional dependencies, quantitative constraints."*

**3 · Size.** *"protocol §3.6 already ruled 18 insufficient with worked math; this is 15. The
readiness tool's 'slice ≥5 is meaningful' bar is criterion drift against the frozen constraint. Size
must derive from the task set per §3.6 — realistically a 20–30-statement slice, so a 50–75 crystal."*

**4 · Coverage.** *"the crystal spans 2 of 15 namespaces in the ratified boundary. Either extend
coverage or narrow the ratified boundary to what the crystal actually contains — as frozen, I can't
author tasks without either broad failure or contamination."*

**And the closing flag, which is the finding about the findings:** *"the readiness checks that passed
this crystal (dedup, derivation-headroom) scored labels and lexical distance rather than content —
worth hardening before vP2, since they're the gates everything else trusts."*

---

## 2. The operator's accepted response

> "we are adding semantic rather than primarily lexical duplicate detection; an explicit
> relational-sufficiency test for causal, conditional, propagation, constraint, threshold, trade-off
> and quantitative structure; a derivation-headroom assessment that distinguishes lexical/label
> diversity from actual inferential capacity; and restoration of the task-derived population
> requirement from §3.6."

> **"One important falsification test is that we will then run frozen vP1 unchanged through those
> strengthened instruments. They should independently reproduce the substance of your objections. If
> they don't, we have not fixed the measurement problem."**

> "We also agree that your 20–30 / 50–75 estimate is directionally useful, but we won't turn those
> numbers into arbitrary new thresholds. The executable requirement should be derived from the
> already-registered §3.6 task design."

And on scope discipline, which shaped the whole build:

> "I would distinguish between new checks and strengthening the semantics of existing checks. If
> semantic dedup replaces the weak implementation behind the already-pinned `duplicate-detection`
> check, and relational sufficiency is the proper implementation of what `derivation-headroom` was
> already claiming to assess, then that may be an implementation correction rather than a new
> check-name amendment. … My preference would be to avoid proliferating check names unless the
> concepts are genuinely independent."

**Three of the four findings therefore landed as implementation corrections behind already-pinned
check names.** Only coverage became a new name.

---

## 3. What is deliberately unchanged

| Thing | Status | Why |
|---|---|---|
| Frozen Crystal vP1 | **untouched, byte for byte** | The artifact under review is the evidence. |
| The readiness results that permitted the freeze | **untouched, not re-scored** | They are the record of what the old instruments said. Backfilling them would destroy the only proof the defect existed. |
| The 15 invariant statements | **not authored, not rewritten, not re-tagged** | Operator: *"We will not manually rewrite the 15 statements into stronger invariants. That would contaminate the experiment."* The defect is in the measurement. |
| The ratified 15-namespace boundary | **not narrowed** | Operator: narrowing *"will be surfaced as a separate governance decision rather than an implementation shortcut."* The coverage instrument REPORTS against the boundary; it never adjusts it. |
| The reviewer's illustrative figures (20–30 / 50–75) | **not encoded** | They are a reading of the constraints, not the constraints. The derivation is encoded instead. |

---

## 4. The hardened instruments

### 4.1 `duplicate-detection` — lexical ∪ semantic (finding 1)

**Mechanism: structural, not distributional.** There is no embedding model and no LLM call inside a
readiness function, and inventing a provider integration for one would have been a larger and less
auditable change than the defect warranted. Instead every statement is reduced to a
**direction-canonicalised predicate-argument form** `(determinant, relationClass, dependent)` by
matching a table of relation lexemes, and comparison happens between those FORMS.

That is what catches the failure the lexical pass structurally cannot:

```
"Liquidity is essential for market stability."          → (liquidity) --necessity--> (market stability)
"Market stability depends on adequate liquidity."       → (liquidity) --necessity--> (market stability)
```

Word-set Jaccard over that pair is near zero — the two sentences share almost no words. Both parse
to relation class `necessity`; the second's direction is inverted; after canonicalisation they
collide.

Slot comparison uses the **overlap coefficient** (`|A∩B| ÷ min(|A|,|B|)`), not Jaccard. This is
load-bearing: argument slots are short and asymmetric, and Jaccard scores `liquidity` against
`adequate liquidity` at 0.5 — below any usable bar — so every paraphrase carrying an adjective would
have escaped. The cost is a real false-positive risk on single-word slots, which is why a duplicate
requires **both** slots to clear the bar **within the same relation family**.

The gate is the **union** of the lexical and semantic passes, so nothing the old pass caught is lost,
and the report additionally carries a **distinct-statement estimate** — equivalence classes under the
union relation, computed with the same `connectedComponents` primitive the graph checks already use.
On the reviewer's fixture shape it returns **11 of 15**, and identifies exactly the four pairs.

**What it still cannot do.** It is not a formal entailment prover. It cannot see a relation carried
by a lexeme absent from the table. It cannot see a duplicate expressed in different *concept*
vocabulary ("liquidity" vs "cash availability") — slot comparison is over crudely stemmed content
words, not synonyms. Morphological folding is a suffix heuristic, not a lemmatiser, and both over-
and under-folds. A multi-clause statement is reduced around its first matched relation.

### 4.2 `derivation-headroom` — inferential capacity (finding 2)

The old gate tested `semanticType ∈ {constraint, law}` OR a logical-connective word, at a 20% floor,
while its label claimed the collection was "not only atomic assertions." It now measures §3.6(d)'s
actual requirement: invariants **whose conjunctions entail unstated conclusions**.

An **entailment chain** is a composition `A→B`, `B→C` where the middle terms overlap and the outer
terms do not — so the conclusion `A→C` is stated by neither premise. This is not a proof: it
establishes that a conjunction has somewhere to go, not that the conclusion is true or interesting.
The check gates on the derived chain demand and the derived relational fraction.

Each statement is also classified against the operator's seven relational structures — **causal,
conditional, propagation, constraint, threshold, trade-off, quantitative** — and present/absent is
reported for all seven. **No threshold on how many of the seven must be present is encoded**, because
none is derivable from any registered constraint; inventing one would repeat the defect this cycle
exists to remove.

**`bare-necessity` is the formalisation of the failure.** "X is essential for Y" asserts that Y
depends on X without saying by what mechanism, in which direction it propagates, under what condition
it triggers, or across what magnitude. It is deliberately **not** one of the seven.

**Bare-necessity transitivity is disclosed, not hidden.** "A essential for B" + "B essential for C"
*does* compose — to another bare generality. Pretending otherwise would be dishonest, so the count is
reported. It is **excluded from capacity** because the composition is type-preserving and
mechanism-free: a derivation task built on it measures a syntactic transitivity move rather than
reconstruction of structure. That exclusion is a judgment encoded in an instrument, and it is stated
in the module so a steward who disagrees can argue with it.

**The retired proxy is still computed and reported beside the real figure**, explicitly labelled
`LABEL-DIVERSITY PROXY … no longer gating`. On the reviewer's fixture shape the proxy reads **100%**
(every member is `constraint` or `law`) while inferential capacity reads **0%**. That gap, visible in
one string, *is* the defect.

### 4.3 `selection-space` — the §3.6-derived population requirement (finding 3)

Operator's ruling on the arithmetic, verbatim:

> "the §3.6 issue is settled. The implementation should derive the minimum crystal population from
> the frozen EXP-P1 collection-size guard, not from a new hard-coded target. The arithmetic should
> remain visible: **`required evaluation slice ÷ 0.40 = minimum collection size`**. So if the task
> design needs 24 usable statements, the collection floor is 60; if the final task design needs a
> larger slice, the floor rises mechanically. No new magic number."

The derivation, with each operand's source, exactly as the check prints it:

| Step | Value | Source |
|---|---|---|
| Task design (minimum) | 24 tasks = 12 recall + 12 derivation | EXP-P1 README §5.2 |
| Premise demand per task | recall ≥ 1, derivation ≥ 2 | `taskCoverage.ts::minimumPremisesForTaskKind` — reused, not restated |
| Non-degeneracy *(the one formalising step)* | each task needs its own usable grounding statement in the fixed slice ⇒ **slice ≥ 24** | README §6 *"else Arm C ≈ Arm B degenerately"* + §4's mechanical selection-neutral/sensitive set comparison |
| The frozen guard | ⊆ 40% | README §6 |
| **Minimum collection size** | **24 ÷ 0.40 = 60** | quotient |
| Entailment chains required | 12 (one per derivation task) | README §5.2 + §6(d) |
| Relationally-composable floor in slice | smallest *k* with C(*k*,2) ≥ 12 ⇒ **6** | combinatorial |
| Crystal-level capacity fraction | 6 ÷ 24 = **0.250** | the slice is domain-procedure-selected, not task-selected (README §4), so the crystal must carry the requirement in expectation |

**Cross-checked against the protocol's own worked illustration:** §6 says an 18-invariant collection
caps the slice at 7, which is *"plainly insufficient to ground 24 tasks incl. 12 derivation items."*
7 < 24, so this derivation rejects it too. Had the derivation *accepted* a slice of 7, it would have
contradicted the frozen protocol and the check says so rather than proceeding.

**vP1 at 15 members:** ⌊0.40 × 15⌋ = **6** usable statements, against a required 24 — short of the
60-member floor by 45. The retired bar of 5 would have passed it. That is the criterion drift, in one
line of arithmetic.

**Insufficient input reports `unknown`, never a default.** There is no fallback path to 5. Supplying
the retired `minMeaningfulSliceSize` parameter reports it and changes nothing.

### 4.4 `boundary-coverage` — the one new check name (finding 4)

**Tier: `scientific-readiness`** — a hard gate. The reasoning, because this was the genuine judgment
call:

Coverage was already computed and already disclosed as *"not itself a gate, but a scope fact the
operator should see."* Disclosure was not enough: at 2 of 15 declared namespaces the reviewer could
not author the task set *at all*. A crystal that cannot support task authorship **against its own
declared boundary** fails a pre-registered protocol condition (§5.1: IRL provides the domain corpus
boundary and the reviewer authors tasks against it; §5.4: every task must be answerable from the
material). That is not a maturity aspiration, which is why it does not sit beside
`structural-diversity`.

**Why the requirement is full representation and not a ratio.** No ratio threshold is derivable from
any registered constraint, and inventing one would be the `?? 5` defect again. What *is* derivable:
any boundary namespace with zero members is a region the reviewer may author into and that nothing
grounds. So the requirement is a **consistency condition between two declared things**, containing no
chosen number.

**Is it genuinely independent of `structural-diversity` and the selection logic?** Yes, and this is
the argument for giving it a name rather than folding it in:

- `structural-diversity` measures the distribution of `semanticType` *shapes* (constraint, law,
  definition, principle…). `boundary-coverage` measures which subject-matter *namespaces* are
  represented. The two are orthogonal: a crystal can be 100% `constraint` spread across all 15
  namespaces (diversity fails, coverage passes), or span six semantic types entirely within `finance`
  (diversity passes, coverage fails).
- `selection-space` is a **cardinality** question about the collection. Coverage is an
  **extensional** question about the collection *versus an external declared artifact*.
- Structurally decisive: **every other check is intrinsic to the collection. This is the only one that
  compares the collection against something declared outside it.** That is a different kind of
  measurement, and giving it the name makes the CFS-054 obligation visible instead of burying a
  governance-bearing gate inside an unrelated one.

**The remedy names corpus extension only**, and says explicitly that narrowing the declared boundary
is a separate governance decision this check will not accept as a fix — so a reader under delivery
pressure cannot mistake the shortcut for a remedy.

---

## 5. CFS-054 — the governance obligation

CFS-054 §2.5 pins **nine** check names as the ratified readiness contract. The executable contract now
emits **ten**.

**Three of the four findings require no amendment.** An implementation correction behind an
already-pinned name is not a contract change: `duplicate-detection`, `derivation-headroom` and
`selection-space` keep their names, and each now measures what its name always claimed. That is the
operator's own distinction and it is the reason the amendment surface is one name instead of four.

**`boundary-coverage` requires an amendment**, so that *"the constitutional contract matches the
executable readiness contract."* It is **drafted below for operator ratification and is NOT
self-ratified.** The contract entry carries `pinnedByCFS054: false`, and
`tests/source-of-truth-parity.test.ts` fails the build if the name ever appears in CFS-054 while that
flag still reads false — so the amendment cannot land and be forgotten in either direction.

### Draft amendment text (for operator ratification — not ratified)

> **§2.5 Readiness report passes — all ten checks [mechanical]** *(amended 2026-08-26, IRL Review
> #001 remediation cycle 1)*
>
> `runCrystalReadinessReport(...).ok === true`. The report runs **ten** checks: `selection-space`,
> `derivation-headroom`, `structural-diversity`, `duplicate-detection`, `provenance-eligibility`,
> `lifecycle-validation-integrity`, `relationship-density`, `graph-connectivity`, `orphan-detection`,
> and **`boundary-coverage`**.
>
> `boundary-coverage` is a `scientific-readiness`-tier gate: every namespace in the DECLARED domain
> boundary must be represented by at least one crystal member, so that a reviewer authoring tasks
> against the boundary (§5.1) cannot author into a region the crystal cannot ground (§5.4). Its only
> sanctioned remedy is corpus extension. **Narrowing a ratified boundary to satisfy this check is a
> separate governance decision and must be surfaced as one; it is never an implementation
> shortcut.**
>
> Three previously-pinned checks were re-implemented in the same cycle WITHOUT changing their names,
> and this specification's references to them stand unamended: `duplicate-detection` now gates on
> the union of a lexical and a semantic (predicate-argument form) pass; `derivation-headroom` now
> gates on inferential capacity — whether conjunctions entail unstated conclusions — rather than on a
> semantic-type label or a connective word; and `selection-space` now gates on a requirement DERIVED
> from the frozen §3.6 collection-size guard (`required evaluation slice ÷ 0.40 = minimum collection
> size`) rather than on an illustrative slice floor. §2.6 and §2.8's descriptions of those checks as
> heuristic and lexical are superseded by the modules' own current disclosures.

---

## 6. The retrospective falsification harness — a release gate

> "the retrospective vP1 falsification harness is load-bearing. I would make it a release gate for
> the hardened instruments. … **Do the new gates reject the exact frozen artifact that the
> independent reviewer rejected?** If live vP1 still passes, do not proceed to vP2 extraction yet.
> Fix the measurement layer first."

### ⚠ The sense is inverted

**The retrospective PASSES when the hardened instruments REJECT the frozen artifact.** A result in
which vP1 still passes readiness is a **failure of the remediation**, not a finding about the crystal.

No field on the verdict is called `ok` — deliberately. `ok: true` is read as "all good" by every
consumer, and here the good outcome is a rejection. The field is
**`reproducedReviewerObjections: boolean`**, and a canary asserts the object carries no own property
named `ok`.

### How to run it

```
GET /api/research/crystal/EXP-P1/instrument-falsification
```

Admin, or a persona with an active research-lab grant scoped to that experiment (the same admission
the sibling readiness route uses). **Strictly read-only**: no receipt, no artifact mutation, no
lifecycle transition, and no re-scoring of the historical readiness results.

From a browser console (the spine ignores cookies; the Bearer must be attached by hand):

```js
(async () => {
  const k = Object.keys(localStorage).find(k => k.includes('auth-token'));
  const parsed = JSON.parse(localStorage.getItem(k));
  const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
  const r = await fetch('/api/research/crystal/EXP-P1/instrument-falsification', {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(JSON.stringify(await r.json(), null, 2));
})();
```

### What it reports

```
{
  ok: true,                                  // the ROUTE succeeded — says nothing about the verdict
  instrumentSuite: { suiteVersion, contractFingerprint, modules },
  retrospective: {
    reproducedReviewerObjections: boolean,    // ← THE GATE
    concerns: [ { concernId, bearsOnCheck, rejected, instrumentFinding, preRemediationSignal } ],
    readinessRejectsFrozenCrystal: boolean,
    distinctStatementEstimate: number,
    crystalContentHash, verifiedAgainstFreeze,
    blockingGaps: string[],
    interpretation: string
  },
  remediationProfile: { bound, binding, bindingGaps, profile },
  frozenArtifact: { present, lifecycle, verifiedAgainstFreeze, verificationDetail }
}
```

Four concerns, each mapped to the check that measures it: `duplication` →
`duplicate-detection`; `relational-structure` → `derivation-headroom`; `population-size` →
`selection-space`; `boundary-coverage` → `boundary-coverage`. Each carries a
`preRemediationSignal` line stating what the OLD gate would have reported on the same numbers, so
the delta is legible rather than asserted.

**Hash-anchored.** The verdict is recomputed live and anchored to the freeze commitment via
`buildFrozenCrystalManifest`, which recomputes the same deterministic projection the freeze pinned
and compares. A verdict that cannot verify against the commitment is refused rather than served as
if it described the frozen set. A live recompute against a pinned commitment is a *stronger* durable
record than a stored row, which can silently go stale.

**An unassessable concern is NOT a reproduced one.** Every readiness check fails closed on an empty
domain, so the naive implementation ("all four checks failed ⇒ the instruments caught it") would let
an unreachable substrate certify the remediation. Empty domain, unreadable substrate and unverified
freeze commitment each land in `blockingGaps` and each block the gate.

### Consumer contract

Fail closed on: a non-200, `ok: false`, `retrospective === null`,
`reproducedReviewerObjections !== true`, or `remediationProfile.bound !== true`.

### What the harness does NOT contain

No reviewer prose, no reviewer name, no review number, no finding text. A review pasted into a chat
is not an artifact: it has no locator and no content hash, so it cannot be verified or re-read.
Binding a gate to it would put unverifiable content behind a decision about whether a second crystal
may be built. The harness reports **instrument-side** rejections; binding them to an actual review's
findings happens through the remediation profile's `checkMappings`, once an authoritative artifact
exists.

---

## 7. `CrystalRemediationProfile` — the shared configuration object

> "I'd also have both tracks converge on one versioned `CrystalRemediationProfile` object so the
> orchestrator never reads loose reviewer prose or infers thresholds itself. … Once that object is
> frozen, the orchestrator can safely consume it as configuration rather than interpretation."

**Location: `types/crystalRemediation.ts`** — in `types/` because two tracks read it and neither owns
it. It imports nothing.

Five members, plus a version and a binding state:

| Member | Carries |
|---|---|
| `sourceRefs: BoundSourceRef[]` | Locator + content hash of each authoritative artifact. Addresses, never inlined prose. |
| `checkMappings: RemediationCheckMapping[]` | Finding → the readiness checks that measure it, the implementing instrument, and any `gap`. |
| `populationFormula: TaskDerivedPopulationFormula` | The §3.6 derivation as a **formula** with visible `derivationLines`. `sliceFractionOfCrystal` is the only constant. |
| `boundaryRequirement: BoundaryCoverageRequirement` | The declared namespaces, the required count, `remedy: 'extend-corpus'`, and `mayNarrowBoundary: false` — permanently false, as data a consumer can read rather than a comment it can miss. |
| `instrumentSuite: InstrumentSuiteIdentity` | `suiteVersion` + `contractFingerprint` + the modules covered. |
| `retrospective` | The verdict reference, read in the same breath as the binding state. |

`binding` is **derived** from the contents by `remediationProfileBindingState()`, never stored as an
assertion, so a profile cannot claim `bound` while carrying a gap. States:
`unbound-no-artifact` → `unbound-incomplete` → `unbound-retrospective-not-reproduced` → `bound`.

**The instrument fingerprint's honest limit.** `crystalInstrumentSuiteFingerprint()` commits to the
suite's **declared contract** — check names, tiers, what each gates on, the structural vocabularies,
the population formula's shape — **not to the source bytes**. A behaviour change that leaves the
declared contract identical will not move it. That is the right trade for a configuration consumer
(it moves exactly when the thing they configure against moves) and it is not a tamper seal.
`CRYSTAL_INSTRUMENT_SUITE_VERSION` is the field to bump by hand when behaviour changes without the
contract changing.

**`BOUND_CRYSTAL_REMEDIATION_PROFILES` is EMPTY.** No authoritative review artifact with a
re-readable locator has been ingested, so every consumer fails closed — which is the correct state,
not a gap to fill.

---

## 8. Intended lineage

```
vP1 frozen → Review #001 (changes_requested) → instrument remediation →
retrospective vP1 falsification → corpus/extraction remediation → vP2 candidate →
corrected readiness → vP2 freeze → independent re-review
```

And the sequencing chain that gates automation against epistemic assurance:

```
orchestrator ready → hardened instruments ready → retrospective vP1 falsification passes →
remediation profile bound/frozen → v2 autonomous execution unlocked
```

> *"That prevents automation from outrunning epistemic assurance."*

---

## 9. The research finding, preserved as a candidate

> **Syntactic or classificatory diversity is not equivalent to inferential diversity.**

vP1 appears to demonstrate that a corpus can have multiple external sources, lexical variation and
classificatory diversity while still possessing very little reasoning-bearing structure.

Recorded as `CI-2026-08-26-CLASSIFICATORY-VS-INFERENTIAL-DIVERSITY-001` at status **`candidate`** —
not `validated`, not `ratified`. This is an **empirical claim about corpora**, and this repo's
Hypothesis-vs-Canon discipline forbids an agent promoting one into canon before its evidence exists.

**The promotion bar is recorded inside the candidate itself**, so a future agent cannot promote it on
vP1 evidence alone. Operator, verbatim:

> "I would leave 'Syntactic or classificatory diversity is not equivalent to inferential diversity'
> at candidate/validated status until we have at least **vP1 and vP2 evidence showing the distinction
> survives a materially improved substrate**. That would turn it from a good retrospective
> observation into something much more defensible."

Passing vP2 readiness is *not* sufficient. What is required is a measurement on a materially improved
substrate in which the two measures **still come apart** — establishing the distinction as a property
of corpora rather than an artifact of a weak one.

Three sibling candidates from the same resolution are engineering rules about how gates must be
built, and carry the ordinary bar:

- `CI-2026-08-26-GATE-MEASURES-WHAT-ITS-NAME-CLAIMS-001`
- `CI-2026-08-26-DERIVED-CRITERION-OVER-ILLUSTRATIVE-DEFAULT-001`
- `CI-2026-08-26-UNASSESSABLE-IS-NOT-REPRODUCED-001`

All four are `candidate`, scope `local`, `ratifiedSource: null`. Resolution record:
`RES-2026-08-26-CRYSTAL-INSTRUMENT-MEASUREMENT-LAYER-001`.

---

## 10. What the instruments still cannot measure

Stated plainly, because the pre-remediation instruments' honesty about their own limits is the only
reason this was catchable at all.

- **Semantic dedup** is structural, not distributional. A relation carried by a lexeme outside the
  table parses as unrecognised. A duplicate expressed in different concept vocabulary is not
  detected. Morphological folding is a suffix heuristic.
- **Inferential capacity** is not entailment proof. A chain establishes that a conjunction has
  somewhere to go — not that the conclusion is true, sound, or interesting.
- **The seven-structure classifier** detects asserted *form*, not correctness. A false causal claim
  classifies as causal.
- **No bar on how many of the seven must be present** is encoded, because none is derivable.
- **The population requirement** is a floor from the *registered minimum* task design until a
  finalized task set is supplied. It is not a target, and it will rise when the real design lands.
- **Boundary coverage** measures representation, not adequacy: one member in a namespace satisfies it
  while plainly not making that namespace groundable. It is a necessary condition, not a sufficient
  one.
- **The suite fingerprint** covers the declared contract, not the source bytes.
- **The graph checks** read only recorded `invariant_edges`, so a corpus with real but un-annotated
  relationships under-reports.

---

## 11. Files

**New**

- `types/crystalRemediation.ts` — the shared profile shape (committed with the orchestrator track)
- `services/research/crystalSemanticStructure.ts` — relational forms, the seven structures, semantic dedup, inferential capacity
- `services/research/crystalPopulationRequirement.ts` — the §3.6 derivation
- `services/research/crystalInstrumentSuite.ts` — the declared check contract, version and fingerprint
- `services/research/crystalInstrumentFalsification.ts` — the retrospective verdict composer
- `app/api/research/crystal/[experimentId]/instrument-falsification/route.ts` — the read-only harness route
- `tests/crystal-instrument-remediation.test.ts` — the canaries

**Changed**

- `services/research/crystalReadiness.ts` — three checks re-implemented, `boundary-coverage` added, tiers read from the contract
- `services/research/crystalStatistics.ts` — coverage read from readiness; `derivationHeadroom` now capacity, with `labelDiversityFraction` beside it
- `services/research/crystalFreezeRecommendation.ts` — `boundary-coverage` in the rationale; stale "lexical only" / "not itself a gate" caveats corrected
- `services/research/taskCoverage.ts` — `minimumPremisesForTaskKind` exported so the derivation reuses it
- `services/research/exceptionIsolation.ts` — `boundary-coverage` added to `PRE_REGISTERED_READINESS_CHECKS`, with a parity canary
- `tests/source-of-truth-parity.test.ts`, `tests/crystal-freeze-rehearsal.test.ts`, `tests/crystal-freeze-recommendation.test.ts`, `tests/crystal-freeze-ceremony.test.ts`, `tests/exception-isolation.test.ts`, `tests/prd-epi-001-crystal-readiness.test.ts` — assertions updated where the change of measurement genuinely required it
