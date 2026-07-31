# SOURCE MATERIAL — EXP-P3 Section BP (Assumption Back-Propagation and Content Certification)

> Provenance file, verbatim (operator-supplied, 2026-07-26). BP replaces brief-v0.2 §9.1;
> back-translation §9.2 is unchanged and runs after BP completes. The four AMENDMENTS at the
> end are normative and must be merged into the section when assembling the final document
> (Amendment 2 REPLACES BP.3 Step 6). Do not edit; derive from it.

One design tension, stated openly (reviewer preamble): naive back-propagation would destroy
the experiment. If every commitment forced by formalization is copied into Arm L as prose, L
drifts toward being a verbose serialization of M, and the manipulation dissolves. The
procedure rests on one load-bearing distinction: **content commitments propagate; encoding
properties do not.**

---

# Section BP — Assumption Back-Propagation and Content Certification

## BP.1 Purpose

Translating structural knowledge into different substrates forces commitments unevenly: formalization demands precision that prose permits to remain open; diagrams encode spatial relations implicitly; prose carries scope and exception structure other substrates lack. If these forced commitments remain in only the substrate that forced them, every cross-arm contrast is confounded by content, and §23/DP.8-F1 pre-condemns the affected contrasts.

BP ensures that, before any experimental run, all arms carry the **same set of content commitments**, each expressed in its own substrate's native form, so that surviving performance differences are attributable to encoding rather than to information.

## BP.2 Definitions

**Atomic condition (AC).** A minimal, independently evaluable structural statement: one relation, its arguments, its scope, and its qualifiers. The canonical AC set is substrate-neutral and is the reference object for all audits.

**Forced assumption (FA).** A commitment that (a) is not present in the canonical AC set, and (b) must be introduced for some substrate to express an AC at all. Examples: a coordinate frame; a numerical stability margin standing in for "safely within"; a closed-world assumption implied by an exhaustive schema; a convexity property implied by a drawn polygon.

**Encoding property (EP).** A characteristic of *how* a substrate expresses content, carrying no independently evaluable structural commitment. Examples: identifiers and keys in Arm S; symbol choice and notation style in Arm M; layout, color, and line weight in Arm D; sentence order in Arm L. **EPs are the experimental manipulation. They are never propagated.**

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

**Step 6 — Convergence check.** [SUPERSEDED — see Amendment 2 below, which replaces this step with canonical assumption closure.]

**Step 7 — Post-propagation content map.** The final matrix records, for every AC (original and propagated) × every arm: present/absent; explicit/implicit; native encoding used; residual caveats. This is the artifact DP.2 Stage 0 item 1 requires.

**Step 8 — Certification and freeze.** Auditors certify post-propagation equivalence per BP.7. All materials, the AC set, FA registry, EP log, IC dispositions, and the content map are hash-committed. Only then does back-translation (§9.2) run, followed by the extraction gate (Section T).

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

The Arm D visual notation specification must state which of these is the default; recommended default is (1).

## BP.7 Certification criteria

Post-propagation equivalence is certified when:

- every AC is present in every arm, or covered by a BP.5 disposition;
- no arm contains a commitment absent from the final AC set (auditor inspection, second harvest pass);
- all FA registry items are propagated or dispositioned; no item remains "declared-only" — **declaration without disposition is a certification failure**;
- the EP log confirms each arm retains its distinctive encoding (a homogenization check: auditors confirm the arms still *differ* in the intended manipulation — equivalence of content, not similarity of form);
- back-translation (§9.2) subsequently achieves the preregistered reconstruction threshold on the *post-propagation* materials, per arm.

## BP.8 Worked example (normative illustration)

Canonical AC: *the center of mass of the assembly must remain within the support polygon under registered loading.*

