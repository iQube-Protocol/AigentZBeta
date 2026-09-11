# IRL Experimental Protocol

# EXP-P2 — Consequential Performance

## Condition-Directed Gated Verification Across Software and Physical Consequence Domains

**Version:** 0.5
**Status:** Consolidated full-protocol candidate for final adversarial review
**Protocol family:** EXP-P2A — Software Consequences; EXP-P2B — Physical Consequences
**Registered causal construct:** **Condition-Directed Gated Verification Workflow**
**Programme-facing description:** Invariant-guided consequential workflow
**Date:** 2026-07-27

> **Parameter notation.** Every value shown as `⟦…⟧` remains unresolved. No numerical value or procedural choice is implied by a placeholder. Each placeholder must be resolved through the pilot or an independent pre-confirmatory decision, frozen, and hash-committed before confirmatory generation.

---

## Supersession and lineage notice

This document deliberately consolidates and supersedes the prior EXP-P2 draft lineage.

Earlier P2 versions established experimental machinery around condition-directed review, formal verification, readiness gating, expert effort to acceptance, failure classification, physical fabrication, falsification, and stopping rules. A later redesign correctly recentered EXP-P2 on **process**, distinguishing it from EXP-P3, whose scientific object is **representation**. That redesign did not initially carry forward all of the earlier machinery.

Version 0.5 is therefore an assembly rather than a fresh rewrite. It combines:

- the process recentering, P2/P3 boundary, null symmetry, and P2A/P2B family introduced in v0.4;
- the workflow controls, parity requirements, condition-set governance, acceptance machinery, failure taxonomy, fabrication anchor, and stopping discipline developed through v0.2;
- the directed-review control, effort decomposition, modification-count measure, verifier accountability, and honest blinding treatment developed through v0.3;
- the decision-and-falsification architecture developed for EXP-P3 and adapted here to consequential outcomes;
- the repaired representation firewall, cross-domain aggregation rule, and protected-element registry agreed during the final review cycle.

Nothing in this supersession reclassifies prior results. No prior P2 draft is treated as a completed or confirmatory experiment. Version 0.5 becomes the controlling candidate protocol only after review and formal registration.

---

## Abstract

EXP-P2 tests whether a **Condition-Directed Gated Verification Workflow** improves consequential performance relative to weaker review processes when task information is controlled.

The experiment is about **process**, not representational substrate. All arms receive the same task-material package in the same base representation. Review-stage inputs differ only through a preregistered workflow ladder:

- baseline execution;
- generic review;
- condition-directed review;
- condition-enumerated, evidence-bearing verification with repair and readiness gating.

The primary confirmatory contrast is **W3 versus W2**. Both receive the same substantive condition set. W3 additionally requires atomic enumeration, explicit pass/fail/unresolved adjudication, evidence, repair, re-adjudication, and withholding of readiness while critical conditions remain failed or unresolved.

The experiment has two independently confirmatory domains:

- **EXP-P2A — Software Consequences**, anchored primarily by executable held-out tests and mutation-tested acceptance suites;
- **EXP-P2B — Physical Consequences**, anchored by blinded expert assessment and a preregistered fabricated subsample.

Model agents perform the tasks. Human experts evaluate outputs and, where required, repair them to frozen acceptance thresholds. Consequential correctness and expert effort to acceptance are co-primary dimensions, governed by preregistered discordance rules. A reduction in effort cannot count as success if consequential failures worsen beyond the accepted margin; a correctness gain purchased through excessive effort is reported as correctness-at-cost rather than efficiency.

Null and adverse findings are first-class scientific outcomes. A positive programme-level claim requires directional replication across both domains under the frozen cross-domain decision rule.

---

# Part I — Scientific Constitution

## 1. Purpose

The purpose of EXP-P2 is to determine whether a formalized workflow of condition enumeration, evidence-bearing verification, repair, and readiness gating produces better consequential outcomes than review processes that contain the same substantive guidance but lack that formalized workflow.

The experiment tests a mechanism-level construct. It does not test the universal value of "invariants," Constitutional Computing as a whole, or any claim about human cognition.

## 2. Position within the IRL foundational programme

| Experiment | Programme focus | Core question |
|---|---|---|
| EXP-P1 | Reasoning Compression | Can reasoning be compressed into structural invariants? |
| EXP-P2 | Consequential Performance | Do condition-directed gated workflows improve consequential outcomes? |
| EXP-P3 | Representation | Does representational substrate materially affect reasoning? |
| EXP-P4 | Interaction — Reserved | Do invariants exhibit interaction or field-like behaviour? |

The conceptual sequence remains:

> **Compression → Consequence → Representation → Interaction**

The methodological dependency is not strictly sequential. EXP-P2 inherits atomic decomposition and audit methods from EXP-P3/RSS-001 while preserving a strict scientific boundary:

- EXP-P2 manipulates workflow operations.
- EXP-P3 manipulates representational substrate.

## 3. Primary scientific question

> Does the Condition-Directed Gated Verification Workflow improve consequential correctness and/or reduce expert effort to acceptance compared with condition-directed prose review, without producing materially worse consequential failures?

## 4. Secondary scientific questions

### RQ2.1 — Review value
Does adding a generic review pass improve outcomes relative to baseline execution?

### RQ2.2 — Directedness value
Does supplying validated task-specific conditions during review improve outcomes relative to generic review?

### RQ2.3 — Formalization and gating value
Does condition enumeration, explicit adjudication, evidence, repair, and readiness gating improve outcomes relative to review using the same substantive conditions in prose?

### RQ2.4 — Domain portability
Does the primary effect replicate across software and physical-construction consequence domains?

### RQ2.5 — Verification fidelity
Do the workflow's pass/fail/unresolved records accurately correspond to independent ground truth, or do they create false readiness?

### RQ2.6 — Proxy validity
In the physical domain, how accurately does blinded expert acceptance predict fabricated physical outcomes?

## 5. Hypotheses

