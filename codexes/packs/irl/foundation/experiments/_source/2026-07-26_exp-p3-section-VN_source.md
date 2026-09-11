# SOURCE MATERIAL — EXP-P3 Section VN (Arm D Visual Notation Specification)

> Provenance file, verbatim (operator-supplied, 2026-07-26). New normative section;
> referenced by brief-v0.2 §7 Arm D, BP.6, BP.3 Step 5, and Section T. ⟦ ⟧ marks parameters
> to be frozen. Do not edit; derive from it.

Reviewer preamble (design tension, stated openly): **the more rigorously you control a
visual notation, the closer it drifts toward being a visual serialization of Arm S — which
would dissolve the very contrast (S vs D) the arm exists to serve.** The specification
protects, as its central commitment, the property that makes D a distinct substrate:
**relations carried by visual-spatial configuration itself** — topology, containment,
adjacency, direction — rather than by enumerable symbolic statements.

---

# Section VN — Arm D Visual Notation Specification

## VN.1 Purpose and load-bearing distinction

Arm D operationalizes "diagrammatic representation." Without a frozen specification, a single diagram author's conventions silently become the experiment's entire definition of the substrate, and drawing-quality variance masquerades as substrate effect.

The specification must simultaneously guarantee:

1. **Control** — element and relation semantics defined precisely enough for content mapping, back-propagation, back-translation, and extraction gating to operate on D at parity with other arms;
2. **Substrate integrity** — the diagrams remain genuinely diagrammatic: their distinctive encoding property (EP, per BP.2) is that structural relations are recoverable from **visual-spatial configuration**, not from enumerated symbolic statements rendered pictorially.

The discriminating test, applied throughout this section:

> *Is this relation recovered by reading a configuration (what is inside, touching, connected to, above, bounded by what), or by reading a statement?* Configuration → legitimate D encoding. Statement → prohibited in D except where VN.5 explicitly permits it.

## VN.2 Semantic channel allocation

Every visual channel is classified, exhaustively, into one of three classes. The allocation below is the default; genre profiles (VN.4) may reallocate a channel only by explicit declaration in the frozen profile.

**Class 1 — Semantic channels (carry AC content):**
- **topology / connection:** lines and junctions denote declared relation types;
- **containment:** enclosure denotes scope, membership, or boundary relations;
- **adjacency / contact:** declared contact relations;
- **relative position along a declared axis:** ordering, direction, or precedence — only where a profile declares the axis semantic;
- **glyph identity:** closed vocabulary of entity and relation glyphs (VN.3);
- **boundary style:** solid vs dashed distinguishes declared boundary types (e.g., physical boundary vs margin-reduced boundary, per the BP.8 example).

**Class 2 — Reserved non-semantic channels (never carry content):**
- absolute size and area of elements;
- line weight, color, fill, texture;
- layout aesthetics, whitespace, aspect ratio;
- font choice and label size.

Auditors verify during certification that no AC's recovery depends on a Class 2 channel. If a draft diagram is found encoding content in a Class 2 channel, it is redrawn; if the content cannot be expressed otherwise, it is escalated to BP as a potential non-propagatable item.

**Class 3 — Conditionally semantic channels (semantic only if promoted):**
- metric properties (lengths, angles, areas *to scale*). Default: non-semantic, per VN.6. May be promoted only under BP.6 option 2 (the quantity is AC content), in which case it must be dimensioned by annotation, not left to visual measurement.

This allocation is the visual analogue of BP.2's content/encoding distinction and exists for the same reason: it makes "what the diagram says" auditable, so that "how the diagram says it" can be the manipulation.

## VN.3 Element and relation vocabulary

- A **closed glyph vocabulary** is defined per genre profile: entity glyphs, relation-line types, junction types, boundary types, and annotation markers. The vocabulary is frozen with the profile and hash-committed.
- Every glyph and line type has exactly one legend-defined meaning within a profile. No overloading; no synonymous glyphs.
- The vocabulary must be **sufficient for the frozen AC closure**: after BP closure freeze, the vocabulary is checked against every AC assigned to D, and any AC inexpressible in the vocabulary triggers either a pre-freeze vocabulary extension (if BP closure has not yet frozen) or BP.5 disposition (if it has). Vocabulary extension after BP freeze is prohibited — the same discipline as BP's post-freeze residue rule, for the same reason.

## VN.4 Genre profiles

A single universal notation covering all task regimes would be either too impoverished (failing expressiveness) or too rich (uncontrollable). Instead, VN defines a **common core** (VN.2–VN.3 rules, legend discipline, text-leakage cap, rendering parameters) plus a small set of **genre profiles**, each a frozen instantiation for a family of structural content:

- **Profile VN-CON (constraint/containment):** boundaries, regions, membership, margins — serves spatial and topological ACs;
- **Profile VN-FBD (force/load path):** free-body conventions — entities, force arrows (direction semantic; magnitude by annotation only, per VN.6), supports, reactions;
- **Profile VN-NET (dependency/network):** nodes, typed edges, direction — serves logical, relational, and procedural ACs;
- **Profile VN-STATE (state/transition):** states, transitions, guards — serves procedural/causal ACs.

