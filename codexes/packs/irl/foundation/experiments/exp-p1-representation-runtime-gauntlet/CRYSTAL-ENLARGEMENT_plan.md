# EXP-P1 — Crystal vP1 Enlargement Plan (pre-freeze work item)

**metaMe IRL · EXP-P1 prerequisite · Status: PLANNED (tracked) · 2026-07-21**
**Governs:** the enlargement of `Crystal vP1` that must complete BEFORE EXP-P1 freeze.
**Constitutional frame:** IRL-016 (Experimental Freeze & Protocol Governance) §2/§5; EXP-P1 §3 (collection-size guard); `inv.reasoning.346–350`; the EXP-009 accrual discipline.

> This is the one piece of EXP-P1 that is genuine lab work, not a quick fix. It is
> charted here so it is tracked and cannot get lost, and so the sequence gate
> (IRL-016 §5) is explicit.

## 1. Objective

Grow the EXP-P1 constitutional-reasoning domain collection from its current **18
invariants** to a size **sufficient for the finalized 24-task set** (12 recall + 12
derivation), such that the fixed Arm C slice needed to ground the tasks is **≤ 40%
of `Crystal vP1`** (EXP-P1 §3) and Arm B's live selection retains discriminatory
power.

**The target size is NOT fixed a priori** (EXP-P1 §3 as corrected; `inv.reasoning.350`).
It is an implementation parameter that falls out of two constraints, resolved by the
originating team — never by the reviewer:
- the slice size the finalized task set actually requires to be groundable, and
- the ⊆40% subset guard.

(Illustratively only: at 18 invariants the guard caps the slice at 7 statements —
plainly too small to ground 24 tasks — so the collection must grow; how far follows
from the finalized tasks, not from a chosen figure.)

## 2. Method — receipted accrual, never bulk-authoring (condition a)

New invariants enter the constitutional-reasoning domain through the **normal
`proposed → validated` lifecycle with real receipted validation counts** (the EXP-009
accrual discipline). Sources, in order of preference:
1. **Discovery** — run the Invariant Discovery/Resolution path over the existing
   constitutional-reasoning corpus (the CFS/Polity reasoning material) to surface
   genuine candidate invariants, promoted `proposed` for validation.
2. **Validation** — each candidate accrues validation the honest way; Arm B's
   selection and any standing behaviour read `times_validated / standing`, so
   zero-validation filler would distort the arms asymmetrically and is forbidden.

**No invariant is authored to hit a number.** If genuine accrual cannot reach a size
that satisfies the guard at a meaningful task set, that is itself a finding about the
domain's density — reported, not papered over.

## 2a. Source scope — EVIDENCE provenance, not discovery provenance (operator ruling, 2026-07-27; refines the 2026-07-22 instruction)

**metaMe-authored / internal platform risk materials must never enter the EXP-P1
crystal.** They remain available for platform operations (the financial-services
application, Agent MoneyPenny's `inv.finance.*` derivation from the QriptoCENT
sub-corpus — `col_qriptocent_corpus`) but are excluded from this experiment's corpus
to avoid self-affinity: the crystal must be tested against structure IRL did not
author, not against its own doctrine restated.

### 2a.0 What changed, and why

The 2026-07-22 instruction was read as excluding *platform-derived invariants*. That
conflates two different facts. The operator's ruling separates them:

> "The key question is **not where the invariant was discovered, but what its
> evidentiary basis is.**"
>
> "These may have been discovered by your IDE, but they are not authored by IRL. They
> are extracted from independent sources. That means they satisfy the spirit of §2a
> because the underlying structure was not created by the platform."
>
> "That is a much cleaner scientific criterion. It distinguishes **source provenance**
> from **discovery provenance**."

**SUPERSEDED — the original 2026-07-22 rule, preserved verbatim (do not apply):**

> Every invariant entering the crystal carries a provenance tag:
>
> `external-established | external-empirical | platform-derived | platform-hypothesized`
>
> **Only `external-established` and `external-empirical` invariants are eligible for
> `Crystal vP1`.** `platform-derived` and `platform-hypothesized` invariants may inform
> platform operation but are never promoted into this experiment's collection. Where
> feasible, EXP-P1 results should be reportable both with and without any
> platform-originated invariant (an internal ablation: does the result depend on
> self-authored doctrine, or does it survive on independently-sourced structure alone?).

### 2a.1 The rule now in force

> **Invariants whose primary evidentiary basis originates within the metaProof platform
> are excluded from the primary EXP-P1 evaluation population. Invariants discovered by
> IDE from independently authored external corpora remain eligible, regardless of where
> the discovery process occurred.**

### 2a.2 Two orthogonal attributes — never conflated

Every invariant carries **two** separately readable provenance attributes. They answer
different questions and neither may be inferred from the other.

