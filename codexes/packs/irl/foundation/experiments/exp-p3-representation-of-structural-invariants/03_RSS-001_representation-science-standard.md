# RSS-001 — Representation Science Standard

**Invariant Research Lab (IRL) · Reusable Methodology Standard**
**Version: 1.0 Candidate · Status: pending series ratification (with EXP-P3)**

> Document 03 of the EXP-P3 set — and a **reusable standard, not a P3-only document**. RSS-001
> extracts the representation-science methodology first instantiated by EXP-P3 so that future
> experiments comparing representational substrates can adopt it without re-deriving it. It
> makes no experiment-specific claims.
>
> **Conventions.** ⟦ ⟧ marks parameters an instantiating experiment must freeze before
> confirmatory runs (candidate values shown where proposed). Arms **L / M / D / S / H**
> (Linguistic / Mathematical / Diagrammatic / Serialized Structural / Controlled Hybrid) are the
> standard's canonical representation families; an instantiating experiment registers which
> families it uses. References of the form "§9.1 / §9.2 / §11 / §14 / §23 / §24 / §26 / §28"
> resolve to the instantiating experiment's design body (for EXP-P3: the v0.2 design brief whose
> operative content now lives in `02_experimental-protocol.md` and `05_implementation-guide.md`);
> references to "Section DP / DP.n" resolve to the instantiating experiment's Statistical
> Analysis Plan (for EXP-P3: `04_statistical-analysis-plan.md`).

## Contents

- **§1 Representation Certification** — atomic content mapping, back-translation, certification
- **§2 Tiered Computational Equivalence** — Section T (two-tier claim architecture, extraction gate)
- **§3 Assumption Back-Propagation and Content Certification** — Section BP, with canonical assumption closure (normative amendments merged)
- **§4 Visual Representation Standard** — Section VN (Arm D visual notation specification)
- **§5 Audit Framework** — commitments, roles, freeze rules (consolidated index)
- **§6 Governance and Reuse**

---

# §1 Representation Certification

All experimental materials undergo certification before use. Certification consists of: Atomic Content decomposition; Content Mapping; Assumption Back-Propagation; Canonical Assumption Closure; Informational Equivalence Audit; Back Translation; Representation Certification. Only certified materials enter confirmatory analysis.

## 1.1 Informational Equivalence Standard

The standard does not claim that cross-modal representations are perfectly semantically identical. Instead, it uses a two-part auditable standard.

### 1.1.1 Atomic Content Mapping

Every invariant will be decomposed into atomic structural conditions. A content-mapping matrix will record where each atomic condition appears in each representation.

For every condition, the matrix must identify: whether it is present; how it is encoded; whether it is explicit or implicit; whether translation required an additional assumption; whether any information was lost; whether any information was introduced.

The mapping must be completed and hash-committed before experimental runs.

*(Assumption handling and the closure computation that finalizes the atomic-condition set are normative in §3, Section BP, which supersedes any simpler declaration-only treatment of this step.)*

### 1.1.2 Independent Back-Translation Audit

Independent reviewers will receive only one representation at a time and reconstruct the structural conditions it communicates. Their reconstruction will be compared against the canonical atomic-condition set.

This produces an empirical measure of: extraction accuracy; omission; addition; ambiguity; interpretive disagreement.

Back-translation performance becomes the operational certificate of informational comparability. Representations that fail the preregistered equivalence threshold cannot support a confirmatory substrate-effect claim.

Back-translation runs only on frozen-closure materials and is scored against the closed atomic-condition set, including propagated forced assumptions (§3, BP.11.2).

## 1.2 Structural Fidelity

The phrase "structural fidelity" will not be defined by downstream task performance. That would be circular.

Where used, structural fidelity will be measured independently through the content and back-translation audits.

Candidate ex ante measures include: proportion of atomic conditions recoverable; proportion of relations explicitly encoded; number of undeclared assumptions required; rate of reconstruction disagreement; rate of omitted or added conditions.