### H2.1 — Consequential correctness
Within each domain, W3 improves consequential correctness relative to W2 by at least the preregistered material-effect threshold `⟦δ_correct,d⟧`, or is non-inferior on correctness while materially reducing effort to acceptance.

### H2.2 — Expert effort
Within each domain, W3 reduces expert effort to acceptance relative to W2 by at least `⟦δ_effort,d⟧`, without worsening consequential failures beyond `⟦δ_ni-fail,d⟧`.

### H2.3 — Verification fidelity
W3 verification records achieve preregistered precision, recall, and false-readiness thresholds against independent ground truth.

### H2.4 — Cross-domain support
The W3-versus-W2 primary effect meets the domain-level decision rule in both P2A and P2B.

### H2.5 — Directed review
W2 improves at least one registered consequential outcome relative to W1, subject to the same safety and discordance rules.

### H2.6 — Generic review
W1 improves at least one registered consequential outcome relative to W0, reported as a review-process result rather than an invariant-specific result.

### H2.7 — Physical proxy validity
For the preregistered P2B fabricated subsample, expert acceptance predictions meet the frozen proxy-validity criterion `⟦θ_proxy⟧`. If P2B fabrication remains underpowered after feasibility analysis, H2.7 shall be downgraded to exploratory before confirmatory generation.

## 6. Constitutional principles

### Principle I — Process is the manipulated variable
EXP-P2 varies required workflow operations, not the base representational substrate.

### Principle II — Identical task materials
All arms receive the same task request and the same base task-material package in the same representation.

### Principle III — Controlled review-stage differences
Review-stage inputs differ only as explicitly specified by the W0–W3 workflow ladder.

### Principle IV — Independent ground truth
Acceptance criteria and ground truth are authored independently of the evaluated model and frozen before confirmatory generation.

### Principle V — Condition provenance
The registered condition set must derive from standards, engineering principles, documented failure modes, or other auditable sources; it may not be authored solely by the evaluated model.

### Principle VI — Verification is an output-producing process
Verification records are outputs of W3. They are never supplied as prior answers or privileged outcome information.

### Principle VII — Null symmetry
Null findings are scientifically informative and contribute equally to programme decisions.

### Principle VIII — Claims proportionality
Claims must name the tested mechanism and remain scoped to the tested domains, models, tasks, and thresholds.

### Principle IX — Adverse-result priority
Safety-relevant harm, false readiness, and suppression of out-of-set concerns override efficiency gains.

### Principle X — Protected experimental memory
The directed-review arm, representation firewall, and Decision and Falsification Procedure are non-droppable elements of EXP-P2.

## 7. Claims discipline

### 7.1 Claims permitted

Subject to the Decision and Falsification Procedure, EXP-P2 may support claims about:

- consequential correctness under the tested workflow;
- expert effort to acceptance;
- formal condition adjudication and readiness gating;
- verification-record fidelity;
- domain-scoped software or physical-construction outcomes;
- cross-domain support if both domains satisfy the registered rule;
- proxy validity where the physical fabrication anchor is adequately powered.

### 7.2 Claims prohibited

EXP-P2 shall not support claims that:

- structural invariants are universally superior;
- representation is causally responsible for the observed effects;
- Constitutional Computing as a whole is validated;
- human cognition operates through the tested mechanism;
- results generalize beyond the tested model, task, and domain populations;
- W3-versus-W0 identifies the mechanism responsible for any observed effect;
- a single-domain positive result constitutes cross-domain validation.

### 7.3 Registered terminology

All confirmatory headlines shall use:

> **Condition-Directed Gated Verification Workflow**

"Invariant-guided workflow" may be used only as programme-facing shorthand and must not replace the mechanism-level construct in registered claims.

## 8. P2/P3 anti-goalpost clause

Findings from EXP-P3 shall not retrospectively reinterpret frozen EXP-P2 results. Findings from EXP-P2 shall not rescue, redefine, or alter EXP-P3 hypotheses.

The constitutive enumeration difference between W2 and W3 may motivate a future P2.x or P3.x experiment, but it may not be used after the fact to reclassify EXP-P2's registered construct or results.

---

# Part II — Experimental Family and Unit

## 9. Experimental family

EXP-P2 is a coordinated family containing two independently confirmatory domain protocols.

### 9.1 EXP-P2A — Software Consequences

Focus: whether the workflow improves executable software outcomes and reduces expert effort required to reach a frozen acceptance threshold.

Candidate task classes:

- defect repair;
- bounded feature implementation;
- API integration;
- schema or database migration;
- constrained architectural modification;
- security remediation;
- performance remediation.

The final confirmatory task classes shall be frozen after pilot feasibility assessment and before confirmatory generation. Task classes may not be added to the confirmatory corpus after any confirmatory arm result is known.

### 9.2 EXP-P2B — Physical Consequences

Focus: whether the workflow improves the correctness, safety, and acceptance efficiency of buildable physical designs.

Candidate object classes carried forward from the P2 lineage:

- lamp;
- shelf;
- enclosure.

Candidate information regimes:

- image or photograph only;
- image or photograph plus measurements.

The final object classes and information regimes shall be frozen before confirmatory generation.

### 9.3 Additional domains

No additional consequence domain may enter the confirmatory EXP-P2 claim after either P2A or P2B confirmatory results are known. New domains require separately numbered extensions and cannot retroactively change EXP-P2's aggregation result.

## 10. Experimental unit

The unit of generation is a:

> **model × task × workflow-arm execution**

The model agent produces the task artifact under one workflow condition.

Human experts then:

1. evaluate the artifact against frozen ground truth and acceptance criteria;
2. identify consequential failures;
3. where required, repair the artifact to the frozen acceptance threshold;
4. record timestamped effort and structural modifications.

P2A may resolve substantial portions of correctness through deterministic execution without human judgment. P2B necessarily relies more heavily on expert evaluation and the fabricated reality anchor.

## 11. Actor architecture

### 11.1 Performing agent
The performing agent is the frozen model and tool configuration assigned to the execution.

