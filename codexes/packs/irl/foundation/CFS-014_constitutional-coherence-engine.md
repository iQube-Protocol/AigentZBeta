# CFS-014 — Constitutional Coherence Engine

**Chrysalis Foundation Specification · v1 · Status: draft · Ratified 2026-07-04 · Executable specification**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

## Executive summary

The Invariant Computational Model defines three foundational layers: the **Ontology** (what exists), the **Graph** (how invariants relate), and the **Composition Laws** (how classes compose — CFS-013). These are necessary but insufficient for generating coherent experiences. A fourth execution layer is therefore introduced: **the Constitutional Coherence Engine**. Its responsibility is to ensure that independently composed invariant classes remain constitutionally coherent when rendered together as a single experience. The Coherence Engine operates as a **constitutional field** over all invariant classes during rendering. It never alters canonical invariants; it validates and orchestrates their collective expression.

This is **the last foundational layer beneath every renderer, not a video feature.** Video merely exposed it, because video is the medium that forces every invariant class to coexist simultaneously — semantics, narrative, style, timing, symbolism, continuity, emotion, pacing — where an article barely does. Imagine the semantic invariants perfect, the style invariants perfect, the narrative invariants perfect — yet the emotional tone drifts, the pacing breaks, the symbolism stops matching. Nothing is technically wrong; everything is incoherent. That failure lives in no single invariant. It lives in the **interaction between them**. Knowledge composes locally; experiences succeed globally through coherence.

## 1. Constitutional principle

**Every rendered experience shall represent a coherent constitutional composition of all participating invariant classes.** Individual invariant classes may compose correctly in isolation while failing collectively. Constitutional Coherence guarantees that the complete rendered experience expresses one constitutional reality.

## 2. Position in the stack

```
Reality
    ↓
Reasoning
    ↓
Invariant Discovery
    ↓
Invariant Ontology
    ↓
Invariant Graph
    ↓
Composition Laws
    ↓
KnowledgeQube
    ↓
──────────────────────────────
Constitutional Coherence Engine
──────────────────────────────
    ↓
Experience Rendering
    ↓
Citizen Experience
    ↓
Action → Standing → Knowledge Evolution   (the flywheel, CFS-006a)
```

The graph tells us what is connected. Constitutional Coherence tells us whether things **belong together** — not topology, not local computation: harmony, in the musical sense. Individual notes obey their own rules; harmony emerges from their relationships over time. And what actually gets rendered is not knowledge — knowledge is the substrate. **What gets rendered is experience.** This is why the runtime was always called an experience runtime; the metaMe naming anticipated this layer.

## 3. Responsibilities

The Constitutional Coherence Engine SHALL validate five dimensions:

- **3.1 Semantic Coherence** — no rendered artifact contradicts the semantic invariant collection.
- **3.2 Narrative Coherence** — beats remain sequential and proportional; no skipped, reordered, or contradictory arcs; no discontinuous transitions.
- **3.3 Style Coherence** — global cinematic continuity: protagonist, visual identity, typography, lighting, palette, symbolism, cinematography. Style invariants apply globally.
- **3.4 Experience Coherence** — rendered UX remains aligned with the experience model, matrix, constitutional context, and citizen intent. Renderings may differ visually while preserving identical constitutional experience.
- **3.5 Reasoning Coherence** — all generated conclusions remain derivable from the originating KnowledgeQube; every reasoning path terminates at canonical invariants.

## 4. The coherence field

The engine evaluates the **complete experience**, never `semantic + narrative + style + experience` as independent sums. Coherence is an emergent property of constitutional composition — a field over the whole, in the same sense that gravity is not a property of any node in a particle graph but of the field acting across it.

## 4a. Internal decomposition — amendment 2026-07-05 (Constitutional Sequencing)

Coherence is not only "do these fields agree?" — it is also "**do they unfold
constitutionally?**" Those are different questions, and the engine answers them in
distinct layers:

