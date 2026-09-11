# EXP-P3 — Implementation Guide

**Invariant Research Lab (IRL) · EXP-P3 — Representation of Structural Invariants**
**Version: 1.0 Candidate · Status: pending series ratification**

> Document 05 of the EXP-P3 set — the laboratory manual. Pure implementation: arm construction,
> task corpus, ground truth, output schema, models, outcome operationalization, execution
> workflow, and the commitment inventory. Scientific rationale lives in
> `02_experimental-protocol.md`; normative methodology in RSS-001 (`03_...md`); the
> confirmatory decision procedure in the SAP (`04_...md`). ⟦ ⟧ marks parameters to be frozen.

## 1. Representation arms (construction specifications)

The initial experiment uses five arms.

**Arm L — Linguistic Representation** — Natural-language statements of structural conditions. Example: "The center of mass must remain within the support polygon." The language should be direct, controlled, and free from stylistic ornamentation.

**Arm M — Mathematical or Formal-Symbolic Representation** — Structural knowledge represented through equations, inequalities, symbolic logic, formal predicates, or other conventional mathematical notation. Example: π_xy(c) ∈ P where c is the center of mass and P is the support polygon. Any additional assumptions introduced by formalization must be declared in the content map (and are handled by the BP procedure, RSS-001 §3).

**Arm D — Diagrammatic Representation** — Structural knowledge represented through a controlled visual system that preserves relations through topology, position, linkage, boundary, direction, or composition. Examples may include: constraint diagrams; free-body diagrams; state diagrams; topology maps; engineering schematics; formal symbolic visual notation. These are not decorative illustrations. They are structured visual representations whose elements and relations have defined meanings. Arm D authoring, rendering, and audit are governed entirely by the Visual Representation Standard (RSS-001 §4, Section VN), including the frozen rendering parameters (VN.7).

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

**Arm H — Controlled Hybrid Representation** — A combined language, mathematics, and diagrammatic representation of the same audited structural conditions. This arm is retained to test whether multimodal representations produce complementary value. Pairwise hybrids such as LM, LD, and MD are deferred from the initial experiment unless the pilot demonstrates a clear need to decompose hybrid effects. H's diagrammatic constituent uses the VN specification unchanged (RSS-001 §4, VN.11.5).

## 2. Why serialized structure is required

Without Arm S, the experiment cannot distinguish: "The model benefited from explicit relational structure" from "The model benefited from a visual representation."

The following contrasts become especially important:
- **S versus L** — Tests explicit relational structure against prose within the same broad text modality.
- **S versus D** — Tests serialized relational structure against visual rendering of comparable structure.
- **L versus M** — Tests linguistic description against formal symbolic encoding.
- **D versus other arms** — Tests diagrammatic rendering, but only after confirming that the model can accurately parse the diagram (the extraction gate, RSS-001 §2).

The confirmatory ordering and confirmation rules for these contrasts are fixed in the SAP (DP.5).

## 3. Task corpus

Task selection must not be capable of manufacturing the winning representation. Therefore, tasks are authored independently of representation construction and stratified across preregistered regimes.

Task regimes:

- **Spatial and topological** — Tasks involving containment, adjacency, orientation, path, balance, composition, or geometric relationships.
- **Quantitative and mathematical** — Tasks involving magnitude, threshold, ratio, conservation, equality, or inequality.
- **Logical and relational** — Tasks involving dependency, compatibility, exclusion, hierarchy, sequencing, and constraint interaction.
- **Procedural and causal** — Tasks involving ordered actions, conditional intervention, failure propagation, or process constraints.
- **Contextual and exception-sensitive** — Tasks involving scope, qualification, uncertainty, boundary cases, and exception handling.

The task corpus must be hash-committed before representation-specific materials are authored. This sequencing is load-bearing: the BP boundary test references the committed task taxonomy, and task authors hold no BP role (RSS-001 §3, BP.9). If any pilot work has already authored arm materials before the corpus commitment, those materials must be discarded for confirmatory use, not retrofitted.

Per-regime minimum task counts are a DP.1 registered parameter.

## 4. Ground truth

Every task must have representation-independent ground truth.

Acceptable ground-truth mechanisms include: deterministic computation; constraint solving; simulation; physical or engineering rules; independently adjudicated expert consensus; established formal proofs; validated reference implementations.

The ground truth must be fixed before any representation arm is constructed. Task authors should not participate in arm-specific representation authoring where avoidable. No representation serves as ground truth for another.

## 5. Input and output modality; common output schema

All arms differ in input representation. All arms produce outputs in a common structured schema.

The output schema should include: (1) final verdict; (2) conditions relied upon; (3) derivation or justification; (4) uncertainty declaration; (5) identified conflicts or missing information.

This ensures that outputs can be evaluated consistently and arm-blind. It also makes explicit that P3 measures: reasoning from differently represented inputs into a shared evaluable output structure. The experiment does not compare the expressive quality of output modalities.

## 6. Model scope

P3 measures representation effects under tested model architectures. It does not establish a universal property of representation independently of the consuming system.

At least two materially different model families should be used. For diagrammatic arms, the selected systems must possess genuine multimodal capability. The model family set is a DP.1 registered parameter; delivery parity constraints for image inputs are in VN.7.

