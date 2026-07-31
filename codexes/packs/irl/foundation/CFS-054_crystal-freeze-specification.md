# CFS-054 — Crystal Freeze Specification

**Chrysalis Foundation Specification · v1.0 · Status: RATIFIED as mechanism, ADVISORY as gate**
**Governs:** Crystal vP1 (PRD-EPI-001 §3.1) and every future crystal snapshot.
**Composes:** IRL-016 (Experimental Freeze & Protocol Governance) · PRD-EPI-001 §§2–3 (artifact model,
Crystal Intrinsic Readiness) · `services/research/crystalReadiness.ts` · `services/research/artifacts.ts`
(`freezeArtifact` — the actual freeze mechanism, unchanged by this document) · CFS-053 (Constitutional
Binding — the "bound to an observable event, produces an observable consequence" discipline this
specification's checklist is an instance of).

> **Scope discipline, stated once and binding throughout this document.** *Preparing* Crystal vP1 for
> freeze is engineering — readiness checks, statistics, and an advisory recommendation, all of which
> this specification's supporting code performs today. *Freezing* Crystal vP1 is a constitutional act
> — one explicit, human-issued, ratified decision, performed exactly once, by the operator, through
> `freezeArtifact()`. No code shipped alongside this specification calls `freezeArtifact` for a
> crystal-version artifact. No report, statistic, or recommendation this specification defines may
> ever write a `frozen` lifecycle state as a side effect of being computed.

---

## §1 The question this document answers

*What, mechanically, constitutes a frozen crystal?* Not "how many invariants" — the objective was
never a headcount (PRD-EPI-001 §0.5: every number in that PRD is an illustrative default, never a
precondition). The objective is to be able to say, with evidence rather than a self-attestation,
**"nothing further should be added to this crystal before this experiment runs."**

That sentence is only honest when it rests on computed checks, not on how the corpus happens to look
today. This specification is the checklist that makes it computable.

## §2 The freeze checklist

A crystal **may** be presented to the operator for ratification only when every item below is
satisfied. Items marked **[mechanical]** are computed by code named in this document; items marked
**[human]** require an explicit human act that no code performs on the operator's behalf.

```
A crystal may freeze only when:

□ domain boundary declared                       [human]   — see §2.1
□ corpus complete (external-provenance only)     [human]   — see §2.2
□ provenance validated                           [mechanical] — see §2.3
□ invariant lifecycle complete                   [mechanical] — see §2.4
□ readiness report passes (all 9 checks)         [mechanical] — see §2.5
□ duplicates resolved                            [mechanical] — see §2.6
□ slice feasibility confirmed                    [mechanical] — see §2.7
□ derivational headroom confirmed                [mechanical] — see §2.8
□ reviewer package generated                     [mechanical] — see §2.9
□ content hash generated                         [mechanical] — see §2.10
□ operator ratification recorded                 [human]   — see §2.11
```

Eleven items, not the ten in the operator's illustrative sketch — "invariant lifecycle complete" and
"provenance validated" are reported as two distinct mechanical items below because they are two
distinct checks in `crystalReadiness.ts` (`lifecycle-validation-integrity` and
`provenance-eligibility`) and folding them into one line would hide which one failed.

### §2.1 Domain boundary declared **[human]**

A crystal domain is a bounded scope, not an accumulation point. The operator (or the reviewer acting
on the operator's behalf) states, in prose, what the domain covers and — equally load-bearing — what
it explicitly does **not** cover. `FreezeCeremonyRatificationInput.domainBoundary`
(`services/research/crystalFreezeCeremony.ts`) is the field this statement lands in; the freeze-preview
API refuses to build a package without it (`buildFreezeCeremonyPackage` returns a typed refusal, never
a package with a blank boundary).

### §2.2 Corpus complete — external-provenance only **[human]**

Per PRD-EPI-001 §9 (the operator's binding scope rule): every invariant entering the crystal carries
evidence provenance `external-established` or `external-empirical` (Population A). Internal/platform
risk material is excluded from the corpus by construction — this is a sourcing decision a human makes
when acquiring and classifying source material (`services/research/experimentalPopulations.ts`'s
classification queue), not something a readiness report can retroactively confer. "Complete" here
means the operator judges the domain's external source lanes sufficiently sampled — never a fixed
count (§0.5 of PRD-EPI-001 applies verbatim).

### §2.3 Provenance validated **[mechanical]**

`runCrystalReadinessReport(...).checks.find(c => c.name === 'provenance-eligibility').passed` — every
invariant in the domain resolves to Population A (`inPrimaryPopulation`, `partitionByPopulation` in
`experimentalPopulations.ts`). An unclassified or platform-derived invariant fails this item outright;
there is no partial credit (`passed: invariantCount > 0 && eligibleCount === invariantCount`).

### §2.4 Invariant lifecycle complete **[mechanical]**

`checks.find(c => c.name === 'lifecycle-validation-integrity').passed` — every invariant carries a
real, receipted `timesValidated > 0`. No bulk-authored filler; no invariant enters the crystal by
population alone.

### §2.5 Readiness report passes — all nine checks **[mechanical]**

`runCrystalReadinessReport(...).ok === true`. As of this specification the report runs **nine** checks
(the original six from PRD-EPI-001 §3.1 plus three graph-structural checks added by this
specification's companion build — §3 below): `selection-space`, `derivation-headroom`,
`structural-diversity`, `duplicate-detection`, `provenance-eligibility`,
`lifecycle-validation-integrity`, `relationship-density`, `graph-connectivity`, `orphan-detection`.
Every check fails closed on an empty or unreachable domain (never a vacuous pass) — see
`tests/prd-epi-001-crystal-readiness.test.ts` and this build's extension of it.

### §2.6 Duplicates resolved **[mechanical]**

`checks.find(c => c.name === 'duplicate-detection').passed` — zero near-duplicate statement pairs at
the configured Jaccard threshold. Heuristic, lexical, documented as such (`findNearDuplicatePairs`'s
doc comment) — this item confirms the mechanical check passed, not that a human has certified semantic
uniqueness. `CrystalStatisticsReport.duplicateRatio` reports the same figure as a proportion for the
statistics/birth-certificate view.

### §2.7 Slice feasibility confirmed **[mechanical]**

`checks.find(c => c.name === 'selection-space').passed` — Arm C's fixed `⌊0.4 × N⌋` slice remains a
genuine, meaningful, proper subset (EXP-P1 README §3; PRD-EPI-001 §3.1). `sliceRatio` in
`CrystalStatisticsReport` reports the same fraction for the birth certificate.

### §2.8 Derivational headroom confirmed **[mechanical]**

`checks.find(c => c.name === 'derivation-headroom').passed`, together with the two graph checks this
specification adds (`relationship-density`, `graph-connectivity`) and the `orphan-detection` check.
Headroom is not just "some invariants look relational" — it is relational shape (derivation-headroom)
**and** actual recorded relationships between crystal members (relationship-density,
graph-connectivity) **and** the absence of excess unconnected statements (orphan-detection). A crystal
that passes derivation-headroom on statement text alone while its `invariant_edges` graph is empty is
not derivation-ready; §3 below is why this specification requires the graph checks explicitly.

### §2.9 Reviewer package generated **[mechanical]**

Two independent artefacts, both already built and reused here rather than forked:

- The **Independent Review** package (SPEC-IRL-REVIEW-001, `services/research/review/*`) — the
  admissibility/contamination review this session's `IndependentReviewPanel` surfaces. A crystal that
  has not been through at least one independent review round has not satisfied this item.
- The **Research Package** exporter (PRD-EPI-001 §4, `services/research/researchPackage.ts`) — the
  same exporter CFS-033 §3 names for both "publish this" and "let a reviewer verify this". Do not build
  a third exporter for crystal freeze; `researchPackage.ts` already assembles frozen artifacts for an
  experiment.

### §2.10 Content hash generated **[mechanical]**

`CrystalStatisticsReport.frozenHash` (`services/research/crystalStatistics.ts`) — a deterministic
sha256 commitment over the corpus's current content (id, statement, namespace, semanticType,
provenance, status per member, sorted by id, canonical-JSON-stable). Computing this hash has **no**
side effect: it is not itself a freeze, and recomputing it against an unchanged corpus is idempotent by
construction. It becomes the `contentHash` argument to `freezeArtifact()` at the moment the operator
actually ratifies (§2.11) — the SAME value the operator reviewed in the freeze-ceremony package, never
a value recomputed silently between preview and freeze.

### §2.11 Operator ratification recorded **[human]**

The one item this specification cannot make mechanical, and does not attempt to. Ratification is:

1. The operator (optionally with an independent reviewer, per SPEC-IRL-REVIEW-001) reviews a
   **Freeze Ceremony Package** (`services/research/crystalFreezeCeremony.ts::buildFreezeCeremonyPackage`)
   containing: crystal identifier, content hash (§2.10), date, operator reference, reviewer reference,
   corpus statistics (§4), known limitations, domain boundary (§2.1), and freeze rationale.
2. The operator calls `freezeArtifact({ id, contentHash, signedBy })` — the pre-existing mechanism in
   `services/research/artifacts.ts`, unchanged by this specification. `freezeArtifact` independently
   re-runs `checkFreezeGate` → `runCrystalReadinessReport` (§2.5's check, run again at the moment of
   freeze, not trusted from an earlier preview) and refuses if the artifact is already frozen
   (immutability, IRL-016 §4) or if `signedBy` is empty.
3. `freezeArtifact` writes a `research_lifecycle_transition` receipt (already anchorable in
   `services/dvn/activityReceiptDvnPipeline.ts`'s `ANCHORABLE_ACTION_TYPES` — no pipeline change was
   needed or made for this specification) and the artifact's `research_objects` row transitions
   `validated → frozen`.

No automated process may perform step 2 on the operator's behalf. Nothing built alongside this
specification does.

## §3 Why the checklist grew from six checks to nine

PRD-EPI-001 §3.1 named six checks. Building the Crystal Readiness Report out fully (this
specification's companion build) surfaced a gap the original six do not close: a collection can pass
`derivation-headroom` (relational-*looking* statement text) while containing **zero** recorded
relationships between its members in `invariant_edges` — a bag of independently-relational-sounding
sentences, not a graph a retrieval mechanism can actually traverse. Three checks close that gap,
computed from one shared intra-crystal edge fetch so they can never disagree with each other about
which edges exist:

| Check | What it verifies | Fails closed if |
|---|---|---|
| `relationship-density` | Standard graph density (unique undirected intra-crystal pairs ÷ possible pairs) meets a floor | density below threshold, or ≤1 invariant |
| `graph-connectivity` | The largest connected component covers enough of the collection | fragmented into many small disjoint clusters |
| `orphan-detection` | Few or no invariants carry zero relationships to any other crystal member | orphan fraction exceeds threshold |

All three are heuristic in the same documented sense as `duplicate-detection` and
`derivation-headroom` were already: they read only recorded `invariant_edges` rows, so a corpus with
real but un-annotated relationships under-reports density and connectivity — never over-reports. This
is a stated limitation (surfaced verbatim in `CrystalFreezeRecommendation.remainingRisks`), not a
silent gap.

## §4 The birth certificate — Crystal Statistics

`services/research/crystalStatistics.ts::runCrystalStatisticsReport` produces the descriptive record a
frozen crystal keeps permanently attached to it: domain, source count, document count, external
sources, invariant count, relationship count, average validation depth, standing distribution,
composition density, semantic diversity, coverage estimate (against the ratified namespace boundary),
derivation headroom, slice ratio, selection entropy, duplicate ratio, and `frozenHash`. It computes
nothing the Crystal Readiness Report has not already computed where an authoritative figure exists
(`derivationEligibleFraction`, `duplicatePairCount`, and the whole `graph` block are read from
`CrystalReadinessReport`, never re-derived) — `inv.engineering.036`'s "one authoritative location per
concern" applies to statistics exactly as it applies to code.

The word "frozen" in `frozenHash` names a property of the hash function (a deterministic content
commitment), not an act this report performs. Running the statistics report, at any time, against an
unchanged corpus, reproduces the identical hash — that is what makes it usable as the `contentHash`
argument to a LATER, separate, human-issued freeze.

## §5 The Freeze Recommendation

`services/research/crystalFreezeRecommendation.ts::composeCrystalFreezeRecommendation` derives a
`READY_FOR_FREEZE` / `NOT_READY` verdict **mechanically** from `readiness.ok` — never a separate
judgement layered on top of the checks it reports. Its rationale list restates each of the checklist's
mechanical items (§2.3–§2.8) by name, with a `☑`/`☐` a human reads at a glance, plus a
`remainingRisks` section naming every unsatisfied item and every documented heuristic limitation
(lexical duplicate/derivation detection, edge-substrate-only relationship counting, domain coverage
against the ratified namespace boundary). Every recommendation this module produces carries an
`advisoryNote` field, verbatim, stating that the recommendation is advisory and never itself a freeze.

## §6 The freeze ceremony package — mechanism, not an act

`services/research/crystalFreezeCeremony.ts::buildFreezeCeremonyPackage` is a **pure function**: no
I/O, no database write, no receipt creation, no DVN call. Given the readiness report, the statistics
report, and a ratification input (operator reference, reviewer reference, domain boundary, known
limitations, freeze rationale, and a caller-supplied timestamp — never `Date.now()` internally), it
assembles the package described in §2.11 and reports `eligibleForRatification` (mirroring
`recommendation.verdict === 'READY_FOR_FREEZE'`) so a UI can withhold a ratify affordance without this
module performing any refusal of its own — it has no action to refuse. `package.dvnAnchorRef` is
always `null`: a DVN anchor exists only after the real freeze's receipt clears the (unmodified)
DVN pipeline, which this module never invokes.

**No code shipped alongside this specification calls `freezeArtifact` for a crystal-version artifact.**
The freeze-preview API route (`app/api/research/crystal/[experimentId]/freeze-preview/route.ts`) calls
`runFreezeCeremonyPreview`, which calls `buildFreezeCeremonyPackage` — nothing past that boundary.

## §7 Front-end surface

The **Independent Review** tab (`components/composer/IndependentReviewPanel.tsx`, mounted in
`InvariantExperimentLab.tsx`'s Validation Programme section as `independent-review` — the operator's
"review tab") carries a fourth view, **Crystal vP1**, alongside New Review / Review Queue / Review
Result. It renders:

- the Crystal Readiness Report (all nine checks, pass/fail + detail),
- the Crystal Statistics birth certificate,
- the Freeze Recommendation (verdict, checkmarked rationale, remaining risks), and
- a "Preview package (no freeze)" action that calls the freeze-preview route and displays the
  resulting package read-only.

There is no freeze button anywhere in this surface. Ratifying a freeze requires the separate,
explicit, operator-issued `freezeArtifact()` call described in §2.11 — outside this UI, exactly as
this specification requires.

The `EXP-P1 Readiness` dashboard (`components/composer/ExpP1ReadinessTab.tsx`, mounted in the IRL
cartridge's Laboratory group) continues to show the Crystal *section* of the seven-section
protocol-ratified dashboard (PRD-EPI-001 §10) — a different altitude (macro artifact-freeze status
across the whole protocol) from this specification's detailed Readiness/Statistics/Recommendation
view. Both surfaces call the same underlying `runCrystalReadinessReport`; neither forks it.

## §8 Future generalisation — recorded, not built here

The operator observes that this pattern — *a constitutional object becomes authoritative only after
satisfying its completion invariants and transitioning through an irreversible freeze event* — recurs
across object classes this codebase already governs separately:

| Object | Its own freeze/completion precedent |
|---|---|
| Passport | Passport lifecycle states + issuance/revocation receipts (`passport_issued`, `passport_revoked` — already `ANCHORABLE_ACTION_TYPES`) |
| x409 agreement | The x409 authorization gate (PRD-MPY-001 §9 D5's finance invariants) |
| Experiment | `EXPERIMENT_LIFECYCLE` (`designed → protocol-ratified → running → evaluated → published → replicated`, CFS-019 §4) + IRL-016's freeze stage |
| Protocol (this doc's own subject) | `ARTIFACT_LIFECYCLE` (`draft → validated → frozen → executed → archived`, PRD-EPI-001 §2.1) |
| Crystal | This specification |
| Constitutional document / canon | CFS-009 Law XI (ratification is a human act) + the Hypothesis vs Canon discipline (proposed → canonical only on operator ratification) |
| Software release | Versioned deploys + the deploy trigger / commit-message discipline (CLAUDE.md) |

Each of these already has its own completion ladder and its own freeze/ratification act, built
independently, at different times, for different reasons. They rhyme. A single generic **Freeze
Engine** — one completion-ladder contract, one freeze-ceremony-package shape, one ratification
recorder, parameterised per object class — is a plausible future generalisation once a second or third
object class needs the SAME kind of freeze infrastructure this specification just built for crystals.

**This specification does not build that engine.** Scope here is Crystal vP1 only, per the operator's
explicit instruction. Recorded here as a forward-looking observation so a future pass can generalise
deliberately — by lifting the shared shape out of this specification's `crystalFreezeCeremony.ts` and
whatever the next object's freeze mechanism turns out to need — rather than by guessing the general
shape in advance of a second real instance.

## §9 What this specification does NOT do

- It does not freeze Crystal vP1. No test, script, or route added alongside it calls `freezeArtifact`
  for a crystal-version artifact.
- It does not change `freezeArtifact`, `checkFreezeGate`, the DVN pipeline, or
  `ANCHORABLE_ACTION_TYPES` — `research_lifecycle_transition` was already anchorable.
- It does not promote any empirical claim to `canonical`. Every invariant entering Crystal vP1 remains
  whatever status its own lifecycle already grants it (`proposed`/`validated`/`canonical` per CFS-009
  Law XI) — this specification governs corpus/readiness mechanics, not invariant ratification.
- It does not fix an invariant count, task count, or repetition count as a requirement (PRD-EPI-001
  §0.5's illustrative-numbers rule applies here without exception).

## Ratification record

- [ ] Operator ratification of this specification as the governing Crystal Freeze mechanism.
- [x] Companion build: three graph-structural checks added to `runCrystalReadinessReport` (§3).
- [x] Companion build: Crystal Statistics report (§4), Freeze Recommendation (§5), Freeze Ceremony
      package builder (§6) — all read-only/pure, none writes a frozen state.
- [x] Companion build: front-end surface in the Independent Review tab (§7).
- [ ] Crystal vP1 itself readied and, separately, ratified as frozen by the operator (§2.11) — not
      performed by this specification or its companion build.
