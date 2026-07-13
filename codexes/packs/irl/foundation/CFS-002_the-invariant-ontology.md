# CFS-002 — The Invariant Ontology

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

Defines the semantic classification system over invariants: hierarchy, taxonomy, inheritance, semantic typing, namespaces, and extensibility.

---

## 1. Position

The ontology is the **semantic coordinate system** for invariants. Every invariant is classified into exactly one ontology class within one namespace; classes form a strict inheritance hierarchy. The ontology answers *"what kind of statement is this?"* — the graph (CFS-003) answers *"how does it relate to other statements?"*, and contexts (CFS-001 §3) answer *"where does it apply?"*.

Law X binds every architectural evolution to strengthening this ontology.

## 2. Namespaces

Five root namespaces, mirroring the Invariant Computational Model layers:

| Namespace | Governs | Seed sources already in the platform |
|---|---|---|
| `constitutional` | Legitimacy: personhood, standing, identity, delegation, authority | Polity Constitution, Standing Charter, Delegation Framework (`codexes/packs/polity-core/`) |
| `reasoning` | The epistemics of the model itself | The Foundational Constitutional Record's seven Principles |
| `capability` | What compositions of agents/tools/workflows can do | `registry_assets.capabilities`, ClusterQube composition rules, trust bands |
| `experience` | How intelligence is rendered to citizens | Experience depth ladder, capsule/layout contracts, metaMe client protocol |
| `engineering` | How the platform itself evolves | CLAUDE.md rules, the Development Constitution (CFS-009) |
| `style` | Perceptual continuity: visual, linguistic, aesthetic identity across a composed experience | CFS-011 (Style Invariant Specification), the video Continuity Block |
| `narrative` | Temporal unfolding: sequence, transformation, progression, resolution | CFS-012 (Narrative Invariant Specification) |

*(Table backfilled 2026-07-06: `style` and `narrative` were added to the seed JSON's `namespaces` array at CFS-011/012 ratification, 2026-07-03/04, without the matching rows here — an infraction of this document's own lockstep obligation, corrected here without renumbering. `context` remains a named-but-unpopulated field slot — see §2a — not yet a namespace.)*

Namespaces are extensible by constitutional process (a canonization request), never by ad-hoc insertion.

## 2a. Invariant Fields — the compositional primitive
*(Amendment 2026-07-06 — operator + agent co-authored. Law XV (CFS-009) legislated how fields behave — composition is multiplicative, fields are locally independent and globally dependent — before the ontology ever defined what a field is. This section closes that gap: Law XV governs behaviour; this is CFS-002 territory, definition.)*

### Definition — Invariant Field
**An Invariant Field is a coherent domain of interacting invariants that governs the behaviour of a system. Fields are independently verifiable, composable, and give rise to emergent phenomena through their interaction with other fields.**

This definition is deliberately universal: it names no human, no AI, no experience, no software. A gravitational field is not defined by the planets that happen to occupy it — planets express behaviour because they exist within it. An invariant field is the same shape of thing: it is not defined by the experiences that compose within it. **Experience is one observable behaviour a field composition can produce, not the field's defining context.** The same compositional mathematics recurs across every organized system this platform has touched or can name:

| System | Its fields |
|---|---|
| Constitutional experience (this platform) | Semantic, Narrative, Style, Experience, Context (§ below) |
| Biology | Morphology, metabolism, regulation, development — DNA does not create an organism; it defines the fields whose composition *is* the organism |
| Engineering (a bridge) | Material, geometric, stress, environmental, construction — the bridge is the emergent consequence |
| Operating systems | Memory management, scheduling, security, networking, filesystem — Linux is not those fields, Linux is their composition |
| Civilization | Legal, economic, social, ethical, scientific invariants — civilizations emerge from their composition |
| Intelligence | Reasoning, memory, semantic, goal, constraint fields — composition gives rise to intelligence, biological or digital |

