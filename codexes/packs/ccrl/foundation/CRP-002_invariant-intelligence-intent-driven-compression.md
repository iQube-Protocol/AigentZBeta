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
| **IRL-EXP-001 — Intent Projection Fidelity** | WP1 + WP2 | Can intent reliably predict the **minimal invariant set** required for high-fidelity reasoning? | Held-out judge scores *sufficiency* (nothing needed is missing) and *non-redundancy* (nothing present is unused) of the projected set vs a human-curated reference |
| **IRL-EXP-002 — Reasoning Entropy Reduction** | WP3 + WP4 | Does invariant discovery **reduce reasoning entropy** relative to document retrieval? | Reasoning fidelity + variance (drift/entropy) of invariant-initialised generation vs retrieval-initialised, at matched or lower token budget |
| **IRL-EXP-003 — Cross-Modal Invariant Reuse** | WP4 | Are invariant sets **reusable across downstream modalities**? | Drift metric across article / story / image generation from ONE invariant seed (formalises the 2026-07-08 observation that a single seed generated all three without significant drift) |

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
| **2** | The founding Validation Series — IRL-EXP-001/002/003 registered in `EXPERIMENT_REGISTRY` (its own `col_irl` collection), with runners + canonical publication | After Phase 1 |
| **3** | The Intent→Projection runtime seam — an *Intent Engine* composing intentQube + invariant registry + EXP-003 compression + KnowledgeQube assembly (projects, does not retrieve) | After Phase 2 findings |

---

## Ratification record

- [x] **v1 CHARTERED — 2026-07-09, operator ratification.** metaMe IRL adopted as the institution's primary name; CRP-002 chartered as the first programme under CRP-001; the reframed iQube pipeline, the intent-as-projection thesis, the intent grammar, the four workstreams, and the three-experiment founding Validation Series adopted as the programme's scope.
- [ ] Phase 1 contracts — the reframed pipeline + intent grammar as typed, canary-guarded constitutional data (own ratification).
- [ ] IRL-EXP-001/002/003 designs — each experiment's protocol is its own ratification before spend (CRP-001 discipline).

## Honest limits

- The intent grammar's 13 primitives are a **hypothesis**, not a finding — WP1 refines or refutes them; Phase 1 pins whatever is ratified, not this candidate list as fact.
- The three research questions are **stated, not yet answered.** IRL-EXP-001/002/003 are designed-and-open; the cross-modal reuse result (IRL-EXP-003) has a suggestive prior observation, not a measured claim.
- "KnowledgeQube" is named as the executable compressed-knowledge object; its assembly/versioning contract is WP3's deliverable, not asserted here.
- No runtime is built by this charter. Phase 3 (the live Intent Engine) is gated on Phase 2 findings — the programme measures the thesis before the platform depends on it.
