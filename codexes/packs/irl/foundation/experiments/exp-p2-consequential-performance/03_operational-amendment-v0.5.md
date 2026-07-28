# EXP-P2 v0.5 — Operational Amendment 1

**Invariant Research Lab (IRL) · Amendment to `02_protocol-v0.5.md`**
**Status: operational amendment — accepted after adversarial review. Does NOT reopen the architecture.**
**Date: 2026-07-27**

---

## A0. Scope and standing of this amendment

The v0.5 architecture is accepted and frozen. The reviewer's disposition:

> "I accept the v0.5 architecture as the final EXP-P2 brief. No further adversarial review of the
> settled design is needed."

and the governing transition rule:

> "No more conceptual rewriting of EXP-P2. From this point onward, every change must either resolve
> a named engineering parameter, add a preregistered diagnostic decomposition such as W2.5, or
> trigger a new version and constitutional review."

This amendment therefore does exactly three things: it adds one **preregistered diagnostic
decomposition** (A1), it names **four feasibility gates** that must be resolved before or during
the pilot (A2–A5), and it records the **pre-pilot resolution requirement** for one Appendix C item
(A6). It changes no hypothesis, no contrast, no outcome, no arm of the W0–W3 ladder, no firewall
clause, and no element of the Decision and Falsification Procedure.

**`02_protocol-v0.5.md` remains the authoritative text.** This amendment does not restate it;
where a requirement of v0.5 governs, this document cites the section rather than reproducing it.
Section A7 records three observations that were found while filing and are deliberately **not**
acted upon.

---

## A1. W2.5 — Enumerated Directed Review (diagnostic decomposition cell)

### A1.1 Definition (verbatim)

> **"W2.5 — Enumerated Directed Review:** identical to W2, except that the validated conditions are
> presented in the same enumerated form used by W3. The responsible review-stage actor may consult
> the enumerated conditions but is not required to adjudicate individual conditions, attach
> evidence, produce a verification record, execute a condition-linked repair loop, or apply a
> readiness gate."

### A1.2 Diagnostic interpretation of the three contrasts

| Contrast | Diagnostic interpretation |
|---|---|
| W2.5 vs W2 | Effect of enumerated presentation alone |
| W3 vs W2.5 | Effect of mandatory adjudication, evidence, repair, readiness gating |
| W3 vs W2 | Primary confirmatory effect of the complete registered mechanism |

W2.5 exists because v0.5 §15 FW.4 declares the enumerated, adjudicable format to be a
**constitutive residual** of the registered construct, and v0.5 §17.1 states that the primary
contrast "does not isolate enumeration, evidence, repair, or gating from one another." W2.5 does
not remove that residual from the confirmatory claim; it provides a *diagnostic* estimate of how
much of the W3-versus-W2 difference the enumerated presentation alone accounts for.

### A1.3 Status constraints — all five are requirements

W2.5 must remain:

1. **Optional, but declared before the pilot.** If W2.5 is run at all, its inclusion is declared
   pre-pilot; it may not be added after any confirmatory arm result is known.
2. **Diagnostic, not confirmatory.**
3. **Excluded from the cross-domain constitutional decision** (v0.5 §41).
4. **Excluded from the primary multiplicity sequence**, unless explicitly incorporated into the
   Statistical Analysis Plan.
5. **Identical to W2 except for read-only enumeration** — no adjudication requirement, no evidence
   schema, no verification record, no condition-linked repair loop, no readiness gate.

### A1.4 Role and stage parity — a requirement, not a note

> "the same actor must receive W2.5's enumeration at the same workflow stage at which W3's
> enumerated conditions are received. If W3's enumeration is presented to a model verifier, W2.5
> cannot be presented only to the later human repairer and still function as a valid decomposition.
> **Role and stage parity must be exact.**"