- Arm M drafting forces: a projection convention (vertical projection onto the support plane) and a margin semantics (boundary inclusive vs. exclusive with margin m). Both are FAs — a reasoner's answer on near-boundary tasks changes with them.
- Central choice (BP.4): vertical projection; inclusive boundary with margin m = ⟦value⟧.
- Propagation: L gains the sentence "The check uses the vertical projection of the center of mass onto the support plane; the position must lie inside the polygon boundary reduced by margin m." S gains fields `projection: "vertical"`, `boundary: "inclusive"`, `margin: m`. D gains a legend convention: dashed inner boundary denotes the margin-reduced polygon; a legend note states the projection convention.
- Arm D harvest finds IC: the drawn polygon appears convex and the drawn margin appears large relative to the polygon. Disposition: neutralize — schematic rendering, "not to scale" legend flag; convexity is checked against the AC set — if convexity matters to any task's ground truth, it is promoted to an AC and propagated; otherwise the drawing is revised to avoid implying it.
- EP items logged, not propagated: M's symbol choice π_xy; S's key names; D's line weights; L's sentence order.

## BP.9 Roles and separation

Distinct, declared before Step 1: content team (AC decomposition; BP.4 choices); one authoring team per substrate; harvest/classification auditors; certification auditors; adjudication panel for contested FA/EP/IC rulings. Auditors and adjudicators hold no authoring role. Task authors (§11) hold no BP role — the task corpus is committed **before** Step 2, so that FA classification (whose boundary test references the task taxonomy) cannot be gamed by writing tasks after seeing which assumptions propagated. This sequencing is load-bearing and must appear in the commitment inventory.

## BP.10 Commitments

Hash-committed, in order: canonical AC set (pre-propagation) → task corpus → draft-round FA declarations → classification rulings and rationales → final AC set with provenance → post-propagation arm materials → content map → EP log and IC dispositions → certification record. Amendments after first confirmatory generation: none; any later-discovered content asymmetry is handled under DP.7-F1, not by revising materials.

---

# NORMATIVE AMENDMENTS (merge when assembling)

## Amendment 1 — New definition in BP.2

> **Transformation.** A re-expression of an AC into a substrate's native form that introduces no commitment absent from the canonical AC set — i.e., a translation that is content-lossless under the boundary test. Transformations are the intended, unavoidable act of arm authoring and are never logged as FAs. The operational discriminator: apply the BP.2 boundary test to everything the re-expression added; if every added element fails the test (could not change any task answer), the re-expression is a transformation; if any element passes, that element is an FA and the re-expression is a transformation *plus* an FA, logged accordingly. Auditors classify the *elements*, not the re-expression as a whole — a single translation may contain both.

*(This also tightens the FA/EP boundary: EP describes retained stylistic properties of a substrate; transformation describes the act of lossless re-encoding; FA describes introduced content. Three categories, no gaps.)*

## Amendment 2 — Replace BP.3 Step 6 with closure computation

> **Step 6 — Canonical assumption closure.**
> Propagation may itself force new assumptions: expressing a coordinate-frame commitment diagrammatically may require a new visual convention that carries its own implications. The procedure therefore computes a **canonical assumption closure** before any freeze:
>
> 1. **Iterate:** Steps 3–5 repeat on draft materials. Each round, newly forced FAs (including those forced *by propagation itself*) are harvested, classified, centrally resolved (BP.4), and added to the working AC set. During closure computation, recursion is permitted and expected: an FA forced by projecting into Arm D propagates into L, M, S, and H like any other.
> 2. **Terminate:** iteration ends at the earlier of (a) a fixed point — a round harvesting zero new FAs — or (b) round ⟦3⟧.
> 3. **Freeze:** the working AC set at termination becomes the **frozen canonical closure**, hash-committed with full provenance (which substrate forced each FA, in which round).
> 4. **Final projection:** final arm materials are authored against the frozen closure. This is a one-time projection; no further propagation is permitted.
> 5. **Post-freeze residue rule:** any FA discovered *after* freeze — during final projection, certification, back-translation, or the experimental run — is **never** propagated. It is routed to BP.5 disposition: AC exclusion or contrast scoping, with the discovery logged. If discovered after confirmatory generation begins, it is handled under DP.7-F1 as a potential content-inequivalence finding, not by revising materials.
>
> Termination at the round bound rather than a fixed point is recorded in the certification record, and every FA still emerging in the final round is treated as non-propagatable under BP.5. The round bound exists to prevent arm homogenization: unbounded iteration converges the arms toward a common hybrid, destroying the experimental manipulation. The homogenization check in BP.7 is the counterweight to closure and must be evaluated *against the frozen-closure materials*, not the drafts.

