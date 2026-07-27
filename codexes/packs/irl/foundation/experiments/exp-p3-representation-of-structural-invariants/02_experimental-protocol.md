# EXP-P3 — Experimental Protocol

**Invariant Research Lab (IRL) · Experiment Specification**
**EXP-P3 — Representation of Structural Invariants · Experiment ID: IRL-EXP-P3**
**Version: 1.0 Candidate · Status: Protocol for External Scientific Review — pending series ratification**
**Classification: Internal (Pending External Review)**

> Document 02 of the EXP-P3 set — the constitutional protocol. It answers: *what is this
> experiment?* Detailed procedural content lives in the referenced documents: reusable
> methodology in `03_RSS-001_representation-science-standard.md` (RSS-001), the confirmatory
> decision procedure in `04_statistical-analysis-plan.md` (SAP), execution detail in
> `05_implementation-guide.md`.

## Abstract

Structural knowledge can be represented through multiple substrates, including natural language, mathematical notation, diagrams, and machine-readable structural representations. These representations are commonly treated as interchangeable provided they communicate equivalent information.

EXP-P3 investigates whether this assumption is empirically justified.

The experiment tests whether representational substrate constitutes an independent computational variable under conditions of audited informational equivalence. Structural knowledge is held constant while representational substrate is systematically varied across a preregistered set of representation families. Differences in computational performance are evaluated using representation-independent ground truth and controlled inferential procedures.

The experiment deliberately makes no claim that any existing representational substrate is privileged or native to structural invariants. Rather, it seeks to determine whether representation itself exerts measurable computational consequences.

## 1. Purpose

To determine whether representational substrate materially affects computational reasoning over structurally equivalent knowledge.

## 2. Scientific Motivation

Different representations of structural knowledge are commonly assumed to be interchangeable provided they communicate equivalent information. P3 distinguishes between:

**Informational equivalence** — Different representations contain the same audited set of atomic structural conditions.

**Computational equivalence** — Different representations enable the same level of reasoning performance, accessibility, consistency, and application.

The experiment tests whether informationally equivalent representations are computationally equivalent. (Normative definitions: RSS-001 §1; the accessibility/reasoning decomposition of computational equivalence is Section T, RSS-001 §2.)

## 3. Position Within the IRL Programme

| Experiment | Focus |
|---|---|
| EXP-P1 | Reasoning Compression |
| EXP-P2 | Consequential Performance |
| EXP-P3 | Representation |
| EXP-P4 (Reserved) | Interaction |

Each experiment is independently interpretable.

**Anti-goalpost rule** — P3 results may not retroactively alter, rescue, invalidate, or reclassify the frozen findings of P2. Likewise, P2 results may motivate P3 task design but may not predetermine P3's hypotheses, thresholds, or interpretation. P3 neither validates nor invalidates P1 or P2.

## 4. Scientific Scope

This experiment investigates representation.

It does not investigate: invariant discovery; reasoning compression; consequential decision quality; interaction between invariants; human cognition; representation learning.

Those questions belong to other experiments within the Constitutional Cybernetics programme.

## 5. Research Questions

**Primary:** Under conditions of audited informational equivalence, does representational substrate materially affect computational reasoning?

**Secondary:**
1. Does representational substrate affect accessibility independently of reasoning?
2. Do representational effects vary across different classes of reasoning task?
3. Do hybrid representations provide complementary reasoning advantages?
4. Can informational equivalence be certified independently of representational substrate?

## 6. Hypotheses

**Primary Hypothesis (H3.1)** — Representational substrate is an independent computational variable. This hypothesis is non-directional: P3 does not preregister language, mathematics, diagrams, or serialized structure as the expected winner.

**Secondary Hypotheses** —

**H3.2** — Representational effects differ by task regime. The experiment treats representation × task regime as a central scientific object, rather than assuming that one representation should dominate globally.

**H3.3** — Accessibility varies independently of downstream reasoning performance. (Representations that make relevant structural relationships explicitly recoverable are expected to exhibit lower contradiction rates and higher structural-validity accuracy than representations in which those relationships must be inferred indirectly.)

**H3.4** — Controlled hybrid representations demonstrate complementary strengths not exhibited by constituent representations alone. Hybrid success is not established merely by outperforming the average of its components; it must outperform the best corresponding single-substrate arm by a preregistered margin.

Confirmation criteria for each hypothesis are fixed in the SAP (DP.6); no confirmatory claims may be made outside that registered decision framework.

## 7. Representation Taxonomy

| Arm | Representation |
|---|---|
| L | Natural Language |
| M | Mathematical Representation |
| D | Diagrammatic Representation |
| S | Serialized Structural Representation |
| H | Controlled Hybrid Representation |

Full arm definitions, illustrative encodings, and the rationale for Arm S are in the
Implementation Guide (05 §1–§2). Arm D is governed by the Visual Representation Standard
(RSS-001 §4, Section VN). Arm H interpretation rules are in the Implementation Guide (05 §8).

