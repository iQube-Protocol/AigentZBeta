# IRL-011 — The Computational Model of Invariant Intelligence

**STATUS: OUTLINE / COMMISSIONING NOTE (not yet authored).** This is the scaffold for the formal-theory companion to IRL-010, opened as a follow-on to the first external technical diligence (2026-07-14). IRL-010 specifies the **system** (what runs); IRL-011 will specify the **theory** (the computational model beneath it). This file records the agreed structure and the formal seeds already in hand, so the eventual document is authored from a substrate rather than a blank page. It makes **no claim to be complete** — every section below is a commission, not a result.

> Division of labour (Alethean, 2026-07-14): *"IRL-010 is the system. IRL-011 becomes the theory. That's the document computer scientists will cite."* The scientific "why" lives in the IRL-00x research series; the engineering "how" in IRL-010; the formal "what it is, precisely" here.

## Why this document (the gap it closes)

Austin Ambrozi's first question was **"What exactly is an invariant?"** — a definitional/mathematical question, not "what services exist?" IRL-010 §2.1 now gives the compact answer (the tuple `I = (S,E,C,V,P,L)` + operator signatures) and stops there by design. IRL-011 is where that compact algebra is developed into a theory a computer scientist can evaluate, cite, and attack.

## Commissioned structure (Alethean's seven parts)

1. **Formal definitions.** Invariant as `I = (S, E, C, V, P, L)`; typed statements (S from natural language → typed proposition); the confidence ladder; standing vs reach as orthogonal scalars (Law XII); the Collection `K = {I₁…Iₙ}`; the InvariantQube; and the composite **iQube = Intent + CuratedInvariants + ConstitutionalProvenance + Standing**.
2. **Computational primitives.** `Retrieve` (intent-guided constitutional *curation*, not document retrieval), `Compose`, `Evaluate`, `Cite` (reach), `Validate`/`Contradict` (standing), `Supersede` (versioning). Each as a typed operator with pre/post-conditions.
3. **Composition algebra.** The laws `L` per namespace (normative / causal / contextual / global…); identities and closure properties; the weakest-link confidence rule; when `Compose(K)` is legal vs rejected (a composition may not weaken a normative member); associativity/commutativity where they hold and where they don't.
4. **Runtime semantics.** The step-by-step **computational transformation "how an invariant becomes reasoning"** — the missing centrepiece: intent → curated slice → grounded prompt → generated artifact → coherence-scored → receipted → standing/reach updated → next curation. Small-step semantics, not code, not architecture.
5. **Coherence calculus.** The Constitutional Coherence Engine formalized: dimensions, per-dimension scores, weighted aggregation, violation detection; the relationship between coherence score and grounded-share/contradiction measures used in EXP-001/003.
6. **Complexity considerations.** Retrieval/ranking cost; composition cost; the reasoning-economy function (below); bounds on slice size; the minimum-sufficient-substrate optimization.
7. **Relationship to statistical inference.** How invariant grounding relates to (and differs from) RAG, in-context learning, and constrained decoding; where standing-weighted retrieval sits relative to relevance-ranked retrieval; the constitutional-curation-vs-information-retrieval distinction made precise.

## Formal seeds already in hand (carry into the draft verbatim)

- **The invariant tuple + operator signatures** — IRL-010 §2.1 (authored 2026-07-14).
- **The iQube composite** — `iQube = Intent + CuratedInvariants + ConstitutionalProvenance + Standing` (IRL-010 §2.4). The commercial + scientific thesis in one object: *RAG retrieves information; iQubes curate intelligence.*
- **The constitutional chain (Law XIII, refined)** — `Personhood → Individualization → Standing → Authority → Consequence`, with **Identity an off-chain projection** off Individualization (yields reputation, not standing). Explains why anonymity and accountability coexist. Canon: `inv.constitutional.011/012/013/063/066/130` (IRL-010 §2.11).
- **Reasoning economy as a multivariate function** — `E = f(G, B, M)` (grounding quality, collection breadth, merit/standing weighting) — **not** `E = f(B)`. From EXP-003 Run 001 (2026-07-14), which isolated the three: G replicates, B alone does not, M is the untested lever.
- **Curation dominates accumulation** — the generalized EXP-003 finding; the minimum-sufficient-substrate research question: *what is the smallest curated set of validated invariants that solves a class of problems at maximum fidelity and minimum reasoning cost?*
- **Standing as an information-theoretic weighting function** — the reframing of standing from "reputation" to a retrieval weight; the basis for the standing-weighted vs confidence-weighted retrieval A/B (EXP-003 Run 002).

## Candidate canonical additions this document will propose (for operator ratification — NOT self-adopted)

- **IRL Principle 004 (proposed):** *Experimental instruments must faithfully report observed outcomes regardless of whether those outcomes support the hypothesis.* (Elevated from the instrument-honesty fix that caught the hardcoded-optimistic breadth summary; Alethean: *"an experiment harness that can only report success isn't an experiment."* Candidate constitutional invariant, epistemology or engineering namespace.)
- **Emerging law (proposed, unproven):** *Knowledge quality scales through organization before it scales through accumulation* — the substrate improves not because it grows but because experience reorganizes it. To be tested by EXP-003 Run 002; ratify only if the earned-crystal result supports it.
- **EXP-003 reframed as "Reasoning Economics"** (from "Computational Efficiency") — it now measures cost + grounding + contradictions + retrieval strategy + merit weighting + token economy. A naming/charter amendment for operator approval.

## Bundled follow-on programme (Alethean's six-month priority sequence)

1. **IRL-011 itself** — the formal theory (this document).
2. **Foundational Validation Series replication** — additional models, independent evaluators, the missing control arms (EXP-001 ungrounded arm; EXP-004 scaffold-only arm; EXP-003 multi-run variance + the standing-vs-confidence retrieval A/B).
3. **Law XIII canonical registration** — DONE 2026-07-14 (`inv.constitutional.063–067` + `130` canonized); the loop between constitutional law, implementation, and experiment is closed.
4. **Small external technical review group** (3–5 engineers/researchers under NDA) to attempt falsification before broader publication.

## Publication-stream note

This document confirms the institute's natural division into three literatures (as serious research orgs operate): **Research Series** (why — IRL-00x), **Technical Specifications** (how — IRL-010), **Experimental Records** (evidence — the experiments/ tree). IRL-011 is the formal keystone of the second stream and the most-citable artifact for a CS audience.

---

*Authoring trigger: operator direction 2026-07-14 ("address IRL-010 for now and add IRL-011 as a follow-on"). This outline is the follow-on's opening move; the full draft is scheduled work, not a completed claim.*