Rules:
1. The profile assigned to each invariant is fixed by the content team **before** arm authoring, recorded in the content map, and never chosen by the diagram authors.
2. Profile assignment follows the AC's structural type, not the task regime it will be tested under — this limits (but cannot eliminate) the profile × regime confound.
3. ⟦4⟧ profiles maximum for the initial study. Profile proliferation is notation drift; a fifth profile requires the same governance as a vocabulary extension.

## VN.5 Legend, annotation, and the text-leakage cap

Diagrams unavoidably contain text. Uncontrolled, D degenerates into "Arm L with pictures," and the S vs D and L vs D contrasts die. The cap:

1. **Labels may name; they may not state.** Text within the diagram field may identify entities (names, identifiers) and reference legend symbols. Text may **not** express a relation, condition, threshold semantics, or exception in prose. Relations are carried by Class 1 channels only.
2. **The legend defines the notation; it does not restate the content.** Legend entries define glyph and line semantics ("dashed inner boundary = margin-reduced support region"). A legend entry that states an AC in prose ("the center of mass must remain within…") is a violation — that AC must be carried by the diagram, or routed to BP.5.
3. **Propagated FAs** (BP.3 Step 5) are expressed in D as: (a) a visual convention where configurational (preferred — e.g., the dashed margin boundary of BP.8); (b) a legend *convention* entry where the FA governs interpretation (e.g., "projection direction: vertical, denoted by ⟂ marker"); (c) a structured annotation marker where numeric (e.g., "m = ⟦value⟧" attached to the margin boundary). Never a prose sentence.
4. **Quantified cap, audited:** total text tokens in a diagram (labels + annotations, excluding the legend) ≤ ⟦τ_text, candidate: 30%⟧ of the token count of the corresponding Arm L rendering of the same ACs. The cap value is calibrated in pilot and frozen. Per-diagram token counts are recorded in the content map.
5. **Legend placement is uniform** (same position, format, and ordering rules across all diagrams) so legend-reading cost is constant, not a per-diagram variable.

## VN.6 Incidental content defaults (implements BP.6)

1. **Default: schematic, not-to-scale rendering.** Every diagram carries a standard NOT-TO-SCALE legend flag. Metric visual properties are Class 3, non-semantic by default.
2. **Neutralization drawing rules:** where a metric quantity could be incidentally read (relative sizes, apparent margins, apparent angles), authors must draw to *avoid implying a value the AC set does not assert* — e.g., near-boundary cases must not be drawn either obviously-inside or obviously-outside; the standard convention is to draw the queried element at the boundary marker with an explicit "position given by annotation" marker. Auditors check IC during the BP Step 3 harvest using the diagram-specific checklist: implied convexity, implied symmetry, implied scale, implied completeness (does the drawing suggest all elements are shown?), implied planarity.
3. **Implied completeness** deserves its own convention: diagrams suggest closed-world readings by default. Every profile defines an "elision marker" (e.g., an ellipsis glyph) that must be used wherever the AC set does not assert enumeration completeness. Absence of the marker is a positive claim of completeness and is audited as such.
4. **Promotion:** where a metric quantity *is* AC content, it appears as a dimensioned annotation (VN.5.3c) and, per BP.6 option 2, in every other arm in native form.

## VN.7 Rendering and delivery parameters (frozen experimental parameters)

- **Format:** vector-authored, rasterized to ⟦PNG⟧ for model delivery;
- **Resolution:** ⟦1024×1024⟧ px canvas, with minimum stroke width ⟦2⟧ px and minimum label height ⟦16⟧ px at delivery resolution — floor values verified against the extraction battery in pilot;
- **Rendering pipeline:** one toolchain, version-pinned; the pipeline identity and configuration are hash-committed;
- **Color:** monochrome by default (color is Class 2; removing it removes a variance source and a model-capability confound);
- **Delivery:** identical image preprocessing across all model families' ingestion paths, to the extent the providers permit; any provider-side preprocessing that cannot be controlled is documented per model family and reported alongside Tier 1 results;
- **One rendering per diagram.** No per-model re-rendering, resizing, or enhancement. If a model family cannot consume the frozen rendering, that is a Tier 1 access finding, not a rendering bug to be fixed mid-run.

## VN.8 Authorship, convergence, and parity