This is a validity condition of the decomposition, not a recommendation. A W2.5 cell whose
enumeration reaches a different actor, or reaches the same actor at a different workflow stage than
W3's, **does not decompose the W3-versus-W2 difference** and must not be reported as though it did.
The actor identity and workflow stage at which enumeration is delivered shall be recorded and
hash-committed for both W2.5 and W3 under v0.5 §47, and any mismatch is a protocol deviation under
v0.5 §37.

### A1.5 Parameters introduced by W2.5

| Placeholder | What must be frozen |
|---|---|
| `⟦W2.5 inclusion decision⟧` | Whether W2.5 is run, declared before the pilot |
| `⟦W2.5 enumeration-delivery actor and stage⟧` | The actor and workflow stage, matched exactly to W3's |
| `⟦n_W2.5 per domain × class⟧` | Diagnostic cell size, if run |

These are additions to v0.5 Appendix C and are unresolved on the same terms as every other
placeholder: no value or procedural choice is implied by any of them.

---

## A2. Feasibility gate 1 — P2A corpus floor

v0.5 §19.1 requires confirmatory software tasks to be private, newly authored, or post-cutoff, and
permits public benchmark tasks only where contamination risk is measured and does not carry the
primary claim. This gate makes the failure mode explicit and preregisters the consequence.

**Preregister, before the pilot:**

| Placeholder | What must be frozen |
|---|---|
| `⟦n_corpus-min,P2A⟧` | Minimum viable number of uncontaminated confirmatory tasks |
| `⟦n_class-min,P2A⟧` | Minimum number per retained task class |
| `⟦n_confirmatory-lb,P2A⟧` | The confirmatory lower bound below which P2A cannot carry a confirmatory claim |

**Consequence of a shortfall.** If the floor cannot be met, the result is **either**:

- an explicitly scoped **pilot-only outcome**, **or**
- a **domain-scoped confirmatory result with reduced claims**,

decided by the frozen rule and not after inspecting results. It is **not** silent substitution of a
weaker corpus.

> "The protocol should not permit schedule pressure to justify an unrecorded return to public
> benchmark tasks."

Any use of public benchmark tasks after a shortfall is a substantive change requiring the v0.5 §48
amendment path, not a logging entry.

---

## A3. Feasibility gate 2 — P2B fabrication-anchor adjudication

v0.5 §20.5 names two anchor questions and requires the protocol to "choose which question is
confirmatory, or power both separately." This gate makes the separation **operational** rather than
conceptual, because the two questions can otherwise compete as alternative definitions of success.

The two questions, as v0.5 §20.5 states them:

1. **Raw-output prediction** — does expert assessment of the un-repaired model output predict
   physical failure?
2. **Post-repair acceptance validity** — does the repaired-to-threshold package produce an
   acceptable physical artifact?

**Preregister, before the pilot:**

| Placeholder | What must be frozen |
|---|---|
| `⟦anchor adjudicator separation⟧` | Separate adjudicators, or explicitly separated phases |
| `⟦anchor sequencing⟧` | The order in which the two questions are adjudicated |
| `⟦anchor information sets⟧` | What information is available to each adjudicator at each phase |
| `⟦anchor same-expert permission⟧` | Whether one expert may answer both questions |
| `⟦anchor disagreement resolution⟧` | How disagreement between adjudicators is resolved |
| `⟦anchor confirmatory role assignment⟧` | Which question evaluates proxy validity and which evaluates final acceptance |

> "These should not compete as alternative definitions of 'success.'"

The proxy-validity threshold `⟦θ_proxy⟧` and the fabricated sample `⟦n_fabricated per arm × class⟧`
remain as v0.5 §20.5 leaves them, including its downgrade branch: if adequate powering is not
feasible, the anchor is registered as exploratory and P2B claims are scoped as expert-proxy
outcomes.

---

## A4. Feasibility gate 3 — bidirectional W2/W3 content audit

v0.5 FW.3 requires that every substantive condition, threshold, exception and scope qualifier in W3
appear in W2, and v0.5 §14 assigns RSS-001 the within-modality equivalence audit. That audit is
stated in **one** direction. This gate requires **both**.