An experiment must not infer that a representation has greater structural fidelity merely because it performs better.

---

# §2 Tiered Computational Equivalence — Section T (Two-Tier Claim Architecture)

## T.1 Rationale

Computational equivalence includes both **accessibility** (whether a tested system can recover the represented conditions) and **reasoning performance given access**. These are distinct scientific outcomes and must not be conflated by a single gating step. A substrate that current systems cannot reliably read is computationally non-equivalent in a consequential way; that result is a finding, not an exclusion.

The standard therefore registers two claim tiers. Both are confirmatory. Neither may be reported as the other.

## T.2 Tier 1 — Substrate Access Effect

**Registered question:** Do representational substrates differ materially in the accuracy with which tested model architectures can recover the audited atomic structural conditions?

**Instrument:** For every model × representation cell, an extraction battery administered before any reasoning task, comprising:
- atomic condition recovery (proportion of canonical atoms correctly recovered);
- relation recovery (correct identification of relation type and arguments);
- boundary and threshold recovery (correct recovery of numerical limits and scope qualifiers);
- absence integrity (rate of conditions invented during extraction).

Extraction items are scored against the canonical atomic-condition set fixed by the content-mapping audit (§1.1.1) after assumption back-propagation. Extraction materials and scoring keys are hash-committed before generation.

**Tier 1 outcomes (confirmatory):**
- per-cell extraction accuracy, with atomic condition recovery as the Tier 1 primary measure;
- pairwise substrate differences in extraction accuracy, within model family.

**Tier 1 claims permitted:** "Substrate X was materially less/more accessible than substrate Y under the tested architectures." A substrate that fails the gate (T.4) in all tested model families supports the confirmatory finding: *the substrate is computationally inaccessible to the tested architectures*. This is a valid positive result under the access component of a substrate-effect hypothesis and must be reported as such.

**Tier 1 claims prohibited:** any inference about the reasoning quality the substrate would support if accessible; any claim about the substrate's intrinsic representational fidelity independent of the consuming system.

## T.3 Tier 2 — Reasoning-Given-Access Effect

**Registered question:** Among model × representation cells demonstrating reliable access, does substrate materially affect structural-validity reasoning accuracy, as a function of task regime?

Tier 2 uses the instantiating experiment's primary outcome (structural-validity accuracy) and co-primary outcome (contradiction rate), evaluated under the decision procedure in Section DP.

**Tier 2 claims permitted:** substrate and substrate × regime effects on reasoning, scoped to gate-passing cells and tested architectures.

**Tier 2 claims prohibited:** extrapolation to cells excluded by the gate; aggregation across cells with unequal gate eligibility (T.5).

## T.4 Extraction Gate

A model × representation cell **passes the gate** if:
- atomic condition recovery ≥ ⟦θ_gate, candidate 0.90⟧; and
- invented-condition rate ≤ ⟦θ_inv, candidate 0.05⟧;

measured on the committed extraction battery. θ values are frozen before confirmatory runs and must be justified independently of any arm's observed performance. Gate results are reported for **all** cells, pass or fail, as Tier 1 data.

## T.5 Tier 2 Eligibility Rules

1. **Within-contrast completeness.** A Tier 2 contrast between substrates X and Y is computed only within model families where *both* X and Y passed the gate. Cells are never pooled across families with unequal eligibility.
2. **Minimum family rule.** A Tier 2 contrast is confirmatory only if computed in ≥ ⟦2⟧ model families. If eligible in exactly one family, the contrast is reported as *architecture-scoped exploratory*, with the claim limited to that family.
3. **Arm H disposition.** Arm H is Tier 2–eligible in a model family only if **every constituent single substrate** (L, M, D) individually passed the gate in that family. If any constituent fails, H is excluded from Tier 2 in that family and its extraction result is reported under Tier 1 with the failing constituent identified. H may not be credited with "complementarity" in any family where a constituent was unreadable.
4. **No post hoc gate adjustment.** θ values may not be revised after any confirmatory generation. If pilot data show the candidate θ values exclude all cells for a substrate, that substrate's Tier 2 questions are deferred, and the exclusion is itself reported under Tier 1; θ is not lowered to admit the substrate.