### 11.2 W3 verifier
The W3 verifier architecture must be frozen before registration as one of:

- isolated same-model verification pass;
- separate verifier model;
- deterministic toolchain;
- hybrid model-and-tool verifier.

The protocol shall record which elements produce judgments, which produce measurements, and which may trigger repair.

### 11.3 Evaluators
Evaluators score correctness, failures, and acceptance without access to arm identifiers wherever technically possible.

### 11.4 Repair experts
Repair experts modify artifacts to the acceptance threshold and record effort. Full arm blinding may be structurally impossible because artifacts and verification records can reveal workflow provenance. This limitation is acknowledged rather than concealed.

### 11.5 Fabricators
P2B fabricators follow a scripted gap-completion and construction protocol and must not participate in arm generation, condition-set authorship, or acceptance adjudication.

---

# Part III — Materials, Conditions, and Representation Firewall

## 12. Task-material package

Each task has one frozen base package containing:

- task request;
- source materials;
- permitted assumptions;
- available measurements or input data;
- tool permissions;
- output requirements;
- information-sufficiency status;
- task-specific acceptance interfaces.

All arms receive this package unchanged.

Where a task is intentionally under-specified, the permitted treatment of missing information must be frozen. The model may be required to ask, defer, flag unresolved inputs, or proceed within explicitly bounded assumptions. Arms may not receive different missing-information policies.

## 13. Condition-set authorship

The substantive condition set is the shared substrate for W2 and W3.

### 13.1 Sources

Conditions shall derive from auditable sources such as:

- governing standards;
- engineering or software principles;
- documented failure modes;
- safety requirements;
- interface contracts;
- system constraints;
- domain-expert consensus.

### 13.2 Independence

The condition set may not be authored solely by the evaluated model. Model assistance may be used only if:

- its contribution is disclosed;
- independent experts validate every retained condition;
- the final panel is unaware of confirmatory arm outcomes;
- the final set is frozen before confirmatory generation.

### 13.3 Atomicity

Each condition must be decomposed sufficiently to allow:

- unambiguous scope;
- identifiable thresholds;
- per-condition adjudication;
- evidence attachment;
- mapping to the master failure taxonomy;
- W2/W3 content-equivalence audit.

### 13.4 Validation panel

An independent panel shall evaluate:

- relevance;
- completeness;
- non-redundancy;
- ambiguity;
- severity;
- testability;
- domain appropriateness;
- treatment of missing information.

Panel composition, voting rule, disagreement resolution, and exclusion criteria remain `⟦to be frozen⟧`.

### 13.5 Freeze and commitment

Before confirmatory generation, the following shall be frozen and hash-committed:

- canonical condition set;
- W2 prose rendering;
- W3 enumerated rendering;
- severity labels;
- source provenance;
- thresholds and scope qualifiers;
- master failure taxonomy;
- mapping between conditions and taxonomy entries.

## 14. RSS-001 role within EXP-P2

RSS-001 does not serve its P3 role of comparing different representational substrates.

Within P2 it supplies three narrower functions:

1. **Atomic decomposition:** producing an auditable condition substrate suitable for W2 prose rendering and W3 enumeration.
2. **Within-modality equivalence audit:** confirming that every substantive condition, threshold, exception, and scope qualifier in W3 is present in W2.
3. **Completeness and consistency certification:** checking the common task-material package and condition set before execution.

RSS-001 certification does not establish computational equivalence between W2 and W3. The workflow difference is the manipulation.

## 15. Representation Firewall — non-droppable

### FW.1 — Base-material identity
All arms receive identical task materials in identical representation.

### FW.2 — Ladder-scoped differences
Arms differ only in required workflow operations and review-stage inputs specified in Section 16.

### FW.3 — W2/W3 substantive equivalence
Every substantive condition, threshold, exception, and scope qualifier in W3's enumerated condition set must appear in W2's prose review criteria.

The equivalence audit shall be:

- independent;
- completed before confirmatory generation;
- hash-committed;
- repeated on a preregistered audit sample by a second auditor;
- reported with disagreement resolution.

### FW.4 — Declared constitutive residual
The enumerated, adjudicable format of W3's conditions is constitutive of the registered construct. Per-condition adjudication cannot be performed without distinguishable condition objects.

This difference is openly included in the claim:

> EXP-P2 tests the package of condition enumeration, evidence-bearing adjudication, repair, re-adjudication, and readiness gating relative to prose review containing the same substantive conditions.

EXP-P2 does not claim to isolate enumeration from the other W3 operations.

### FW.5 — Verification outputs
Pass/fail/unresolved determinations, evidence, repair traces, and readiness status are outputs of W3. They shall not be supplied as inputs to W0, W1, W2, or W3.

### FW.6 — No representation rescue
Certified informational equivalence shall not be interpreted as evidence that the W2 and W3 review inputs are computationally equivalent. The experiment tests their operational difference as part of the registered workflow contrast.

---

# Part IV — Workflow Ladder

## 16. Registered workflow arms

### W0 — Baseline execution

- one generation pass;
- standard task request;
- no review instruction;
- no condition set supplied during review;
- output submitted at the frozen stopping point.

Purpose: ambient baseline for the value of review.

### W1 — Generic review

- W0 generation;
- one generic review pass using a frozen instruction;
- no task-specific condition content supplied during review;
- repair permitted only within the frozen pass and budget policy;
- no condition identifiers, adjudication record, or gate.

Frozen generic instruction: `⟦insert preregistered text⟧`.

Purpose: control for the value of an additional pass, attention, and compute.

### W2 — Directed review

- W0 generation;
- one review pass supplied with the validated condition set as prose review criteria;
- no condition identifiers;
- no mandatory per-condition pass/fail/unresolved adjudication;
- no evidence schema;
- no readiness gate;
- repair permitted within the frozen pass and budget policy.

Purpose: control for substantive task-specific review content and directedness.

### W3 — Gated verification

After generation, the workflow must:

