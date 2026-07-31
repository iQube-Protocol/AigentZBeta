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

*(The ontological definition of "field" itself — what it is, independent of any
particular system — lives in CFS-002 §2a. This section is that concept's
constitutional-experience instantiation: the concrete equation this platform
executes.)*

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

## 7. Constitutional Sequencing — the temporal law (amendment 2026-07-05)

Not every valid composition is a coherent composition: **the sequence is part of the
system**. Ratified as the sequencing corollary of Law XV (CFS-009):

> Constitutional fields shall compose according to a constitutionally valid sequence.
> Correct components arranged in an invalid sequence do not constitute a coherent
> experience.

This names a third kind of correctness, distinct from the two the field equation
already covers:

| Correctness | Question | Where it fails | Validated by |
|---|---|---|---|
| **Local** | Is this field internally valid? | inside one field | field integrity (per-class rules, CFS-011/012) |
| **Relational** | Does this field agree with the others? | in an interaction (§6) | field composition (Law XIV / CFS-014) |
| **Temporal** | Does this occur in the proper order? | in the unfolding | constitutional sequencing (CFS-014 sequencing layer) |

A composition may satisfy any two while violating the third — the EXP-002
terminal-beat defect is the type specimen for the third. Re-read through this lens:
no narrative beat was wrong, no style rule was wrong, the semantic grounding was
intact, the rendering was faithful. The failure was that **transformation appeared
before completion had ever been rendered** — more precisely, completion never
appeared at all. Every component correct; the sequence wrong. That is a different
class of failure from §6's interaction defects, and it is why the fix was an
*ordering* fix (endpoint-anchored `round(i·(B−1)/(N−1))` mapping) rather than a
content fix.

Sequencing was already latent in this specification: the narrative class's
composition law (§1) is **Sequential** — order-preserving *within one class*. The
corollary generalizes it **across fields**: the composed experience as a whole must
unfold in constitutional order (completion before transformation; grounding before
assertion; authority before delegation). §1's per-class algebra remains untouched;
sequencing constrains the product, not the operands.

The assembly-puzzle reading (how this was found): the pieces existing is not enough,
and even correct pieces correctly paired are not enough, because **some pieces become
inaccessible once others are fixed**. Ordering constraints are real constraints, not
presentation. This is also why sequencing belongs to composition rather than to
rendering: by render time, an invalid sequence has already destroyed information no
renderer can recover.

First executable instance: the CFS-014 narrative monotonicity/endpoint validator
(the one that caught the defect), regression-pinned by the endpoint-anchoring
assertions in `tests/video-invariant-brief.test.ts` (opening beat maps to the first
unit, terminal beat to the last, order monotonic throughout). Cross-field sequencing
validators (e.g. semantic grounding must precede the narrative beats that consume it)
are future extension under CFS-014 §9.

**Empirical refinement — 2026-07-05 (EXP-002 sequencing control arm).** The
reversed-order control (identical clips, order inverted) confirmed the corollary's
central prediction — designed order scores distinctly higher coherence, with
semantic/style fidelity intact in both cuts — and taught the corollary two things
about itself:

1. **Temporal correctness is graded, not boolean.** Violating the sequence degraded
   coherence without zeroing it; a residual coherence spanned the whole reversed
   film. Sequencing validity is therefore a **field over the space of orderings**:
   the designed sequence is the observed coherence *maximum*, not the sole
   constitutionally coherent ordering. Alternative orderings may realise different
   coherent experiences at different coherence values — **constrained resequencing**
   is a legitimate compositional operation (scored by CCS, connected to the
   remix-with-lineage path in CFS-006), not automatically a violation.
2. **The three correctness kinds predicted the failure's shape.** Adjacent-pair
   coherence survived the reversal (relational correctness is pairwise-local: each
   neighbouring pair still agrees on world, style, and subject) while the global
   arc broke (temporal correctness is global). Local coherence survives a global
   sequence violation precisely because only one of the three kinds was violated —
   the taxonomy's rows are independently damageable, which is what makes each
   independently validatable.

Neither refinement weakens the corollary: correct components in an invalid sequence
still failed to constitute the *designed* coherent experience. What they add is that
"invalid" is measured, not declared — the constraint field has a shape, and the
Coherence Engine is its instrument.

**Formalization — the temporal coherence field is topological (ratified 2026-07-05,
operator + agent co-authored).** The canonical sentence: **sequence is scored, not
validated.** Temporal correctness is a graded coherence field over the space of
orderings, not a binary predicate over one of them. For N units there are N!
candidate orderings, and every one has a coherence value — the landscape has:

- a **global maximum** — the designed sequence (the manifest's recorded order);
- potentially **local maxima** — alternative orderings that remain internally
  coherent as *different* trajectories (the constrained-resequencing operation);
- **graded decay** away from the optimum rather than immediate collapse (observed:
  the full reversal degraded without zeroing).

So the Coherence Engine's sequencing question is not *"is this sequence valid?"* but
*"how coherent is this sequence?"* — `CCS(ordering)` is a scoring function over
sequence space, and the designed ordering is the highest-scoring point *observed so
far*, not a categorical singleton. Two structural consequences:

1. **Narrative is a hierarchical field, not a linear chain.** Coherence exists at
   (at least) two scales — local (adjacent pairs) and global (the whole arc) — which
   is why the reversal's adjacent pairs still "worked" while the arc broke
   (`inv.reasoning.094`). A linear-chain model cannot produce that observation; a
   hierarchical field requires it. This is also plausibly why CCS tracks human
   narrative experience: humans routinely reconstruct out-of-order stories (film
   grammar depends on it) — what matters is preserving enough invariant structure
   for causal relationships to be reconstructed, which is what the field measures.
2. **Remix becomes constitutional rather than destructive.** If multiple
   high-scoring orderings exist, a remix does not *change the work* — it **finds
   another coherent trajectory through the same invariant space**. The invariants
   remain fixed; only the traversal changes (`inv.reasoning.096`). This gives
   CFS-006's remix-with-lineage path its constitutional ground: derivative works
   are alternative traversals, provenance-linked to the same substrate.

**The next instrument — perturbation mapping (EXP-002b, designed).** Full reversal
is the maximum-distance perturbation; it establishes that the landscape slopes but
not its shape. Adjacent swaps (`BACD`, `ACBD`, `ABDC` against canonical `ABCD`) are
minimum-distance perturbations: if the field hypothesis is right, coherence should
decay approximately with *distance from the canonical ordering* (e.g. swap distance)
rather than randomly. Mapping score against distance would reveal the field's shape
— and how much each individual temporal dependency contributes to global coherence.
At that point temporal composition stops being a correctness test and becomes a
**measurable geometry of narrative**. Protocol registered in
`experiments/exp-002-invariant-video/README.md`.