## Amendment 3 — New BP.8b, worked recursion example

> **BP.8b — Recursive propagation example.**
> Round 1: Arm M forces FA-1 (vertical projection convention) from the center-of-mass AC. FA-1 is centrally resolved and propagated. Projecting FA-1 into Arm D requires a new legend convention: an arrow glyph denoting projection direction.
> Round 2 harvest: auditors apply the boundary test to the arrow glyph. The glyph *element* is EP (notation style). But the glyph's placement implies the projection is taken from the assembly's geometric center rather than its mass center — an implication that could change answers on asymmetric-mass tasks. That implication is FA-2. FA-2 is centrally resolved (mass center, not geometric center) and propagated to all arms: L gains a clarifying sentence; M gains an explicit definition; S gains a field; D's legend is corrected.
> Round 3 harvest: zero new FAs. Fixed point reached; closure frozen at two propagated FAs.
> Counterfactual: had FA-2 emerged only during final projection (post-freeze), it would not have been propagated; instead, all asymmetric-mass tasks would be excluded from confirmatory scoring under BP.5, or the affected contrasts scoped, with the discovery logged.

## Amendment 4 — New BP.11, interfaces clause

> **BP.11 — Interfaces with other protocol sections.**
> 1. **Content map (Step 7):** built against the frozen closure; every propagated FA appears as a flagged AC row with provenance.
> 2. **Back-translation (§9.2):** runs only on frozen-closure materials. Reconstruction is scored against the *closed* AC set, including propagated FAs — a substrate from which reviewers cannot recover a propagated FA fails equivalence on that atom, exactly as for an original AC.
> 3. **Extraction gate (Section T):** the Tier 1 battery samples propagated FAs as well as original ACs. Propagated-FA extraction accuracy is reported as a distinguishable subscore, since propagated content is the newest and most artificial material in each arm and plausibly the hardest to recover.
> 4. **Decision procedure (Section DP):** BP certification is DP.2 Stage 0 item 1; failure removes the arm from Tier 2 and routes it to Tier 1 reporting. Post-freeze residue discovered after confirmatory generation routes to DP.7-F1. BP.5 contrast-scoping declarations bind DP.5: a contrast declared content-limited in a regime is barred from confirmation in that regime.
> 5. **Materiality threshold (DP.1):** the pilot estimate of ⟦δ_mat⟧ must be taken from *post-closure* pilot materials. Pre-closure pilot effects overstate the encoding effect by including content asymmetries the closure removes; calibrating δ_mat on them would set an unreachable bar.

---

## Reviewer drafting notes (retain in Internal Research Record, not in the standard)

1. **The boundary test (BP.2) is the procedure's single point of failure.** It is a judgment rule, and judgment rules drift. The mitigations are the committed rationale log, the adjudication panel, and — worth adding if capacity allows — a small double-classification reliability sample: two auditor pairs independently classify ⟦20%⟧ of harvested items, and inter-auditor agreement is reported alongside the certification. If agreement is poor, the certificate is weak and reviewers should know it.

2. **Task-corpus-before-arm-authoring (BP.9) tightens §11's sequencing.** v0.2 required the corpus committed "before representation-specific materials are authored"; BP now *depends* on that ordering for the boundary test's integrity. If any pilot work has already authored arm materials, those materials must be discarded for confirmatory use, not retrofitted.

3. **Expect BP to make effects smaller.** Back-propagation deliberately removes the content advantage formalization used to smuggle in; what remains is the pure encoding effect, which will be more modest than the informal literature suggests. That is the point — but ⟦δ_mat⟧ in DP.1 should be set with this in mind during the pilot, or the programme will build an experiment whose honest effect size sits below its own materiality threshold.

4. **On "publishable methodology":** the closure procedure is the most exportable artifact P3 has produced — but claims discipline applies to methods too: it should be written up as a companion methods contribution *after* it has survived contact with the actual corpus — a procedure that has never been executed is a proposal, not a method. The first execution (the S-vs-L pre-pilot is the natural venue) doubles as its validation, including the inter-auditor reliability sample.