1. enumerate every registered condition;
2. adjudicate each condition as **pass**, **fail**, or **unresolved**;
3. distinguish violation from missing information;
4. attach evidence or measurement to each adjudication;
5. identify affected artifact locations;
6. repair failed conditions within the frozen repair policy;
7. re-adjudicate every affected condition;
8. record out-of-set concerns without suppressing them;
9. withhold readiness while any critical condition remains failed or unresolved;
10. output both the artifact and the machine-readable verification record.

Purpose: test the value of formal condition objects, evidence-bearing adjudication, repair discipline, and readiness gating at matched substantive review content.

## 17. Registered contrasts

### 17.1 Primary confirmatory contrast

> **W3 versus W2, separately within P2A and P2B**

Permitted attribution:

> The effect of the Condition-Directed Gated Verification Workflow relative to prose review containing the same substantive conditions.

The contrast does not isolate enumeration, evidence, repair, or gating from one another.

### 17.2 Secondary confirmatory contrast

> **W2 versus W1**

Permitted attribution:

> The effect of task-specific directed review relative to generic review.

### 17.3 Secondary confirmatory contrast

> **W1 versus W0**

Permitted attribution:

> The effect of a generic review pass relative to baseline execution.

### 17.4 Descriptive full-stack contrast

> **W3 versus W0**

This contrast may describe the practical effect of the full workflow package. It is barred from narrow mechanism attribution.

## 18. Parity requirements

The following shall be preregistered by arm:

- maximum model calls or passes;
- token or compute budget;
- wall-clock or execution-time budget where applicable;
- tool access;
- stopping conditions;
- model identity and version;
- system and user prompts;
- sampling parameters;
- context-window policy;
- retry policy;
- error-handling policy.

### 18.1 Primary-contrast parity

W2 and W3 must have matched:

- substantive review content;
- permitted tools, unless a decomposition cell is preregistered;
- total review-stage compute or a justified budget-normalization rule;
- time budget;
- access to task materials;
- repair permissions.

If W3 uses a deterministic tool unavailable to W2, the protocol must either:

1. make that tool available to W2's review pass; or
2. preregister a W3-without-that-tool decomposition cell.

### 18.2 Pass parity

The protocol must distinguish workflow operations from extra opportunity. W3 may contain multiple internal steps, but W2 must receive a matched overall opportunity budget. The final parity rule remains `⟦to be frozen after pilot feasibility testing⟧`.

---

# Part V — Domain Protocols

## 19. EXP-P2A — Software Consequences

### 19.1 Corpus construction

Confirmatory software tasks shall be:

- private, newly authored, or created after the evaluated model's likely training cutoff where feasible;
- bounded enough to admit frozen acceptance criteria;
- realistic enough to require consequential implementation;
- free of direct answer leakage;
- versioned and hash-committed.

Public benchmark tasks may be used only if contamination risk is explicitly measured and does not carry the primary confirmatory claim.

### 19.2 Contamination controls

Before inclusion, each task shall undergo:

- repository and web provenance review where possible;
- similarity screening against known public tasks;
- model familiarity probes that do not reveal the acceptance suite;
- documentation of any unresolved contamination risk.

A task with material contamination risk shall be excluded from confirmation or labeled exploratory before arm results are known.

### 19.3 Ground truth

The P2A primary correctness anchor is a held-out executable acceptance suite.

Where appropriate, the suite shall include:

- functional tests;
- regression tests;
- mutation testing;
- adversarial or edge-case tests;
- security or performance checks;
- interface-contract checks.

Visible development tests and held-out acceptance tests must be distinct. Models and workflow verifiers may not access the held-out suite.

### 19.4 Acceptance threshold

The task-specific acceptance threshold may require:

- all critical held-out tests passing;
- no critical security or data-integrity failures;
- regression performance within frozen bounds;
- required interface contracts satisfied;
- no unresolved critical defect.

Thresholds must be designed without access to pilot arm outcomes.

### 19.5 Human evaluation

Human judgment may assess:

- maintainability;
- architectural consistency;
- repair effort;
- severity of non-test-captured defects;
- out-of-set concerns.

Code and diffs shall be normalized before review where technically feasible. Reviewers shall complete an arm-detection diagnostic so residual unblinding can be reported.

### 19.6 P2A primary outcomes

- held-out functional correctness;
- consequential failure severity;
- expert effort to acceptance.

### 19.7 P2A supporting outcomes

- mutation score;
- regression count;
- structural modification count;
- discovery, repair, and verification effort;
- false readiness;
- out-of-set failures;
- reviewer agreement.

## 20. EXP-P2B — Physical Consequences

### 20.1 Object classes

The candidate confirmatory classes are:

- lamp;
- shelf;
- enclosure.

Each class must have:

- frozen task templates;
- accepted materials and tools;
- safety constraints;
- measurable performance requirements;
- acceptance criteria;
- master failure taxonomy coverage.

### 20.2 Information regimes

Candidate regimes are:

- image or photograph only;
- image or photograph plus measurements.

The protocol must freeze whether information regime is:

- a stratification variable;
- a confirmatory moderator;
- or an exploratory factor.

It may not be reclassified after arm outcomes are known.

### 20.3 Ground truth

P2B ground truth combines:

- frozen engineering acceptance criteria;
- blinded expert adjudication;
- deterministic or simulated checks where available;
- physical fabrication on a preregistered subsample.

### 20.4 Acceptance threshold

An artifact reaches acceptance only when:

- no critical condition remains failed or unresolved;
- required dimensions, stability, load, heat, electrical, enclosure, or safety constraints are met as applicable;
- all information gaps required for construction are resolved under the scripted completion policy;
- the expert can approve the package for the protocol's defined construction state.

The exact acceptance state—prototype-ready, fabrication-ready, or another frozen state—must be defined per object class before pilot scoring.

### 20.5 Fabrication anchor

The fabricated subsample shall be stratified across:

- workflow arm;
- object class;
- information regime where retained;
- initial expert acceptance status where feasible.

Two distinct anchor questions must not be conflated:

