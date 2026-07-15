# EXP-010 — The Representation Gauntlet

**Charter · status: DESIGN (jointly co-designed with an external reviewer; the Phase 1 protocol document is to be drafted by the external party for joint sign-off before anything runs — nothing in this charter has been executed).**
Chartered 2026-07-16 from a three-way exchange: the operator, the external reviewer's agent, and Aletheon. Companion to: CRP-002 (whose EXP-006/007/008 this extends, not duplicates), EXP-003 (whose grounding + breadth results are the prior evidence), EXP-009 (Constitutional Knowledge Evolution — this gauntlet's Phase 2 hands off to EXP-9A/9B), IRL-010A (the traceability discipline this charter's language rules extend), IRL-011 (the formal model whose claims the arms operationalize).

> Numbering note: EXP-009 was assigned to Constitutional Knowledge Evolution the same day this charter was written (resolving that series' collision with CRP-002's EXP-006 — see EXP-009's designation history). EXP-010 was the next free slot, verified against the registry, the corpus, and code.

## 0. What this experiment is FOR — the two-claim decomposition (external reviewer, adopted)

The external reviewer's central correction, adopted in full: the programme's thesis decomposes into two separable claims, and only one of them is distinctively ours.

- **Claim A (content):** compressed, validated knowledge injected at inference time improves reasoning economy. Likely true, **not novel** — EXP-003's grounding delta (−12.6% tokens, grounded share 65.8%→96.2%, contradictions 3→0, replicated) already shows it, and the reviewer is right that context engineering broadly predicts it.
- **Claim B (substrate/representation):** the constitutional machinery and/or the invariant REPRESENTATION around that content adds measurable value beyond the content itself. **This is the only claim that is distinctively the institute's**, and no experiment run to date isolates it.

**The misread this charter corrects for the record (operator's exchange, 2026-07-16):** the reviewer's "Arm C" was never *human-curated vs LLM-curated invariants* — origin was never the variable (and the operator is right that origin is immaterial to the thesis; that is now IRL Principle 005, `inv.epistemology.133`). Arm C is: the SAME invariant statements, stripped of all machinery, pasted as plain text at the same token budget. Same knowledge, no constitution.

## 1. Aletheon's refinement — representation is the independent variable

Aletheon's contribution sharpens the reviewer's design rather than opposing it: the reviewer's B-vs-C implicitly assumes **an invariant = a sentence**. The institute's theory has never said that — an invariant is a computational object (typed, versioned, composable, referenceable, receipted, incrementally mutable). Serializing the object into text and calling it "the same knowledge" is the analogue of comparing a hydrogen atom with the word "Hydrogen." So the flattening control SPLITS:

> "If those representations remain equivalent, we'll have learned that much of the value lies in the content. If they diverge, then representation itself becomes part of the hypothesis. Either outcome materially advances the research." — Aletheon, 2026-07-16

**The reframed central question** (Aletheon, adopted as this experiment's headline): not *"does the runtime outperform a prompt?"* but **"what computational operations become possible once knowledge is represented as invariant objects rather than transient context?"** — representation is the independent variable, not an implementation detail. This is also the moment the institute's posture shifts from *proving that invariants work* to *discovering why they work*.

## 2. The arms

| Arm | Name | What it holds constant / removes | Isolates |
|---|---|---|---|
| **A** | Cold | No knowledge injection at all (the EXP-003 cold-arm precedent) | The baseline |
| **B** | Invariant Runtime | The full pipeline: object graph, typing, standing, composition laws, receipts | The complete system |
| **C** | Flattened invariant text | The SAME invariant statements, decomposition PRESERVED (one statement per unit), machinery removed, equal token budget | Content + decomposition, no runtime semantics |
| **D** | Expert-curated conventional prompt | The same knowledge rewritten as excellent conventional prompting, same token budget, NO invariant decomposition | Content alone, conventionally represented |
| **M** | Mutation probe | Supersede ONE invariant with a corrected version in B; hand-edit the same fact in C's plain text | **Locality** — see §3 |

Arms C and D are deliberately not the same thing (Aletheon's split): C preserves invariant decomposition without runtime semantics; D is simply excellent prompting. B-vs-C isolates *runtime semantics*; C-vs-D isolates *decomposition itself*; B-vs-D is the reviewer's original Claim B test, now decomposable when it succeeds or fails.

**Interpretation contract, pre-committed** (the honest-branches discipline, per EXP-003's breadth-arm precedent):
- **B ≈ C ≈ D** → the value is the content. The near-term proposition is knowledge curation — commercially real, differently priced (the reviewer's soft landing, adopted verbatim so a null has no incentive to be fought).
- **B ≈ C > D** → decomposition matters, runtime semantics don't (yet) — the representation hypothesis survives in weakened form; the machinery must find its value in the dynamical claims (EXP-009), not the static ones.
- **B > C** → the machinery earns its cost at inference time — the first direct evidence for Claim B "no reviewer can wave away."
- Every branch is publishable. A null is a finding (IRL Principle 004).

## 3. The mutation probe — locality, not propagation

Adopted from the reviewer with Aletheon's strengthening. Propagation itself is TRUE BY CONSTRUCTION (the graph has edges — observing it is QA, not science). The empirical questions are:

1. **Correctness:** after superseding one invariant, do stale conclusions actually get eliminated from downstream reasoning — faster and more reliably than a human hand-editing the equivalent fact in Arm C's plain text?
2. **Collateral:** does anything break that shouldn't?
3. **Cost:** what did each approach cost (tokens, time, human attention)?
4. **Locality** (Aletheon's deeper framing): *can one invariant change without reconstructing the rest?* — this is where objecthood begins to matter; prompts do not natively support it.

## 4. The by-construction guard — a methodological standard, recorded for all future property tests

Adopted from the reviewer, who correctly named it as IRL Principle 004 applied to experiment design:

> **A property test counts as evidence only if the property is (a) not guaranteed by construction, or (b) shown to causally produce capability that an equal-cost conventional baseline lacks.**

Provenance preservation, versioning, closure — demonstrating these demonstrates the software works as designed: engineering QA, not discovery ("wearing an algebra costume"). The Codd precedent cuts the same way: the relational model won because it had BOTH a formal algebra AND won on outcomes — the paradigm claim was cashed out in capability, never asserted in lieu of it. **The one property test in the current programme that passes this guard: the composition challenge** — merge coherence across independently built collections is genuinely NOT guaranteed by construction. Scoped per the reviewer: two independently built collections in adjacent domains (not three teams), Phase 3.

This guard is recorded as IRL METHOD (guidance, beside the discipline of distinctions and discover→reconcile→extend) — not a seeded invariant.

## 5. Language rule — "empirically stable under repeated validation"

Adopted from the reviewer's flag, in the traceability-matrix spirit (IRL-010A): **"provably repeatably invariant" overstates the current system.** Nothing in the runtime PROVES invariance — standing is accumulated LLM-judge validation. The defensible phrase today is **"empirically stable under repeated validation"**; "provable" waits until a verification mechanism exists that deserves the word. (Distinct from Law XIII's "provably the same subject," which IS backed by an actual proof mechanism — the personhood-proof nullifier — and stands unchanged.)

## 6. Phased sequence (proposed jointly; nothing scheduled)

- **Phase 1 — the static gauntlet** (weeks, low cost): Arms A–D + M on a fresh held-out task set selected by the external reviewer. n≥20 per arm; protocol, task list, and judge rubric **hashed and pre-registered before execution**; judge configuration specified jointly, adjudication runnable by either side; success thresholds AND what-counts-against-the-thesis defined in advance (the IRL-010 F1 falsifier and H4 scaffold control, made real).
- **Phase 2** (contingent on Phase 1 signal): **EXP-9A/9B** — receipted standing accrual on one task family, frozen Crystal v1, standing-weighted vs confidence-weighted retrieval. (The reviewer's correspondence calls these "EXP-006A/B"; they are EXP-9A/9B after the numbering correction — see EXP-009's designation history.)
- **Phase 3**: the composition challenge (§4) + an externally scored forecasting benchmark — the one instrument neither party designs or adjudicates. Finance re-enters here as a HOST DOMAIN for composability/calibration experiments (CRP-003's laboratory), never as validation; P&L-as-validation is dead by mutual agreement.

## 7. The reviewer's capability probe — answered against the code, honestly

The reviewer asked two closing questions, correctly noting the answers are diagnostic either way:

1. **"Can the Phase 1 grounding slices be exported verbatim for Arm C?"** — Substantially yes, with modest work: the grounding path is `buildInvariantSlice` (the same ranked slice `scripts/benchmark-rediscovery.mjs` grounds its arms on), and slices are plain invariant statements + metadata — nothing prevents verbatim export. What does NOT exist yet: a first-class export command producing the frozen, hash-committed Arm C text file. That is a small build item, not an architectural obstacle.
2. **"Can the judge configuration be externally specified?"** — Partially today: the EXP-001 judge harness (`scripts/evaluate-exp001.mjs`) already defaults to non-Anthropic judges for independence and takes provider/model configuration, but the rubric lives in the script rather than as an external, hashable config document. Making the rubric an externally supplied, pre-registered artifact is likewise a small build item.

Neither answer indicates the coupling failure the reviewer was probing for — the pipeline decomposes — but both honest gaps are named as Phase 1 prerequisites: **(i) a verbatim slice-export command, (ii) an external judge-config artifact.** Both are build work BEFORE the protocol can be pre-registered.

## 8. Honest limits

- **Nothing here has run.** This charter records a jointly-converging design; the Phase 1 protocol document (arms, task-selection procedure, judge spec, pre-registration mechanism, falsification thresholds) is the external reviewer's to draft and both parties' to sign before execution.
- **The two Phase 1 prerequisites (§7) are unbuilt.**
- **Claim A is deliberately NOT re-litigated here.** EXP-003's grounding result stands as its evidence; this gauntlet spends its budget entirely on Claim B and the representation question.
- **Aletheon's "certain compressions preserve the generative structure of reasoning" (reconstructability vs mere compression — JPEG/ZIP compress; neither preserves reasoning) is recorded as the HYPOTHESIS the C-vs-D split operationalizes** — not as a finding. It connects to WP5 (Invariant Morphogenesis) and `inv.epistemology.132`, and none of those connections is evidence.
- **"Context engineering is too coarse a description" (Aletheon: "databases are file management — technically true, scientifically useless") is a framing position, not a measured claim** — the gauntlet is exactly the instrument that would make it one, in either direction.
- Task-set selection by the external party controls for in-distribution inflation but introduces its own selection choices; the pre-registration discipline is the mitigation.

## Ratification record

- [x] **CHARTERED 2026-07-16 by operator direction** ("fold into the lab as appropriate"), from the operator + external reviewer + Aletheon exchange. Every adopted element is attributed inline; the two elements NOT adopted verbatim are recorded with their reasons (the Arm C misread, corrected; "provably repeatably invariant," replaced with the defensible phrase).