---

# §3 Assumption Back-Propagation and Content Certification — Section BP

One design tension, stated openly: naive back-propagation would destroy an experiment of this
class. If every commitment forced by formalization is copied into Arm L as prose, L drifts toward
being a verbose serialization of M, and the manipulation dissolves. The procedure rests on one
load-bearing distinction: **content commitments propagate; encoding properties do not.**

## BP.1 Purpose

Translating structural knowledge into different substrates forces commitments unevenly: formalization demands precision that prose permits to remain open; diagrams encode spatial relations implicitly; prose carries scope and exception structure other substrates lack. If these forced commitments remain in only the substrate that forced them, every cross-arm contrast is confounded by content, and the falsification provisions (§23 / DP.8-F1) pre-condemn the affected contrasts.

BP ensures that, before any experimental run, all arms carry the **same set of content commitments**, each expressed in its own substrate's native form, so that surviving performance differences are attributable to encoding rather than to information.

## BP.2 Definitions

**Atomic condition (AC).** A minimal, independently evaluable structural statement: one relation, its arguments, its scope, and its qualifiers. The canonical AC set is substrate-neutral and is the reference object for all audits.

**Forced assumption (FA).** A commitment that (a) is not present in the canonical AC set, and (b) must be introduced for some substrate to express an AC at all. Examples: a coordinate frame; a numerical stability margin standing in for "safely within"; a closed-world assumption implied by an exhaustive schema; a convexity property implied by a drawn polygon.

**Encoding property (EP).** A characteristic of *how* a substrate expresses content, carrying no independently evaluable structural commitment. Examples: identifiers and keys in Arm S; symbol choice and notation style in Arm M; layout, color, and line weight in Arm D; sentence order in Arm L. **EPs are the experimental manipulation. They are never propagated.**

**Transformation.** A re-expression of an AC into a substrate's native form that introduces no commitment absent from the canonical AC set — i.e., a translation that is content-lossless under the boundary test. Transformations are the intended, unavoidable act of arm authoring and are never logged as FAs. The operational discriminator: apply the BP.2 boundary test to everything the re-expression added; if every added element fails the test (could not change any task answer), the re-expression is a transformation; if any element passes, that element is an FA and the re-expression is a transformation *plus* an FA, logged accordingly. Auditors classify the *elements*, not the re-expression as a whole — a single translation may contain both.

*(This also tightens the FA/EP boundary: EP describes retained stylistic properties of a substrate; transformation describes the act of lossless re-encoding; FA describes introduced content. Three categories, no gaps.)*

**Incidental content (IC).** Content unavoidably co-transmitted by a substrate that is neither in the AC set nor deliberately introduced — most acutely, quantitative spatial information readable from a diagram (relative sizes, apparent distances, aspect ratios) that other arms do not carry. IC is the hardest category and is handled in BP.6.

The FA/EP boundary test, applied by auditors to every candidate item:

> *Could a reasoner's answer to any task in the committed taxonomy change depending on whether this item is true?* If yes → FA (propagate or exclude). If no → EP (retain, never propagate).

Boundary rulings are recorded with rationale and are themselves hash-committed; contested rulings go to the adjudication panel (BP.9).

## BP.3 Procedure

**Step 1 — Canonical decomposition.** The invariant corpus is decomposed into the canonical AC set by the content team, before any arm materials exist. Hash-committed.

**Step 2 — Independent arm authoring (draft round).** Each substrate team authors its arm's materials from the canonical AC set only, without sight of other arms' drafts. Authors log every commitment they were forced to introduce, in a structured FA declaration: the AC affected, the commitment introduced, why the substrate required it, and candidate FA/EP/IC classification.