1. **Raw-output prediction:** does expert assessment of the un-repaired model output predict physical failure?
2. **Post-repair acceptance validity:** does the repaired-to-threshold package produce an acceptable physical artifact?

The protocol must choose which question is confirmatory, or power both separately.

Where raw outputs are not directly fabricable, fabricators shall use a scripted minimal gap-completion procedure authored blind to arm. Every completion must be recorded and scored as added information.

Candidate minimums suggested in prior review are not adopted automatically. Final `⟦n_fabricated per arm × class⟧` and `⟦θ_proxy⟧` require a feasibility and power determination before confirmation. If adequate powering is not feasible, the fabrication anchor shall be registered as exploratory and P2B claims shall be scoped as expert-proxy outcomes.

### 20.6 P2B primary outcomes

- expert-adjudicated consequential correctness;
- critical physical-design failures;
- expert effort to acceptance.

### 20.7 P2B supporting outcomes

- structural modification count;
- discovery, repair, and verification effort;
- false readiness;
- predicted versus fabricated outcome;
- out-of-set failures;
- evaluator and repairer agreement.

---

# Part VI — Outcomes and Measurement

## 21. Co-primary outcome dimensions

EXP-P2 has two co-primary dimensions per domain:

1. **Consequential correctness**
2. **Expert effort to acceptance**

The decision rule is not a free choice between endpoints. Section 40 specifies how they combine and how discordant results are reported.

## 22. Consequential correctness

Correctness shall be defined at the domain level.

### P2A
A frozen composite based primarily on held-out executable acceptance, critical regressions, and safety/security constraints.

### P2B
A frozen composite based on critical acceptance criteria, expert adjudication, deterministic checks, and the fabricated anchor where confirmatory.

The protocol must preregister whether the primary correctness endpoint is:

- binary acceptance;
- weighted failure burden;
- a hierarchical critical-first endpoint;
- or another frozen composite.

No outcome definition may be chosen after confirmatory arm results are known.

## 23. Expert effort to acceptance

Effort shall be recorded as timestamped active expert time and decomposed into:

- **discovery effort:** identifying failures or missing information;
- **repair effort:** modifying the artifact or specification;
- **verification effort:** confirming that the repaired artifact meets the threshold;
- **total effort:** sum under the frozen accounting policy.

Waiting time, administrative time, and tool-runtime time shall be separately recorded or explicitly excluded.

The confirmatory effort endpoint shall be `⟦frozen after pilot⟧`. Supporting components remain reported even if not confirmatory.

## 24. Structural modification count

An objective supporting measure shall count the structural changes required to reach acceptance.

Domain-specific counting rules must be frozen:

- code-level or architecture-level change units in P2A;
- design, dimension, material, component, safety, or documentation change units in P2B.

Where possible, modifications shall be adjudicated from normalized diffs without arm metadata.

The measure is designed to distinguish cheap disclosure of many flaws from genuine reduction in repair burden.

## 25. Failure-severity taxonomy

Every failure shall be assigned to a preregistered class:

- **Critical:** can produce unsafe, nonfunctional, security-compromising, structurally invalid, or falsely ready outcomes; blocks acceptance.
- **Major:** materially impairs required function, reliability, maintainability, or constructability; normally blocks acceptance.
- **Minor:** does not materially block the defined consequence but requires correction or clarification.
- **Informational:** observation not counted as a failure under the frozen acceptance threshold.

Detailed domain-specific definitions and examples shall be independently authored and frozen.

Inter-rater reliability and disagreement resolution shall be reported.

## 26. In-set and out-of-set failures

The condition set is not presumed complete.

An independent master failure taxonomy, strictly broader than the registered condition set, shall be hash-committed before generation.

Failures shall be classified as:

- **in-set:** directly covered by a registered condition;
- **out-of-set:** relevant under the master taxonomy but absent from the registered condition set;
- **out-of-scope:** outside the frozen task and acceptance boundary.

The personnel responsible for programme-level invariant discovery or condition-set expansion shall not control confirmatory in-set/out-of-set adjudication.

## 27. Verification-record fidelity

For W3, compare the verification record against independent ground truth.

Registered measures:

- pass precision;
- pass recall;
- failure recall;
- unresolved-state calibration;
- false-pass rate;
- false-readiness rate;
- evidence sufficiency;
- omitted-condition rate.

A W3 artifact declared ready while independent ground truth contains an unresolved critical failure is a **false-readiness event**.

## 28. Reproducibility

Reproducibility is defined as outcome stability under a frozen rerun protocol, not as identical text or artifact output.

The rerun protocol shall freeze:

- model and version;
- sampling parameters;
- seed policy where available;
- workflow instructions;
- task materials;
- tool versions.

Reproducibility is secondary unless promoted before confirmatory registration with a specific hypothesis and threshold.

---

# Part VII — Blinding, Reliability, and Reality Contact

## 29. Blinding

### 29.1 What can be blinded
Where technically feasible, evaluators shall not see:

- arm labels;
- prompts;
- verification metadata not required for scoring;
- file names or identifiers revealing arm;
- execution order.

### 29.2 What cannot be fully blinded
W3 outputs may contain verification records or artifact structure that reveal the arm. Repair experts may infer arm from artifact characteristics. This is a structural limitation.

### 29.3 Mitigations
The protocol shall use:

- normalized artifacts and diffs;
- independent evaluators;
- crossed assignment of experts to arms;
- counterbalanced review order;
- arm-detection diagnostics;
- a multi-expert reliability subsample;
- evaluator and repairer random effects in analysis;
- explicit reporting of successful and failed blinding.

No claim of full repairer blinding is permitted.

## 30. Reliability subsample

A preregistered subsample shall receive independent duplicate or multiple evaluation and repair measurement.

The subsample must estimate:

- evaluator agreement;
- severity agreement;
- acceptance agreement;
- repair-effort reliability;
- structural-modification-count reliability.

The subsampling rule and minimum reliability criterion remain `⟦to be frozen before confirmation⟧`. Budget pressure may not silently alter the rule.

## 31. Reality contact

