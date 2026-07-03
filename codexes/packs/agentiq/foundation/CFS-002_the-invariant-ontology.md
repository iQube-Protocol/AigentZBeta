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

Namespaces are extensible by constitutional process (a canonization request), never by ad-hoc insertion.

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