The generalized law this section grounds: **every coherent system is the composition of independently verifiable invariant fields; constitutional experiences are one expression of this general principle** (Law XV, restated — CFS-009).

### Field vs. Collection vs. Namespace — three axes, not one hierarchy
A field is easy to mistake for another container, because this document already has two: the **namespace** (§2, the ontological category a statement is classified under) and the **Invariant Collection** (CFS-001 §Level 2, a curated grouping used for storage and retrieval). A field is neither.

- **Invariant** — an atomic constitutional statement (CFS-001 Level 1). *What is true.*
- **Invariant Collection** — a curated grouping of invariants (CFS-001 Level 2). *How truths are organized for storage.*
- **Invariant Field** — a functional **role** that one or more collections occupy during composition. *How truths participate in producing a system's behaviour.*
- **InvariantQube** — a versioned, ownable, transactable publication of one or more collections (CFS-001 Level 3). *How compressed expertise is published.*

A field is a role, not a container — keeping storage (Collection), classification (Namespace/Ontology), and execution (Field) unconflated. This is also why a field need not map 1:1 onto a namespace: the Semantic Field (below) is filled by `constitutional`, `reasoning`, and `capability` namespace invariants simultaneously (CFS-013 §1's distributive law draws round-robin across exactly this span); the Narrative and Style fields happen, in this platform's constitutional application, to be filled by namespaces bearing the same name — that is convenience, not requirement.

### Properties
Every Invariant Field shall be:
- **Coherent** — every invariant occupying the field governs the same concern.
- **Independent** — verifiable in isolation from every other field.
- **Composable** — contributes to system behaviour only through composition, never alone.
- **Versioned** — evolves through constitutional supersession (Law X), never silent mutation.
- **Traceable** — every observable behaviour can identify which fields composed it (Corollary IV, below).

### Natural fields vs. constitutional fields
Both obey identical compositional mathematics. They differ only in **origin**, never in structure:

| | Natural invariant fields | Constitutional invariant fields |
|---|---|---|
| Origin | Discovered | Designed, ratified, and codified by intelligent agents |
| Examples | Gravitation, genetics, thermodynamics, evolution | Governance, legal systems, protocols, experience architectures, software |
| Changes by | Further discovery (physics doesn't get amended) | Constitutional process (Law XI — proposal → operator ratification) |

The Constitutional Internet is one engineered application of a much more general theory — its uniqueness is that it is the first field system this platform *designs*, rather than merely *discovers*.

### The universal hierarchy
```
Invariant
    ↓
Invariant Collection
    ↓
Invariant Field (role)
    ↓
System
    ↓
Observable Behaviour
    ↓
Consequences
```
Notice what does not appear: **Experience.** It is one observable behaviour among many — mechanical behaviour, biological development, economic markets, intelligence, and constitutional governance are others. The Constitutional Internet's own flywheel (CFS-006a) is this hierarchy's constitutional specialization:
```
Invariant → Invariant Collection → Invariant Field → Composition Engine (CFS-013 §4)
    → Constitutional Experience → Consequences → Standing → Registry → Knowledge Evolution
```

### The five constitutional fields
This platform's ratified application of the general Invariant Field concept (Law XV, CFS-009). Each answers a distinct question no other field answers:

| Field | Governs | Question answered |
|---|---|---|
| **Semantic** | What may be constitutionally expressed — principles, constraints, meanings, invariants an experience draws on (`constitutional`, `reasoning`, `capability` namespaces) | What may be expressed? |
| **Narrative** | Sequence, transformation, progression, resolution (`narrative` namespace, CFS-012) | When is meaning revealed? |
| **Style** | Visual, linguistic, and aesthetic continuity (`style` namespace, CFS-011) | How is meaning perceived? |
| **Experience** | Personalization, agency, rendering, pacing, orchestration (`experience` namespace) | How is meaning experienced? |
| **Context** | The circumstances under which every other field operates — determines applicability, never truth (namespace not yet populated — the "named slot" of Law XV) | Under what conditions does meaning apply? |

Without Semantic there is no constitutional meaning. Without Narrative there is no constitutional journey. Without Style there is no constitutional identity. Without Experience there is no constitutional interaction. Without Context there is no constitutional judgment.

### Composition
```
Semantic × Narrative × Style × Experience × Context = Constitutional Experience
```
Composition is multiplicative, not additive. No field is optional. No field dominates another. Changing any field changes the composed experience. Full mechanics live in CFS-013 §6 (the field equation) and CFS-014 (the Constitutional Coherence Engine that judges the composed whole); this section supplies the ontology those specifications operate on.

### Corollaries
- **Field Independence** and **Field Interaction** are already constitutionally recorded (`inv.reasoning.073`: fields are locally independent and globally dependent; a compositional failure can live purely in an interaction while every field is individually correct) — not restated here to avoid a near-duplicate seed.
- **Corollary III — Experience Emergence.** A constitutional experience is an emergent property of field composition. It is not stored. It is composed.
- **Corollary IV — Constitutional Explainability.** Every constitutional experience shall be decomposable back into the fields and invariants from which it was composed.

## 3. Hierarchy & inheritance

`ontology_classes` is a self-referential tree: `id`, `namespace`, `parent_id`, `semantic_type`, `description`. A class inherits the semantic type and applicability constraints of its ancestors; an invariant classified under `constitutional/delegation/bounds` is retrievable by any ancestor query (`constitutional/delegation`, `constitutional`).

Rules:
- Single inheritance (a class has one parent). Cross-cutting membership is expressed through **contexts** and **graph edges**, not multiple parents — this keeps traversal cheap and semantics unambiguous.
- Depth is unbounded but should stay shallow (≤4 in practice); deep trees signal that graph edges are being smuggled into the taxonomy.
- `generalizes`/`specializes` edges between invariants (CFS-003) are distinct from class hierarchy: the ontology classifies statements; the graph relates them.

## 4. Semantic typing

Each class carries a `semantic_type` describing the logical form of statements it admits:

- `principle` — normative, order-defining (*Knowledge precedes inference*)
- `constraint` — prohibitive (*Delegation never removes accountability*)
- `definition` — meaning-fixing (*Standing is confidence in the veracity of declarations*)
- `heuristic` — defeasible guidance (*Three similar lines beat a premature abstraction*)
- `law` — ratified engineering law (CFS-009)

Semantic type determines how the runtime may use an invariant: constraints can veto (guardian checks), principles order plans, heuristics advise but never veto.

## 5. Constitutional / capability / experience / reasoning ontologies

These are the namespace subtrees, not separate systems. The constitutional subtree is special in one respect: its `canonical` invariants are extracted from ratified Polity documents and may not be superseded except by constitutional amendment (recorded in `AMENDMENT_RECORDS.md` and DVN-anchored). The ontology defers to the Polity; it never overrules it.

## 6. Relationship to `docs/platform-ontology.md`

The existing platform ontology is a **terminology canon** (canonical spellings + meanings). It remains authoritative for vocabulary and is itself a source of `engineering`-namespace definition invariants. This specification does not replace it; it subsumes its role for *statements* while the terminology canon governs *words*.

## 7. Extensibility & governance

- New classes: proposed by anyone (including agents), ratified by operator via canonization request. Humans define semantics; AI optimizes implementation (Law XI).
- Class deprecation follows the same supersession grammar as invariants.
- The seed taxonomy ships with Appendix A: each seed invariant carries its namespace + class, which instantiates the initial tree.

## 8. Current substrate

Existing classification systems that seed (not compete with) this ontology: the six-primitive iQube taxonomy (CHECK-constrained in `iqube_id_map`), ToolQube subtypes, VSP evidence domain taxonomy, trust-band ladders, and the polity charters. The ingestion path mirrors `scripts/ingest-polity-papers.mjs`.
