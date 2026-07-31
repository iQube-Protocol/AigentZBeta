# SOURCE MATERIAL — EXP-P3 Briefs (operator-supplied, 2026-07-26)

> Provenance file. Verbatim operator-supplied material: the review-hardened v0.2 brief
> (the substantive design body) and the v1.0 Candidate external brief. Do not edit;
> derive from it.

---

# PART A — EXP-P3 Experimental Brief v0.2
Representation of Structural Invariants
Invariant Research Lab
Status: Revised experimental brief
Purpose: Second-round adversarial red-team / blue-team review
Maturity: Conceptual experimental design, prior to full protocol and preregistration

## 1. Purpose

EXP-P3 investigates whether the representational substrate used to encode structural invariants materially affects how effectively those invariants can be interpreted, reasoned over, and applied by current computational systems.

The experiment does not attempt to determine the final or native representation of an invariant.

It asks a narrower and prior question:

Is representational substrate itself a consequential variable in invariant-guided reasoning?

If no consequential difference is found, there may be little empirical basis for a programme seeking novel invariant representations.

If consequential differences are found, then the search for more faithful or more computationally effective representations becomes scientifically justified.

## 2. Foundational Research Question

Under audited informational equivalence, does the representational substrate of structural knowledge materially affect reasoning performance?

This question distinguishes between:
- the knowledge being represented; and
- the computational consequences of the way it is represented.

P3 therefore adopts the distinction between:

**Informational equivalence** — Different representations contain the same audited set of atomic structural conditions.

**Computational equivalence** — Different representations enable the same level of reasoning performance, accessibility, consistency, and application.

The experiment tests whether informationally equivalent representations are computationally equivalent.

## 3. Scientific Position

P3 does not assume that:
- language is the native form of an invariant;
- mathematics is the native form of an invariant;
- diagrams are inherently more faithful than text;
- formal structure is always superior to prose;
- multimodal representations are necessarily better;
- any currently available representation is optimal.

Language, mathematics, diagrams, graphs, schemas, and combinations of these are treated as candidate renderings or projections of underlying structural knowledge.

The experiment does not attempt to discover a hypothetical new representational language. It tests whether the search for one would be warranted.

## 4. Relationship to P1 and P2

| Experiment | Foundational question |
|---|---|
| P1 — Compression | Can reasoning be compressed into a smaller structural substrate without materially degrading performance? |
| P2 — Consequence | Do invariant-governed workflows improve consequential task outcomes? |
| P3 — Representation | Does the representational substrate of structural knowledge materially affect reasoning performance? |

The experiments are distinct but not entirely non-overlapping.

P2 includes a limited within-text comparison between prose and structured invariant predicates. P3 extends the representation question across formal, serialized, and diagrammatic substrates.

This overlap must not be used to reinterpret either experiment after the fact.

**Anti-goalpost rule** — P3 results may not retroactively alter, rescue, invalidate, or reclassify the frozen findings of P2. Likewise, P2 results may motivate P3 task design but may not predetermine P3's hypotheses, thresholds, or interpretation.

## 5. Primary Hypothesis

**H3.1 — Representation Effect** — Reasoning performance will differ materially across representational substrates even where the represented structural conditions have been audited for informational equivalence.

This hypothesis is non-directional. P3 does not preregister language, mathematics, diagrams, or serialized structure as the expected winner.

## 6. Secondary Hypotheses

**H3.2 — Task-Regime Interaction** — The effect of representation will vary by task regime.

For example:
- diagrammatic representations may perform differently on spatial tasks;
- mathematical representations may perform differently on quantitative or formal tasks;
- linguistic representations may perform differently on contextual or exception-sensitive tasks;
- serialized structure may perform differently on relational or constraint-resolution tasks.

The experiment therefore treats representation × task regime as a central scientific object, rather than assuming that one representation should dominate globally.

**H3.3 — Structural Explicitness** — Representations that make relevant structural relationships explicitly recoverable will exhibit lower contradiction rates and higher structural-validity accuracy than representations in which those relationships must be inferred indirectly.

**H3.4 — Hybrid Complementarity** — A hybrid representation may outperform its strongest individual component where the modalities preserve genuinely complementary information. Hybrid success is not established merely by outperforming the average of its components. It must outperform the best corresponding single-substrate arm by a preregistered margin.

## 7. Representation Families

The initial experiment will use five arms.

