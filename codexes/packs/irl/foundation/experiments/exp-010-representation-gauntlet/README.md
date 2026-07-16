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

Neither answer indicates the coupling failure the reviewer was probing for — the pipeline decomposes — but both honest gaps were named as Phase 1 prerequisites: **(i) a verbatim slice-export command, (ii) an external judge-config artifact.**

**Both prerequisites BUILT, 2026-07-16 (same day), per operator direction.** The platform's answer to the reviewer's probe is now an unqualified yes:

1. **`scripts/export-grounding-slice.mjs`** — exports the exact invariant statements an arm grounds on, verbatim (no paraphrase), one marker-prefixed statement per line (decomposition preserved — Arm C's shape by construction), as `<name>.arm-c.txt` + `<name>.manifest.json` carrying the **sha256 of the text file** (the pre-registration commitment), full generation parameters, per-invariant provenance (seed id, standing, confidence, reach, status), and a token estimate for the equal-budget discipline. Two modes: `--collection exp001` (the fixed 18-invariant instrument, config order preserved) and `--broad` (the live domain-scoped slice, ranked standing → confidence → reach — the same query the benchmark's broad arm grounds on, verbatim). Exports land in this experiment's `exports/` directory. The instrument deliberately never generates Arm D — the expert conventional prompt is authored by humans, per the design.
2. **`--judge-config <path>` on `scripts/evaluate-exp001.mjs`** — a JSON artifact externally specifying the judge: `{ "provider", "model"?, "rubrics"?: { "answerSystem"?, "judgeQuestionSystem"?, "judgeCoherenceSystem"? } }`. The config file's **sha256 is printed at run start and recorded in the results JSON** (`judgeConfig: { path, sha256, rubricOverrides }`) — hash the config, register the hash, then run; neither party can quietly swap the rubric. The pre-registered config is authoritative: passing a conflicting `--provider` flag is a hard error, never silently resolved. Verified live: config load + sha256 banner + rubric-override listing, the conflict guard, and both scripts' honest usage/missing-env errors.

The same `--judge-config` format is the contract EXP-010's own Phase 1 harness (not yet built — it awaits the signed protocol) will consume — extend, don't duplicate.

## 7A. The Phase 1 freeze + the final four adoptions (2026-07-17, the alignment round)

**The protocol is FROZEN, per the external reviewer's process commitment, adopted symmetrically.** Four arms (A cold · D expert prose · C flattened invariants · B runtime) + the mutation probe + the generative sufficiency probe (below), n≥20 per arm, held-out tasks selected by the external reviewer, jointly specified judge, hashed pre-registration, falsification thresholds agreed in advance. Nothing further is admitted to Phase 1. Every new hypothesis this exchange generates — and it keeps generating good ones — goes to the **Phase 2+ parking lot** (first entry: the structural experiment, §7B). *"Three rounds of refinement have made this a strong design; a fourth makes it a seminar."*

**Adopted 1 — the generative sufficiency probe.** Reconstructability ("invariant compression preserves the generative structure of reasoning, unlike JPEG/ZIP") is a testable claim, so it is now a scored sub-task: the task set includes held-out **derivation** tasks — conclusions that follow from the knowledge but are not stated in it. The claim is supported only if Arm C beats Arm D on derivation specifically, not merely recall. C ≈ D on derivation = the reconstructability claim is unsupported at current scale — publishable either way, per Principle 004.

**Adopted 2 — the token accounting rule.** Budget equality across arms is measured on the **final rendered prompt, as tokenized by the target model**. Structured decomposition carries formatting overhead; it is neither charged a hidden budget tax nor given one.

**Adopted 3 — the mechanistic difference enumeration, ANSWERED from the code (not deferred).** The reviewer is right that at inference time an invariant object has exactly two channels into today's models — serialized text and orchestration — and right that without this enumeration a null B−C would be degenerate and a positive B−C unattributable. The honest table, drawn from the actual grounding path (`services/invariants/grounding.ts buildInvariantSlice` → statement injection → `citeInvariants`), for a single inference:

| Inference-path stage | Arm B (runtime) | Arm C (flattened export) | Differs? |
|---|---|---|---|
| Selection | LIVE, per-task, intent/domain-scoped, standing → confidence → reach ranked, deduped, capped | ONE frozen, pre-registered slice (exported by the same ranking at freeze time) | **YES — the load-bearing within-call difference** |
| Crystal state | live substrate at call time | snapshot at pre-registration | YES (timing) |
| Serialization | marker-prefixed statements | marker-prefixed statements (the exporter mirrors the runtime slice format) | **NO — essentially identical** |
| Composition-law validation | applies on composition-class tasks (`validateComposition`) | absent | Only on composition tasks |
| Post-call citation (`citeInvariants` → Reach) | yes | no | YES — but it CANNOT affect the in-call answer; it is lifecycle |

**Pre-registered prediction, stated before any data exists:** on single-call recall tasks with a fixed, matched slice, **we predict B ≈ C by construction** — the serialization channel is identical. The runtime's within-call claim localizes entirely to **selection-under-intent** (which invariants, per task — the operator's "the curated information is not intuitive; it's based on the invariant substrate, not the knowledge"); everything else the runtime does is lifecycle (mutation locality, standing accrual, versioned merge, governance), which the mutation probe and EXP-009 test, not this gauntlet. Stating this now forecloses both failure modes the reviewer named: a null B−C confirms a prediction rather than requiring an excuse, and a positive B−C is attributable to the one enumerated mechanism.

