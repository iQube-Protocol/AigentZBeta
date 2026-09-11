# EXP-P2 v1.0 Candidate — Invariant-Governed Generation and Verification for Physical Design

> **STATUS BANNER — added 2026-07-27 under the operator ruling that made EXP-P2 a family.**
> This document is now **prior art for EXP-P2B (Physical Consequences)**, not the current protocol.
> Two things changed around it, and neither altered a word of its body:
> 1. **Location.** It moved with its directory: `exp-p2-invariant-governed-physical-design/README.md`
>    → `exp-p2b-physical-consequences/01_prior-protocol-v1.0-candidate.md`. External citations of the
>    old path resolve here.
> 2. **Arm structure superseded.** The ruling replaces the arms of §6 (B / C / B+R / B+R-D / D) and
>    the confirmatory contrast of §7 (D versus B+R-D) with A–E arms that separate content from
>    representation, and it makes RSS-001 certification a precondition of admissibility — which
>    changes the standing of §9's information-equivalence clause from asserted to certified.
>    The revised protocol is **PENDING OPERATOR PROTOCOL**; see
>    [`README.md`](README.md) and
>    [`../exp-p2-consequential-performance/01_shared-constitutional-framework.md`](../exp-p2-consequential-performance/01_shared-constitutional-framework.md).
>
> Everything below is the document as ratified-candidate-submitted, unedited. Do not cite §6, §7 or
> §9 as the current design; do cite this document for the review history, the failure-taxonomy and
> invariant-set governance provisions, and the claims discipline of §28.

**Invariant Research Lab (IRL) · Validation Programme series (P1 / P2 / P3)**
**Status: v1.0 Candidate — superseded in arm structure by the ruling of 2026-07-27; see the banner above**
**Classification: Confirmatory Experimental Protocol · Candidate for External Ratification**
**Provenance:** assembled verbatim from the operator-supplied consolidated protocol staged at
`foundation/experiments/_source/2026-07-26_exp-p2-v1.0-candidate_source.md` (2026-07-26). Intermediate
working drafts (v0.1/v0.2) are deliberately not republished; §29 records the review history.

## Designation note — read before citing "EXP-P2"

