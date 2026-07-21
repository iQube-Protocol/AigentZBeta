# CFS-011 — Style Invariant Specification v1

**Chrysalis Foundation Specification · v1 · Status: draft · Ratified 2026-07-04**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

One of five invariant classes, alongside Knowledge (constitutional), Reasoning, Experience, and **Narrative** (CFS-012, ratified alongside this spec — the fixed structural arc of a story, distinct from the visual/cinematographic continuity defined here). Same computational primitive (CFS-000 §7: one architecture, many domains), new namespace: `style`.

---

## 1. The distinction

**Semantic invariants preserve meaning. Style invariants preserve visual and narrative continuity.** They are different layers over the same substrate:

- A **semantic invariant** (`constitutional`/`reasoning`/`capability`/`experience` namespace) is a statement that must remain true — e.g. *"Authority follows standing."*
- A **style invariant** (`style` namespace) is a statement that must remain **visually/narratively constant** across the segments of one production — e.g. *"The protagonist's appearance remains identical across all segments."*

A multi-segment production grounded in a KnowledgeQube carries both: the semantic invariants determine *what is asserted*; the style invariants determine *how it looks and feels, unbroken*. Neither substitutes for the other. A film that varies its visuals segment-to-segment while asserting consistent principles has semantic coherence and no cinematic identity; a film with a fixed visual language but drifting principles has the reverse defect. Both are required.

## 2. Definition

**Every multi-segment video generated from a KnowledgeQube shall preserve a shared cinematic identity independent of the individual segment prompts.**

Style invariants are the canonical seed of that cinematic identity: statements in the `style` namespace, at the same three levels as any other invariant (CFS-001 §1) — atomic style invariants (Level 1), a Style Invariant Collection (Level 2, the "style bible" for one production or one recurring series), and a published StyleQube-as-InvariantQube (Level 3) when a style is validated and reused across productions.

## 3. The four sub-domains

### 3.1 Visual Identity
Identical protagonist appearance, wardrobe, age, facial features, lighting language, colour palette, camera language, aspect ratio, rendering quality, typography, iconography, environmental aesthetic — across every segment.

### 3.2 Narrative Identity (surface continuity — see CFS-012 for structural arc)
Same protagonist, same constitutional world, same emotional trajectory, continuous timeline, an explicit visual bridge between segments, a recurring visual motif, a recurring constitutional symbol. **This sub-domain owns sameness of surface only** — the same world, the same recurring symbol. The *shape* the story moves through (opening → tension → resolution → transformation) is a distinct, sequential concern governed by CFS-012 Narrative Invariants, not by this style sub-domain.

### 3.3 Semantic Identity — the seam to the semantic invariants
**Every visual metaphor must correspond to one or more grounding invariants. No visual element may imply a constitutional principle absent from the originating KnowledgeQube.** This is where style invariants and semantic invariants meet: a style invariant may be `constrains`-scoped by the semantic invariant(s) it must never contradict — reusing the existing edge taxonomy (CFS-003 §2), not inventing a new relation. No new edge type is needed: `constitutional/reasoning invariant --[constrains]--> style invariant` records precisely this seam, and the coherence gate (CFS-003 §5) — already enforced at InvariantQube publication — applies unchanged when a style collection is composed against its grounding semantic collection.

### 3.4 Transition Identity
Each segment shall begin from the final semantic state of the preceding segment. Transitions preserve: character position, environmental state, lighting direction, active visual motifs, constitutional narrative progression. The stitched film shall appear as a single continuous production rather than independent clips.

## 4. Not prompts — invariants

These are not prompt fragments to be pasted once and forgotten. Framed as invariants, they inherit the full substrate: lifecycle (a style bible can be `proposed`, `validated`, `canonical` once proven across productions), Standing (a style collection reused and never broken accrues Standing exactly as any other invariant does — CFS-001 §6), and provenance (which production discovered this visual language first). A recurring series' "look" is a **canonical `style`-namespace InvariantQube**, referenced — never copy-pasted — by every subsequent production in that series.