**Step 3 — Assumption harvest.** Auditors (independent of all authoring teams) collect the FA declarations, *and* independently inspect each draft arm for undeclared commitments, using the boundary test in BP.2. Diagram inspection explicitly includes implicit-content review (BP.6).

**Step 4 — Classification.** Every harvested item is classified FA, EP, or IC. FA items proceed to Step 5. EP items are logged and retained. IC items go to BP.6.

**Step 5 — Propagation.** Each FA is added to the canonical AC set as a new atomic condition (flagged `propagated`, with provenance recording which substrate forced it). Every arm's materials are then revised so the propagated AC is expressed **in that arm's native form**:
- Arm L: a controlled-language sentence;
- Arm M: an explicit premise, definition, or side condition;
- Arm S: an additional typed record or field;
- Arm D: a legend entry, annotation, or declared visual convention;
- Arm H: per its constituent forms.

Native-form expression is mandatory. Propagation must not smuggle one substrate's encoding into another (e.g., inserting equations into Arm L prose is prohibited; the *commitment* is stated in words, not the *notation*).

**Step 6 — Canonical assumption closure.**
Propagation may itself force new assumptions: expressing a coordinate-frame commitment diagrammatically may require a new visual convention that carries its own implications. The procedure therefore computes a **canonical assumption closure** before any freeze:

1. **Iterate:** Steps 3–5 repeat on draft materials. Each round, newly forced FAs (including those forced *by propagation itself*) are harvested, classified, centrally resolved (BP.4), and added to the working AC set. During closure computation, recursion is permitted and expected: an FA forced by projecting into Arm D propagates into L, M, S, and H like any other.
2. **Terminate:** iteration ends at the earlier of (a) a fixed point — a round harvesting zero new FAs — or (b) round ⟦3⟧.
3. **Freeze:** the working AC set at termination becomes the **frozen canonical closure**, hash-committed with full provenance (which substrate forced each FA, in which round).
4. **Final projection:** final arm materials are authored against the frozen closure. This is a one-time projection; no further propagation is permitted.
5. **Post-freeze residue rule:** any FA discovered *after* freeze — during final projection, certification, back-translation, or the experimental run — is **never** propagated. It is routed to BP.5 disposition: AC exclusion or contrast scoping, with the discovery logged. If discovered after confirmatory generation begins, it is handled under DP.7-F1 as a potential content-inequivalence finding, not by revising materials.

Termination at the round bound rather than a fixed point is recorded in the certification record, and every FA still emerging in the final round is treated as non-propagatable under BP.5. The round bound exists to prevent arm homogenization: unbounded iteration converges the arms toward a common hybrid, destroying the experimental manipulation. The homogenization check in BP.7 is the counterweight to closure and must be evaluated *against the frozen-closure materials*, not the drafts.

**Step 7 — Post-propagation content map.** The final matrix records, for every AC (original and propagated) × every arm: present/absent; explicit/implicit; native encoding used; residual caveats. This is the artifact DP.2 Stage 0 item 1 requires.

**Step 8 — Certification and freeze.** Auditors certify post-propagation equivalence per BP.7. All materials, the AC set, FA registry, EP log, IC dispositions, and the content map are hash-committed. Only then does back-translation (§1.1.2) run, followed by the extraction gate (Section T).

## BP.4 Choice-of-commitment rule

Where a substrate forces a *choice* among possible commitments (e.g., which stability margin value; which coordinate convention), the choice is made **once, centrally**, by the content team — not by the substrate team that encountered it — and then propagated everywhere. This prevents a substrate team from selecting commitments favorable to its own arm's task performance. All such choices are logged with rationale.

## BP.5 Non-propagatable items

An FA is non-propagatable if it cannot be expressed in some arm's native form without either (a) importing another substrate's encoding, or (b) exceeding the convergence bound. Disposition rule, in order of preference:

1. **AC exclusion:** every task whose ground-truth answer depends on the affected AC is removed from confirmatory scoring for *all* arms. The exclusion list is committed before runs.
2. **Contrast scoping:** if exclusion would gut a task regime (> ⟦20%⟧ of its items), the affected contrast is instead declared *content-limited in that regime*, reported with the limitation, and barred from DP.5 confirmation in that regime.

Option 2 exists because silent mass exclusion is itself a bias (surviving tasks skew toward what all substrates express easily — which structurally favors L, the most flexible substrate). The 20% tripwire forces that trade-off into the open.

## BP.6 Incidental content (diagram-specific rule)

Diagrams transmit measurable spatial fact by existing. Disposition options, chosen per IC item and logged:

1. **Neutralize:** redraw so the incidental quantity is uninformative (schematic, not-to-scale rendering; explicit "NOT TO SCALE" legend flag) — preferred wherever the AC set does not require the quantity;
2. **Promote:** if the quantity *is* part of the AC set, it is not incidental — it is content, and must be present in all arms (numbers in L/M/S; dimensioned annotation in D);
3. **Accept-and-declare:** where neither is feasible, the IC item is recorded as a declared residual asymmetry, and any contrast whose result plausibly depends on it is flagged in reporting under DP.7-F1 review.

The Arm D visual notation specification (§4, Section VN) must state which of these is the default; recommended default is (1).

## BP.7 Certification criteria

Post-propagation equivalence is certified when:

- every AC is present in every arm, or covered by a BP.5 disposition;
- no arm contains a commitment absent from the final AC set (auditor inspection, second harvest pass);
- all FA registry items are propagated or dispositioned; no item remains "declared-only" — **declaration without disposition is a certification failure**;
- the EP log confirms each arm retains its distinctive encoding (a homogenization check: auditors confirm the arms still *differ* in the intended manipulation — equivalence of content, not similarity of form);
- back-translation (§1.1.2) subsequently achieves the preregistered reconstruction threshold on the *post-propagation* materials, per arm.

## BP.8 Worked example (normative illustration)

Canonical AC: *the center of mass of the assembly must remain within the support polygon under registered loading.*

- Arm M drafting forces: a projection convention (vertical projection onto the support plane) and a margin semantics (boundary inclusive vs. exclusive with margin m). Both are FAs — a reasoner's answer on near-boundary tasks changes with them.
- Central choice (BP.4): vertical projection; inclusive boundary with margin m = ⟦value⟧.
- Propagation: L gains the sentence "The check uses the vertical projection of the center of mass onto the support plane; the position must lie inside the polygon boundary reduced by margin m." S gains fields `projection: "vertical"`, `boundary: "inclusive"`, `margin: m`. D gains a legend convention: dashed inner boundary denotes the margin-reduced polygon; a legend note states the projection convention.
- Arm D harvest finds IC: the drawn polygon appears convex and the drawn margin appears large relative to the polygon. Disposition: neutralize — schematic rendering, "not to scale" legend flag; convexity is checked against the AC set — if convexity matters to any task's ground truth, it is promoted to an AC and propagated; otherwise the drawing is revised to avoid implying it.
- EP items logged, not propagated: M's symbol choice π_xy; S's key names; D's line weights; L's sentence order.

## BP.8b Recursive propagation example

Round 1: Arm M forces FA-1 (vertical projection convention) from the center-of-mass AC. FA-1 is centrally resolved and propagated. Projecting FA-1 into Arm D requires a new legend convention: an arrow glyph denoting projection direction.

Round 2 harvest: auditors apply the boundary test to the arrow glyph. The glyph *element* is EP (notation style). But the glyph's placement implies the projection is taken from the assembly's geometric center rather than its mass center — an implication that could change answers on asymmetric-mass tasks. That implication is FA-2. FA-2 is centrally resolved (mass center, not geometric center) and propagated to all arms: L gains a clarifying sentence; M gains an explicit definition; S gains a field; D's legend is corrected.

Round 3 harvest: zero new FAs. Fixed point reached; closure frozen at two propagated FAs.