**Adopted 4 — the Mechanistic Trace artifact** (Aletheon's fifth artifact — a document, not an arm): one worked inference, traced end to end — `Corpus → Invariant Selection → Composition → Conflict Resolution → Serialization → Model → Evaluation → Receipts` — **starting at the corpus, not the prompt**, because selection, compression, canonicalization, and conflict resolution are computation that happens before serialization. Required Phase 1 deliverable alongside the protocol document.

## 7B. The two hypotheses this exchange disentangled (the real fault line, named)

The exchange's closing rounds surfaced that TWO different experiments were hiding inside one design, with different independent variables:

- **Hypothesis B — Execution (Phase 1, frozen, the reviewer's experiment):** given an already-organized invariant substrate, does the runtime add within-call value beyond the content? Independent variable: *how the knowledge is delivered.* This is what B-vs-C measures, with the §7A prediction on record.
- **Hypothesis A — Structure (the Institute's PRIMARY claim, deliberately NOT in Phase 1):** does organizing raw experience into an invariant substrate change the computational properties of reasoning, versus the raw experience or a conventional expert summary at matched tokens? Independent variable: *what constitutes the knowledge.* Arms, when chartered: raw corpus excerpts / expert summary / invariant substrate — same source material, matched final-prompt tokens (Aletheon's medicine example is the illustrative domain). **Parked to Phase 2 under the identical disciplines** — pre-registration, external task selection, joint judge — and assigned its EXP-nnn number only when chartered (no number minted here).

The layer separation behind this is not new doctrine invented under adversarial pressure — it is the ratified canon, timestamped before this exchange began: `inv.reasoning.085` (2026-07-06: invariant fields are natural/discovered or constitutional/ratified, differing only in origin), CFS-021's three invariant families, and CFS-019 §2's three layers (Layer I — Invariant Intelligence, the substrate science; Layers II/III — Constitutional Computing/Cybernetics, the governance engineering). Phase 1 tests a Layer II delivery question; Hypothesis A tests the Layer I claim. Axis-precision note (the witness's caveat): the operator's structural/constitutional distinction is a FUNCTION axis (governance-independent substrate vs second-order governance of it); inv.085's natural/constitutional is an ORIGIN axis (discovered vs ratified) — they map through the CFS-019 layers and must not be silently equated.

**The four-stage research decomposition, recorded** (Aletheon, 2026-07-17): **Discovery** (can raw experience be distilled into stable invariant representations?) → **Representation** (do those representations improve reasoning over unstructured experience?) → **Execution** (does the runtime further enhance their use?) → **Evolution** (can they be maintained, composed, updated, governed over time?). Phase 1 = Execution; Hypothesis A = Discovery + Representation; EXP-009 = Evolution.

**Pre-committed interpretation of the reviewer's "repricing" scenario:** if B ≈ C within-call (as predicted), the within-call value lives in representation and content — Hypothesis A territory — and the runtime's value lives in selection-under-intent and lifecycle. That is not a retreat from the science; it is the two-layer doctrine stating itself in data. (And per Aletheon: applications don't invalidate science — if invariant organization turns out to derive most of its value from organizing, maintaining, and evolving knowledge, then knowledge organization itself is the intelligence primitive discovered. The dichotomy "lifecycle system vs new science" is false.)

## 8. Honest limits

- **Nothing here has run.** This charter records a jointly-converging design; the Phase 1 protocol document (arms, task-selection procedure, judge spec, pre-registration mechanism, falsification thresholds) is the external reviewer's to draft and both parties' to sign before execution.
- **The two Phase 1 prerequisites (§7) are BUILT (2026-07-16)** — the slice exporter and the external judge-config artifact. What remains unbuilt: EXP-010's own Phase 1 runner harness (it awaits the signed protocol; the EXP-001 harness demonstrates the judge-config contract it will reuse).
- **Claim A is deliberately NOT re-litigated here.** EXP-003's grounding result stands as its evidence; this gauntlet spends its budget entirely on Claim B and the representation question.
- **Aletheon's "certain compressions preserve the generative structure of reasoning" (reconstructability vs mere compression — JPEG/ZIP compress; neither preserves reasoning) is recorded as the HYPOTHESIS the C-vs-D split operationalizes** — not as a finding. It connects to WP5 (Invariant Morphogenesis) and `inv.epistemology.132`, and none of those connections is evidence.
- **"Context engineering is too coarse a description" (Aletheon: "databases are file management — technically true, scientifically useless") is a framing position, not a measured claim** — the gauntlet is exactly the instrument that would make it one, in either direction.
- Task-set selection by the external party controls for in-distribution inflation but introduces its own selection choices; the pre-registration discipline is the mitigation.

## Ratification record

- [x] **CHARTERED 2026-07-16 by operator direction** ("fold into the lab as appropriate"), from the operator + external reviewer + Aletheon exchange. Every adopted element is attributed inline; the two elements NOT adopted verbatim are recorded with their reasons (the Arm C misread, corrected; "provably repeatably invariant," replaced with the defensible phrase).
