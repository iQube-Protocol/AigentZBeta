# CRP-002 — Invariant Intelligence: Intent-Driven Knowledge Compression for High-Fidelity Generative AI

**Constitutional Research Program · Programme Charter · v1 · Status: chartered 2026-07-09 (operator ratification)**
Umbrella: **CRP-001** (Constitutional Research Program) — the first programme formally chartered under it.
Institution: **metaMe IRL** (the metaMe Invariant Research Lab; CFS-019, `docs/platform-ontology.md § metaMe IRL`).
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`
Substrate: `inv.epistemology.119`–`120` (knowledge as a computational object), the Invariant Intelligence layer (CFS-019 Layer I).
Companion to: CFS-008 (Reasoning Compression), CFS-015 (Chrysalis 2.0), CFS-018 (Platform Sovereignty), CFS-019 (the institution).

> **This charter is written to double as the spine of a grant proposal.** Its title, abstract, workstreams, and research questions are the fundable unit. Nothing here blocks, gates, or sequences a Chrysalis deliverable (CRP-001 interface rule); the programme *feeds* the platform, it is not part of it.

---

## Abstract

Contemporary AI treats knowledge organisation as a retrieval problem: *what information is relevant?* This programme advances a different thesis — that the governing bottleneck is not the model but the **organisation of knowledge before the model ever begins to think**, and that the right unit of that organisation is the **invariant**, not the document.

We formalise **intent as a projection operator** over knowledge space: intent does not retrieve all relevant information; it *projects* the space onto the minimal set of governing invariants a purpose requires. Compression, on this account, is not absolute but **intent-relative** — the same corpus under different intent yields different invariant sets. The programme's central claim is measurable: *if intent determines which invariants matter, and those invariants determine reasoning quality, then reasoning initialised from intent-selected invariants outperforms retrieval-based approaches at a fraction of the context.*

This reframes the discipline the platform already named — **Computational Epistemology** (`inv.epistemology.119`: "Knowledge is a computational object: its preservation, composition, and reasoning-compression are measurable properties") — by adding its missing operator: **intent**.

---

## 0 · The Three Computational Compressions — the central claim, stated precisely (2026-07-18 amendment)

> **Placed at the front of the charter deliberately.** This is the sharpened statement of the programme's central claim, produced in dialogue with **Austin and Austin's agent**. It is stated up front so it is not re-litigated: **Invariant Intelligence is neither prompt engineering nor context engineering. It is a distinct pre-inference compression — of reasoning — with a distinct optimization objective.** Everything else in this charter is downstream of this section. Canonized as `inv.epistemology.138`–`141` + `inv.reasoning.142`.

### 0.1 The three compressions

Every intelligent system performs a compression before inference. **The discriminating question is what it compresses.**

| Discipline | Compresses | Optimization target | Output |
|---|---|---|---|
| **Prompt engineering** | instructions | instruction formulation | a prompt |
| **Context engineering** | knowledge | information relevance | curated knowledge |
| **Invariant Intelligence** | **reasoning** | **computational reuse** | an invariant substrate |

Elevating this from *three engineering techniques* to *three computational compressions* ties it into the Institute's compression theory (CFS-008) and exposes why this is **not "better context": the optimization target is different.** *(Canonical: `inv.epistemology.140`.)*

### 0.2 The Pre-Prompt Reasoning Theorem

> **Prompt engineering optimizes how reasoning is requested. Context engineering optimizes what knowledge is supplied. Invariant Intelligence optimizes which reasoning need not occur again.**

The whole field in one sentence. *(Canonical: `inv.epistemology.138` — validated, because the optimization claim is exactly what the Institute exists to test.)*

### 0.3 The purpose, and the independent variable

> **The purpose of Invariant Intelligence is not to retrieve better knowledge. It is to reduce the amount of reasoning that must be performed at inference time by reusing previously validated structural reasoning.**

This fixes the programme's independent variable: **not prompts, not context, but the reuse of previously validated reasoning through invariant structures.** Context engineering asks *"given an intent, what information should I provide?"* (optimizing retrieval); Invariant Intelligence asks *"given an intent, what reasoning should never need to happen again?"* (optimizing reuse). *(Canonical: `inv.epistemology.141` — validated, a falsifiable claim owed EXP-nnn confirmation.)*

### 0.4 What an invariant *is* (tightened)

> **A structural invariant is a persistent representation of previously validated reasoning that remains sufficient across a class of intents and can therefore be reused rather than recomputed.**

Not a **fact**, not **knowledge**, not **truth** — *previously validated reasoning*. This is the criterion that also grounds IRL Principle 005 (`inv.epistemology.133`). *(Canonical: `inv.epistemology.139`.)*

### 0.5 The Representation Principle

> **Representations are not invariants. They are manifestations of invariants.** The same structural invariant may be represented as natural language, symbolic logic, a graph, executable code, or a future world-model representation. The representation is constrained by the computational substrate; the invariant is not.

If two pre-prompt processes serialize to similar text, that does **not** imply they performed the same computation — one may have rediscovered the relationships from raw knowledge, the other assembled previously validated invariants. The representation is the transport; the science concerns the process that produced it. This cleanly separates three concerns that were being conflated: **structural invariance** (the science), **constitutional governance** (how invariants evolve, are trusted, versioned, become authoritative — the runtime's job), and **representation** (how an invariant is manifested). *(Canonical: `inv.reasoning.142`.)*

**Reconciliation with the 2026-07-16 Representation Gauntlet amendment.** That amendment names *"representation is the independent variable"* for **EXP-010** — correctly, because the gauntlet *varies* representation (invariant-object vs flattened-text vs conventional-prompt) as the experimental handle to isolate whether the substrate matters (its C-vs-D split isolates decomposition itself). This §0 refines, not contradicts, that: the surface representation is the experimental **handle**; what the handle is testing for is the **substrate** — previously validated reasoning — and the programme's optimization **objective** is the reuse of that substrate. "An invariant is a computational object, not a sentence" (EXP-010) and "representations are manifestations of invariants" (§0.5) are the same claim from two directions.

### 0.6 Why this is at the front

The register-collapse this prevents: reducing everything to alphanumerics is a known limitation of LLMs relative to human cognition (language is a proxy for reality, the gap large world models attempt to address). Naming the substrate — not the serialization — as the object of study is what keeps Invariant Intelligence a distinct category rather than a re-description of retrieval. The pipeline placement, the DNA analogy, the magic-numbers worked example, the seminar-not-experiment methodology, and the full response to Austin are in the supporting amendment at the end of this charter.

---

## 1. The thesis — intent is the primary computational primitive

Knowledge compression is downstream. The prior scientific question is: **how do you systematically discover the *right* invariants?** That discovery begins *before* curation.

- **Current AI asks:** *What information is relevant?*
- **Invariant Intelligence asks:** *What governing principles are relevant to this intent?*

That is a fundamentally different retrieval problem — and we argue, the correct one.

### Intent as a projection function

The total knowledge space is enormous. Intent behaves like a **projection operator**: it maps the space onto the subset of invariants needed for a purpose; everything else disappears.

> **Intent:** *Design a constitutional onboarding experience.*
> **Corpus:** identity · UX · governance · standing · privacy · AI · accessibility · law · onboarding · incentives · education.
> **Projected invariant set:** *minimum disclosure · progressive agency · action gives standing · human-first · explainability.*

An extraordinary reduction — and the reduction *is* the curation. **Curation is no longer an activity; it is the *result* of discovering the invariants.**

### Compression is intent-relative

The same corpus under different intent projects a different invariant set — the knowledge did not change, the projection did:

| Intent | Projected invariants |
|---|---|
| Explain to a child | fairness · helping · responsibility · privacy |
| Design an API | authentication · delegation · disclosure · verification |
| Policy analysis | governance · rights · accountability · jurisdiction |

This makes the compression process **programmable**: `Intent → select compression strategy → extract invariants → generate`.

---

## 2. The reframed iQube pipeline

The historical pipeline placed curation as an activity between intent and analysis:

```
Intent → Curation → Risk → Value → Price
```

The reframed pipeline makes intent the organising principle of the entire downstream flow:

```
Intent
  ↓