### 31.1 P2A
Execution against held-out software tests is direct contact with the artifact's functional reality. The primary integrity threat is contamination or teaching to visible tests.

### 31.2 P2B
Expert review is a proxy. The fabricated subsample tests whether that proxy predicts physical outcomes.

Simulation and deterministic engineering checks should be used as objective measures where available, not merely as workflow aids.

---

# Part VIII — Pilot, Sampling, and Analysis

## 32. Pilot

The pilot exists only to:

- test task feasibility;
- calibrate acceptance thresholds without reference to confirmatory conclusions;
- estimate variance and repair-hour requirements;
- test W2/W3 content equivalence;
- test parity budgets;
- validate logging and measurement;
- estimate evaluator and repairer reliability;
- assess fabrication feasibility;
- set material-effect and non-inferiority thresholds;
- determine sample size.

The pilot may not:

- test headline hypotheses for publication;
- select favorable task classes by arm effect;
- change the registered construct;
- remove W2;
- weaken the representation firewall;
- choose thresholds to maximize observed arm separation.

Pilot outputs and all resulting changes must be logged.

## 33. Sample structure

The confirmatory sample shall be determined from pilot variance, the frozen material-effect thresholds, clustered task structure, and expert-repair capacity.

The protocol must preregister:

- number of tasks per domain;
- number of executions per task × arm;
- model count and selection rule;
- object/task-class stratification;
- information-regime allocation;
- repairer and evaluator sample sizes;
- reliability subsample;
- fabrication subsample;
- maximum total expert hours;
- a lawful subsampling rule if the full corpus exceeds budget.

No silent reduction of repair or fabrication coverage is permitted.

## 34. Model population

The model population shall be frozen before power analysis.

The protocol must state whether confirmation concerns:

- one named model;
- a small predefined model set;
- model families;
- or a crossed architecture design.

An ambiguous list such as "frontier/open/reasoning/non-reasoning" is not a population definition.

The primary claim shall be scoped to the frozen model population.

## 35. Randomization and assignment

Within each domain:

- task-to-arm assignment shall be randomized or fully crossed;
- execution order shall be randomized;
- expert assignment shall cross arms;
- repair order shall be counterbalanced;
- model and task effects shall be balanced where feasible;
- fabricator assignment shall be separated from arm generation.

Randomization seeds and assignment tables shall be committed before confirmatory evaluation where feasible.

## 36. Statistical analysis

The confirmatory analysis shall be specified in a separate Statistical Analysis Plan before confirmatory generation.

Candidate structure:

- per-domain mixed-effects model;
- workflow arm as fixed effect;
- task or object as random effect;
- evaluator and repairer as random effects where measured;
- model as fixed or random according to the frozen target population;
- information regime and task class as preregistered moderators;
- fixed-sequence gatekeeping for secondary contrasts;
- confidence intervals for statistical and practical significance;
- multiplicity correction across domains and endpoints.

The final model form, link function, α allocation, missing-data treatment, and robustness analyses remain `⟦to be frozen⟧`.

## 37. Missingness and protocol deviations

The protocol shall define before confirmation:

- model failure or timeout;
- invalid tool execution;
- incomplete logs;
- expert withdrawal or unavailable repair;
- unbuildable physical output;
- contaminated task discovery;
- accidental access to held-out tests;
- arm leakage;
- corrupted verification records.

Every exclusion must use a preregistered rule and be reported by arm. Exclusions may not be based on outcome favorability.

---

# Part IX — Decision and Falsification Procedure

## 38. Protection clause — non-droppable

Any future EXP-P2 revision omitting:

- this Decision and Falsification Procedure;
- the W2 directed-review arm;
- the Representation Firewall;
- or the cross-domain aggregation rule

fails constitutional review automatically and may not be registered as a successor protocol.

## 39. Parameters frozen after pilot

The following shall be justified independently of confirmatory arm outcomes, frozen after pilot, and hash-committed before confirmatory generation:

- `⟦δ_correct,A⟧`, `⟦δ_correct,B⟧`: material correctness effects;
- `⟦δ_effort,A⟧`, `⟦δ_effort,B⟧`: material effort reductions;
- `⟦δ_ni-fail,A⟧`, `⟦δ_ni-fail,B⟧`: non-inferiority margins for consequential failures;
- `⟦δ_ni-effort,A⟧`, `⟦δ_ni-effort,B⟧`: effort-cost margins for correctness-only claims;
- `⟦θ_false-ready⟧`: maximum false-readiness rate;
- `⟦θ_proxy⟧`: P2B proxy-validity threshold if confirmatory;
- α allocation and fixed-sequence testing order.

A prior candidate practical threshold of 30% for effort reduction is part of the historical design record but is not silently adopted here. It must be re-justified or replaced using the v0.5 pilot and practical-cost analysis.

## 40. Per-domain primary decision rule

For each domain, the W3-versus-W2 result is classified as follows.

### 40.1 Supported
A domain supports the registered construct if:

- correctness improves by at least `⟦δ_correct,d⟧`, **or**
- expert effort to acceptance falls by at least `⟦δ_effort,d⟧`;

and all of the following hold:

- consequential failures do not worsen beyond `⟦δ_ni-fail,d⟧`;
- false readiness does not exceed `⟦θ_false-ready⟧`;
- the primary contrast passes content, compute, tool, and blinding audits;
- no adverse-result override applies.

### 40.2 Correctness at cost
If correctness improves materially but effort increases beyond `⟦δ_ni-effort,d⟧`, the result is reported as:

> **Correctness improvement at increased expert cost**

It is not an efficiency success.

### 40.3 Efficiency without safety
If effort falls materially but consequential failures worsen beyond `⟦δ_ni-fail,d⟧`, the result is not support. It is classified as adverse or harmful according to Section 42.

### 40.4 Null
If neither correctness nor effort meets its material threshold and no adverse override applies, the domain result is null.

### 40.5 Indeterminate
A result is indeterminate if the causal audit fails, required data are unavailable, or protocol deviations prevent valid classification. Indeterminate is not support and may not be relabeled as null.