**Direction 1 — W3 enumeration → W2 prose.** Every enumerated condition, threshold, scope qualifier
and exception is present in the W2 prose rendering.

**Direction 2 — W2 prose → W3 enumeration.** Every substantive directive in the W2 prose maps to a
registered condition, **or is removed**.

**Unmapped material in either direction triggers correction and recertification before hash
commitment** (v0.5 §13.5, §47).

### A4.1 Reviewer instructions must distinguish three categories

Auditors shall be instructed explicitly that these are not the same finding:

| Category | Disposition |
|---|---|
| **Substantive content differences** | **Prohibited.** Trigger correction and recertification. |
| **Interpretive flexibility introduced by prose** | An acknowledged property of W2. Recorded, not corrected. |
| **Enumeration and adjudicability** | **Constitutive elements of W3** (v0.5 FW.4), not concealed confounders. Recorded, not corrected. |

Collapsing these categories is the specific failure this gate exists to prevent: an auditor who
treats prose flexibility as a content difference will corrupt W2 toward W3, and an auditor who
treats enumeration as a content difference will report the registered construct as a confound.

| Placeholder | What must be frozen |
|---|---|
| `⟦bidirectional audit sample and second-auditor rule⟧` | The preregistered audit sample and the second-auditor repetition required by v0.5 FW.3 |

---

## A5. Feasibility gate 4 — expert-hour and subsampling dependency

v0.5 §33 requires a lawful subsampling rule and forbids silent reduction of repair or fabrication
coverage. This gate binds that rule to the **domain decision rule**, so that a budget outcome
cannot silently become a scientific one.

**The pilot must estimate repair-hour consumption** (v0.5 §32 already lists this) **and bind it to
the domain decision rule** via a preregistered lower bound:

| Placeholder | What must be frozen |
|---|---|
| `⟦h_repair-lb,P2B⟧` | The expert-hour lower bound determining P2B's eligibility for the cross-domain constitutional claim |

**The frozen rule:**

> "If lawful subsampling pushes P2B below that bound: P2B automatically becomes domain-scoped or
> exploratory, according to the frozen rule. **It may not be restored to confirmatory status after
> results are inspected.**"

"Automatically" is load-bearing — the downgrade is a consequence of the frozen bound, not a
judgement made when the shortfall appears. A P2B downgraded under this rule enters v0.5 §41
aggregation as a domain that cannot supply a "Supported" row.

---

## A6. Appendix C item 19 — pre-pilot, and UNRESOLVED for a named reason

**Item 19 (programme stopping-rule decision point) is not a pilot-estimated parameter.** It is an
interpretive constitutional constraint and must be specified **before** the pilot, because it
determines what the pilot's outcomes will be allowed to mean.

The six elements requiring specification:

1. the exact P2 outcomes that activate the programme rule;
2. treatment of a double-null across P2A and P2B;
3. treatment of an adverse or harmful result;
4. whether domain-scoped support changes the programme decision;
5. the relationship between P2 findings and frozen P1/P3 findings;
6. the prohibition on relabelling null findings as support for a weaker construct.

### A6.1 Why this item is filed UNRESOLVED rather than copied

The instruction governing this item is explicit:

> "This should be copied faithfully from the existing v0.2 §38 and its v0.3 binding rather than
> reconstructed from memory."

**Those source documents are not present in this repository.** The audit finding, verified before
this amendment was written:

| Claimed source | Status in repo |
|---|---|
| EXP-P2 v0.2 | **Absent.** The v1.0 candidate's own front matter records why: *"Intermediate working drafts (v0.1/v0.2) are deliberately not republished."* |
| EXP-P2 v0.2 §38 | **Absent.** There is no `§38` anywhere in the IRL pack. |
| EXP-P2 v0.3, and its "binding" of the stopping rule | **Absent.** No v0.3 document exists. |
| Any deleted P2 draft in git history | **Never existed.** `git log --all --diff-filter=D` over P2 paths returns nothing. |
| The nearest in-repo stopping rule | v1.0 candidate §25, two sentences, containing **none** of the six elements above (`../exp-p2b-physical-consequences/01_prior-protocol-v1.0-candidate.md`). |