**Arm L — Linguistic Representation** — Natural-language statements of structural conditions. Example: "The center of mass must remain within the support polygon." The language should be direct, controlled, and free from stylistic ornamentation.

**Arm M — Mathematical or Formal-Symbolic Representation** — Structural knowledge represented through equations, inequalities, symbolic logic, formal predicates, or other conventional mathematical notation. Example: π_xy(c) ∈ P where c is the center of mass and P is the support polygon. Any additional assumptions introduced by formalization must be declared in the content map.

**Arm D — Diagrammatic Representation** — Structural knowledge represented through a controlled visual system that preserves relations through topology, position, linkage, boundary, direction, or composition. Examples may include: constraint diagrams; free-body diagrams; state diagrams; topology maps; engineering schematics; formal symbolic visual notation. These are not decorative illustrations. They are structured visual representations whose elements and relations have defined meanings.

**Arm S — Serialized Structural Representation** — The same relational structure represented in a machine-readable but text-consumable schema. Examples may include: adjacency lists; typed graphs; JSON constraint schemas; predicate triples; formal relation tables; graph serialization.

Illustrative example:

```json
{
  "entity": "center_of_mass",
  "relation": "must_be_within",
  "target": "support_polygon"
}
```

This arm is essential because it separates: visual presentation from relational structure; prose from explicit structure; diagrammatic encoding from current vision-model capability.

**Arm H — Controlled Hybrid Representation** — A combined language, mathematics, and diagrammatic representation of the same audited structural conditions. This arm is retained to test whether multimodal representations produce complementary value. Pairwise hybrids such as LM, LD, and MD are deferred from the initial experiment unless the pilot demonstrates a clear need to decompose hybrid effects.

## 8. Why Serialized Structure Is Required

Without Arm S, the experiment cannot distinguish: "The model benefited from explicit relational structure" from "The model benefited from a visual representation."

The following contrasts become especially important:
- **S versus L** — Tests explicit relational structure against prose within the same broad text modality.
- **S versus D** — Tests serialized relational structure against visual rendering of comparable structure.
- **L versus M** — Tests linguistic description against formal symbolic encoding.
- **D versus other arms** — Tests diagrammatic rendering, but only after confirming that the model can accurately parse the diagram.

## 9. Informational Equivalence Standard

P3 will not claim that cross-modal representations are perfectly semantically identical. Instead, it will use a two-part auditable standard.

### 9.1 Atomic Content Mapping

Every invariant will be decomposed into atomic structural conditions. A content-mapping matrix will record where each atomic condition appears in each representation.

For every condition, the matrix must identify: whether it is present; how it is encoded; whether it is explicit or implicit; whether translation required an additional assumption; whether any information was lost; whether any information was introduced.

The mapping must be completed and hash-committed before experimental runs.

### 9.2 Independent Back-Translation Audit

Independent reviewers will receive only one representation at a time and reconstruct the structural conditions it communicates. Their reconstruction will be compared against the canonical atomic-condition set.

This produces an empirical measure of: extraction accuracy; omission; addition; ambiguity; interpretive disagreement.

Back-translation performance becomes the operational certificate of informational comparability. Representations that fail the preregistered equivalence threshold cannot support a confirmatory substrate-effect claim.

## 10. Structural Fidelity

The phrase "structural fidelity" will not be defined by downstream task performance. That would be circular.

Where used, structural fidelity will be measured independently through the content and back-translation audits.

Candidate ex ante measures include: proportion of atomic conditions recoverable; proportion of relations explicitly encoded; number of undeclared assumptions required; rate of reconstruction disagreement; rate of omitted or added conditions.

The experiment will not infer that a representation has greater structural fidelity merely because it performs better.

## 11. Task Taxonomy

Task selection must not be capable of manufacturing the winning representation. Therefore, tasks will be authored independently of representation construction and stratified across preregistered regimes.

Proposed task regimes include:

- **Spatial and topological** — Tasks involving containment, adjacency, orientation, path, balance, composition, or geometric relationships.
- **Quantitative and mathematical** — Tasks involving magnitude, threshold, ratio, conservation, equality, or inequality.
- **Logical and relational** — Tasks involving dependency, compatibility, exclusion, hierarchy, sequencing, and constraint interaction.
- **Procedural and causal** — Tasks involving ordered actions, conditional intervention, failure propagation, or process constraints.
- **Contextual and exception-sensitive** — Tasks involving scope, qualification, uncertainty, boundary cases, and exception handling.

