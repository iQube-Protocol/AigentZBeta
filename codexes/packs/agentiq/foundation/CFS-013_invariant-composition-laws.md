# CFS-013 — Invariant Composition Laws

**Chrysalis Foundation Specification · v1 · Status: draft · Ratified 2026-07-04**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

**Every invariant class defines not only a semantic domain but a lawful method by which its members compose. Composition is therefore a first-class constitutional property.**

---

## 1. The discovery

The distinction between the invariant classes was never only about *what kind of statement* each holds. Implementing multi-class rendering (CFS-011/012, the video brief generator) revealed that **each class obeys its own algebra of composition** — the ontology is not just defining nouns; it is defining **operators**:

| Invariant Class | Composition Law | Realized today in |
|---|---|---|
| Semantic (constitutional/capability) | **Distributive** — members distribute round-robin across units of the artifact; each unit foregrounds a distinct subset, the rest bind as guardrails | `distributeRoundRobin`, `services/video/invariantVideoBrief.ts` |
| Narrative | **Sequential** — members carry a fixed arc order; they map proportionally onto units, monotonically, never reordered | `mapNarrativeToSegments` |
| Style | **Global (constant)** — members apply identically to every unit; one continuity block, everywhere | `buildContinuityBlock` |
| Experience | **Contextual** — members resolve per-context at render time (the depth ladder / matrix prescription pattern) | experience matrix prescription (`/api/experience/capsule`) |
| Reasoning | **Causal** — members compose by dependency-graph traversal; consuming X requires X's closure | `dependencyClosure`, `services/invariants/graph.ts` |
| Engineering | **Normative** — members bind every act of platform evolution simultaneously (law-like; no distribution) | CFS-009 enforcement + review |

The Invariant Ontology thereby becomes a computational language: classes are types, invariants are values, composition laws are the operators.

## 2. The completed trinity

```
Invariant Ontology          — defines what exists        (meaning)
Invariant Graph             — defines relationships      (topology)
Invariant Composition Laws  — define behaviour           (computation)
```

Ontology without composition is taxonomy. Graph without composition is topology. **Composition is what makes the system executable.** Only with all three is the computational model complete: the Registry is the constitutional memory of these three, and every renderer, agent, workflow, or experience is a lawful execution of the same invariant substrate.

## 3. Constitutional requirement — the future-proofing clause

**Future invariant classes shall explicitly define their composition law before entering canonical status.**

This is the Open/Closed Principle applied constitutionally: *the runtime is closed; the ontology is open.* Adding a new invariant class never requires changing the engine — only ratifying the class's algebra. The brief generator already honours this (a grounding's `role` is a free label routed to a composition strategy); this specification makes the pattern a constitutional obligation rather than an implementation courtesy.

The canonization checklist for any new invariant class (extends CFS-002 §7):
1. Ontology definition (namespace + semantic domain)
2. Graph relationships (which edge types apply, any ordering semantics)
3. **Composition law** (the algebra by which its members compose into artifacts)
4. Coherence validator (CFS-014 §9)

## 4. The Invariant Compiler

What the brief generator actually is, seen through this lens:

```
Invariant Graph  →  Composition Laws  →  Target Medium  →  Artifact
```

Whether the output is prose, video, UI, an agent workflow, an infographic, speech, or a simulation is irrelevant — the compiler targets a different runtime. `services/video/invariantVideoBrief.ts` is the first back-end of this compiler (target: video segment prompts); EXP-001's article/report/story/infographic are manual compilations of the same source. Every future renderer is another compilation target, not another architecture.

## 5. Code reflection

The composition laws are pinned as a constitutional constant — `COMPOSITION_LAWS` in `types/invariants.ts` — mapping every namespace to its ratified law. A namespace without an entry cannot be added (the Record type is exhaustive over `InvariantNamespace`), which enforces §3 at compile time: you cannot introduce a class without declaring its algebra.

## 6. The field equation — amendment 2026-07-04 (Law XV)

EXP-002's first production brief taught the composition model its own generalization
(ratified as Law XV — Compositional Fields). The composition is not a pipeline of
independent layers; it is a **multiplicative field product**:

```
Semantic × Style × Narrative × Experience × Context  =  Experience
```

- Fields are **locally independent, globally dependent**: each is verifiable in
  isolation, none is inert in composition — changing any field changes the entire
  resulting experience.
- The substrate is therefore a **constraint field**, not only a graph: the Composition
  Engine (the invariant compiler of §4) does not concatenate fields, it **solves them
  simultaneously** — semantic says *what may be expressed*, narrative *when*, style
  *how*, experience *to whom* (slot — namespace exists, field unimplemented), context
  *under which conditions* (slot).
- Because a defect can live purely in an interaction (the terminal-beat defect:
  every field locally correct, the arc's resolution lost between the narrative field
  and segmentation), field-level evaluation (CFS-014 / Law XIV) is entailed by this
  equation, not merely compatible with it.

**Class-purity corollary (Law XV):** composed blocks that span invariant families —
the v1 Continuity Block mixes style, identity continuity, semantic constraint, and
state continuity (CFS-011 §backlog) — are scaffolding, and dissolve into their
constituent classes as those classes are ratified.
