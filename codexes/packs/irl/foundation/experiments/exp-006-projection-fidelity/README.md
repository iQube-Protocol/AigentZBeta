# EXP-006 → EXP-006A — Intent → Invariant Projection Fidelity

**Family:** Invariant Intelligence Validation Series (IIVS · CRP-002) · **Status:** EXP-006 frozen as the last lexical-fidelity record; **EXP-006A** is the live successor · **Date:** 2026-07-20

> **If you are running EXP-006:** run it, publish the result, and then **follow on to EXP-006A**. EXP-006's exact-set metric has done its job — it exposed that the number it produces is a *lower bound distorted by abstraction mismatch*, not a measure of whether the engine chose the right invariants. §7 is the hand-off. Do not treat the EXP-006 F1 as the projection-fidelity score.

---

## 1. What EXP-006 asked

The question (Austin's, sharpened): **can an invariant projection engine identify the relevant invariant set for an intent, independently of a human-authored reference?** This moves the research from *outcome* evaluation ("does the system behave better?") to *mechanism* evaluation ("did the engine select the right constitutional substrate before reasoning began?").

It is the first experiment to isolate the **Invariant Projection Engine (IPE)** and, behind it, the **Invariant Resolution Engine (IRE)** — the machinery that turns an intent into its governing invariants.

## 2. Method (Stage A)

For each intent in an independently-generated reference set (CIRS-v0.1):
1. **Generate** the reference blind — the CIRS is produced by a generative role (`cirsGenerator.generateCandidateCIRS`) routed through a *different* reasoning stage/provider than the predictor, so the deltas are real cross-model disagreements, not self-agreement (independence protocol, Aletheon 2026-07-09).
2. **Predict** the projection — `predictInvariantsForIntent` routes through the sovereign, invariant-aware router (`callSovereign`).
3. **Score** — `projectionFidelity` computes overlap / precision / recall / F1 on normalised labels.
4. **Classify the deltas** — every disagreement is an **Invariant Delta** (first-class WP0 data): the *hidden* objective is understanding *why* the sets differ, not just the score.

Scoring + delta classification are **pure and deterministic** (drillable without a provider); only the prediction step calls inference. Code: `services/experiments/irlExp001.ts`, route `/api/experiments/irl-exp001`, runner `Exp006ProjectionRunner`.

## 3. What we found (three runs, 2026-07-20)

| Signal | Run 1 | Run 3 (published) |
|---|---|---|
| Sovereign F1 (exact) | 0.284 | **0.408** |
| Random baseline F1 | 0.151 | 0.153 |
| Keyword baseline F1 | 0.154 | 0.182 |
| Semantic baseline F1 | 0.431 | 0.415 |

Three instrument additions made the result *interpretable* rather than a bare number:
- **Comparator arms** (`exp006Baselines.ts`) answered "0.41 vs what?" — the sovereign router clears random and keyword decisively, but **not the semantic baseline**.
- **Graded scorer** (`gradedProjectionScore.ts`) reports exact + normalized (morphology/separator-folded) tiers. By run 3, **`normalized === exact`** on every intent — meaning the residual gap is no longer lexical (morphology was already recovered); it is *semantic / abstraction*.
- The **31 missing / 18 redundant** deltas concentrate on a specific structure (§4).

## 4. The key discovery — abstraction mismatch, not projection failure

Two interpretive facts overturn the headline:

**(a) "Semantic beats sovereign" is an artifact.** The semantic arm embeds and retrieves from the *field vocabulary = the union of the reference labels*. It is peeking at the answer key. The sovereign router projects independently and at a **higher level of abstraction**. These are different tasks; the comparison flatters semantic retrieval.

**(b) The sovereign router projects one abstraction layer up.** The clearest case — *"Design an authenticated delegation API"*:

```
Sovereign predicts:   authentication · delegation · authorization · security
CIRS reference:       secure-access · token-validation · scope-limitation ·
                      audit-logging · user-consent · data-protection
Exact F1:             0.0
```

This scores zero, yet `authentication / delegation / security` **subsume** `token-validation / scope-limitation / secure-access`. The router chose *architectural principles*; the reference listed *implementation constraints*. Both are correct — they live at different levels. The same pattern recurs (`system-analysis` ⊇ `analysis`; diagnosis → structural vs procedural concepts).

**Conclusion:** invariant selection cannot be evaluated as a flat set-overlap problem. The right question is: *did the engine select the correct invariant family, at the correct abstraction level, with a minimal sufficient set?* That is **projection depth**, a first-class research variable — and it is why EXP-006 is **frozen** here: it has proven the limits of exact-set comparison.

## 5. Why EXP-006A is what it is

EXP-006A (`services/experiments/topologyProjectionScore.ts`) evaluates **invariant topology, not invariant names.** Each disagreement is reclassified into four causal classes:

- **vocabulary** — folds under canonical normalization (from the graded scorer)
- **abstraction** — predicted subsumes/generalizes a reference item (same family, different level)
- **omission** — reference item with no predicted relation (a genuine gap — e.g. *patience* for explaining to a child)
- **redundant** — predicted item with no reference relation

**The subsumption oracle is graph-first.** "Does predicted subsume reference?" is answered by the invariant graph's `specializes` / `generalizes` edges (built by the Discovery Engine's parent-linking, §6) — *ground truth*. Where a label doesn't resolve to a registry node, it falls back to embedding cosine as a *proxy*; the two are reported separately (`graphConfirmedAbstractions` vs `embeddingAbstractions`) and never conflated. **Projection Fidelity** becomes a composite (`0.35·structural + 0.45·causalCoverage + 0.2·minimality`), so a low lexical F1 can coexist with high causal agreement.