## 8. Constitutional Principles

> Principle I — Representation is treated as an independent scientific variable.
> Principle II — Equivalent information shall not be assumed to produce equivalent computation.
> Principle III — Content and representation remain experimentally separable.
> Principle IV — Accessibility and reasoning constitute distinct computational properties.
> Principle V — Representation certification precedes confirmatory inference.
> Principle VI — Encoding shall remain native to each representation family.
> Principle VII — Ground truth remains independent of representation.
> Principle VIII — Claims remain proportional to evidence.

Protocols evolve. Principles don't.

## 9. Claims Discipline

The experiment may conclude: representation affects reasoning; representation affects accessibility; effects vary by task regime; hybrid representations demonstrate complementary behaviour. More precisely, P3 may support claims such as:
- representation materially affected performance under the tested systems;
- particular representations were advantageous for particular task regimes;
- explicit structural encoding improved reasoning relative to prose;
- visual rendering added or failed to add value beyond serialized structure;
- hybrid representations showed complementary or redundant effects.

P3 may not support claims that:
- one representation is universally superior;
- mathematics is the native language of invariants;
- language is inadequate;
- diagrams reveal the ontology of invariants, or are superior generally;
- structural invariants possess a native representation;
- the experiment proves that structural invariants exist;
- results apply directly to human reasoning;
- results generalize beyond tested architectures;
- P3 validates P1 or P2;
- the experiment has discovered a new representation;
- interaction or field behaviour exists.

Tier 1 (access) claims and Tier 2 (reasoning-given-access) claims remain explicitly separated
throughout analysis and reporting (RSS-001 §2; SAP DP.6).

## 10. Experimental Architecture

**Design.** Controlled representation comparison. Independent variable: representational
substrate. Dependent variables — Tier 1: accessibility; Tier 2: reasoning performance.

**Experimental principle.** The experiment attempts to satisfy the following condition: structural knowledge remains constant; representation alone varies. Any detected performance differences are therefore attributable to representation rather than informational content.

**Content certification.** All experimental materials undergo certification before use, in accordance with RSS-001: Atomic Content decomposition; Content Mapping; Assumption Back-Propagation; Canonical Assumption Closure; Informational Equivalence Audit; Back Translation; Representation Certification. Only certified materials enter confirmatory analysis (RSS-001 §§1, 3).

**Task regimes.** Performance is evaluated across multiple reasoning regimes: Spatial; Quantitative; Logical; Procedural; Contextual. Tasks are preregistered before representation-specific materials are authored (full taxonomy: 05 §3).

**Ground truth.** Ground truth remains independent of representation. Permitted mechanisms include: simulation; formal proof; engineering verification; validated reference solutions. No representation serves as ground truth for another (mechanism detail: 05 §4).

**Tiered evaluation.** Tier 1 measures representational accessibility (can the representation be reliably interpreted?); Tier 1 findings constitute legitimate scientific outcomes. Tier 2 measures reasoning performance conditional upon Tier 1 eligibility. The tier architecture, extraction gate, and eligibility rules are normative in RSS-001 §2 (Section T).

**Decision procedure.** Inferential decisions follow the preregistered hierarchical decision procedure in the SAP (Section DP), which defines: confirmatory analyses; exploratory analyses; equivalence testing; interaction testing; falsification conditions; supported null conditions; claim eligibility.

**Outcome measures.** Primary: structural-validity reasoning accuracy. Co-primary: contradiction rate. Secondary: extraction accuracy; uncertainty; omitted conditions; invented conditions; reconstruction fidelity; consistency; computational efficiency (descriptive only). Operational definitions: 05 §5.

**Internal validity controls.** The protocol incorporates: informational equivalence certification; assumption back-propagation; canonical closure; independent authorship; independent auditing; role separation; back translation; extraction validation; preregistered statistical procedures. These controls are intended to isolate representational substrate as the primary experimental variable (normative procedures: RSS-001 §§3–5).

## 11. Expected Contributions

1. Evidence regarding the computational role of representation.
2. A preregistered methodology for comparing representational substrates under audited informational equivalence.
3. Reusable methods for representation certification, assumption back-propagation, and content equivalence auditing (extracted as RSS-001).

## 12. Success Criteria

The experiment is considered successful if it produces a scientifically interpretable result, regardless of whether that result supports or rejects the primary hypothesis. Both positive findings and supported null results are regarded as meaningful contributions.

## 13. Limitations

Results apply only to: the registered representation families; the registered notation systems; the tested model architectures; the preregistered task corpus.

No broader claims are made beyond these conditions.

**Future research.** Should representational effects be demonstrated, subsequent investigations may explore: representational optimization; adaptive structural representations; interaction between structural invariants; representational dynamics. These investigations fall outside the scope of EXP-P3 and are reserved (a provisional P4 may investigate invariant interaction or field dynamics; it remains internal and must not influence reviewers' interpretation of P3).