The task corpus must be hash-committed before representation-specific materials are authored.

## 12. Ground Truth

Every task must have representation-independent ground truth.

Acceptable ground-truth mechanisms include: deterministic computation; constraint solving; simulation; physical or engineering rules; independently adjudicated expert consensus; established formal proofs; validated reference implementations.

The ground truth must be fixed before any representation arm is constructed. Task authors should not participate in arm-specific representation authoring where avoidable.

## 13. Input and Output Modality

All arms differ in input representation. All arms will produce outputs in a common structured schema.

The output schema should include: (1) final verdict; (2) conditions relied upon; (3) derivation or justification; (4) uncertainty declaration; (5) identified conflicts or missing information.

This ensures that outputs can be evaluated consistently and arm-blind. It also makes explicit that P3 measures: reasoning from differently represented inputs into a shared evaluable output structure. The experiment does not compare the expressive quality of output modalities.

## 14. Extraction-Accuracy Gate

Before downstream reasoning results are interpreted, each model must demonstrate that it can recover the relevant structural conditions from each representation.

The manipulation check should test: condition extraction; relation extraction; boundary extraction; symbol interpretation; diagram-element recognition; schema parsing.

A representation-model pairing that fails the extraction threshold cannot support the conclusion that the representation itself is inferior. It may only support the narrower conclusion that: the tested model architecture could not reliably consume that representation.

## 15. Model Scope

P3 measures representation effects under tested model architectures. It does not establish a universal property of representation independently of the consuming system.

At least two materially different model families should be used. For diagrammatic arms, the selected systems must possess genuine multimodal capability.

Results should be reported: by representation; by task regime; by model family; by representation × task interaction; by representation × model interaction.

Aggregate claims must not conceal model-specific reversals.

## 16. Primary Outcome

**Structural-Validity Reasoning Accuracy** — The proportion of responses correctly determining structural validity against representation-independent ground truth. This is the primary confirmatory outcome.

## 17. Co-Primary Outcome

**Contradiction Rate** — The proportion of responses that: violate a supplied structural condition; invoke mutually incompatible conditions; produce a conclusion inconsistent with their own cited reasoning; introduce a relation incompatible with ground truth.

## 18. Secondary Outcomes

- consistency across equivalent task variants;
- generalization to held-out configurations;
- condition-recovery accuracy;
- failure localization;
- repair locality;
- uncertainty calibration;
- rate of invented conditions;
- rate of omitted conditions;
- derivation completeness.

## 19. Exploratory Outcomes

- interpretability of the common-schema output;
- reviewer agreement;
- model preference for particular representations;
- performance under partial information;
- cross-domain transfer;
- human–machine joint interpretation;
- representation-specific failure signatures.

Cross-modal token efficiency and compression ratio will not be used as primary between-arm measures because text tokens, image tokens, and serialized structural units are not directly commensurable. Within-modality efficiency may be studied exploratorily.

## 20. Primary Confirmatory Analysis

The primary analysis will test whether representational substrate has a material effect on structural-validity accuracy after: passing informational-equivalence thresholds; passing the extraction-accuracy gate; controlling for task regime; accounting for model family.

The analysis must estimate both: the main effect of representation; and representation × task-regime interactions. A global average alone is insufficient.

## 21. Key Confirmatory Contrasts

- **L versus S** — Does explicit serialized structure outperform natural-language prose within a text-consumable modality?
- **S versus D** — Does diagrammatic rendering provide value beyond relational structure alone?
- **L versus M** — Does mathematical or formal-symbolic encoding change performance relative to linguistic encoding?
- **H versus best single arm** — Does a controlled multimodal hybrid provide complementary value beyond the strongest individual representation?

## 22. Success Criteria

The central hypothesis is supported where:
1. at least one representation contrast exceeds a preregistered material-effect threshold;
2. the relevant arms pass the informational-equivalence audit;
3. the relevant model-representation pairings pass the extraction gate;
4. the difference persists across sufficient task instances and is not explained solely by a single task regime;
5. the effect is not attributable to undeclared added content;
6. the effect survives the registered model and task controls.

A task-specific interaction may count as a valid finding even where there is no universal best representation. For example: diagrammatic representation may improve spatial reasoning without improving logical reasoning. That would still demonstrate that representation is consequential.