## 6. The engines' roles — and the duality this exposed

EXP-006/006A is where three engines meet, and running it clarified how they relate:

- **Invariant Resolution Engine (IRE)** — `resolveConstitutionalField`, PRD-IRE-001. Projects an intent **down** to a minimal invariant set. EXP-006 is, in effect, the fidelity harness for the IRE/IPE projection step.
- **Invariant Projection Engine (IPE)** — the projection under test; EXP-006 predicts it, EXP-006A measures whether it landed at the right level.
- **Discovery Engine (CFS-048)** — builds the invariant library **and** the `specializes` topology (via Compare's earned domain invariants + operator-confirmed parent-linking). That topology is exactly the ground truth EXP-006A's subsumption oracle reads.

The duality (Aletheon): **the IRE projects *down* the graph (intent → minimal set); Compare compresses *up* the graph (many sets → minimal common invariant); EXP-006A scores *against* the graph (did the projection land at the right level?).** They are inverse operations over one invariant graph. EXP-006 plateaued precisely because the Discovery Engine had *outgrown* a name-matching metric: the same afternoon, the Discovery Engine proved that "transparent reporting", "market transparency" and "cross-border transparency" are different manifestations of one higher-order invariant — while EXP-006 was still scoring analogous cases as binary mismatches. EXP-006A closes that gap.

This also connects to **K\*** (IRL-011 §6.3): EXP-006 estimates how close the projection engine gets to an independently-constructed substrate; EXP-006A moves that toward the real object — the *minimum sufficient set at the right abstraction*.

## 7. Hand-off — run EXP-006, then follow on to EXP-006A

1. **Run EXP-006** (`Run Stage A`). Publish the result canonically — it is a legitimate, frozen **lexical-fidelity baseline**. When you report it, frame it as *lexical agreement with a known abstraction ceiling*, **not** "the engine scores 0.4X". Include the delta counts and the delegation-API case — those are the finding.
2. **Do NOT stop at the F1.** The exact-set number is a lower bound distorted by abstraction/vocabulary mismatch. The graded scorer's exact-vs-normalized split shows how much is lexical; if `normalized === exact`, the remaining gap is semantic/topological — go to step 3.
3. **Run EXP-006A** (`Run with baselines + topology`). Read the **Projection Fidelity** composite and the four delta classes. Distinguish **graph-confirmed** abstractions (the engine projected a genuine parent of the reference) from **embedding-proxy** ones. Genuine **omissions** are the real improvement targets for the resolution algorithm; **abstraction** deltas are not failures.
4. **Grow the ground truth.** The more the invariant registry (and its `specializes` edges) covers the CIRS vocabulary, the more of EXP-006A's subsumption is graph-truth rather than proxy. The destination: express CIRS references *as registry invariants* (or resolve them through the IRE), at which point subsumption is pure graph-truth and the metric measures exactly "same family, right level, minimal sufficient set".

## 8. Honest limits & open questions

- **Current CIRS uses generic reasoning vocabulary** ("authentication", "negotiate") not yet in the registry, so most EXP-006A subsumption falls back to the embedding proxy today; graph-confirmed counts will be low until the registry grows into that vocabulary. The seam is built graph-first so no rework is needed as it does.
- **The reference is flat.** A fair reference should encode the hierarchy (`delegation` ⊃ consent/scope/revocation; `security` ⊃ secure-access/token-validation/audit-logging), letting the engine earn partial credit for a correct parent while still being penalised for insufficient resolution depth. This is the natural CIRS-v0.2.
- **Baselines still need a human arm.** Random / keyword / semantic anchor the floor; an experienced-human baseline is a separate annotation pass (not yet run).
- Efficacy of the sovereign projection over baselines remains a `proposed` claim until EXP-006A's causal metric is validated across more intents and a hierarchical reference.

## Files
- EXP-006 harness: `services/experiments/irlExp001.ts` · `cirs.ts` · `cirsGenerator.ts` · route `app/api/experiments/irl-exp001/route.ts` · runner `components/composer/Exp006ProjectionRunner.tsx`
- Instrument: `exp006Baselines.ts` · `gradedProjectionScore.ts`
- EXP-006A: `topologyProjectionScore.ts` (graph-first subsumption oracle)
- Ground-truth graph: `services/invariants/discoveryEngine.ts` (Compare + parent-linking `specializes` edges), `lifecycle.ts` (`addEdge`)
- Related: IRL-011 §6.3 (K\*) · PRD-IRE-001 · PRD-IPE-001 · CFS-048 (Discovery Engine) · `inv.reasoning.334–345`
