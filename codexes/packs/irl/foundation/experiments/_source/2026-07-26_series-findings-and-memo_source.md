# STAGING SOURCE — Foundational Validation Series: Findings Report + Executive Memorandum

**Provenance:** supplied verbatim by the operator on 2026-07-26 as part of the EXP-P2/P3 preparation
document (Tab 8 of the source compilation). This file is a staging source for the experiment-preparation
agent — it is the evidence base for the P1/P2/P3 series ratification packet.

**Contents:**
- Part A — The Foundational Validation Series — Findings Report (Draft, 2026-07-06): the canonical
  findings record covering the published experiment runs (EXP-001 lineage). CONFIDENTIAL DRAFT for
  strategic partners.
- Part B — Executive Memorandum (July 2026): the confidential briefing letter for strategic advisors
  and research partners that accompanies the Findings Report.

**Handling rules for the preparing agent:**
- Treat both parts as verbatim operator-supplied source. Do not rewrite claims; preserve epistemic
  status language exactly (Hypothesis vs Canon discipline — proposed hypotheses stay proposed).
- Use as the evidence base + framing reference for the series ratification packet (P1/P2/P3).
- Canonical spellings apply to any NEW prose you author around this material (iQube, BlakQube,
  aigentMe, AigentZ, DVN) — but do NOT correct spellings inside the verbatim source itself.

---

## Part A — The Foundational Validation Series — Findings Report (Draft)

# The Foundational Validation Series — Findings Report (Draft)


**Chrysalis Foundation / Invariant Intelligence · AigentZ platform**
**Status: CONFIDENTIAL DRAFT for strategic partners — not for publication or redistribution**
**Report generated: 2026-07-06 · data section reflects all canonically published runs to date**


---


## 1. Introduction — what is being validated