## 23. Falsification and Null Interpretation

The central hypothesis is unsupported where:
- representation effects fall within preregistered equivalence bounds;
- observed differences disappear after informational-equivalence controls;
- apparent effects are explained by added or missing content;
- differences result from failure to parse a representation;
- effects do not replicate across the required task instances;
- results are entirely attributable to a single model's architecture;
- no representation × task-regime interaction exceeds the material threshold.

A null result is scientifically useful. It would indicate that, under the tested architectures and audited conditions, the search for novel representational substrates lacks empirical support from P3.

Equivalence must be tested using preregistered equivalence bounds rather than inferred from non-significance.

## 24. Hybrid Interpretation

Hybrid representations contain more surface material and potential redundancy. Therefore:
- hybrid arms must be content-mapped against the same atomic-condition set;
- repeated information must be declared;
- additional token or modality exposure must not be treated as complementary value by default;
- hybrid success requires performance exceeding the best constituent arm;
- the experiment should distinguish complementarity from repeated presentation.

The initial pilot includes only one controlled hybrid arm to prevent factorial expansion before the single-substrate effects are understood.

## 25. Prior-Art Positioning

P3 does not claim to originate the general question of whether representations affect reasoning.

Relevant existing traditions include: informational versus computational equivalence in diagrammatic reasoning; symbolic and formal reasoning; structured prompting; program-aided reasoning; multimodal reasoning; graph and schema-based knowledge representation.

P3's intended contribution is narrower: a preregistered, audited comparison of representational substrates for structural knowledge, using atomic content mapping, back-translation, extraction gating, representation-independent ground truth, and explicit falsification criteria.

The experiment's novelty must be claimed proportionately.

## 26. Claims Discipline

P3 may support claims such as:
- representation materially affected performance under the tested systems;
- particular representations were advantageous for particular task regimes;
- explicit structural encoding improved reasoning relative to prose;
- visual rendering added or failed to add value beyond serialized structure;
- hybrid representations showed complementary or redundant effects.

P3 may not support claims that:
- one representation is universally superior;
- mathematics is the native language of invariants;
- diagrams reveal the ontology of invariants;
- the experiment proves that structural invariants exist;
- results apply directly to human reasoning;
- results generalize beyond tested architectures;
- P3 validates P1 or P2;
- the experiment has discovered a new representation;
- field or interference behavior has been demonstrated.

## 27. Reserved Future Research

The following questions are explicitly outside P3:
- whether invariants interact as fields;
- whether invariants exhibit interference, reinforcement, cancellation, resonance, or superposition;
- whether a novel "neo-hieroglyphic" representation can be created;
- whether machine and human reasoning can jointly evolve a new representational system;
- whether representation can become dynamically self-modifying.

These may become separate experiments after P1, P2, and P3 have been executed. A provisional P4 may investigate invariant interaction or field dynamics, but it should remain internal and should not be used to influence current reviewers' interpretation of P3.

## 28. Pilot Recommendation

The cleanest low-cost preliminary contrast is: **Arm S versus Arm L**.

This compares serialized relational structure against prose using text-consumable inputs, common models, common output schemas, and no vision encoder.

However, this pre-pilot must not replace P3 or quietly narrow P3 into a prose-versus-schema experiment.

Its legitimate role is limited to: calibrating the content-mapping procedure; testing the back-translation audit; validating the common output schema; estimating effect sizes; determining whether the full multimodal study is technically viable.

The full P3 question remains representation across multiple substrates.

---

# PART B — EXP-P3 Experimental Brief v1.0 Candidate (external brief)

IRL Experimental Brief
EXP-P3 — Representation of Structural Invariants
Invariant Research Lab (IRL)
Version: v1.0 Candidate
Status: Experimental Brief for External Scientific Review

## 1. Motivation

The first two experiments in the Invariant Research Programme investigate two fundamental questions.

EXP-P1 asks whether complex reasoning can be compressed into a smaller set of structural invariants without materially degrading performance.

EXP-P2 asks whether workflows governed by those invariants produce measurably better consequential outcomes than equivalent prose-based workflows.

Together they address: compression; operational consequence.

However, neither experiment addresses a more fundamental question:

Does the way structural knowledge is represented materially affect reasoning itself?

EXP-P3 investigates this question.

## 2. Research Question

Under conditions of audited informational equivalence, does representational substrate materially affect computational reasoning over structural knowledge?