Counterfactual: had FA-2 emerged only during final projection (post-freeze), it would not have been propagated; instead, all asymmetric-mass tasks would be excluded from confirmatory scoring under BP.5, or the affected contrasts scoped, with the discovery logged.

## BP.9 Roles and separation

Distinct, declared before Step 1: content team (AC decomposition; BP.4 choices); one authoring team per substrate; harvest/classification auditors; certification auditors; adjudication panel for contested FA/EP/IC rulings. Auditors and adjudicators hold no authoring role. Task authors (§11) hold no BP role — the task corpus is committed **before** Step 2, so that FA classification (whose boundary test references the task taxonomy) cannot be gamed by writing tasks after seeing which assumptions propagated. This sequencing is load-bearing and must appear in the commitment inventory.

## BP.10 Commitments

Hash-committed, in order: canonical AC set (pre-propagation) → task corpus → draft-round FA declarations → classification rulings and rationales → final AC set with provenance → post-propagation arm materials → content map → EP log and IC dispositions → certification record. Amendments after first confirmatory generation: none; any later-discovered content asymmetry is handled under DP.7-F1, not by revising materials.

## BP.11 Interfaces with other protocol sections

1. **Content map (Step 7):** built against the frozen closure; every propagated FA appears as a flagged AC row with provenance.
2. **Back-translation (§1.1.2):** runs only on frozen-closure materials. Reconstruction is scored against the *closed* AC set, including propagated FAs — a substrate from which reviewers cannot recover a propagated FA fails equivalence on that atom, exactly as for an original AC.
3. **Extraction gate (Section T):** the Tier 1 battery samples propagated FAs as well as original ACs. Propagated-FA extraction accuracy is reported as a distinguishable subscore, since propagated content is the newest and most artificial material in each arm and plausibly the hardest to recover.
4. **Decision procedure (Section DP):** BP certification is DP.2 Stage 0 item 1; failure removes the arm from Tier 2 and routes it to Tier 1 reporting. Post-freeze residue discovered after confirmatory generation routes to DP.7-F1. BP.5 contrast-scoping declarations bind DP.5: a contrast declared content-limited in a regime is barred from confirmation in that regime.
5. **Materiality threshold (DP.1):** the pilot estimate of ⟦δ_mat⟧ must be taken from *post-closure* pilot materials. Pre-closure pilot effects overstate the encoding effect by including content asymmetries the closure removes; calibrating δ_mat on them would set an unreachable bar.

---

# §4 Visual Representation Standard — Section VN (Arm D Visual Notation Specification)

Design tension, stated openly: **the more rigorously you control a visual notation, the closer it
drifts toward being a visual serialization of Arm S — which would dissolve the very contrast
(S vs D) the arm exists to serve.** The specification protects, as its central commitment, the
property that makes D a distinct substrate: **relations carried by visual-spatial configuration
itself** — topology, containment, adjacency, direction — rather than by enumerable symbolic
statements.

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
3. **Parity requirement:** frozen D materials must pass the human back-translation audit (§1.1.2) at the same preregistered threshold as every other arm **before** any confirmatory run. D's per-substrate reconstruction difficulty is reported as calibration data; parity is required on the threshold, not on difficulty.
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
2. **Back-translation (§1.1.2):** reviewers of D receive diagram + legend, nothing else; reconstruction scored against the frozen closure, including propagated FAs (BP.11.2).
3. **Extraction gate (Section T):** the Tier 1 battery for D includes diagram-element recognition and legend-application items at the frozen rendering parameters (VN.7); a failure of glyph recognition at spec-floor stroke/label sizes discovered in pilot triggers parameter revision *before* freeze, never after.
4. **Content map:** per-diagram records include profile, glyph inventory used, text token count vs cap, IC dispositions, and convergence-check membership.
5. **Arm H:** H's diagrammatic constituent uses this specification unchanged; H may not use a richer or looser visual notation than D, or the H vs best-single contrast confounds hybridization with notation quality.