1. **Independent authorship:** diagram authors are a distinct role (BP.9); they receive the frozen AC closure, the assigned profile, and this specification — not the L/M/S materials, so that D is authored from the canonical content, not translated from a sibling arm (translation from L would import L's framing as a hidden intermediate representation).
2. **Author-convergence check (spec validation):** on a ⟦20%⟧ sample of the corpus, two diagram authors independently produce diagrams from the same ACs and profile. Both versions go to back-translation. The spec is validated if independent authors' diagrams back-translate to the same AC reconstruction at ⟦≥ 90%⟧ agreement. Failure means the *specification* underdetermines the diagrams — the operationalization is the author, not the notation — and the spec must be tightened before freeze. This is the instrument-calibration step; without it, VN is a style guide, not a specification.
3. **Parity requirement:** frozen D materials must pass the human back-translation audit (§9.2) at the same preregistered threshold as every other arm **before** any confirmatory run. D's per-substrate reconstruction difficulty is reported as calibration data; parity is required on the threshold, not on difficulty.
4. **Revision loop:** diagrams failing back-translation are revised and re-audited *before BP certification*; post-certification revision is prohibited (BP.10 amendment rule applies).

## VN.9 Prohibited practices

For audit clarity, the following are categorical violations, checked at certification:
- prose statements of relations or conditions in the diagram field or legend (VN.5.1–5.2);
- content carried on Class 2 channels;
- to-scale encoding of unpromoted metric quantities;
- glyphs or line types outside the frozen profile vocabulary;
- per-diagram legend variations;
- embedding Arm S serializations, Arm M equations, or tables as image content (this would make D a screenshot of another arm — the degenerate case that voids the substrate manipulation; the sole exception is the structured numeric annotation of VN.5.3c);
- post-freeze vocabulary or profile changes.

## VN.10 Worked example (normative)

The BP.8 center-of-mass AC set, rendered under Profile VN-CON:

- Support polygon: closed solid boundary (Class 1, boundary style: physical).
- Margin-reduced region: dashed inner boundary (boundary style: margin); annotation marker "m = ⟦value⟧" attached (VN.5.3c).
- Center of mass: entity glyph ⟨⊕⟩ per vocabulary; label "CM" (names, does not state).
- Projection convention (propagated FA-1): legend convention entry — "⟂ marker: position shown is vertical projection onto support plane"; ⟂ marker placed at the CM glyph (VN.5.3b).
- Mass-center-not-geometric-center (propagated FA-2, per BP.8b): carried by the vocabulary definition of ⟨⊕⟩ itself in the legend ("⊕ = mass center") — a convention entry, not a prose restatement of the condition.
- The queried configuration (is the CM within the margin-reduced region?) is drawn with the CM glyph at the "position by annotation" marker (VN.6.2) so the drawing does not visually answer the task.
- NOT-TO-SCALE flag present; monochrome; no elision marker on the polygon vertices, because the AC set asserts the polygon is fully specified — completeness is being positively claimed, correctly.

What the diagram *carries visually* that S carries only as records: the containment structure itself — that the margin region is inside the support region, that the query is a point-in-region relation. That configurational content is the substrate manipulation the S vs D contrast measures.

## VN.11 Interfaces

1. **BP:** VN.5.3 is the normative form for BP.3 Step 5 propagation into D; VN.6 implements BP.6 with neutralize-as-default; diagram IC harvest (VN.6.2 checklist) occurs in BP Step 3; vocabulary sufficiency is checked at BP closure freeze (VN.3).
2. **Back-translation (§9.2):** reviewers of D receive diagram + legend, nothing else; reconstruction scored against the frozen closure, including propagated FAs (BP.11.2).
3. **Extraction gate (Section T):** the Tier 1 battery for D includes diagram-element recognition and legend-application items at the frozen rendering parameters (VN.7); a failure of glyph recognition at spec-floor stroke/label sizes discovered in pilot triggers parameter revision *before* freeze, never after.
4. **Content map:** per-diagram records include profile, glyph inventory used, text token count vs cap, IC dispositions, and convergence-check membership.
5. **Arm H:** H's diagrammatic constituent uses this specification unchanged; H may not use a richer or looser visual notation than D, or the H vs best-single contrast confounds hybridization with notation quality.

## VN.12 Commitments

Hash-committed before confirmatory generation, in dependency order: common core spec (this section, parameterized) → genre profiles and vocabularies → profile-to-invariant assignments → rendering pipeline identity and parameters → author-convergence results → final diagram corpus → text-leakage counts → certification record. Post-freeze amendments: none; discoveries route to BP.5 / DP.7-F1.

---

## Reviewer drafting notes (retain in Internal Research Record, not in the standard)

1. **Claim scoping consequence.** With this specification, a D-arm result is a finding about *controlled schematic notation under the frozen profiles* — not about "diagrams" as found in engineering practice, which are richer, dirtier, and heavily text-hybridized. §26's claims discipline should gain one line: D results scope to the registered notation system, and neither an advantage nor a deficit generalizes to informal diagrams.

2. **The profile × regime residual confound.** VN.4.2 assigns profiles by structural type, but structural type correlates with task regime (containment ACs will be tested mostly by spatial tasks). D's per-regime effects are therefore partially per-*profile* effects. The analysis plan should record profile as a covariate and DP.5's regime-scoped D claims should name the profile. This confound cannot be removed within a single study — only declared — because it is a fact about the world, not a design error.

3. **The convergence check is the keystone.** If VN.8.2 fails in pilot — independent authors produce divergent diagrams — do not proceed to the multimodal arms on schedule. A notation that underdetermines its diagrams cannot support a substrate claim, and the honest move at that point is the one §28 already licenses: run the S-vs-L pre-pilot as the deliverable while the notation is tightened, rather than letting schedule pressure certify a broken instrument.