The experiment does not compare information. It compares representations of the same information.

## 3. Why This Matters

Every discipline represents structural knowledge differently. Examples include: natural language; mathematics; engineering schematics; symbolic logic; graphs; executable schemas.

These representations are often assumed to be interchangeable. P3 asks whether that assumption is empirically justified.

If representational substrate materially affects reasoning performance, then representation itself becomes a legitimate scientific variable rather than merely a presentation choice.

## 4. Scientific Position

P3 deliberately makes no claim that any existing representation is the "native language" of structural invariants.

The experiment does not assume: language is optimal; mathematics is optimal; diagrams are inherently superior; machine-readable schemas are privileged; multimodal representations are always beneficial.

Each is treated as a candidate projection of the same underlying structural knowledge. The experiment asks whether those projections differ computationally despite representing equivalent information.

## 5. Relationship to Earlier Experiments

| Experiment | Scientific Question |
|---|---|
| P1 | Can reasoning be compressed into structural invariants? |
| P2 | Do invariant-guided workflows improve consequential outcomes? |
| P3 | Does representational substrate materially influence reasoning? |

Although related, these questions remain experimentally independent. P3 neither validates nor invalidates P1 or P2. Likewise, P1 and P2 cannot predetermine the outcome of P3.

## 6. Core Hypothesis

P3 tests the hypothesis that: **Representational substrate is an independent computational variable.**

Specifically, informationally equivalent representations may nevertheless exhibit different reasoning performance because of the computational properties of the representation itself.

## 7. Experimental Principle

The experiment attempts to hold structural knowledge constant while varying only its representation.

Candidate representations include: Linguistic; Mathematical; Diagrammatic; Serialized Structural; Controlled Hybrid.

The experiment therefore compares representations rather than information.

## 8. Scientific Contribution

The principal contribution is methodological. Rather than assuming representational equivalence, P3 attempts to certify it through: atomic content decomposition; assumption back-propagation; audited informational equivalence; independent back-translation; representation-independent ground truth; extraction validation; preregistered decision procedures.

The experiment therefore distinguishes **Information** from **Representation** as separate scientific constructs.

## 9. Possible Outcomes

The experiment may demonstrate that: representation has no measurable effect; representation matters only within particular task classes; representation consistently affects reasoning; different representations exhibit complementary strengths.

All four outcomes are scientifically valuable. A null result would indicate that, under tested architectures, representational substrate does not justify a broader search for alternative invariant representations.

## 10. Non-Claims

P3 does not claim: mathematics is the language of invariants; language is insufficient; diagrams are inherently superior; structural invariants possess a native representation; human reasoning behaves similarly; the experiment proves structural invariants exist; field or interference phenomena exist; novel representational systems have been discovered.

Those remain outside the scope of the study.

## 11. Relationship to Future Research

Should P3 demonstrate that representation materially affects reasoning, it would justify subsequent investigation into more fundamental questions concerning structural representations.

Potential future work may include: invariant interaction; representational evolution; field-like invariant behavior; hybrid representational systems.

These questions are explicitly outside the scope of P3.

## 12. Prior-Art Position

P3 does not claim to originate the general question of representational effects in reasoning.

Prior work exists in areas such as: diagrammatic reasoning; symbolic reasoning; formal methods; structured prompting; multimodal reasoning; graph-based knowledge representation.

The intended contribution is narrower. P3 proposes a controlled, preregistered methodology for comparing representational substrates while explicitly auditing informational equivalence and isolating representation as the experimental variable.

## 13. Questions for Review

Reviewers are asked to evaluate the conceptual design rather than implementation details. In particular:

1. Is representational substrate isolated as the primary scientific variable?
2. Does the proposed methodology adequately separate representation from information content?
3. Is the relationship to P1 and P2 scientifically well-defined?
4. Are the experimental claims proportionate to the hypotheses being tested?
5. Are there unresolved sources of confounding that would invalidate causal interpretation?
6. Does the proposed methodology constitute a meaningful contribution independent of the experimental outcomes?
7. What single issue would most likely prevent this experiment from supporting publishable scientific conclusions?

## 14. Desired Outcome of Review

The purpose of this review is not to optimize performance or implementation. It is to determine whether the experiment, if executed faithfully, would constitute a scientifically valid test of its central hypothesis.

The review is therefore requested from the perspective of a skeptical external evaluator rather than a collaborator.
