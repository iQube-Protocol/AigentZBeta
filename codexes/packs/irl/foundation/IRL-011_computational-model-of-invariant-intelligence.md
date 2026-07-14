# IRL-011 — The Computational Model of Invariant Intelligence

**The formal theory beneath the Constitutional Runtime.**

| | |
|---|---|
| **Status** | DRAFT v0.1 — formal model, implementation-anchored |
| **Date** | 2026-07-14 |
| **Companion to** | IRL-010 (the *system*); this document is the *theory* |
| **Audience** | Computer scientists and researchers evaluating, citing, or attempting to falsify the model |
| **Method** | Definitions are formalized from the actual implementation (IRL-010 is the witness) and labelled **[implemented]**, **[partial]**, or **[proposed formalism]** where the mathematics runs ahead of the code. Nothing here claims to be proven; §8 states what would falsify the model. |

> Division of the literature (three streams, as mature research organizations operate): **Research Series** (IRL-00x — *why* invariant intelligence), **Technical Specifications** (IRL-010 — *how* the runtime works), **Experimental Records** (the experiments/ tree — *evidence*). IRL-011 is the formal keystone of the second stream: the object a CS reader cites.

---

## 1. Formal definitions

### 1.1 The invariant

**Definition 1.1 (Invariant).** An invariant is a 6-tuple

```
I = (S, E, C, V, P, L)
```

where

- **S** — the *statement*. Today a natural-language proposition; the model treats S as a typed proposition `S : Prop` over a domain ontology (CFS-002). **[implemented as text; typed form proposed]**
- **E** — the *evidence ledger*: `E = (val, con, basis)` with `val, con ∈ ℕ` (validation and contradiction counts) and `basis ∈ {document_verified, principal_verified, agent_verified, unknown}`. **[implemented]** (`timesValidated`, `timesContradicted`, `confidenceBasis`).
- **C** — *confidence*, `C ∈ [0,1]`, seeded by `basis` via the ladder `w(document_verified)=1.0, w(principal_verified)=0.85, w(agent_verified)=0.6, w(unknown)=0.3`. **[implemented]**
- **V** — *version*, `V ∈ ℕ`, monotone. Revision is supersession, never mutation: an edited claim is a *new* `I′` with `V(I′)=V(I)+1` and a `supersedes` edge `I′ → I`. **[implemented]** (`version`, `supersedesId`).
- **P** — *provenance*: `ratifiedSource` + structured `provenance`/`reasoningProvenance` (who admitted the invariant, under which ratification, and the reasoning trace). **[implemented]**
- **L** — the *composition law*: `L = 𝓛(ν(I))`, the law of the invariant's namespace `ν(I)` (§3). **[implemented]** (`COMPOSITION_LAWS`).

**Definition 1.2 (Standing and reach — the two derived scalars).** Over the evidence ledger define two functionals, held strictly orthogonal (Law XII):

```
standing : I → [0,100]      from validation-class signals only (val, basis)
reach    : I → ℕ            from adoption signals (timesReferenced + timesUsed)
```

**Axiom 1.1 (Standing–reach orthogonality).** `reach` never enters `standing`. Popularity cannot manufacture epistemic weight. **[implemented]** — the store computes them from disjoint accumulators; `citeInvariants` bumps reach and *only* reach.

**Definition 1.3 (Lifecycle).** `status(I) ∈ {draft, proposed, validated, canonical, rejected, deprecated, superseded}`, a labelled transition system with disconfirmation as a first-class exit: accumulating `con` drives an invariant toward `rejected`/`deprecated`, never toward defence. **[implemented]**

### 1.2 Collection, crystal, iQube

**Definition 1.4 (Collection).** `K = {I₁, …, Iₙ}`, an ordered, curated set. **[implemented]** (`InvariantCollectionRecord`).

**Definition 1.5 (Crystal).** `𝒞 = { I : status(I) ∈ {validated, canonical} }`, the groundable substrate — the set an intent may curate from. **[implemented]** (`GROUNDING_STATUSES`).

**Definition 1.6 (iQube).** The composite reasoning object

```
iQube = (goal, K, P_K, standing_K)
      = Intent + CuratedInvariants + ConstitutionalProvenance + Standing
```