A reconstruction from memory would be indistinguishable from the real thing to every future reader,
which is precisely what the instruction forbids. **Item 19 therefore remains unresolved, with its
missing source named**, and is recorded as:

> **UNRESOLVED — Appendix C item 19 · pre-pilot interpretive constraint · source documents
> EXP-P2 v0.2 §38 and its v0.3 binding are NOT present in this repository. The six required
> elements must be supplied by the operator, or the v0.2 / v0.3 documents added to
> `foundation/experiments/_source/`, before the pilot. No reconstruction has been attempted.**

v0.5 §45 already carries five minimum constraints on the linkage and they stand as written; they do
not constitute the frozen decision point, which §45 itself defers ("The exact programme decision
point and relationship to P1 and P3 shall be recorded before EXP-P2 confirmation").

---

## A7. Observations recorded, not acted upon

Three discrepancies were found while filing v0.5. Per the change-control discipline (v0.5 §48) and
the transition rule in A0, they are **recorded as observations**. None has been edited away.

### A7.1 The stopping-rule elements have no source in this repository

As set out in A6.1. Reported to the operator as an item in its own right.

### A7.2 §39's historical 30% effort threshold is unsourced in-repo

v0.5 §39 states that "a prior candidate practical threshold of 30% for effort reduction is part of
the historical design record but is not silently adopted here." That handling is correct and this
amendment does not alter it. The observation is only about provenance: **no P2 document in this
repository contains a 30% effort threshold.** The single occurrence of "30%" in the experiments tree
is `⟦τ_text, candidate: 30%⟧` — RSS-001's **diagram text-token cap** (`RSS-001 §4`, VN.5), a
different quantity, in a different experiment, measuring the token budget of a diagram rather than a
reduction in expert effort. **That value must not stand in for the historical threshold** under any
circumstances, including as a starting point for re-justification.

### A7.3 Appendix A cites lineage sources that are not inspectable

v0.5 Appendix A attributes elements to v0.2, v0.3 and v0.4 sections (rows 2, 3, 4, 5, 7, 8, 9, 10,
11, 12, 13, 14, 19 among them). None of those documents is in the repository. Independently, the
W0–W3 ladder, the representation firewall, the protected-element registry and W2.5 **appear nowhere
in the repo before v0.5** — nothing precedes them.

**Appendix A is filed verbatim as given and has not been edited.** The observation is that its
lineage column is, at present, a record of provenance that cannot be verified from this repository.
It becomes verifiable the moment the v0.2/v0.3/v0.4 drafts are added to `_source/`.

---

## A8. What this amendment does not do

- It does not reopen the architecture, and no sentence of it should be read as design revision.
- It does not resolve any placeholder, including the ones it introduces.
- It does not author a pilot design, a task corpus, a sample size, or any numerical threshold —
  those are artifacts 3–5 of the sequence and require the operator.
- It does not modify `02_protocol-v0.5.md` in any respect.

## A9. Position in the five-artifact sequence

| # | Artifact | Status |
|---|---|---|
| 1 | **EXP-P2 v0.5 Operational Amendment** | **this document** |
| 2 | **Statistical Analysis Plan skeleton** | [`04_statistical-analysis-plan-skeleton.md`](04_statistical-analysis-plan-skeleton.md) |
| 3 | Pilot Design and Parameter Resolution Plan | not started — requires the operator |
| 4 | Pilot execution and sealed parameter report | not started |
| 5 | SAP and protocol freeze, then preregistration | not started |

> "The SAP skeleton should precede the pilot so the pilot collects exactly the quantities the
> decision procedure requires. Its numerical thresholds can remain visibly unresolved until the
> sealed pilot report."