## 41. Cross-domain aggregation

| P2A result | P2B result | Permitted programme conclusion |
|---|---|---|
| Supported | Supported | Cross-domain support for the registered construct |
| Supported | Null | Software-domain support only |
| Null | Supported | Physical-domain support only |
| Null | Null | Constitutional hypothesis unsupported at the tested scale |
| Harmful | Any | Adverse-result review; no programme-level support |
| Any | Harmful | Adverse-result review; no programme-level support |

Additional rules:

- An indeterminate domain prevents a cross-domain support claim.
- "Partial support" exists only as one of the two domain-scoped rows above.
- No discretionary partial-support category may be introduced.
- Correctness-at-cost is reported separately and does not automatically count as "Supported"; its treatment must be frozen in the SAP.

## 42. Harmful and adverse results

A result is harmful or triggers adverse-result review if W3 produces one or more of:

- increased critical failures;
- false readiness;
- suppression or non-reporting of relevant out-of-set concerns;
- artifact distortion around an incomplete condition set;
- unsafe optimization to registered conditions;
- material degradation hidden by lower effort;
- verifier overconfidence that blocks appropriate uncertainty or escalation.

Adverse findings shall be preserved, reported, and reviewed before further confirmatory execution.

Efficiency gains cannot override this section.

## 43. Falsification conditions

The registered construct claim is unsupported if any of the following applies:

1. W3 does not materially outperform W2 under the per-domain rule.
2. Apparent improvement is attributable to unmatched review content.
3. Apparent improvement is attributable to unequal compute, time, passes, or tools.
4. Evaluator or repairer unblinding plausibly explains the effect and mitigation analyses do not sustain it.
5. W3 improves in-set condition satisfaction while worsening consequential out-of-set failures.
6. Verification records fail the frozen fidelity or false-readiness thresholds.
7. Cross-domain results do not meet the aggregation rule for a programme-level claim.
8. The condition set, taxonomy, acceptance threshold, or analysis changed after confirmatory outcomes were visible.
9. The fabrication anchor, where confirmatory, fails the proxy-validity threshold.
10. Protocol deviations make the primary contrast causally uninterpretable.

A null or falsifying result is a valid completion of EXP-P2.

## 44. Secondary contrast decisions

W2-versus-W1 and W1-versus-W0 are tested only under the frozen gatekeeping sequence.

A positive W2-versus-W1 result supports task-specific directed review.

A positive W1-versus-W0 result supports generic review.

Neither result supports the W3 registered construct or the broader invariant programme.

## 45. Programme stopping-rule linkage

P2 outcomes shall feed the programme-level stopping rule carried forward from the prior P2 lineage.

At minimum:

- a double-null P2 result constitutes the P2 input to the programme rule;
- a harmful result triggers immediate programme review;
- a positive W1 or W2 secondary result may not substitute for a null W3-versus-W2 primary result;
- a double-null may not be relabeled as evidence that "structured workflows help" for purposes of preserving the invariant-specific claim;
- no future, undated experiment may be invoked as an indefinite escape hatch.

The exact programme decision point and relationship to P1 and P3 shall be recorded before EXP-P2 confirmation.

---

# Part X — Governance, Registration, and Execution

## 46. Role separation

The final protocol shall publish a role-separation table covering:

- task authors;
- condition-set authors;
- validation panel;
- W2/W3 equivalence auditors;
- model operators;
- verifier implementers;
- evaluators;
- repair experts;
- failure-taxonomy adjudicators;
- fabricators;
- statisticians;
- programme governance reviewers.

No individual or team shall simultaneously control a load-bearing input and its confirmatory adjudication without disclosure and an independent check.

## 47. Commitment inventory

Before confirmatory generation, hash-commit:

- protocol version;
- task corpus;
- task-material packages;
- condition sets;
- W2 prose criteria;
- W3 enumerated conditions;
- acceptance thresholds;
- severity taxonomy;
- master failure taxonomy;
- prompts;
- toolchain versions;
- model identities and parameters;
- workflow budgets;
- randomization plan;
- analysis plan;
- evaluation rubrics;
- fabrication protocol;
- stopping and adverse-result rules.

## 48. Change control

After freeze:

- clerical corrections require a logged erratum;
- substantive changes require an amendment;
- changes affecting hypotheses, contrasts, outcomes, thresholds, or eligibility require re-registration before further confirmatory runs;
- confirmatory data generated before and after a substantive amendment may not be pooled unless the amendment explicitly defines a valid bridging analysis;
- prior data may not be quietly reclassified as pilot data.

## 49. Protected-element registry

The following elements are protected:

| Element | Protection |
|---|---|
| Process recentering and P2/P3 boundary | Constitutional |
| Null symmetry | Constitutional |
| P2A/P2B family structure | Design |
| W0–W3 ladder | Design |
| W2 directed-review control | Non-droppable |
| W2/W3 review-content equivalence audit | Non-droppable |
| Representation Firewall | Non-droppable |
| Tool/compute/pass parity | Design |
| Condition-set independent authorship and validation | Design |
| Effort decomposition | Design |
| Structural modification count | Design |
| Failure taxonomy and adjudication | Design |
| Honest blinding limitation and mitigation | Design |
| Acceptance threshold machinery | Design |
| P2B fabrication anchor or explicit downgrade | Design |
| P2A contamination controls and executable ground truth | Design |
| Experimental unit | Design |
| Decision and Falsification Procedure | Non-droppable |
| Cross-domain aggregation rule | Non-droppable |
| Programme stopping-rule linkage | Constitutional |
| Bidirectional P2/P3 anti-goalpost clause | Constitutional |
| Mechanism-level construct naming | Constitutional |

Any successor draft must include an inheritance table showing the status of every protected element.

## 50. Execution sequence