## 5. Generalization — stubbed for invariant classes beyond style

The video brief generator (`services/video/invariantVideoBrief.ts`, CFS-011 §6) accepts **any** invariant collection by id, not only `style`- or `constitutional`-namespace ones. A production's "grounding" is a list of `{ collectionId, role }` pairs — `role: 'semantic' | 'style' | ...` — so a future `experience`-namespace collection (an interaction-continuity bible, say) or any other class composes into the same brief without a new code path. The four classes named here (Knowledge, Reasoning, Experience, Style) are today's populated namespaces; the mechanism does not hardcode the count.

## 6. Implementation

- **Namespace**: `style` added to `InvariantNamespace` (migration `20260704000000_style_invariant_namespace.sql`, additive CHECK widening — mirrors the `epistemic` semantic-type precedent).
- **Seed**: seven canonical style invariants seeded into Appendix A / `canonical-invariants.seed.json` (§7 below) — the reusable default "house style" any production can ground against without authoring one from scratch.
- **Brief generator**: `services/video/invariantVideoBrief.ts` + `POST /api/video/invariant-brief` — composes a continuity block from a style collection and per-segment beats from a semantic collection, generalized to N segments (CFS-011 §5; see the EXP-002 experiment for the 2- and 4-segment worked examples this generalizes).
- **The bug this closes**: EXP-002's manual briefs existed because the deployed video skill (`SkillVideoPlayer.invokeMultiSegment`) had no mechanism for per-segment prompts at all — every segment submitted an identical request body, so a "24s video" was mechanically the same 12s clip generated twice. Fixed 2026-07-04 (`segment_prompts` prop + hierarchical stitching for >3 segments); see the Phase-3-video-fix session record.

## 7. Canonical style invariants (seed)

| Seed id | Sub-domain | Statement |
|---|---|---|
| `inv.style.001` | Visual | The protagonist's appearance, wardrobe, and age remain identical across every segment of a production. |
| `inv.style.002` | Visual | Lighting language, colour palette, and camera language remain identical across every segment of a production. |
| `inv.style.003` | Visual | Aspect ratio, rendering quality, and typography remain identical across every segment of a production. |
| `inv.style.004` | Narrative | Every segment shares the same protagonist, the same constitutional world, and one continuous timeline. |
| `inv.style.005` | Narrative | A recurring visual motif and a recurring constitutional symbol persist across every segment. |
| `inv.style.006` | Semantic | Every visual metaphor corresponds to one or more grounding invariants; no visual element implies a principle absent from the originating collection. |
| `inv.style.007` | Transition | Each segment begins from the final semantic state of the preceding segment, preserving character position, environmental state, lighting direction, and active motifs. |

Status `proposed`; namespace `style`; semantic type `constraint` for 001–003/007, `principle` for 004–005, and `constraint` for 006 (it bounds style invariants by semantic ones — see §3.3).

## Backlog — Continuity Block dissolution (Law XV class-purity corollary, 2026-07-04)

The v1 Continuity Block (S-001..S-007) spans FOUR invariant families masquerading as
one style block:

| Entries | Actual family |
|---|---|
| S-002, S-003 (lighting/camera/palette, aspect/typography) | style proper |
| S-001, S-004 (same protagonist, same world, one timeline) | identity continuity |
| S-006 (visual metaphors correspond to grounding invariants) | semantic constraint |
| S-007 (each segment begins from the prior segment's final state) | state continuity |

Per Law XV's class-purity corollary this mixed block is scaffolding: as identity-
continuity, semantic-constraint, and state-continuity invariant classes are ratified
(each with its own composition law per CFS-013 §3), the block dissolves into its
constituent classes. Until then the block remains the operational unit — no code may
treat its current mixed form as constitutionally final.