## VN.12 Commitments

Hash-committed before confirmatory generation, in dependency order: common core spec (this section, parameterized) → genre profiles and vocabularies → profile-to-invariant assignments → rendering pipeline identity and parameters → author-convergence results → final diagram corpus → text-leakage counts → certification record. Post-freeze amendments: none; discoveries route to BP.5 / DP.7-F1.

---

# §5 Audit Framework (consolidated index)

The audit machinery of the standard, in execution order, with the normative source for each step:

1. **Role separation** — content team; per-substrate authoring teams; harvest/classification auditors; certification auditors; adjudication panel; task authors hold no BP role (BP.9). Diagram authors are a distinct role (VN.8.1).
2. **Sequencing (load-bearing)** — canonical AC decomposition → task corpus committed → arm draft authoring → assumption harvest/classification → propagation → **canonical assumption closure** (fixed point or round bound) → closure freeze → final projection → content map → certification → back-translation → extraction gate → confirmatory runs (BP.3, BP.9).
3. **Content mapping** — the per-AC × per-arm matrix (§1.1.1; BP.3 Step 7).
4. **Back-translation** — independent single-representation reconstruction audit against the frozen closure (§1.1.2; BP.11.2; VN.8.3).
5. **Extraction gating** — the Tier 1 battery and gate (Section T; BP.11.3; VN.11.3).
6. **Hash commitments** — every audit artifact is hash-committed in the declared dependency order (BP.10; VN.12; T.2; DP.1). Commitment inventories are part of the instantiating experiment's preregistration bundle.
7. **Freeze rules** — no post-freeze propagation (BP.3 Step 6.5); no post hoc gate adjustment (T.5.4); no post-certification diagram revision (VN.8.4); no parameter, gate, eligibility, or interpretation-row modification after first confirmatory generation (DP.9; BP.10; VN.12).
8. **Escalation** — contested FA/EP/IC rulings → adjudication panel (BP.2/BP.9); post-freeze residue → BP.5 disposition or DP.7-F1; Class 2 channel content → redraw or BP escalation (VN.2).

# §6 Governance and Reuse

1. **No experiment-specific claims.** RSS-001 defines method, not findings. Nothing in this standard asserts that any substrate effect exists; that is the instantiating experiment's hypothesis space.
2. **Instantiation.** An experiment adopts RSS-001 by: registering its representation families; freezing every ⟦ ⟧ parameter with independent justification; binding "Section DP" references to its own preregistered statistical analysis plan; and citing the standard by version (e.g., "Representation Certification SHALL be performed in accordance with RSS-001 §3").
3. **Versioning.** Amendments to RSS-001 produce a new version; a running experiment remains bound to the version it froze. No amendment may be motivated by an in-flight experiment's observed results.
4. **Method maturity discipline.** Claims discipline applies to methods too: a procedure that has never been executed is a proposal, not a method. The closure procedure (§3, BP.3 Step 6) and the notation convergence check (§4, VN.8.2) are validated by their first execution within an instantiating experiment; any companion methods write-up follows that execution.
5. **Provenance.** RSS-001 v1.0 Candidate is extracted from the EXP-P3 protocol engineering record (sources of 2026-07-26); its first instantiation is EXP-P3. Ratification travels with the EXP-P3 series ratification.
6. **Downstream adoption (recorded 2026-07-27).** By operator ruling, RSS-001 certification is an **admissibility precondition** of the EXP-P2 consequence family: every representation entering EXP-P2A (software) or EXP-P2B (physical) must pass certification before it enters the consequence experiment. The adoption — including which RSS-001 sections each of the ruling's five named steps resolves to — is recorded at `../exp-p2-consequential-performance/01_shared-constitutional-framework.md` §3, not here. This clause is a pointer, not a second home for it, and it adds nothing to the standard: adoption obligations remain exactly those in clause 2 above, and the adopting experiment's ⟦ ⟧ freeze is still outstanding.
