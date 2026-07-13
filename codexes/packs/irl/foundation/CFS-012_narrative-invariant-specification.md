# CFS-012 — Narrative Invariant Specification v1

**Chrysalis Foundation Specification · v1 · Status: draft · Ratified 2026-07-04**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

A fifth invariant class. Not plot. **Narrative structure.** Distinct from CFS-011 Style Invariants (cinematographic/visual continuity) and from semantic invariants (what is asserted) — Narrative Invariants govern the fixed *shape* a story moves through, independent of its prose, its visuals, and its camera.

---

## 1. Why this is a distinct class, not a Style sub-domain

CFS-011 §3.2 ("Narrative Identity") named same-protagonist/same-world/continuous-timeline as visual-narrative continuity requirements — those remain in `style` (they're about sameness of surface, not structure). What CFS-011 did not capture is the **shape of the story arc itself**: the sequence of narrative stages a production moves through, which is fixed while everything else — prose, visuals, camera — varies freely beneath it.

> Opening state → Inciting realization → Constitutional tension → Resolution → Constitutional transformation
>
> Those beats remain fixed. The prose changes. The visuals change. The camera changes. The structure doesn't.

## 2. The four continuity problems

Current video-generation systems treat continuity as one undifferentiated problem, which is why larger models chase longer context windows to remember everything at once — every face, every object, every lighting condition, every beat, every symbol simultaneously. That is expensive because the model is trying to be the storyteller, the director, and the cinematographer at once.

There are at least four distinct continuity problems:

| # | Problem | Question | Owned by |
|---|---|---|---|
| 1 | Character Continuity | Same person, face, clothing, age, proportions | Style Invariants (CFS-011 §3.1) |
| 2 | Narrative Continuity | What happened? What changed? What is the emotional arc? | **Narrative Invariants (this spec)** |
| 3 | Semantic Continuity | What principles are communicated? What remains true? | Knowledge Invariants (constitutional/reasoning/capability) |
| 4 | Stylistic Continuity | Lighting, camera language, composition, typography, palette, editing rhythm | Style Invariants (CFS-011 §3.1, §3.4) |

Decomposing these lets each layer stay simple. The video model stops being asked to be the storyteller — it becomes the renderer.

## 3. The rendering pipeline

```
KnowledgeQube
      ↓
Knowledge Invariants     (what is asserted — constitutional/reasoning/capability)
      ↓
Narrative Invariants     (the fixed structural arc — this spec)
      ↓
Style Invariants         (the fixed cinematographic language — CFS-011)
      ↓
Rendering Model          (Sora / Venice / any future generator)
      ↓
Video
```

The storyteller is the KnowledgeQube. The director is the Narrative Invariants. The cinematographer is the Style Invariants. The video model is the camera — it renders from a stable substrate instead of remembering everything itself. This is the same architecture already validated by EXP-001's five renderings of one KnowledgeQube (article, report, story, infographic, video): only the renderer changes; the substrate does not. That every one of those experiments worked from the same invariant collection is not a coincidence — it is this pipeline, instantiated once per medium.

## 4. Sequential mapping — the key implementation difference from Style/Knowledge

Knowledge invariants distribute across segments **without inherent order** (round-robin, CFS-011/CFS-006a's Knowledge Curation); style invariants apply **identically to every segment** (the continuity block). Narrative invariants do neither — they are **strictly sequential**: beat *k* belongs at story-position *k*, and segment *i* of *N* renders whichever beat the story has reached at that point in the arc.

When segment count does not equal beat count, beats map onto segments **proportionally
and endpoint-anchored**: segment *i* (0-indexed, of *N*) renders the beat at
arc-position `round(i × (beatCount − 1) / (N − 1))` — the first segment always renders
the opening beat, the last segment always renders the closing beat, and interior beats
compress or stretch between them (never reordered; the position is monotonic in *i*).
A single-segment production renders the opening beat (an arc cannot traverse in one
segment; the coherence validator warns). Implemented in
`services/video/invariantVideoBrief.ts`.

*Amendment 2026-07-04 (evidence-driven, per this section's own tuning rule):* v1
specified `floor(i × beatCount / N)`, which silently dropped the TERMINAL beat whenever
beats exceeded segments — a 5-beat arc over 4 segments rendered beats 1–4 and the
transformation never resolved. The Constitutional Coherence Engine (CFS-014) flagged
exactly this on EXP-002's first production brief ("arc does not open on the first beat
and close on the last", narrative score 80, CCS 93.3), and the mapping was corrected to
the endpoint-anchored form above: a fixed arc sacrifices interior beats before its
resolution. This amendment is itself flywheel output — the validator validating the
composition law.

## 5. The canonical 5-beat arc (seed)

| Seed id | Position | Statement |
|---|---|---|
| `inv.narrative.001` | 1 | The production opens by establishing the subject's state before any constitutional change. |
| `inv.narrative.002` | 2 | An inciting realization introduces the constitutional principle the production will test. |
| `inv.narrative.003` | 3 | The subject moves through constitutional tension between the old order and the principle introduced. |
| `inv.narrative.004` | 4 | The tension resolves — the constitutional principle prevails, fails, or is qualified. |
| `inv.narrative.005` | 5 | The subject's constitutional transformation is shown as the production's final state. |

Status `proposed`; namespace `narrative`; semantic type `constraint` (each beat constrains what may appear at its story-position). This five-beat arc is the *default*, not the only legal structure — a production may ground against a different Narrative Invariant Collection (a 3-beat, 7-beat, or non-linear arc) exactly as it may ground against a different Style collection; the mechanism (CFS-011 §5, generalized grounding) does not hardcode five beats, only the seed does.

## 6. Implementation

- **Namespace**: `narrative` (migration `20260704010000_narrative_invariant_namespace.sql`, additive CHECK widening).
- **Brief generator**: `services/video/invariantVideoBrief.ts` — a grounding with `role: 'narrative'` is resolved, ordered by `seedId` (`inv.narrative.NNN`), and mapped proportionally per §4; the resolved beat is prepended to that segment's structured beat text ahead of the semantic foregrounding, so a segment's full instruction reads: *narrative stage → foregrounded principles → continuity requirements*.
- **UI**: the Studio-adjacent runner (`components/composer/InvariantVideoExperimentRunner.tsx`) gains an optional Narrative Invariant Collection picker alongside Style and Semantic.

## 7. Cross-reference

CFS-011 §3.2 ("Narrative Identity") is amended by a note pointing here for structural-arc concerns; it retains ownership of surface-level same-world/motif/symbol continuity, which is a style concern (sameness of surface), not a structural one (shape of the arc).