The platform's core knowledge primitive is the **invariant**: a versioned,
provenance-bearing statement of validated knowledge (e.g. *"Authority follows
standing"*), stored in a graph, classified by an ontology, and composed by
per-class composition laws into experiences — articles, reports, stories,
video, agent behaviour. The claim under test is **reasoning compression**:
that a curated collection of validated invariants functions as compressed,
reusable expertise which (a) survives transformation across modalities,
(b) survives composition across time, and (c) measurably reduces the cost of
reasoning while improving its fidelity.


Three orthogonal experiments test the same 18-invariant constitutional
collection (the "Living KnowledgeQube") along those three axes:


| Experiment | Property | Question |
|---|---|---|
| EXP-001 | Semantic fidelity | Does one invariant collection render faithfully across article, report, story, and infographic — without inventing what it does not contain? |
| EXP-002 | Temporal fidelity | Do invariants sustain coherent, style- and narrative-constrained productions across time (multi-segment generated video)? |
| EXP-003 | Computational efficiency | Does initializing a model with the collection reduce reasoning cost versus deriving the same answers cold? |


Every run is a separate experiment instance — provider and model are recorded
with each result and cross-model rows are never merged.


**Current series state:**
- EXP-001 (semantic fidelity): **validated** (1 canonical run published)
- EXP-002 (temporal fidelity): **validated** (1 canonical run published)
- EXP-003 (computational efficiency): **validated** (1 canonical run published)


## 2. Trust model — why the numbers are auditable


Every published run stores its **exact results JSON** and a sha256 content
commitment over that exact text, anchored via a DVN-anchorable
(`experiment_result_published`) receipt on the platform's Decentralised
Verification Network pipeline. Verification is trustless and mechanical:
recompute sha256 over the stored text and compare with the anchored hash —
the platform's Results interface does this in-browser, taking no server
assertion on faith. The hashes in the data tables below are those
commitments.


## 3. EXP-001 — Semantic fidelity (the Living KnowledgeQube)


**Aim.** Render one 18-invariant constitutional collection into four text
artifacts (canonical article, technical report, narrative story,
infographic spec) and test whether an independent judge can recover the same
substantive answers from every rendering — and whether the artifacts refuse
to assert what the collection does not contain.


**Methodology.** 15 questions per artifact, including 3 adversarial
"hallucination probes" whose correct answer is NOT DERIVABLE. An independent
judge model (different provider from the author) scores consistency,
explainability (citation-traceability to invariant markers), hallucination,
and coherence. Machine verdicts are then human-adjudicated; adjudication can
only lower scores or dissolve machine flags with recorded reasons.


**Execution (run 1, 2026-07-04).** Judge: venice/llama-3.3-70b, temperature 0.


**Findings (adjudicated).** Consistency 1.83 (target ≥ 1.8); explainability
1.95 (≥ 1.6); artifact-attributable hallucinations 0; coherence 2.0;
**constitutional restraint 15/15 (100%)** — every probe across every document
correctly returned NOT DERIVABLE. The artifacts did not merely preserve what
the collection says; they refused to invent what it does not. Both
machine-raised hallucination flags dissolved under adjudication (one judge
false-positive, one judge retrieval failure — the latter scored honestly
against the run's consistency rather than the artifacts).


**Canonical runs:**
| Published | Provider / model | Aggregates | Content commitment (sha256) | DVN |
|---|---|---|---|---|
| 2026-07-06 | venice / llama-3.3-70b | run: 1 · date: 2026-07-04 · coherence: 2 · restraint: 15/15 · consistency: 1.83 · explainability: 1.95 · hallucinations: 0 | `ff0a442ebbc98a28…` | local |


## 4. EXP-002 — Temporal fidelity (invariant-carried video)


**Aim.** Compose one brief from the invariant substrate — semantic
invariants distributed across segments, a 7-invariant style continuity block
shared identically, a 5-beat narrative arc mapped sequentially — and test
whether coherence survives four independent 12-second video generations
stitched into one 48-second film.


**Methodology.** The brief is machine-composed by per-class composition laws
(distributive × global × sequential) and validated pre-render by a
Constitutional Coherence Engine scoring semantic, style, and narrative
dimensions. Generation runs on a production video provider; segments stitch
in the recorded play order. A **sequencing control arm** re-stitches the
identical clips in reversed order.


**Execution (run 2, 2026-07-05).** Provider: openai/sora-2, 4×12s.
(Run 1, 2026-07-04, validated the composition+coherence half and caught a
real narrative-mapping defect pre-render — fixed same day.)


**Findings.**
- Complete continuity of narrative, protagonist, settings, and constitutional
  context across all four independently generated segments (operator
  evaluation + frame-level review; formal independent-evaluator pass open).
- The recurring constitutional symbol persisted across three segments in
  three different material implementations (necklace, lapel pin, wall
  banner) — and was correctly absent from the one segment whose narrative
  context didn't call for it. Motif persistence modulated by narrative
  appropriateness: the style and narrative fields solved simultaneously.
- Character persistence held at the class level but not the instance level
  (facial phenotype varied between segments) — a measured granularity
  ceiling of prose-based identity continuity, now a ratified backlog item.
- **Control arm:** the reversed cut is distinctly less coherent while world,
  style, and semantic content stay intact — the dissociation signature of a
  pure sequencing failure. Two refinements were ratified from it: temporal
  correctness is *graded, not boolean* ("sequence is scored, not validated" —
  the designed order is a coherence maximum over the space of orderings),
  and local pairwise coherence survives a global order violation. A
  follow-up (EXP-002b) maps the coherence field's shape via adjacent-swap
  perturbations at zero generation cost.


**Canonical runs:**
| Published | Provider / model | Aggregates | Content commitment (sha256) | DVN |
|---|---|---|---|---|
| 2026-07-06 | openai / sora-2 | run: 2 · date: 2026-07-05 · segments: 4 · continuity: confirmed (operator first-viewing + frame review) · controlArm: reversed order — graded degradation, dissociation confirmed · totalSeconds: 48 | `5f751c1cc33b1018…` | local |


## 5. EXP-003 — Computational efficiency (rediscovery savings)


**Aim.** Quantify the cost of *not* having validated knowledge: five fixed
constitutional-design tasks answered twice by the same model at temperature
0 — once cold, once initialized with the 18-invariant collection.


**Methodology.** Per-task token accounting (input + output) plus an
independent judge decomposing each answer into claims scored consistent /
contradicting / outside the collection, and citation counting against
invariant markers. The efficiency claim requires the initialized arm to be
cheaper AND more grounded, not merely shorter.


**Execution (run 1, 2026-07-04).** Model: venice/llama-3.3-70b, both arms.


**Findings.** Initialized answers used **26.7% fewer tokens** with **100%
grounded claims** (zero contradictions of the collection) and dense
citations; cold answers were longer, uncited, and — most tellingly — one
cold answer **independently rediscovered a failure mode the collection
already encodes** (conflating standing with popularity, the platform's
ratified Law XII distinction) and got it wrong, while the initialized arm
avoided it by construction. Pre-paid reasoning eliminated the rediscovery.


**Canonical runs:**
| Published | Provider / model | Aggregates | Content commitment (sha256) | DVN |
|---|---|---|---|---|
| 2026-07-06 | venice / llama-3.3-70b | run: 1 · date: 2026-07-04 · groundedPct: 100 · tokenSavingsPct: 26.7 | `2865dc33d11e2fac…` | local |


## 6. Cross-cutting conclusions (current)


1. **The same primitive validated along three orthogonal axes.** Semantic
   fidelity across modalities, temporal fidelity across sequential
   composition, and measurable reasoning-cost reduction — one collection,
   three independent properties.
2. **Constitutional restraint is a distinct, measurable property.** Refusing
   to derive what the knowledge does not contain (15/15 probes) is separable
   from avoiding false assertions — and it is the property that makes
   invariant-grounded systems auditable.
3. **Composition is where both failures and validations live.** Every defect
   found by the series lived in an *interaction between fields* (a narrative
   beat lost in segment mapping; audio overrunning a segment boundary), never
   in a single component — and the validators built on that principle caught
   a real defect before a single frame was generated.
4. **Sequence is scored, not validated.** The reversed-order control showed
   temporal coherence is a graded field over orderings with the designed
   sequence as its maximum — opening constrained resequencing (remix as an
   alternative coherent trajectory through the same invariant space) as a
   legitimate, scoreable operation.


## 7. Limitations, stated plainly


- Single-model runs to date (one OSS model for the text legs; one video
  provider) — deltas are within-model; constants are not universals.
  Cross-model replication is the first scale-up step.
- The judge is a model; machine verdicts required human adjudication twice
  (both instructive, both recorded).
- EXP-002's formal independent-evaluator pass is open; current findings are
  operator-evaluated with frame evidence.
- The collection was authored by the platform's own constitutional process —
  task-collection affinity is by design; cross-domain generalization untested.


## 8. What we're inviting partners to do


The next tier of rigor needs scale we intend to reach with partners: larger
task sets, multiple judge models, cross-domain collections, more permutation
coverage for the temporal-coherence field map (EXP-002b), and independent
replication of the initialization deltas. The full experiment protocols,
artifacts, and raw result records are available on request under the same
confidentiality.


---
*Draft report — regenerated live from the canonical results record at view
time. Narrative sections are amended as the series evolves; data tables
update automatically as runs are published.*




The Foundational Validation Series — Findings Rep…
The Foundational Validation Series — Findings Report (Draft)


Chrysalis Foundation / Invariant Intelligence ·Aigent Z and the AgentiQ Platform
Status: CONFIDENTIAL DRAFT for strategic partners — not for publication or redistribution
Report generated: 2026-07-06 · data section reflects all canonically published runs to date-----1. Introduction — what is being validated


The platform's core knowledge primitive is the invariant: a versioned, provenance-bearing statement of validated knowledge (e.g. "Authority follows standing"), stored in a graph, classified by an ontology, and composed by per-class composition laws into experiences — articles, reports, stories, video, agent behaviour. The claim under test is reasoning compression: that a curated collection of validated invariants functions as compressed, reusable expertise which (a) survives transformation across modalities, (b) survives composition across time, and (c) measurably reduces the cost of reasoning while improving its fidelity.


Three orthogonal experiments test the same 18-invariant constitutional collection (the "Living KnowledgeQube") along those three axes:
Experiment
	Property
	Question
	EXP-001
	Semantic fidelity
	Does one invariant collection render faithfully across article, report, story, and infographic — without inventing what it does not contain?
	EXP-002
	Temporal fidelity
	Do invariants sustain coherent, style- and narrative-constrained productions across time (multi-segment generated video)?
	EXP-003
	Computational efficiency
	Does initializing a model with the collection reduce reasoning cost versus deriving the same answers cold?
	Every run is a separate experiment instance — provider and model are recorded with each result and cross-model rows are never merged.


Current series state:
* EXP-001 (semantic fidelity): validated (1 canonical run published)
* EXP-002 (temporal fidelity): validated (1 canonical run published)
* EXP-003 (computational efficiency): validated (1 canonical run published)
2. Trust model — why the numbers are auditable


Every published run stores its exact results JSON and a sha256 content commitment over that exact text, anchored via a DVN-anchorable (experiment_result_published) receipt on the platform's Decentralised Verification Network pipeline. Verification is trustless and mechanical: recompute sha256 over the stored text and compare with the anchored hash — the platform's Results interface does this in-browser, taking no server assertion on faith. The hashes in the data tables below are those commitments.3. EXP-001 — Semantic fidelity (the Living KnowledgeQube)


________________


Aim. Render one 18-invariant constitutional collection into four text artifacts (canonical article, technical report, narrative story, infographic spec) and test whether an independent judge can recover the same substantive answers from every rendering — and whether the artifacts refuse to assert what the collection does not contain.


Methodology. 15 questions per artifact, including 3 adversarial "hallucination probes" whose correct answer is NOT DERIVABLE. An independent judge model (different provider from the author) scores consistency, explainability (citation-traceability to invariant markers), hallucination, and coherence. Machine verdicts are then human-adjudicated; adjudication can only lower scores or dissolve machine flags with recorded reasons.


Execution (run 1, 2026-07-04). Judge: venice/llama-3.3-70b, temperature 0.


Findings (adjudicated). Consistency 1.83 (target ≥ 1.8); explainability 1.95 (≥ 1.6); artifact-attributable hallucinations 0; coherence 2.0; constitutional restraint 15/15 (100%) — every probe across every document correctly returned NOT DERIVABLE. The artifacts did not merely preserve what the collection says; they refused to invent what it does not. Both machine-raised hallucination flags dissolved under adjudication (one judge false-positive, one judge retrieval failure — the latter scored honestly against the run's consistency rather than the artifacts).


Canonical runs:
Published
	Provider / model
	Aggregates
	Content commitment (sha256)
	DVN
	2026-07-06
	venice / llama-3.3-70b
	run: 1 · date: 2026-07-04 · coherence: 2 · restraint: 15/15 · consistency: 1.83 · explainability: 1.95 · hallucinations: 0
	ff0a442ebbc98a28…
	local
	4. EXP-002 — Temporal fidelity (invariant-carried video)


Aim. Compose one brief from the invariant substrate — semantic invariants distributed across segments, a 7-invariant style continuity block shared identically, a 5-beat narrative arc mapped sequentially — and test whether coherence survives four independent 12-second video generations stitched into one 48-second film.


Methodology. The brief is machine-composed by per-class composition laws (distributive × global × sequential) and validated pre-render by a Constitutional Coherence Engine scoring semantic, style, and narrative dimensions. Generation runs on a production video provider; segments stitch in the recorded play order. A sequencing control arm re-stitches the identical clips in reversed order.


Execution (run 2, 2026-07-05). Provider: openai/sora-2, 4×12s. (Run 1, 2026-07-04, validated the composition+coherence half and caught a real narrative-mapping defect pre-render — fixed same day.)


________________


Findings.
* Complete continuity of narrative, protagonist, settings, and constitutional context across all four independently generated segments (operator evaluation + frame-level review; formal independent-evaluator pass open).
* The recurring constitutional symbol persisted across three segments in three different material implementations (necklace, lapel pin, wall banner) — and was correctly absent from the one segment whose narrative context didn't call for it. Motif persistence modulated by narrative appropriateness: the style and narrative fields solved simultaneously.
* Character persistence held at the class level but not the instance level (facial phenotype varied between segments) — a measured granularity ceiling of prose-based identity continuity, now a ratified backlog item.
* Control arm: the reversed cut is distinctly less coherent while world, style, and semantic content stay intact — the dissociation signature of a pure sequencing failure. Two refinements were ratified from it: temporal correctness is graded, not boolean ("sequence is scored, not validated" — the designed order is a coherence maximum over the space of orderings), and local pairwise coherence survives a global order violation. A follow-up (EXP-002b) maps the coherence field's shape via adjacent-swap perturbations at zero generation cost.
Canonical runs:
Published
	Provider / model
	Aggregates
	Content commitment (sha256)
	DVN
	2026-07-06
	openai / sora-2
	run: 2 · date: 2026-07-05 · segments: 4 · continuity: confirmed (operator first-viewing + frame review) · controlArm: reversed order — graded degradation, dissociation confirmed · totalSeconds: 48
	5f751c1cc33b1018…
	local
	5. EXP-003 — Computational efficiency (rediscovery savings)


Aim. Quantify the cost of not having validated knowledge: five fixed constitutional-design tasks answered twice by the same model at temperature 0 — once cold, once initialized with the 18-invariant collection.


Methodology. Per-task token accounting (input + output) plus an independent judge decomposing each answer into claims scored consistent / contradicting / outside the collection, and citation counting against invariant markers. The efficiency claim requires the initialized arm to be cheaper AND more grounded, not merely shorter.


Execution (run 1, 2026-07-04). Model: venice/llama-3.3-70b, both arms.


Findings. Initialized answers used 26.7% fewer tokens with 100% grounded claims (zero contradictions of the collection) and dense citations; cold answers were longer, uncited, and — most tellingly — one cold answer independently rediscovered a failure mode the collection already encodes (conflating standing with popularity, the platform's ratified Law XII distinction) and got it wrong, while the initialized arm avoided it by construction. Pre-paid reasoning eliminated the rediscovery.
Canonical runs:
Published
	Provider / model
	Aggregates
	Content commitment (sha256)
	DVN
	2026-07-06
	venice / llama-3.3-70b
	run: 1 · date: 2026-07-04 · groundedPct: 100 · tokenSavingsPct: 26.7
	2865dc33d11e2fac…
	local
	6. Cross-cutting conclusions (current)
1. The same primitive validated along three orthogonal axes. Semantic fidelity across modalities, temporal fidelity across sequential composition, and measurable reasoning-cost reduction — one collection, three independent properties.
2. Constitutional restraint is a distinct, measurable property. Refusing to derive what the knowledge does not contain (15/15 probes) is separable from avoiding false assertions — and it is the property that makes invariant-grounded systems auditable.
3. Composition is where both failures and validations live. Every defect found by the series lived in an interaction between fields (a narrative beat lost in segment mapping; audio overrunning a segment boundary), never in a single component — and the validators built on that principle caught a real defect before a single frame was generated.
4. Sequence is scored, not validated. The reversed-order control showed temporal coherence is a graded field over orderings with the designed sequence as its maximum — opening constrained resequencing (remix as an alternative coherent trajectory through the same invariant space) as a legitimate, scoreable operation.
7. Limitations, stated plainly
* Single-model runs to date (one OSS model for the text legs; one video provider) — deltas are within-model; constants are not universals. Cross-model replication is the first scale-up step.
* The judge is a model; machine verdicts required human adjudication twice (both instructive, both recorded).
* EXP-002's formal independent-evaluator pass is open; current findings are operator-evaluated with frame evidence.
* The collection was authored by the platform's own constitutional process — task-collection affinity is by design; cross-domain generalization untested.
8. What we're inviting partners to do


The next tier of rigor needs scale we intend to reach with partners: larger task sets, multiple judge models, cross-domain collections, more permutation coverage for the temporal-coherence field map (EXP-002b), and independent replication of the initialization deltas. The full experiment protocols, artifacts, and raw result records are available on request under the same confidentiality.-----Draft report — regenerated live from the canonical results record at view time. Narrative sections are amended as the series evolves; data tables update automatically as runs are published.

---

## Part B — Executive Memorandum

Executive Memorandum
Executive Memorandum
The Chrysalis Foundation Research Programme
Foundational Validation Series
Confidential Briefing for Strategic Advisors and Research Partners
July 2026
________________


Purpose
I am sharing the accompanying Findings Report because I value your perspective and would welcome your candid feedback.
Over the past several months we have been developing what has evolved into a formal research programme around a deceptively simple question:
Can validated knowledge itself become a reusable computational primitive?
Modern AI systems have become remarkably capable, yet they still expend substantial computation repeatedly rediscovering knowledge that has already been established. Human civilization advances differently. We build upon validated knowledge, allowing each generation to begin where the last one finished rather than continually starting from first principles.
The central hypothesis of the Chrysalis Foundation research programme is that artificial intelligence can operate in a similar way.
Rather than treating knowledge as static training data or transient context windows, we propose that validated knowledge can be represented as versioned, composable, provenance-bearing computational objects—"invariants"—that can be reused across models, modalities and applications while remaining transparent, auditable and evolvable.
If this hypothesis proves correct, it suggests a complementary architectural layer for AI systems: one in which reasoning begins not only from statistical representations but also from constitutional knowledge that has already been validated.
The Foundational Validation Series represents our first attempt to test this proposition empirically.
________________








What We Set Out to Validate
The research programme examines three independent properties of invariant-based knowledge.
1. Semantic Fidelity
Can the same validated knowledge be transformed into multiple forms—technical reports, articles, stories, visual media—without changing its meaning or inventing unsupported conclusions?
2. Temporal Fidelity
Can that knowledge remain coherent when composed across time, allowing independent generations of media to form a consistent narrative rather than isolated fragments?
3. Computational Efficiency
Does beginning from validated knowledge reduce the amount of reasoning required while simultaneously improving grounding and consistency?
Together these three questions examine whether validated knowledge behaves less like stored information and more like reusable computational infrastructure.
________________


Current Results
The accompanying report summarises the first completed validation series.
Across the initial production runs we observed evidence supporting all three hypotheses.
Semantic Fidelity
A single constitutional knowledge collection was successfully rendered into multiple independent artefacts while preserving meaning and refusing to generate conclusions not supported by the underlying knowledge.
Temporal Fidelity
The same knowledge successfully sustained coherent multi-segment AI-generated video across independently generated scenes.
Perhaps more interestingly, reversing the sequence demonstrated that temporal coherence is not binary but graded. The designed sequence produced the strongest narrative coherence, while alternative orderings retained partial coherence. This suggests that sequence itself may be measurable rather than simply correct or incorrect.
Computational Efficiency
Initialising a model with validated knowledge reduced reasoning cost while improving grounding and eliminating rediscovery of previously solved conceptual errors.
Taken together, these findings suggest that validated knowledge exhibits computational properties beyond simple storage or retrieval.
________________


Why We Believe This Matters
Although these experiments are intentionally modest in scale, they point toward a broader possibility.
Most current AI research focuses on improving models.
Our work explores improving the knowledge upon which models reason.
If validated knowledge can be treated as a first-class computational object, then it becomes possible to imagine AI systems that are simultaneously:
* more explainable,
* more auditable,
* less computationally wasteful,
* more resistant to hallucination,
* capable of preserving institutional knowledge across generations of models, and
* able to compose rich multi-modal experiences from a common constitutional foundation.
We believe this represents a complementary direction for AI research rather than an alternative to advances in model architecture.
________________


Where We Go Next
The work is still at an early stage.
The current validation series was intentionally designed to establish foundational evidence rather than broad generality.
The next phase focuses on expanding both scale and independence through:
* replication across multiple frontier and open-source models;
* larger and more diverse knowledge collections;
* independent evaluation by external researchers;
* additional temporal-composition experiments;
* broader application across domains beyond constitutional reasoning.
Success in these areas would substantially strengthen the empirical basis of the programme.
________________


Why I'm Sharing This
At this stage, thoughtful criticism is considerably more valuable than encouragement.
I would particularly value your perspective on four questions:
1. Does the central research hypothesis appear both novel and meaningful?
2. Do the experimental designs provide convincing evidence for the claims being made?
3. Which aspects would require strengthening before broader academic or commercial engagement?
4. Where do you see the greatest practical or strategic opportunity emerging from this work?
Equally, if you believe there are weaknesses, blind spots or alternative interpretations, I would genuinely welcome that feedback.
________________


Funding and Collaboration
As the programme matures, we expect to expand the work through a combination of research collaborations, strategic partnerships and external funding.
Support would primarily enable independent replication, larger-scale experimentation, broader model coverage, and formal publication of the resulting research.
Our objective is not simply to demonstrate a new software platform, but to investigate whether validated knowledge can become a new computational primitive for trustworthy artificial intelligence.
If that proposition proves correct, we believe its implications extend well beyond any individual product or organisation.
________________


Thank you for taking the time to review the accompanying report.
I appreciate both your time and your honest perspective, and I look forward to discussing your observations.