Invariant Discovery        ← curation is the RESULT of this, not a separate step
  ↓
Knowledge Compression
  ↓
KnowledgeQube              ← the executable, versioned compressed knowledge object
  ↓
Risk Analysis
  ↓
Value Analysis
  ↓
Consequence Engineering
  ↓
Pricing
```

**The elegant consequence (the Lehigh connection preserved):** every downstream stage inherits the *same* invariant basis. Risk, Value, Consequence, and Price are **no longer independent analyses** — they are **constitutional projections of one compressed knowledge object (the KnowledgeQube)**. Intent is not merely the first box; it is the basis vector for the whole pipeline.

There is deliberately **no retrieval at the front**. The first job is not *fetch what's relevant* — it is *determine what kind of knowledge should exist* for this intent.

---

## 3. The Intent Grammar (hypothesis: intent has an ontology)

We hypothesise that intent itself has an ontology — not a list of intents, but a small set of **intent primitives**, each of which naturally selects a different class of invariants. Candidate primitives (WP1 refines this):

`Acquire-Knowledge · Explain · Compare · Design · Predict · Diagnose · Evaluate · Create · Govern · Negotiate · Collaborate · Teach · Verify`

If the grammar holds, intent classification becomes the first computational step of reasoning, and the invariant-selection function becomes a mapping from intent primitives (and their compositions) to invariant classes. This is the object WP1 formalises and the machine-readable contract Phase 1 pins.

---

## 4. The four workstreams

### WP1 — Intent Science
Develop a formal taxonomy and computational representation of intent. How do we **classify, compose, and resolve** intent? How does intent determine the required reasoning substrate? *Deliverable: the intent grammar + a computational intent representation + a classifier.*

### WP2 — Invariant Discovery
Develop algorithms and methodologies for extracting **candidate invariants** from corpora. NMF, graph methods, embeddings, ontologies, and human constitutional review become **tools, not ends**. *Deliverable: a discovery pipeline that proposes candidate invariants for operator ratification (Law XI).*

### WP3 — Knowledge Compression
Determine how invariant sets are **represented, validated, assembled, and versioned** as executable **KnowledgeQubes**. Measure compression ratios versus reasoning fidelity (extends CFS-008 / EXP-003). *Deliverable: the KnowledgeQube assembly + versioning contract + the compression-vs-fidelity curve.*

### WP4 — Invariant Runtime
Evaluate whether reasoning **initialised from compressed invariants** outperforms conventional retrieval-based approaches across multiple domains and modalities. *Deliverable: the head-to-head evaluation harness + cross-domain/cross-modal results.*

---

## 5. The founding Validation Series — three measurable research questions

Per CFS-019's nomenclature (Research Programmes → **Validation Series** → Experiments), CRP-002's founding series turns the three research questions into experiments that extend the existing `EXPERIMENT_REGISTRY` (`types/research.ts`). Each is hash-committed and DVN-anchorable like the Foundational Validation Series.

| Experiment | Workstreams | Research question (measurable claim) | Metric |
|---|---|---|---|
| **EXP-006 — Intent Projection Fidelity** | WP1 + WP2 | Can intent reliably predict the **minimal invariant set** required for high-fidelity reasoning? | Held-out judge scores *sufficiency* (nothing needed is missing) and *non-redundancy* (nothing present is unused) of the projected set vs a human-curated reference |
| **EXP-007 — Reasoning Entropy Reduction** | WP3 + WP4 | Does invariant discovery **reduce reasoning entropy** relative to document retrieval? | Reasoning fidelity + variance (drift/entropy) of invariant-initialised generation vs retrieval-initialised, at matched or lower token budget |
| **EXP-008 — Cross-Modal Invariant Reuse** | WP4 | Are invariant sets **reusable across downstream modalities**? | Drift metric across article / story / image generation from ONE invariant seed (formalises the 2026-07-08 observation that a single seed generated all three without significant drift) |

Design discipline (inherited from the Foundational Validation Series, CRP-001): failures are data, never masked; the compression baseline is the honest retrieval control; every publish names its question and its metric.

---

## 6. Founding assets (transferred at charter)

CRP-002 does not start empty. It inherits the Chrysalis v2 foundation as apparatus:

- **The reasoning-compression instrument** — CFS-008 + **EXP-003** (rediscovery-savings benchmark): the compression-vs-fidelity measurement already runs.
- **The invariant substrate** — the seed crystal + invariants DB (Standing/Reach), the ontology resolver, the Invariant Registry, hash-committed publication, DVN anchoring.
- **Intent apparatus** — `services/iqube/intentQube.ts` and the orchestration NBE (intent objects already exist in partial form).
- **The iQube pipeline** — `services/consequence/pipeline.ts` (the stages CRP-002 reframes around the invariant basis).
- **The experiment machinery** — the Experiment Lab (front-end runners, canonical publication, the Report tab) + the `RESEARCH_PROGRAMMES` / `EXPERIMENT_REGISTRY` contracts in `types/research.ts`.

---

## 7. Novelty and impact — why this is fundable

The programme sits at an intersection two communities rarely share:

- the **AI-systems** community (optimisation, representations, inference), and
- the **knowledge-management / ontology** community (concepts, taxonomies, governance, semantics).

Invariant Intelligence says: *the future of AI is not just better models — it is better **knowledge substrates**.* That is a materially different agenda from scaling context windows. If the thesis holds, the platform is not another AI product but an **experimental laboratory for a new computational layer between knowledge and intelligence** — addressing a question the field is beginning to feel but few articulate:

> **What if the bottleneck is no longer the model, but the organisation of knowledge before the model ever begins to think?**

Fundable because it is (a) a clearly stated, falsifiable thesis; (b) measurable by three defined experiments; (c) already instrumented; and (d) attractive to academic collaborators, enterprise partners, and research funders across both communities.

---

## 8. Interface with Chrysalis (CRP-001 rule, inherited)

- **CRP-002 → Chrysalis:** findings hand back as **ratification proposals** (the system reveals, humans ratify) and as designed experiments Chrysalis may execute as acceptance tests. A validated intent→invariant projection function is a candidate to power the live Intent Engine (Phase 3).
- **Chrysalis → CRP-002:** production telemetry, receipts, and validation events become research data (the flywheel is shared infrastructure).
- **Never:** a CRP-002 question blocking a Chrysalis deliverable, or a Chrysalis deadline truncating a CRP-002 investigation.

---

## 9. Governance

Law XI applies in full: **CRP-002 proposes; human constitutional authority ratifies.** Discovered invariants enter the substrate as `proposed`, never `canonical`, until operator ratification (the `BehaviouralInvariant.status` discipline, `inv.cybernetics.111`). Results publish through the canonical pipeline (exact-text storage, sha256 commitment, DVN-anchorable receipts) — the trust model is identical to production because the flywheel is shared.

---

## 10. Programme plan (phased; each phase ratification-gated)

| Phase | Deliverable | Status |
|---|---|---|
| **0** | This charter + the metaMe IRL naming canonisation (`docs/platform-ontology.md`, CFS-019 note resolved) | **DELIVERED (this document)** |
| **1** | Contract-first primitives: the reframed iQube pipeline as order-pinned constitutional data + the Intent Grammar taxonomy (`types/`), each canary-guarded | **DELIVERED** — `types/invariantIntelligence.ts` (IQUBE_PIPELINE, PROJECTION_STAGES, INTENT_PRIMITIVES, INVARIANT_CONCERN_CLASSES, CANDIDATE_INTENT_BIAS + pure helpers); canary `tests/invariant-intelligence.test.ts` pins the pipeline order (curation absent), the projection-stage tail, the 13-primitive set, and total intent→concern coverage (structure, not the map's truth) |
| **2** | The founding Validation Series — EXP-006/007/008 registered in `EXPERIMENT_REGISTRY` (`IIVS` series, programme E), with runners + canonical publication | **In progress.** Registered (`types/research.ts`: EXP-006/007/008, `IIVS` series, programme E). CIRS-v0.1 stood up (`services/experiments/cirs.ts`) — experimental, unratified. EXP-006 **Stage A** built (`services/experiments/irlExp001.ts`: pure projection-fidelity + structural Invariant-Delta core + sovereign prediction + orchestrator), admin route `POST /api/experiments/irl-exp001`, canary `tests/irl-exp001.test.ts`. Remaining: a runner, canonical publication, the semantic-judge Δ pass, and Stage B (does the predicted set reason better?) |
| **3** | The Intent→Projection runtime seam — an *Intent Engine* composing intentQube + invariant registry + EXP-003 compression + KnowledgeQube assembly (projects, does not retrieve) | After Phase 2 findings |

---

## Ratification record

- [x] **v1 CHARTERED — 2026-07-09, operator ratification.** metaMe IRL adopted as the institution's primary name; CRP-002 chartered as the first programme under CRP-001; the reframed iQube pipeline, the intent-as-projection thesis, the intent grammar, the four workstreams, and the three-experiment founding Validation Series adopted as the programme's scope.
- [ ] Phase 1 contracts — the reframed pipeline + intent grammar as typed, canary-guarded constitutional data (own ratification).
- [ ] EXP-006/007/008 designs — each experiment's protocol is its own ratification before spend (CRP-001 discipline).

## Honest limits

- The intent grammar's 13 primitives are a **hypothesis**, not a finding — WP1 refines or refutes them; Phase 1 pins whatever is ratified, not this candidate list as fact.
- The three research questions are **stated, not yet answered.** EXP-006/007/008 are designed-and-open; the cross-modal reuse result (EXP-008) has a suggestive prior observation, not a measured claim.
- "KnowledgeQube" is named as the executable compressed-knowledge object; its assembly/versioning contract is WP3's deliverable, not asserted here.
- No runtime is built by this charter. Phase 3 (the live Intent Engine) is gated on Phase 2 findings — the programme measures the thesis before the platform depends on it.

---

## Amendment — Aletheon review integrated (2026-07-09)

*(Framing + design review by Aletheon, the operator's co-agent, relayed and endorsed by operator direction. Integrated as a charter amendment, not a redesign. Machine-readable substrate: `types/invariantIntelligence.ts` gains `INVARIANT_INTELLIGENCE_WORKSTREAMS` (WP0 added), `CanonicalInvariantReference`/`CIRSConfidence`, `ProjectionRule`, `EXP007_ARMS`, `PROPAGATION_MODALITIES`; canary `tests/invariant-intelligence.test.ts` pins them.)*

**1. The reference is the CIRS, not a "gold set."** "Gold set" implies the truth is already discovered — it is not; the programme exists to discover it. The reference EXP-006 judges against is the **Canonical Invariant Reference Set (CIRS)** — versioned and cumulative (`CIRS-v0.1` `experimental`/`ratified:false` → `CIRS-v1.0` `ratified:true` on operator ratification, Law XI). The science is explicit about what is still experimental vs ratified.

**2. EXP-006 is two-stage — renamed *Intent → Invariant Projection Fidelity*.** The rename reinforces the thesis: intent projects into invariant SPACE, it does not retrieve documents.
   - **Stage A — prediction fidelity:** `Intent → predicted invariants → compare to the CIRS`. Metrics: overlap, precision, recall, semantic similarity.
   - **Stage B — downstream reasoning quality:** generate outputs from BOTH invariant sets (predicted + CIRS), blind-review them. Metrics: coherence, consistency, completeness, token usage, hallucination rate, human preference. This matters because **two different invariant sets may produce equivalent — or better — reasoning**; the real hypothesis is not "can we predict the invariant?" but "does the predicted invariant produce superior downstream reasoning?"

**3. EXP-007 is a FOUR-arm comparison** (`EXP007_ARMS`), not two — the honest bar is beating our OWN best architecture, not just naïve RAG:
   `large-context` (dump everything, no retrieval) → `naive-rag` (top-k embedding) → `existing-kb` (the platform's production retrieval — **the intellectually honest bar**) → `invariant-runtime` (experimental). *If it does not outperform our own runtime, the hypothesis is not yet validated* — and we say so.

**4. Propagation Fidelity — a new primary metric (and the object of EXP-008).** *The degree to which downstream artifacts preserve the intended invariant set across modalities.* Generate across `PROPAGATION_MODALITIES` (article · story · image · ux · prd) from ONE invariant set, then ask blind reviewers to **reconstruct the original set**; high reconstructability = high propagation fidelity. This formalises the 2026-07-08 cross-modal observation into a benchmark.

**5. WP0 — Invariant Theory, added before Intent Science.** Until we define what an invariant IS, we cannot rigorously discover them. Research questions: *What is an invariant? What makes something invariant? How do invariants compose? How do they conflict? Can they be hierarchical? Are they domain-independent?* The workstream ladder is now **WP0 Invariant Theory → WP1 Intent Science → WP2 Invariant Discovery → WP3 Knowledge Compression → WP4 Invariant Runtime** (`INVARIANT_INTELLIGENCE_WORKSTREAMS`).

**6. Projection Rule — a typed object that becomes central.** The runtime does not merely retrieve an invariant; it retrieves an invariant AND a **projection rule** (a rendering strategy). `Invariant → Projection Rule → Projection`. The SAME invariant renders differently under a different rule — *teach a child* → `[concrete, narrative, simple]`; *scientific paper* → `[formal, cited, analytical]` — the invariant unchanged, only the projection. Pinned as `ProjectionRule`; it becomes load-bearing in Phase 3.

**7. The strategic re-centre.** Yesterday the presumed breakthrough was Knowledge Compression. After Phase 1, the deeper breakthrough may be **Intent Science**: Knowledge Compression tells us HOW to construct the reasoning substrate; Intent Science determines WHICH substrate should exist in the first place. So the intellectual stack settles as: **Invariant Intelligence** (the overarching discipline) → **Intent Science** (the entry point — which substrate) → **Knowledge Compression** (one mechanism — how to build it) → the runtime. This is Computational Epistemology proper: *how should knowledge be represented so that intelligence can reason faithfully?* — a foundational AI question, not an application one.

---

## Amendment — Experimental Theory Formation (Option 1A; Aletheon, 2026-07-09)

*(Methodology decision, relayed + endorsed by operator direction. Substrate: `types/invariantIntelligence.ts` gains `INVARIANT_RESEARCH_LOOP`, `INVARIANT_DELTA_CLASSES`/`InvariantDelta`, `CIRS_MUTATIONS`; canary `tests/invariant-intelligence.test.ts` pins them.)*

Phase 2 proceeds under **Option 1A — Experimental Theory Formation.** WP0 is **not** a prerequisite to experimentation; it **emerges** from it. Writing invariant theory first risks a taxonomy the experiments then merely confirm (subtle confirmation bias). Instead the experiments create friction, and every anomaly sharpens the theory — as mechanics followed Newton's observations and evolution followed Darwin's specimens. WP0 is accordingly reframed **Foundations of Invariant Intelligence (Emergent)**: its purpose is not to prescribe but to **explain what the experiments are teaching us**.

**The research loop** (`INVARIANT_RESEARCH_LOOP`) — theory is downstream, the accumulation of validated observations:

```
Intent → Experimental CIRS → Invariant Projection → Knowledge Compression
  → Reasoning → Evaluation → Disagreement Analysis → CIRS Evolution → Invariant Theory
