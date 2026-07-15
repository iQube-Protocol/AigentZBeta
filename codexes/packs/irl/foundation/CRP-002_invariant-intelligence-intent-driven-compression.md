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