The designation **EXP-P2** was previously used for a different design: the Structural Invariance
battery chartered at `foundation/experiments/exp-p2-structural-invariance/` (the "Layer 1 vs Layer 2 /
medicine-style" companion experiment named by EXP-P1 §14). This document is a **different experiment**
— invariant-governed generation and verification for physical design — staged as the P2 slot of the
P1/P2/P3 series ratification packet (`foundation/experiments/SERIES-RATIFICATION_p1-p2-p3.md`).
**The designation conflict is unresolved and is flagged for operator decision in the ratification
packet.** Neither directory supersedes the other until the operator rules; do not cite either as "the"
EXP-P2 without qualifying which design is meant.

## Review provenance (front matter)

This protocol has undergone multiple independent adversarial reviews — an external scientific
reviewer and two independent AI reviewers — and incorporates their accepted recommendations
(enumerated in §29). The previous review rounds converged on protocol hygiene rather than fundamental
architectural flaws. Per the review guidance recorded in the staging source, this consolidated
candidate — not the intermediate versions — is the document submitted for ratification, and the
review history itself is presented as evidence of the discipline applied to the protocol.

---

## EXP-P2 v1.0 Candidate
## Invariant-Governed Generation and Verification for Physical Design

Invariant Research Lab (IRL)
Status: Candidate for External Ratification
Classification: Confirmatory Experimental Protocol

### 1. Purpose

This experiment evaluates whether an invariant-governed generation and verification workflow reduces the expert effort required to transform AI-generated physical designs into prototype-ready artifacts.

The protocol deliberately evaluates an operational projection of invariant-governed reasoning rather than attempting to validate the complete constitutional invariant framework.

### 2. Research Question

Does an invariant-governed generation, verification and readiness-gating workflow reduce expert effort to prototype-ready acceptance compared with equivalent conventional generation and review workflows?

### 3. Scientific Position

P2 evaluates one operational mechanism within the wider IRL programme.

It does not claim to establish:
- completeness of invariant theory;
- completeness of the invariant corpus;
- validity of the Discovery Engine;
- validity of the constitutional runtime.

Those remain independent research programmes.

P2 evaluates only the operational effectiveness of invariant-guided reasoning when projected into a physical design workflow.

### 4. Primary Hypothesis

Invariant-guided generation combined with formalized verification and readiness gating will materially reduce expert effort required to reach prototype-ready acceptance without increasing structural failures or false readiness.

### 5. Secondary Questions

The experiment also investigates:
- representation effects;
- verification effects;
- repair locality;
- discovery versus correction effort;
- structural modification burden;
- verification accuracy;
- invariant coverage limitations.

### 6. Experimental Arms

**Arm B** — Content-matched prose generation. No review.

**Arm C** — Invariant projection generation. No review.

**Arm B+R** — Content-matched prose. Generic review.

**Arm B+R-D** — Content-matched prose. Directed review using the identical structural requirements expressed as engineering prose. No invariant identifiers. No formal verification objects. No readiness gate.

**Arm D** — Invariant projection generation. Formal verification. Machine-readable verification record. Pass / Fail / Unresolved states. Explicit readiness gate.

### 7. Confirmatory Contrast

Primary: **D versus B+R-D**

This isolates the incremental contribution of formalized verification and readiness gating beyond equivalent directed review.

### 8. Secondary Contrasts

- B+R-D versus B+R (directed review)
- C versus B (representation)
- D versus C (verification)

### 9. Information Equivalence

Independent auditors shall verify:

**Generation equivalence** — B and C contain identical substantive engineering information. Only representation differs. Hash committed.

**Review equivalence** — B+R-D and D contain identical substantive review requirements. Only representation and readiness mechanism differ. Hash committed.

### 10. Primary Outcome

Expert effort to prototype-ready threshold.

Measured as:
- discovery effort;
- correction effort;
- verification effort;
- total effort.

Total effort is the confirmatory endpoint.

### 11. Co-primary Objective Measure

Structural modification count. Derived from normalized engineering diffs.

Discordance rule: A reduction in expert effort accompanied by increased structural modification burden shall not constitute full confirmation without separate explanation.

### 12. Secondary Measures

Repair locality. Critical failures. False readiness. Simulation success. Verification precision. Verification recall. Out-of-set failures. Repair sequence. Repair iterations.

### 13. Process Logging

Record: every invariant evaluated; every failed verification; every repair; repair category; repair duration; verification outcome; expert rationale; tool usage.

### 14. Repair Locality

Repairs categorized as: Mechanical, Dimensional, Material, Assembly, Electrical, Safety, Other. Exploratory only.

### 15. Verification Architecture

Frozen before preregistration.

Specify: verifier implementation; tool access; compute allocation; verification schema; pass/fail criteria; false-pass handling; false-fail handling.

Verification precision and recall become registered outcomes.

### 16. Tool Parity

Tool availability shall be matched across D and B+R-D unless explicitly declared as an experimental variable. Any asymmetry must be preregistered.

### 17. Blinding

Repair engineers cannot be blinded.

Mitigations: counterbalanced assignments; multiple repairers on reliability subsample; repair engineer treated as random effect.

Threshold adjudicators remain blinded. Artifact scoring remains blinded.

### 18. Failure Taxonomy

Independent master taxonomy. Prepared before generation. Hash committed.

Defines: known failures; novel failures; out-of-set failures; false readiness.

No modification after experiment begins.

### 19. Invariant Set Governance

Invariant set frozen before generation. Independent challenge review conducted before freeze. Candidate omissions documented. Out-of-set failures recorded only. No additions during execution.

### 20. Physical Validation

Stratified sampling across arms. Scripted completion protocol. Physical validation criteria preregistered.

If powered validation is infeasible, physical validation is explicitly exploratory.

### 21. Model Selection

Model list preregistered. Report per-model results. Power analysis based on the selected model set.

### 22. Statistical Plan

Primary confirmatory endpoint: Total expert effort.

Supporting analyses: Discovery effort. Correction effort. Verification effort. Structural modification count.

Secondary metrics treated as exploratory unless explicitly preregistered.

### 23. Success Criteria

Material reduction in total expert effort. No increase in structural failures. No increase in false readiness. Equivalent or improved physical validity.

### 24. Falsification Criteria

The primary hypothesis shall be considered unsupported if:
- D does not materially outperform B+R-D on the confirmatory endpoint.
- Improvements are fully attributable to unmatched review content, unequal tooling, or repairer expectancy.
- False readiness increases materially.
- Structural modification burden increases without compensating benefit.
- Physical validation contradicts expert acceptance beyond the preregistered tolerance.

### 25. Stopping Rule

Interpretation shall be based solely on P2 outcomes. Future experiments may extend findings but cannot rescue unsupported hypotheses.

### 26. Discovery Engine Governance

Out-of-set failures are classified before confirmatory analysis is locked. Only after all analyses are finalized may those failures be transferred to the Invariant Discovery Engine. Discovery Engine personnel shall not participate in confirmatory failure classification.

### 27. Constitutional Integrity

Independent role separation. Hash commitments. Frozen protocol. Frozen invariant set. Frozen failure taxonomy. Immutable audit trail.

### 28. Claims Discipline

Positive results support only: the evaluated invariant-guided generation, verification and readiness-gating workflow.

They shall not be presented as validation of: the complete invariant framework; the Discovery Engine; constitutional computing as a whole.

### 29. Review History

This protocol incorporates successive adversarial reviews from independent reviewers.

Accepted revisions include:
- decomposition of expert effort;
- directed-prose control arm;
- review-content equivalence auditing;
- failure-taxonomy preregistration;
- verifier freezing;
- tool parity;
- explicit blinding limitations;
- strengthened falsification criteria;
- Discovery Engine governance;
- claims discipline.

### 30. Ratification

This protocol is submitted for independent ratification.

Requested reviewers:
- Austin's scientific review agent (scientific validity and falsifiability).
- Claude (protocol consistency, implementation feasibility, and constitutional alignment).

Following successful ratification, this document becomes the canonical EXP-P2 protocol within the Invariant Research Lab and serves as the preregistered reference for execution.

---

## The ratification question (verbatim — the question put to reviewers)

Per the closing review guidance recorded in the staging source, reviewers receive only this
consolidated candidate — not the intermediate versions — and are asked one narrow question:

> "Would you ratify this protocol for execution? If not, identify only those issues that would prevent preregistration or materially invalidate the experiment."

This reframes the review from designing the experiment to certifying it — the appropriate posture,
given the protocol's evolution, before adding it to the IRL canon.

---

## Epistemic status

The primary hypothesis (§4) is an empirical hypothesis under test. Per the IRL Hypothesis vs Canon
discipline, it enters and remains `proposed` until the experiment produces supporting evidence;
nothing in this protocol is to be cited as an established result. §28's claims discipline governs
every downstream statement about P2 outcomes.