1. Ratify v0.5 architecture.
2. Resolve all `⟦…⟧` placeholders eligible for pre-pilot resolution.
3. Author and validate task corpora.
4. Author, validate, atomize, and freeze condition sets.
5. Produce W2 and W3 review materials.
6. Complete independent W2/W3 equivalence audit.
7. Freeze verifier architecture and parity policy.
8. Build acceptance thresholds and master failure taxonomies.
9. Run pilot.
10. Freeze effect thresholds, margins, sample sizes, and analysis plan.
11. Hash-commit confirmatory package.
12. Run P2A and P2B confirmation.
13. Apply per-domain Decision and Falsification Procedure.
14. Apply cross-domain aggregation.
15. Preserve and publish null, adverse, and positive findings under the same reporting standard.
16. Feed the frozen outcome into the programme stopping rule.

---

# Appendix A — Inheritance Register

| # | Element | Source lineage | v0.5 disposition |
|---|---|---|---|
| 1 | Process recentering; P2/P3 boundary; supersession discipline | v0.4 | Adopted |
| 2 | Null symmetry | v0.4 §§11–12 | Adopted |
| 3 | P2A/P2B family | v0.4 §5 | Adopted |
| 4 | Directed-review control | v0.2 arms; v0.3 review amendment | Adopted as W2; non-droppable |
| 5 | W2/W3 content-equivalence audit | v0.3 review cycle | Adopted; non-droppable |
| 6 | Representation firewall | final review cycle | Adopted; non-droppable |
| 7 | Tool/compute/pass parity | v0.2 §17; v0.3 review | Adopted |
| 8 | Condition-set construction and validation | v0.2 §§18–19 | Adopted |
| 9 | Effort decomposition | v0.3 | Adopted |
| 10 | Structural modification count | v0.3 | Adopted |
| 11 | Failure-severity taxonomy | v0.2 §24 | Adopted |
| 12 | Blinding and unblindability treatment | v0.2 §25; v0.3 | Adopted |
| 13 | Acceptance threshold | v0.2 §22 | Adopted |
| 14 | Fabrication anchor | v0.2 §29; review cycles | Adopted with power/downgrade branch |
| 15 | P2A contamination controls and executable ground truth | final review cycles | Adopted |
| 16 | Model-agent / human-expert experimental unit | prior P2 lineage | Adopted |
| 17 | Decision and Falsification Procedure | P3 DP adapted to P2 | Adopted; non-droppable |
| 18 | Cross-domain aggregation | final review cycle | Adopted; non-droppable |
| 19 | Programme stopping rule | v0.2 §38; v0.3 binding | Adopted pending exact programme decision text |
| 20 | P2/P3 anti-goalpost clause | P3 clause extended | Adopted |
| 21 | Mechanism-level construct naming | repeated review requirement | Adopted |

---

# Appendix B — Operational Definitions

**Acceptance:** The frozen domain-specific state at which no blocking condition or consequential failure remains under the registered threshold.

**Condition:** A validated, atomic, scope-bounded requirement against which an artifact can be reviewed or adjudicated.

**Condition-directed review:** Review supplied with substantive task-specific conditions but without formal per-condition adjudication or readiness gating.

**Condition-Directed Gated Verification Workflow:** The W3 package of condition enumeration, evidence-bearing pass/fail/unresolved adjudication, repair, re-adjudication, and readiness gating.

**Consequential failure:** A defect that affects the defined real or executable outcome, rather than merely the elegance of the reasoning trace.

**Expert effort to acceptance:** Active expert time required to discover, repair, and verify an artifact until it reaches the frozen threshold.

**False readiness:** A W3 declaration of readiness where independent ground truth contains a failed or unresolved critical condition.

**Out-of-set failure:** A relevant failure present in the independently authored master taxonomy but absent from the registered condition set.

**Readiness gate:** The rule withholding readiness while any critical registered condition remains failed or unresolved.

**Representation firewall:** The requirement that base task materials remain identical across arms and that review-stage differences be limited to the preregistered workflow ladder.

**Structural modification:** A countable artifact change required to reach acceptance under frozen domain rules.

---

# Appendix C — Unresolved Parameters Requiring Freeze

The protocol cannot enter confirmatory registration until the following are resolved:

1. Final P2A task classes and corpus size.
2. Final P2B object classes and information-regime role.
3. Model population.
4. W1 generic-review instruction.
5. W2 prose-rendering standard.
6. W3 verifier architecture.
7. Compute, pass, time, and tool parity.
8. Acceptance thresholds per task/object class.
9. Master failure taxonomies.
10. Confirmatory correctness endpoints.
11. Confirmatory effort endpoint.
12. Material-effect thresholds.
13. Non-inferiority margins.
14. False-readiness threshold.
15. P2B fabrication sample and proxy-validity criterion.
16. Reliability subsample and agreement thresholds.
17. Sample-size and expert-hour budget.
18. Statistical model and α allocation.
19. Programme stopping-rule decision point.
20. Exact handling of correctness-at-cost in cross-domain aggregation.

---

# Appendix D — Final Review Questions

Reviewers are asked to evaluate only demonstrated defects in the settled architecture and the feasibility of execution.

1. Does W3-versus-W2 support the mechanism-level claim as scoped?
2. Is FW.4 sufficiently explicit about the constitutive enumeration residual?
3. Are W2/W3 content and tool parity auditable in practice?
4. Are the co-primary decision and discordance rules adequately falsifiable?
5. Is the experimental unit operationally feasible across both domains?
6. Are P2A contamination controls sufficient for executable ground truth?
7. Can P2B's fabrication anchor be adequately powered, or should it be explicitly exploratory?
8. Are the protected elements sufficient to prevent design-memory loss in future revisions?
9. Which unresolved parameters require resolution before pilot, and which may legitimately be frozen after pilot?
10. Does any remaining wording overclaim beyond the Condition-Directed Gated Verification Workflow?

---

## Candidate disposition

**Architecture:** settled candidate
**Protocol engineering:** incomplete until Appendix C is resolved
**Preregistration:** not yet authorized
**Next authorized step:** final adversarial review of v0.5, followed by parameter resolution, pilot design, and Statistical Analysis Plan