```yaml
evidence_provenance:      # WHERE DID THE EVIDENCE COME FROM (scientific independence)
  - external-established
  - external-empirical
  - platform-derived
  - platform-hypothesized
  - platform-doctrine

discovery_provenance:     # WHO DISCOVERED THE INVARIANT (discovery process)
  - ide
```

Two further questions are answered elsewhere and are likewise not folded in: **who
ratified it** (`status` / `ratifiedSource` / `canonical_basis`, under CFS-009 Law XI)
and **who represents it** (the Constitutional Representation System).

*Vocabulary reconciliation (recorded, not silent).* The ruling named four evidence
values, ending in `platform-doctrine`; the 2026-07-22 list ended in
`platform-hypothesized`. These are different classes and neither subsumes the other —
`platform-hypothesized` is a doc-only claim with no artefact evidence behind it
(PRD-IDE-002 §6), `platform-doctrine` is deliberately proprietary doctrine offered for
a different purpose. **All five are kept**, in one vocabulary
(`services/corpusScout/types.ts::ProvenanceClass`). Dropping `platform-hypothesized`
to hit a count of four would have silently relabelled every doc-only claim.

### 2a.3 The three experimental populations

| Population | Evidence provenance | Role |
|---|---|---|
| **A** — external-derived | `external-established`, `external-empirical` | **The primary EXP-P1 evaluation population.** |
| **B** — platform-derived | `platform-derived`, `platform-hypothesized` | **Ablation only.** Never in the primary. |
| **C** — platform doctrine | `platform-doctrine` (MoneyPenny / Q¢) | **A separate experimental population.** In neither A nor the ablation. |
| *(unclassified)* | *none recorded* | In **no** population. Never defaulted into one. |

Membership is **computed**, never stored — `experimentalPopulation()` /
`partitionByPopulation()` in `services/research/experimentalPopulations.ts`. A stored
population label would be a second source of truth for a fact the record's provenance
already answers, and would go stale the moment a reclassification lands
(`inv.engineering.036`). Discovery provenance is **not an input** to the partition;
`tests/evidence-provenance-populations.test.ts` asserts it cannot become one.

### 2a.4 The ablation is now a PERMANENT feature, not a "where feasible"

The original section asked for the ablation *"where feasible"*. It is no longer
conditional. **Every crystal report carries both results:**

- **P1 Core** — Population A only.
- **P1 Ablation** — Populations A ∪ B.

> "If the conclusions survive both analyses, that is scientifically stronger than
> relaxing the original rule."

`crystalReadiness` emits the A/B/C/unclassified split and both counts on every report —
structurally in `populations`, and in the `provenance-eligibility` check's detail so the
split is visible wherever the report is rendered. A reader therefore computes the
populations from the records rather than reconstructing them from prose. (The split is
deliberately **not** a check row of its own: it is a reporting obligation, and a row that
can never fail is the decorative-mechanism defect CFS-053 CB-2 names.)

### 2a.5 Current state of the corpus — Population A is EMPTY

Recorded because it is the finding this refinement exists to make visible, not a defect
in the partition. Across the **373** records in `canonical-invariants.seed.json`, **not
one cites an independently authored external source.** Every cited source is a
metaProof / IRL-authored artefact: the repo's own specifications and charters
(`CFS-*`, `CRP-*`, `IRL-*`, `PRD-*`, `SPEC-*`, `CLAUDE.md`), the Polity corpus
(`CONSTITUTION.md`, `STANDING_CHARTER.md`, `DELEGATION_FRAMEWORK.md`), the platform's
own published papers (the ES Papers, Thresholds, The Polity Embodied I–II, Polity for
Robots & Agents, the Invariant Intelligence FCR, the Chrysalis Foundation bundle), and
operator ratifications and Aletheon dialogue records. No DOI, journal, standards body or
outside author appears anywhere in the seed. The namespaces most likely to cite outside
work do not: `reasoning` traces to IRL-017, the CFS-048 charter and Aletheon sessions;
`epistemology` to Aletheon reviews and the IRL Principles; `cybernetics` to the IRL PRD;
`representation` to operator articulations of CFS-021.

**So the primary EXP-P1 evaluation population currently has zero members**, and the
eight commercialisation records do not change that — they are Population B (§2a.6).
Records that predate this vocabulary carry no evidence-provenance tag and are therefore
**`unclassified`**, not assumed `platform-derived`: assuming would be inventing
provenance, and assuming the other way would be laundering it. The partition over the
seed today is therefore **A = 0 · B = 8 · C = 0 · unclassified = 365**, and that is
asserted mechanically, not narrated — `tests/evidence-provenance-populations.test.ts`
computes it from the seed file itself and fails the build if it drifts.

### 2a.6 The eight commercialisation records are Population B