```
Constitutional Coherence
├── Field Integrity            — local correctness: is each field internally valid?
├── Field Composition          — relational correctness: do the fields agree?
├── Constitutional Sequencing  — temporal correctness: do they unfold in constitutional order?
└── Constitutional Resolution  — the verdict: does the whole express the constitutional intent?
```

The three correctness kinds are ratified in CFS-013 §7 (sequencing corollary of
Law XV); Constitutional Resolution is the judgment Law XIV already assigns to this
engine, now named as the layer that consumes the other three. The v1 narrative
monotonicity/coverage validator (§3.2) was, in retrospect, the first sequencing
validator — it is the layer that caught the terminal-beat defect, a purely temporal
failure invisible to integrity and composition checks. The Constitutional Emergence
principle (CFS-009) states why all three layers are simultaneously required: the
valid whole emerges only when identity, relationship, and sequence are all respected.

Orientation note: coherence orients an experience in constitutional space (which
invariants govern it) **and in constitutional progression** (where it stands in its
own unfolding). Any instrument that reports constitutional bearing therefore carries
both components — spatial orientation and temporal orientation. A navigator does not
merely know where they are; they know where they are in the journey.

## 5. Constitutional Coherence Score (CCS)

Every rendered artifact SHALL receive a CCS: per-dimension scores (semantic fidelity, narrative continuity, style continuity, experience alignment, reasoning explainability) with **renderer-configurable weights** but **constitutionally constant dimensions**. The prediction this spec commits to: coherence will become measurable, and when it does it becomes the criterion by which every generated *experience* — not just every artifact — is evaluated.

## 6. Experience rendering contract

Renderers (Differ, Studio, aigentMe, AigentZ, video/article/infographic renderers) SHALL consume `KnowledgeQube + Invariant Graph + Composition Laws + Coherence Engine`. Renderers SHALL NOT modify canonical invariants; they determine presentation only. Differ, under this contract, is not choosing colours — it is rendering an experience field for a particular individual over an untouched substrate.

## 7. Execution pipeline

```
KnowledgeQube → Resolve Invariants → Resolve Graph → Apply Composition Laws
      → Constitutional Coherence Validation → Renderer → Artifact
```

**No renderer executes until Constitutional Coherence succeeds** (or its violations are explicitly waived by the operator — fail-closed by default, human override per Law XI).

## 8. Coherence relationships are transient

Unlike the Invariant Graph (structural, stored, canonical), the engine evaluates **runtime** relationships — alignment, consistency, continuity, progression, harmony, experiential integrity. These are transient; they are never stored as canonical graph edges.

## 9. Future extension

No invariant class becomes canonical until all four exist: (1) ontology definition, (2) graph relationships, (3) composition law (CFS-013 §3), (4) **coherence validator**.

## 10. Implementation (v1 — landed with this spec)

- `services/coherence/` — `CoherenceEngine` contract + `CoherenceResult` (per-dimension scores, violations, recommendations) + five independently extensible validators.
- v1 scope, stated honestly: the deterministic validators land now against the first compiled medium (the video brief) — semantic guardrail integrity, narrative monotonicity/coverage, style-continuity presence. Experience and reasoning validators land as structural stubs returning `unevaluated` with recommendations (their signals — experience matrix alignment, reasoning-path termination — need renderer telemetry that doesn't flow yet). A stub that says "unevaluated" is constitutional honesty; a hardcoded 100 would be a Law XII violation (score without validation).
- Wired at the §7 seam for the first renderer path: `/api/video/invariant-brief` returns the brief's `CoherenceResult` alongside the brief; the experiment runner surfaces it before generation.
- Studio/Differ/aigentMe/AigentZ integration follows as each surface adopts the rendering contract (§6).

## Law XIV

See CFS-009 — Law XIV (Constitutional Coherence): *Every constitutional experience shall be rendered as a coherent composition of multiple invariant classes operating simultaneously within a shared constitutional context.* Ontology defines meaning. Graph defines relationships. Composition Laws define local computation. Constitutional Coherence ensures they collectively express a single constitutional reality.