where `goal` is operator intent, `K ⊆ 𝒞` a curated collection, `P_K` the aggregate provenance, `standing_K` the aggregate standing. **This is the platform's epistemic unit** — a *curated reasoning substrate purpose-built around intent*, not a container of information. **[implemented as InvariantQube + grounding slice; the unifying `iQube` object is the formalization]**

**Definition 1.7 (Aggregate confidence — weakest link).** For a collection `K`,

```
C(K) = min { C(I) : I ∈ K }
```

Confidence is floored by the weakest member; composition can never raise it. **[implemented]** (`InvariantQubeManifest.aggregateConfidence`).

---

## 2. Computational primitives

Each primitive is a typed operator with pre/post-conditions. **[all signatures implemented; pre/post-conditions are the formalization of existing behavior]**

**2.1 Retrieve — intent-guided constitutional curation** (*not* document retrieval)

```
Retrieve : (goal, scope) → K ⊆ 𝒞
  pre :  scope = (namespaces, domains, limit)
  post:  K = topₙ( 𝒞 ∩ scope,  ≼ )   where n = limit
```

with the merit order `≼` of Definition 3.4. Retrieve is the formal core of the iQube proposition: it *curates* validated invariants for an intent, it does not fetch documents by relevance. **[implemented]** (`buildInvariantSlice`).

**2.2 Compose**

```
Compose : K → Artifact
  pre :  legal(K)              (Definition 3.2 — no composition law is weakened)
  post: C(Artifact) = C(K)     (weakest-link confidence carried through)
```

**[implemented]** (`validateComposition` / `composeArtifact`).

**2.3 Evaluate**

```
Evaluate : Artifact → Score
  post: Score = CCE(Artifact)   (the coherence calculus, §5)
```

**[implemented]** (`services/coherence`).

**2.4 Cite, Validate/Contradict, Supersede** (the ledger-moving operators)

```
Cite       : I → I    with reach(I) += 1                         (adoption; Law XII)
Validate   : I → I    with val(I) += 1                           (standing-class)
Contradict : I → I    with con(I) += 1                           (disconfirmation)
Supersede  : (I, I′) → I′  with version and a supersedes edge     (immutable revision)
```

**[implemented]** (`citeInvariants`, lifecycle, `supersedesId`).

---

## 3. Composition algebra

**Definition 3.1 (Composition law).** Each namespace `ν` carries a law `𝓛(ν) ∈ {normative, causal, contextual, global, …}` (CFS-013). The law constrains legal combination:

- **normative** (constitutional): a composition MUST NOT weaken a member — `Compose` preserves every normative member's force.
- **causal** (cybernetics): members compose along cause→effect edges.
- **contextual** (style): members apply within a shared context; conflicts resolve by scope.
- **global** (representation): members hold across all projections.

**[implemented for the 7 ratified namespaces; 5 provisional]** — sovereignty, cybernetics, interaction, epistemology, representation carry provisional laws pending ratification (CFS-013 §3). The provisional status gates *composition*, not *discovery* (§7.3).

**Definition 3.2 (Legality).** `legal(K) ⟺ ⋀_{I∈K} respects(K, 𝓛(ν(I)))`. `Compose(K)` is defined only when `legal(K)`; otherwise it is rejected (a constitutional error, surfaced — not silently coerced).

**Proposition 3.3 (Weakest-link is a lower bound under composition).** For any legal `K` and any `K′ ⊇ K`, `C(K′) ≤ C(K)`. *Adding invariants can only lower or hold aggregate confidence.* Corollary: **breadth is not free** — accumulation cannot raise confidence and may lower it. (This is the algebraic shadow of the EXP-003 breadth result; see §6.) **[proposed formalism; consistent with implemented min-rule]**

**Definition 3.4 (Merit order).** The retrieval order `≼` ranks by

```
I ≼ J  ⟺  ( standing(I), C(I), reach(I) )  ≥_lex  ( standing(J), C(J), reach(J) )
```

standing first, then confidence, then reach — lexicographic. **[implemented]** (`rankByStanding`).

**Remark 3.5 (Algebraic properties — open).** Commutativity/associativity of `Compose` hold for order-independent namespaces (global, contextual with disjoint scopes) and fail where sequence is constitutional (narrative, causal — cf. Law XV: temporal correctness is a distinct property). A full characterization is open work.

---

## 4. Runtime semantics — how an invariant becomes reasoning