Applied honestly rather than conveniently. `PRD-IDE-002` states in four places that the
entire §9.1 library is `platform-derived`: §6 ("the in-repo corpus is platform-internal
material… §9's library is therefore a `platform-derived` candidate set"), §9's preamble
("discovered from the **in-repo corpus only**… They are `platform-derived`"), §9.4
("every candidate in §9.1 sits at `platform-derived`, and provenance caps them all…
**the single largest limitation of the initial library**"), and §12 ("No external corpus
has been acquired, and no external source is cited"). §7 is an acquisition **plan** that
has not been executed.

Under the refined criterion — *primary evidentiary basis* — the eight are Population B:
**excluded from the primary P1, routed to the ablation.** Their discovery provenance is
`ide`, and that changes nothing; "discovered by the IDE" is not evidence of
independence. This resolves the conflict PRD-IDE-002 §10.4 flagged for operator
decision, along its route 1.

### 2a.7 How a reclassification happens when the external corpus lands

Population A becomes non-empty by **corpus acquisition** (PRD-ICA-001's Corpus Scout is
built; the external lanes have not been run), not by relabelling. When §7's external
corpus re-derives a candidate from an independently authored source, that invariant's
evidence provenance changes — and the change is a **recorded event carrying its own
evidence**, never a field edit:

`applyProvenanceReclassification()` refuses a reclassification that carries no
`evidenceRefs`, no rationale, or that is a no-op; and it refuses a move **into
Population A** whose citations are all repo-internal — relabelling platform evidence as
external is laundering, not acquisition. On success it appends to an append-only
`provenanceReclassifications` log, so the prior class and the evidence that moved it
both remain readable.

The source-material lanes themselves (which external corpora, what domain boundary,
target composition across risk/actuarial/valuation/market-structure/failure-case
material) are **separately chartered** — this plan's own enlargement work is paused
pending that follow-up (see `PRD-EPI-001` §0.6/§9, the companion infrastructure PRD).
This section states only the one rule that is already decided and binding now.

*(Follow-up now chartered: `CRYSTAL-CANON_source-material-charter.md` — the collection
list, priorities, and composition target — and `PRD-ICA-001_invariant-corpus-acquisition-agent.md`
— the acquisition agent that sources it. Both DESIGN-status, ratify-before-build, and
neither changes this plan's method/sequence/exclusion rule above.)*

## 3. Composition requirements

- **In-domain (condition c).** Enlargement stays within the defined constitutional-
  reasoning domain (EXP-P1 §12 limitation). Cross-domain widening is a *successor*-
  experiment question, not a Phase-1 choice.
- **Derivation headroom (condition d).** The 12 derivation tasks need invariants
  whose **conjunctions entail unstated conclusions** — relational and conditional
  statements, not isolated atomic assertions — or the generative-sufficiency probe
  (P-IRL-3) has nothing to measure. Enlargement must deliberately add relational/
  conditional structure, not just more facts.

## 4. Sequence gate (IRL-016 §5 — sacred, condition b)

```
enlarge (receipted) → FREEZE Crystal vP1 → construct the fixed Arm C slice by the
standard domain procedure → hash the crystal snapshot AND the slice → THEN the
reviewer builds the 24 tasks → joint signature → run
```

Task construction MUST NOT precede the freeze. If it did, invariants would be
authored to fit the tasks and the affinity limitation (§12) would return through the
side door. The reviewer sees the **domain corpus boundary**, not the crystal
contents, when writing tasks (EXP-P1 §5.1). The reviewer's domain-agnostic task-
construction framework (schema, templates, answer-key format, judge rubric, sealing
procedure) can be built **in parallel now**, because it is domain-independent and
therefore sequence-safe.

## 5. Definition of done (unblocks EXP-P1 freeze)

- [ ] Constitutional-reasoning collection grown via receipted `proposed → validated`
      accrual to a size that satisfies EXP-P1 §3's ⊆40% guard for the finalized task set.
- [ ] Collection carries sufficient relational/conditional structure for the 12
      derivation tasks (condition d).
- [ ] `Crystal vP1` snapshotted + hash-committed (EXP-P1 §3.1).
- [ ] Fixed Arm C slice constructed by the standard domain procedure + hash-committed;
      slice fraction recorded in the pre-registration bundle (§10).
- [ ] Per-invariant validation counts recorded (no zero-validation filler).

Only after all five does the reviewer build tasks (§5 sequence). Until then EXP-P1
correctly presents as **`designed` / pre-freeze** (review-surface QA fix, 2026-07-21).

## 6. What this plan does NOT do

It does not set a crystal size, does not co-design with the task set, and does not
bulk-author invariants. Those would each violate a locked condition. The size, the
slice, and the tasks are produced in that order, by the right party, or the
experiment is contaminated.