Results are reported: by representation; by task regime; by model family; by representation × task interaction; by representation × model interaction.

Aggregate claims must not conceal model-specific reversals (this requirement is enforced by DP.5's family-replication rule).

## 7. Outcome measures (operational definitions)

**Primary — Structural-Validity Reasoning Accuracy.** The proportion of responses correctly determining structural validity against representation-independent ground truth. This is the primary confirmatory outcome.

**Co-primary — Contradiction Rate.** The proportion of responses that: violate a supplied structural condition; invoke mutually incompatible conditions; produce a conclusion inconsistent with their own cited reasoning; introduce a relation incompatible with ground truth.

**Secondary outcomes:**
- consistency across equivalent task variants;
- generalization to held-out configurations;
- condition-recovery accuracy;
- failure localization;
- repair locality;
- uncertainty calibration;
- rate of invented conditions;
- rate of omitted conditions;
- derivation completeness.

**Exploratory outcomes:**
- interpretability of the common-schema output;
- reviewer agreement;
- model preference for particular representations;
- performance under partial information;
- cross-domain transfer;
- human–machine joint interpretation;
- representation-specific failure signatures.

Cross-modal token efficiency and compression ratio are not used as primary between-arm measures because text tokens, image tokens, and serialized structural units are not directly commensurable. Within-modality efficiency may be studied exploratorily; computational efficiency is descriptive only.

## 8. Hybrid interpretation rules

Hybrid representations contain more surface material and potential redundancy. Therefore:
- hybrid arms must be content-mapped against the same atomic-condition set;
- repeated information must be declared;
- additional token or modality exposure must not be treated as complementary value by default;
- hybrid success requires performance exceeding the best constituent arm;
- the experiment should distinguish complementarity from repeated presentation.

The initial pilot includes only one controlled hybrid arm to prevent factorial expansion before the single-substrate effects are understood. Arm H's Tier 2 eligibility rules are in RSS-001 §2 (T.5.3); the conservative confirmation standard is DP.5 contrast 4 / DP.6.

## 9. Execution workflow

In order (each step's normative source in parentheses):

1. Canonical AC decomposition by the content team (BP.3 Step 1). Hash-commit.
2. Task corpus authored and hash-committed (this guide §3; BP.9 sequencing).
3. Independent arm authoring, draft round, with FA declarations (BP.3 Step 2).
4. Assumption harvest → classification → central resolution → propagation, iterated to **canonical assumption closure**; closure freeze (BP.3 Steps 3–6).
5. Final projection of arm materials against the frozen closure (BP.3 Step 6.4); Arm D authored under the VN spec by independent diagram authors (VN.8.1), including the author-convergence check (VN.8.2).
6. Post-propagation content map; certification (BP.3 Steps 7–8; BP.7).
7. Back-translation audit on frozen-closure materials, per arm (RSS-001 §1.1.2); D revision loop closes before certification (VN.8.4).
8. Extraction battery and gate, all model × representation cells; Tier 2 eligibility map committed before unblinding (Section T; DP.2).
9. Confirmatory generation and reasoning runs; common output schema (this guide §5).
10. Analysis strictly per the SAP stages (DP.3–DP.7); everything else labeled exploratory (DP.9).

## 10. Pilot (pre-pilot) recommendation

The cleanest low-cost preliminary contrast is: **Arm S versus Arm L**.

This compares serialized relational structure against prose using text-consumable inputs, common models, common output schemas, and no vision encoder.

However, this pre-pilot must not replace P3 or quietly narrow P3 into a prose-versus-schema experiment.

Its legitimate role is limited to: calibrating the content-mapping procedure; testing the back-translation audit; validating the common output schema; estimating effect sizes; determining whether the full multimodal study is technically viable.

Pre-pilot results are calibration only and enter no cell of the DP.7 outcome table (DP.8). The pilot estimate of ⟦δ_mat⟧ must be taken from post-closure pilot materials (BP.11.5). The full P3 question remains representation across multiple substrates.

## 11. Commitment inventory (hashes)

The preregistration bundle assembles, in dependency order:

1. BP commitments: canonical AC set (pre-propagation) → task corpus → draft-round FA declarations → classification rulings and rationales → final AC set (frozen closure) with provenance → post-propagation arm materials → content map → EP log and IC dispositions → certification record (BP.10).
2. VN commitments: common core spec (parameterized) → genre profiles and vocabularies → profile-to-invariant assignments → rendering pipeline identity and parameters → author-convergence results → final diagram corpus → text-leakage counts → certification record (VN.12).
3. Tier commitments: extraction materials and scoring keys (T.2); gate thresholds ⟦θ_gate, θ_inv⟧ and eligibility map (T.4–T.5; DP.2).
4. SAP commitments: ⟦δ_mat, δ_eq, δ_ni, δ_acc⟧, α allocation, regime set and per-regime minimum task counts, model family set, the specific joint-testing procedure (DP.1, DP.4).

Post-freeze amendments: none (DP.9; BP.10; VN.12). Discoveries route to BP.5 disposition or DP.7-F1.