This is the model's centrepiece: the step-by-step computational transformation from intent to consequence. Small-step operational semantics (`⇒`), not code. **[the pipeline is implemented; the semantics is its formalization]**

State: `σ = (goal, K, A, r, 𝒞)` — intent, curated collection, artifact, receipt, crystal.

```
(Curate)      (goal, ∅, ⊥, ⊥, 𝒞)  ⇒  (goal, Retrieve(goal, scope), ⊥, ⊥, 𝒞)
(Ground)      the model's working context is initialized with K            (initializeKnowledge)
(Compose)     (goal, K, ⊥, …)      ⇒  (goal, K, Compose(K), ⊥, 𝒞)          requires legal(K)
(Evaluate)    A ↦ Score = CCE(A)                                            forks on Score (§5)
(Receipt)     A, Score            ⇒  r = receipt(A)                          append-only, anchorable
(Account)     r                   ⇒  ∀ I∈K: Cite(I);  standing updates       reach += ; standing ← evidence
(Return)      the accounted crystal 𝒞′ feeds the next Curate                 the loop closes
```

**Definition 4.1 (The curation flywheel).** The fixpoint the loop iterates toward:

```
Intent → Curate → Ground → Compose → Evaluate → Receipt → Account(standing, reach) → Better Curate → …
```

The substrate is not static: each pass updates `standing`/`reach`, which changes `≼`, which changes what the next intent curates. **The crystal improves not because it grows, but because experience reorganizes it** (`inv.epistemology.132`). **[Account step implemented; the fixpoint dynamics are the object of EXP-003 Run 002]**

---

## 5. Coherence calculus

**Definition 5.1 (Coherence).** For an artifact `A` composed from `K`, the Constitutional Coherence Engine returns

```
CCE(A) = Σ_d  w_d · score_d(A)      d ∈ {identity, continuity, style, narrative, constitutional}
```

with per-dimension `score_d ∈ [0,1]`, weights `w_d` (`CoherenceWeights`), and a violation set `Viol_d(A)`. **[implemented]** (`services/coherence`).

**Definition 5.2 (Grounded share and contradiction count — the experiment observables).** For a judged artifact with claim set `Γ`,

```
grounded(A) = |{γ ∈ Γ : γ consistent-with some I ∈ K}| / |Γ|
contra(A)   = |{γ ∈ Γ : γ contradicts some I ∈ K}|
```

These are the EXP-001/003 measures. **Conjecture 5.3:** `CCE(A)` and `grounded(A)` are monotonically related for constitutional artifacts; `contra(A) = 0` is necessary (not sufficient) for `constitutional`-tier promotion. **[proposed; testable against the judge protocol]**

---

## 6. Complexity and reasoning economics

**Definition 6.1 (Reasoning economy).** Let `E` be reasoning economy (inverse output-token cost at fixed fidelity). The model asserts

```
E = f(G, B, M)          G = grounding quality   B = collection breadth   M = merit weighting (standing)
```

**not** `E = f(B)`. **[ratified model; EXP-003 Run 001 isolates the three variables]**

**Empirical status (EXP-003 Run 001, 2026-07-14, openai/gpt-4o-mini, n=1):**
- **G:** grounding raised grounded-share 65.8%→96.2% and cut tokens ~12.6% (replicated across two same-day runs). `∂E/∂G > 0` — supported.
- **B alone:** the 24-invariant *accumulated* slice used +14.7% more tokens than the 18-invariant *curated* collection for a saturated grounded-share gain. `∂E/∂B ≈ 0 or < 0` at fixed M — **breadth alone does not buy economy.**
- **M:** untested — the broad slice had all `standing ≈ 0`, so `≼` degenerated to confidence order. M is the lever EXP-003 Run 002 tests.

**Principle 6.2 (Curation dominates accumulation).** For these tasks, a curated `K` outperformed a larger accumulated `K′ ⊃ᵣ K` (accumulated = relevance-blind). Formally consistent with Prop 3.3 (breadth cannot raise confidence) and the token cost of a longer grounding prompt.

**Definition 6.3 (Minimum sufficient constitutional substrate).** For a task class `T` and fidelity target `φ`,

```
K*(T, φ) = argmin_{K ⊆ 𝒞}  cost(K)   subject to   fidelity(Compose(K)) ≥ φ
```