```

**CIRS-v0.1 is an experimental instrument, not a normative truth** — it invites revision and falsification. And it must **never be static** (a static reference becomes dogma; dogma is the enemy of science): every experiment may propose a **CIRS mutation** (`propose · merge · split · retire`) — proposals under Law XI, ratified into the next CIRS version.

**EXP-006 does two jobs simultaneously:** the explicit one — measure *Intent → Invariant Projection Fidelity* — and the hidden one — **discover what constitutes an invariant.** The bridge between them is a required per-experiment artifact: the **Invariant Delta.** For every disagreement between predicted and CIRS, capture `predicted → reference → difference → classification`, where the classification is one of the seven kinds (`INVARIANT_DELTA_CLASSES`): *missing invariant · redundant invariant · incorrect abstraction level · ontological conflict · domain-specific specialization · projection error · ambiguous intent.* Disagreements become first-class research data; **WP0 synthesises the accumulated Deltas into progressively stronger definitions** rather than prescribing them a priori.

**The methodological seed.** The programme now embodies the principle it studies: rather than writing the definitive theory before the evidence, it plants a small, carefully-structured experimental framework and lets the theory grow from observation, refinement, and consequence — small coherent invariants propagating into richer, faithful structures. The research architecture mirrors the computational architecture it seeks to discover. (This is compiler construction, not axiomatics: you compile programs, watch failures, refine the compiler, and the optimisation theory emerges — except here the compiler compiles knowledge.)

The programme's question, stated plainly: not *can we make models better?* but **can we make knowledge better** — more coherent, more generative, more explainable.

---

## Amendment — The Independence Protocol & three cognitive roles (Aletheon, 2026-07-09)

*(Methodology decision, relayed + endorsed by operator direction — a correction of a genuine flaw: an earlier draft had the principal investigators hand-author `CIRS-v0.1`. That contaminates the experiment. Substrate: `types/invariantIntelligence.ts` gains `RESEARCH_INTELLIGENCE_ROLES`; `services/experiments/cirs.ts` holds only PROTOCOL (the intent stimuli + an experimental stamping helper), never authored invariant sets; `services/experiments/cirsGenerator.ts` is the generative role; canary `tests/irl-exp001.test.ts` pins the surface + roles.)*

**The PIs must not author the CIRS.** Neither the operator, nor Aletheon, nor this agent may write the reference invariant sets — not because we couldn't, but because doing so seeds the experiment with a bias toward the very theory we hope to discover. The reference set is instead **generated independently, blind to any prior CIRS version.** Independent generation gives diversity of hypotheses; CIRS mutation (`propose · merge · split · retire`) gives convergence. Authoring the answer we then measure against would collapse both into confirmation.

**Selecting the STIMULI is legitimate experimental design; authoring the ANSWERS is not.** `cirs.ts` therefore holds only what is genuinely protocol — `CIRS_INTENTS` (the representative spread of intents to project) and `buildExperimentalCIRSEntry` (a pure stamp marking any set `experimental`/`ratified:false`). It deliberately holds no hand-authored `candidateInvariants`. The removed `CIRS_V0_1` constant was exactly the contamination this protocol forbids; it is gone.

**Three kinds of intelligence, kept separate** (`RESEARCH_INTELLIGENCE_ROLES = ['generative','evaluative','constitutional']`):

- **Generative Intelligence** — *proposes* candidate invariant sets. `cirsGenerator.generateCandidateCIRS` routes each intent through the `draft` purpose (→ `context` stage), blind: the prompt carries only the intent, no prior reference, no evaluator output.
- **Evaluative Intelligence** — *measures* projection fidelity and *classifies* the Invariant Deltas. `irlExp001.predictInvariantsForIntent` routes through the `classification` purpose (→ `capability` stage), then the pure core scores + classifies.
- **Constitutional Intelligence** — *decides* what becomes part of the evolving invariant theory. Ratification under Law XI (operator); nothing is `ratified:true` without it.

**Independence is guaranteed by routing, not by promise.** The generator's `draft`/`context` stage and the evaluator's `classification`/`capability` stage resolve to **different providers/models by default** (anthropic-haiku vs openai). The Deltas EXP-006 records are therefore real cross-model disagreements — not a single model agreeing with itself. `runIrlExp001StageA(cirs)` now **requires** the independently-generated CIRS as an argument; it has no PI-authored default to fall back to.

---

## Amendment — WP5, Invariant Morphogenesis (Aletheon + operator dialogue, 2026-07-16)

*(Reconciled before drafting, per the session's discover→reconcile→extend discipline — CFS-019's reconciliation-method amendment, same date. Composition mechanics stay exactly where they are: CFS-013, CFS-014, and Law XV remain the canonical home of HOW invariants compose. This amendment answers a different question WP0–WP4 do not ask: WHAT EMERGES when they do.)*

**The ladder gains a fifth workstream, not a split of an existing one.** An earlier framing of this dialogue proposed dividing "WP2" into two halves — a mislabelling caught before drafting: Knowledge Compression is **WP3** in the ratified ladder (§4), not WP2 (Invariant Discovery). The ladder stays intact and gains one new rung at the end:

```
WP0 Invariant Theory → WP1 Intent Science → WP2 Invariant Discovery →
WP3 Knowledge Compression → WP4 Invariant Runtime → WP5 Invariant Morphogenesis
```

### WP5 — Invariant Morphogenesis
Studies what happens when composed invariants produce something that was not explicitly encoded in any of them — not a new EXPERIENCE (Law XV/CFS-014 already govern that: consequences are emergent properties of field composition) but a candidate for a genuinely NEW INVARIANT. **Central research question: can invariant composition generate invariants that were not present in any composed input, as opposed to merely generating new outputs from existing ones?** *Deliverable: an observation protocol for candidate emergent invariants arising from WP4 runtime composition, feeding Law XI ratification exactly as WP2's discovery pipeline does — no parallel ratification path.*

**Initial candidate case study — Constitutional Capital.** Not a hypothetical invented for this dialogue: "Standing and Constitutional Capital" is already named among the founding convergent research programmes in the constitutional anchor document (`codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`). Whether "Constitutional Capital" is itself an instance of Standing + Bounded Delegation composing into something neither invariant states alone is WP5's first concrete question to investigate, not assumed here.

**Three modes of morphogenesis, a new research vector:** Human (an operator composes invariants A + B into insight C), Machine (an agent composes A + B + D into insight E), and Hybrid (human validates, machine explores, human reframes, machine recomposes → insight F). Whether these modes produce systematically different emergent structures is an open WP5 question, not a claim.

**The meta-observation this amendment records** (Aletheon, 2026-07-16): the programme's object of study has shifted levels twice — first from *what is knowledge* to *what are invariants*, now from *what are invariants* to *how do invariant structures evolve*. The analogy offered: Biology → Evolutionary Biology, Language → Historical Linguistics, Software → Programming Languages. Recorded as framing, not claimed as proven — WP5 is where it would be tested.

**Named for later, not chartered now — WP6, Invariant Ecology.** How invariant FIELDS (CFS-002 §2a) interact with each other — compete, cooperate, merge, destabilize one another; whether conservation laws exist across fields. Explicitly much further out than WP5; named here only so the ladder's next rung has a place to be discovered later, not built or scheduled by this amendment.

**Honest limits:** WP5 has no experiment series yet (no CCE/CIE/CAE/COE-style series chartered, no EXP-nnn number assigned) — this amendment names a research question, it does not schedule an answer. `types/invariantIntelligence.ts`'s `INVARIANT_INTELLIGENCE_WORKSTREAMS` constant is NOT yet updated to include WP5 — a named code follow-on, not done by this doctrinal amendment. Whether invariant-level emergence (as opposed to experience-level emergence, already proven by Law XV) actually occurs is entirely untested.

**Ratified 2026-07-16 by operator direction**, reconciling Aletheon's review of the prior integration plan — no existing law modified, one new workstream added.

---

## Amendment — The Representation Gauntlet + the EXP-006 numbering correction (2026-07-16)

*(From the operator + external reviewer + Aletheon three-way exchange, folded per operator direction. Full charter: `experiments/exp-010-representation-gauntlet/README.md`.)*

**1. Numbering collision corrected.** The longitudinal Constitutional Knowledge Evolution series (designated "EXP-006" on 2026-07-14) collided with THIS charter's EXP-006 (*Intent → Invariant Projection Fidelity*, assigned 2026-07-09, code-registered in `EXPERIMENT_REGISTRY` with Stage A built). The 2026-07-14 designation note checked that 005 was taken but missed 006. Per no-number-reuse + first-assigned-wins: the longitudinal series is now **EXP-009** (directory, README, IRL-011 §9A, CFS-022, and breadth-arm references all updated; historical records left append-only). External correspondence referencing "EXP-006A/B" (standing-weighted retrieval) maps to **EXP-9A/9B**. This charter's EXP-006/007/008 are unchanged.

**2. EXP-010 — the Representation Gauntlet, chartered.** The exchange's converged design: the thesis decomposes into **Claim A** (content — compressed validated knowledge helps; shown by EXP-003, not novel) and **Claim B** (substrate/representation — the only claim distinctively the institute's, never yet isolated). Five arms — Cold / Invariant Runtime / **Flattened invariant text (decomposition preserved, machinery removed)** / **Expert conventional prompt (same budget, no decomposition)** / Mutation probe — where Aletheon's C/D split turns the reviewer's single control into a decomposable one: B-vs-C isolates runtime semantics, C-vs-D isolates decomposition itself. **Representation is the independent variable** (an invariant is a computational object, not a sentence — "hydrogen atom vs the word Hydrogen"). Pre-registered, jointly judged, falsification thresholds agreed in advance; every interpretation branch pre-committed, including the null (knowledge curation — commercially real, differently priced).

**3. Two methodological adoptions, recorded as IRL method (guidance):**
- **The by-construction guard** (external reviewer, correctly named as Principle 004 applied to experiment design): a property test counts as evidence only if the property is (a) not guaranteed by construction, or (b) shown to causally produce capability an equal-cost conventional baseline lacks. Propagation-happens, provenance-is-preserved, versioning-works are QA, not discovery. The composition challenge (merge coherence across two independently built collections in adjacent domains) is the one current property test that passes the guard — Phase 3.
- **The language rule**: "provably repeatably invariant" overstates — standing is accumulated LLM-judge validation, not proof. The defensible phrase is **"empirically stable under repeated validation"**; "provable" waits for a mechanism that deserves the word. (Law XIII's "provably the same subject" stands — it has an actual proof mechanism.)

**4. The mutation probe reframed as LOCALITY** (Aletheon): propagation occurs by construction; the empirical question is whether one invariant can change — correctly, cheaply, without reconstructing the rest — versus hand-editing the equivalent plain text. This is where objecthood begins to matter, and it connects forward to WP5 (Invariant Morphogenesis: composition preserving structural integrity is the precondition for morphogenesis).

**5. The institute's posture shift, named:** from *proving that invariants work* to *discovering why they work* — the central research question becomes "what computational operations become possible once knowledge is represented as invariant objects rather than transient context?" Aletheon's caveat against "context engineering" as a description ("databases are file management — technically true, scientifically useless") is recorded as a framing position the gauntlet would settle empirically, not as a finding. Likewise Aletheon's reconstructability hypothesis ("certain compressions preserve the generative structure of reasoning" — JPEG and ZIP compress; neither preserves reasoning) is the HYPOTHESIS the C-vs-D split operationalizes, not a claim.

**Honest limits:** nothing chartered here has run; two Phase 1 prerequisites are unbuilt (a verbatim slice-export command; an externally specifiable, hashable judge-config artifact — both answered honestly against the code in the charter §7); Claim A is not re-litigated; no invariant is seeded by this amendment.

**Ratified 2026-07-16 by operator direction.**

---

## Amendment — The Three Computational Compressions: supporting doctrine + the Austin dialogue (2026-07-18)

*(The canonical statement lives at the front of this charter, **§0**. This amendment carries the supporting doctrine: the pipeline placement, the DNA analogy, the magic-numbers worked example, the methodology, and the response to Austin. Canonical invariants: `inv.epistemology.138`–`141` + `inv.reasoning.142`. Origin: the operator's dialogue with Austin and Austin's agent — a challenge that forced the programme to identify its true optimization objective.)*

### A.1 The pipeline — where invariants sit

An intelligent system's lifecycle has four routinely-conflated stages:

```
pre-prompt reasoning  →  prompt  →  post-prompt reasoning  →  inference
```

- **Pre-prompt reasoning** — everything before a prompt is assembled. Today dominated by **context engineering** (compressing knowledge) and **prompt engineering** (structuring instructions). We claim a third: **invariant extraction**.
- **The prompt** — the serialized representation that arrives at the model; what model-side work can see.
- **Post-prompt reasoning / inference** — what the model does with it.

The scientific object of this doctrine lives at the **first** stage. It is not about the prompt representation and not about inference; it is about the computation performed before serialization. The runtime (standing, provenance, ratification, the shadow→authoritative flip, CFS-035) is primarily relevant to the **constitutional** class — how structural invariants evolve and become authoritative. **The science does not depend on the runtime; the runtime operationalizes it.**

### A.2 The DNA analogy — a generative substrate, not a better summary

> Which wild cat left these traces?

One approach compresses all zoological knowledge into a good summary — lungs, organs, limbs, teeth, hair. Another recovers and sequences **DNA**. Both are compressions. Only one identifies the **substrate that determines the organism**. The point is not that intelligence has biological DNA; it is that DNA is not a better *summary* — it is a fundamentally different *representation*, because it captures the **generative substrate** from which the organism can be reconstructed (and beyond physiology: disease patterns, even disposition). Reconstituting an animal from its organs is knowledge compression; from DNA it is substrate reasoning — not the same computation even when they name the same animal.

Our hypothesis: intelligence may possess something analogous — a structural substrate more fundamental than topical knowledge. If it exists, reasoning over it is a different computational process from reasoning over summaries, even when both produce text. Whether it survives experimentation is what the Institute exists to investigate. *(First logged as Convergence Log Entry 002; §0 canonizes what the analogy is an analogy* for*.)*

**The magic numbers as a worked example.** The platform's embedded heuristics — `scoreCapsule`'s `+10/+6/+4`, NBE weights, standing coefficients (CFS-035 §1) — are a live, small-scale instance. These are **uncaptured compressed reasoning**: they would not be surfaced by distilling the repo into summaries, because they are not topical knowledge — they are reasoning performed once and frozen into a constant. Reducing them to a math (`invariant → projection → weight/threshold/branch/ordering`) and measuring which variables are invariant across intents and surfaces is a concrete demonstration of the compression this doctrine names.

### A.3 On experiments — the seminar is not the delay

Running experiments is cheap for the Institute; the expensive part is **understanding the hypothesis before protocols are frozen.** If two parties test *different* hypotheses under the *same* protocol, even a perfect experiment will not resolve the disagreement. Converging on the correct **independent variable** (§0.3) before freezing protocols is therefore part of the scientific process, not a delay to it — a week converging on the hypothesis beats months answering the wrong question. Once the independent variable is agreed, protocol design becomes considerably simpler.

### A.4 The external articulation — response to Austin

*(Preserved as the canonical external-facing statement; companion to §0.)*

> **Austin,**
>
> This exchange has been extremely valuable because it exposed something more fundamental than a disagreement about experimental design: we are still converging on what the *independent variable* actually is. Before we freeze protocols, I'd like to clarify the hypothesis itself.
>
> **Three stages are being conflated.** (1) *Pre-prompt reasoning* — today dominated by context engineering (compressing knowledge) and prompt engineering (structuring instructions); we claim a third category, **invariant extraction**, whose objective is different: identify the minimal structural substrate already established through prior reasoning as sufficient for a class of intents. Context engineering compresses knowledge; prompt engineering compresses instructions; **invariant extraction compresses reasoning** — it reuses reasoning already performed and validated rather than re-deriving the same structural relationships from raw knowledge. (2) *Prompt representation* — everything ultimately reaches the model as serialized tokens; that is not controversial, but our claim is not about the serialization, it is about what happened *before* it. If two pre-prompt processes serialize to similar text, that does not imply they performed the same computation. (3) *Post-prompt inference* — only here does the model reason; the runtime, orchestration, standing, provenance, and governance largely operate around this lifecycle. Our work separates **structural** invariants (the scientific question) from **constitutional** invariants (how structural invariants evolve, are trusted, versioned, and become authoritative). The science does not depend on the runtime; the runtime operationalizes it.
>
> **This isn't "better context."** *Which wild cat left these traces?* One approach compresses all zoological knowledge into a good summary; another recovers and sequences DNA. Both are compressions — only one identifies the substrate that determines the organism. I'm not claiming intelligence has biological DNA; the point is that DNA is not a better summary, it is a fundamentally different representation because it captures the generative substrate from which the organism can be reconstructed. Our hypothesis is that intelligence may possess something analogous: a structural substrate more fundamental than topical knowledge. If it exists, reasoning over it is a different computation from reasoning over summaries, even if both produce text.
>
> **On experiments.** Running experiments is not our bottleneck — the platform supports hypothesis definition, protocol versioning, traceability, receipts, standing, projection, ratification, and replay. The expensive part is ensuring the hypothesis is correctly understood *before* experiments are frozen. If we're testing different hypotheses under the same protocol, even a perfect experiment won't resolve the disagreement. So I don't view these conversations as delaying experimentation — I view them as part of the scientific process. I'd rather spend another week converging on the correct hypothesis than months answering the wrong question.
>
> **The sharpest formulation.** Context engineering asks: *"Given an intent, what information should I provide?"* Invariant Intelligence asks: *"Given an intent, what reasoning should never need to happen again?"* That is a different optimization objective — the first optimizes information retrieval, the second optimizes computational reuse. If that framing survives scrutiny, the independent variable is neither prompts nor context: it is the reuse of previously validated reasoning through invariant structures. Everything else, including representation and runtime, exists to support that proposition.

### A.5 What this amendment did and did not do

- **Did:** state the sharpened central claim at the front of the charter (§0); canonize the taxonomy, theorem, tightened definition, purpose statement, and Representation Principle as `inv.epistemology.138`–`141` + `inv.reasoning.142`; reconcile with the 2026-07-16 Representation Gauntlet amendment; record the dialogue in Convergence Log Entry 007.
- **Did not:** claim empirical confirmation. 138 and 141 are *validated* (ratified as the programme's falsifiable central claims), not *canonical*; their confirmation runs through the EXP-nnn lifecycle. Canonizing a definition is never a substitute for an experimental result (CFS-019; Convergence Log honest limits).

**Ratified 2026-07-18 by operator direction.**