The central optimization of the discipline: *the smallest curated set of validated invariants that solves `T` at fidelity `φ` and minimum reasoning cost.* Curation is thereby a **first-class computational primitive**, not editorial activity. **[proposed; K* existence/uniqueness and whether `standing`-weighted retrieval approximates it is the research programme]**

**Complexity notes.** `Retrieve` is `O(|𝒞 ∩ scope| · log)` (rank + top-n); `Compose` legality is `O(|K|)` per law; the binding cost is prompt length in `Ground` (linear in `|K|` tokens) — which is exactly why accumulation has a cost and `K*` matters.

---

## 7. Relationship to statistical inference

**7.1 vs RAG.** RAG maximizes *relevance* of retrieved *documents*; `Retrieve` maximizes *merit* (standing→confidence→reach) of *validated invariants*. RAG asks "what documents are relevant?"; the iQube asks "what validated invariants should this reasoning begin from?" The unit differs (document vs invariant), the objective differs (relevance vs constitutional merit), and the substrate is governed (lifecycle, supersession, disconfirmation) rather than indexed.

**7.2 vs in-context learning / constrained decoding.** Grounding is ICL over a *curated, provenance-bearing* set with a *composition algebra*; the coherence calculus + contradiction count act as a soft constitutional constraint on the output distribution — closer to constrained decoding by an external validity model than to unconstrained ICL. Standing functions as an **information-theoretic weighting** on the prior over which knowledge enters context — the reframing that makes `M` a real variable in §6.

**7.3 Discovery vs composition gate.** A validated-but-provisional-law invariant is *discoverable* (may be curated by `Retrieve`) yet not freely *composable* (its `𝓛` is provisional). The two gates are independent — the model separates the epistemic act of grounding from the legal act of composition.

---

## 8. Falsification of the model

The model (not just the papers) is falsifiable. It is weakened or rejected if:

- **F1 (economy).** Across controlled multi-run experiments, `E` shows no dependence on `G` or `M` beyond `B` — i.e. `E = f(B)` fits as well as `E = f(G,B,M)`. Then the multivariate model is unwarranted.
- **F2 (curation).** A relevance-blind accumulated `K′ ⊃ K` consistently matches or beats the curated `K` at equal fidelity. Then "curation dominates accumulation" (`inv.epistemology.132`) fails and should be demoted.
- **F3 (merit).** A `standing`-weighted retrieval does not outperform a `confidence`-weighted (or random) retrieval once standing has accrued (EXP-003 Run 002). Then standing is not an information-theoretic weight and Def 3.4's lead term is cosmetic.
- **F4 (orthogonality).** If any measured improvement in reasoning requires `reach` to enter `standing`, Axiom 1.1 fails.
- **F5 (weakest-link).** If aggregate confidence is observed to *rise* under composition, Prop 3.3 and Def 1.7 are wrong.

Each maps to a runnable experiment; F2/F3 are EXP-003's Run 001/Run 002 line directly.

---

## 9. Ratified principles carried by this model

- **IRL Principle 004** (`inv.epistemology.131`, canonical): *experimental instruments must faithfully report observed outcomes regardless of whether those outcomes support the hypothesis.* The model's own falsification section (§8) and the sign-aware instruments (§6's evidence) are bound by it.
- **Emerging law** (`inv.epistemology.132`, governing principle, empirical confirmation pending EXP-003 Run 002): *knowledge quality scales through organization before accumulation.*
- **Law XII** (standing/reach orthogonality) — Axiom 1.1.
- **Law XIII** (personhood continuity; the constitutional chain `Personhood → Individualization → Standing → Authority → Consequence`, identity an off-chain projection) — the identity model these definitions assume (IRL-010 §2.11).

---

## 10. Honest limits (v0.1)

- The typed-proposition form of `S`, the algebraic characterization of `Compose` (§3.5), Conjecture 5.3, and the existence/approximability of `K*` (§6.3) are **proposed formalism** — the mathematics runs ahead of both the code and the evidence, and is labelled so throughout.
- All empirical anchors are single-run, internally adjudicated (the base EXP-003 limitations); §8's F-conditions are the outstanding controls.
- This is v0.1: a model to be attacked, not a settled theory. Revisions supersede; they do not silently rewrite (the discipline the model itself describes).

*Companion: IRL-010 (system spec), IRL-010A (claims traceability). Experimental substrate: `experiments/exp-003-rediscovery-savings/breadth-arm.md`.*
