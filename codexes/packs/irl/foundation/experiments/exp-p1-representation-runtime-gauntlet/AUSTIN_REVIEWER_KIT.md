# EXP-P1 Austin Reviewer Kit

**Status: DRAFT — internal, not yet sent. Purpose: independent review and confirmatory freeze, not approval of any internal result.**
**Prepared:** 2026-09-08. **Audience:** Austin Ambrozi (Autonomi Solutions LLC), independent reviewer/protocol designer, and his delegated agent.
**Companion documents:** `README.md` (the registered protocol), `STAGE-0_HANDOFF.md` (instrument validation), `AUSTIN_COVER_NOTE.md` / `AUSTIN_ONE_PAGER.md` (existing draft outreach — see §9 for their current send-readiness).

This kit does **not** modify, supersede, or re-derive anything in the registered protocol. Every claim below is either a verbatim quote of the registered protocol, a verbatim quote of a persisted record, or explicitly labeled as internal apparatus-development commentary. Where this document and `README.md` appear to disagree, `README.md` governs — say so rather than silently reconciling.

---

## 1. Executive Reviewer Brief

### Scientific hypothesis (README.md §0, verbatim)

> "Does invariant **representation** (discrete, typed, decomposed statements) and the invariant **runtime** (live intent-scoped selection + machinery) provide measurable benefit beyond conventional context engineering, at equal token budget, under externally specified controls? Each arm-delta owns one framing (§1) — the hypothesis disagreement is resolved by design, not argument."

EXP-P1 is the externally-countersigned freeze of the four-arm design chartered internally as EXP-010 (README.md §0): "The Institute owns the hypotheses; the external reviewer hardens the validation methodology." It does **not** test IRL's "Layer 1 vs Layer 2" structural hypothesis — that is the companion EXP-P2, run under identical rigor.

### Why Arm B vs Arm C is the critical comparison

Per the registered arm-delta table (README.md §1), each arm-to-arm delta is owned by one party's framing. **B − C is Austin's scaffold-control question**: Arm C is the flattened invariant representation with no runtime (no live selection, no standing weighting, no receipts, no post-call path); Arm B is IRL's complete pipeline — per-task intent-scoped selection, prompt assembly, orchestration, evaluation gates, and post-call citation — against the identical frozen substrate. Everything Arm B does that Arm C does not must appear in the Mechanistic Difference Enumeration (§3 below); no unenumerated mechanism may be invoked to explain a result. This is the one comparison that isolates the *runtime's* marginal value from the *representation's* marginal value (owned by C − D instead).

### Current status

**Apparatus internally validated. Confirmatory experiment not yet run.**

- The registered protocol (README.md) is still in **DRAFT FOR SIGN-OFF** — no joint signature, no hash-committed pre-registration bundle, no external task set/answer key, no external Arm D, no judge configuration exists yet.
- What *has* happened: an internal engineering programme (v1 → v4, §5 below) built and stress-tested the **measurement apparatus** — the Arm B selector, the retrieval-recall harness, the genuine per-arm execution/evidence-of-use harness, and the durability of the execution pipeline itself — entirely against an `internal-pilot`-designated Crystal generation, entirely outside the registered confirmatory design (different repetition count, no external task set, no judge, mechanical proxy scoring only).
- **No scientific superiority claim is warranted from any of this internal work.** It answers "does the apparatus work?", not "does the runtime help?". §6 below reports the latest internal apparatus run under that explicit ceiling.

---

## 2. Frozen Experimental Substrate

**Crystal:** `EXP-P1/crystal-vP2`
**Content hash / commitment hash:** `c85ea160ec6615d13b7c9b978d28c96480123a7c867c37a319d16d1bd8bd685b`
**Members:** 63, frozen 2026-09-06T10:53:19.707Z, receipt `7aaef810-d661-47c6-9dbb-8640abea2957`.
**Execution designation:** `internal-pilot` — **not** a confirmatory freeze. Per the freeze record's own semantics (`RES-2026-09-05-CRYSTAL-FREEZE-EXECUTION-DESIGNATION-001`), a freeze act answers two separate questions — *what was frozen* and *whether it is fit for a confirmatory result* — and this generation was frozen answering only the first.

### Acknowledged Crystal-readiness deviations (verbatim from the freeze record)

Two `scientificDeviations` are recorded against this freeze, both stated as properties of *this generation*, not defects to silently work around:

1. **`derivation-headroom`** — *"Crystal vP2 is frozen as the immutable substrate for an internal EXP-P1 experimental run. It contains 63 externally grounded, validated and distinct invariants and satisfies the registered selection-space requirement. Its measured limitations in derivational structure and declared-boundary coverage are preserved as properties of this generation. Findings from the internal run may motivate corpus expansion in a successor Crystal generation; vP2 itself will remain immutable."* Measured detail: 0 conjunctions entail an unstated conclusion (need ≥ 12); 0/63 members participate in one; 0/63 assert any of the seven relational structures (causal, conditional, propagation, constraint, threshold, trade-off, quantitative).
2. **`boundary-coverage`** — *"2/15 declared namespaces represented (13.3%) — unrepresented: reasoning, engineering, experience, capability, style, narrative, sovereignty, cybernetics, interaction, epistemology, representation, polity, commercialisation. A reviewer authoring tasks against the declared boundary (§5.1) may author into any of these, and nothing in the crystal grounds them (§5.4)."*

**Explicit statement: Crystal vP2 has not been modified during any part of rehearsal development (v1–v4).** It is immutable by design — every rehearsal run reads the same frozen `memberSnapshot`; no run, fix, or selector change ever wrote to it. This is independently verifiable: the content hash above is unchanged across every persisted rehearsal/execution-run artifact this kit references.

---

## 3. Experimental Protocol (as registered — quoted, not restated)

**Registered document:** `README.md` in this directory, "Chrysalis Foundation · Validation Programme v1 · Experiment A (Comparative) · Status: DRAFT FOR SIGN-OFF."

### Arm definitions (README.md §4)

- **Arm A — Cold.** Task prompt only. No grounding material.
- **Arm D — Expert Prose.** Conventional expert-curated context: continuous prose covering the same knowledge domain as the crystal's source material, written without access to the invariant collection or its decomposition, by a competent curator on Austin's side. Token budget matched to Arm C. Fixed once at freeze; identical across all tasks.
- **Arm C — Flattened Invariants.** The verbatim exporter output for a fixed, pre-registered slice of `Crystal vP1`: discrete, typed invariant statements with decomposition preserved, but **no runtime** — no live selection, no standing weighting, no receipts, no post-call path. One fixed slice for all tasks, hash-committed.
- **Arm B — Full Runtime.** IRL's complete pipeline against `Crystal vP1`: per-task intent-scoped selection, prompt assembly, orchestration, evaluation gates, and post-call citation as normally operated.

### Mechanistic Difference Enumeration (MDE) — quoted verbatim (README.md §3.4)

> "IRL's enumeration (per EXP-010 §7A) is included in the pre-registration bundle as a signed artifact: the complete list of points where Arm B's inference path differs from Arm C. Current stated content: (i) per-task intent-scoped live selection [load-bearing]; (ii) crystal state timing [non-effect under freeze]; (iii) post-call citation/standing return path [lifecycle; cannot affect the in-call answer]. **No mechanism absent from the MDE may be invoked to explain any result.**"

### Treatment / model / provider controls (README.md §3, §9)

- One target model, pinned by exact model string, identical for all arms. Temperature and sampling parameters fixed and recorded. Any provider-side model update mid-experiment voids affected runs.
- Single frozen Crystal snapshot; no live-table reads during the experiment except Arm B's selection step, reading the same frozen snapshot.
- Arm C's exporter and source hash recorded (`scripts/export-grounding-slice.mjs`).
- Token-budget equality across Arms C and D measured on the final rendered prompt as tokenized by the pinned target model; Arm B's per-task rendered prompts are logged and reported, not budget-capped against C/D.

### Repetition / statistical requirements (README.md §7, verbatim)

> "**Repetitions:** k = 5 runs per task per arm at fixed temperature. Total main-phase runs: 24 tasks × 4 arms × 5 reps = 480 inference runs. **Reporting:** per-arm distributions with medians and bootstrap 95% CIs (10,000 resamples). No single-number results without variance bands. **Signal threshold (pre-agreed):** a delta counts as signal only if (a) bootstrap 95% CIs of the arm medians do not overlap **and** (b) absolute median improvement ≥ 5 points on the 0–100 rubric (or ≥ 10% relative on token economy). Anything smaller is reported as null. **Pre-specified comparisons (in order):** ① B − C selection-neutral recall (null check); ② B − C selection-sensitive (primary comparison); ③ C − D derivation (sufficiency probe); ④ C − D overall; ⑤ D − A (sanity). No other comparisons may be reported as confirmatory."**

### Confirmatory success/failure criteria

The full pre-registered Interpretation Table (README.md §12) fixes what each outcome pattern means **before any result exists**: "an outcome's meaning is fixed here before any result exists; the experiment may generate new hypotheses but may not redefine its own success criteria after observation." Domain limitation stands regardless of outcome strength: "**No EXP-P1 outcome, however strong, may be read as evidence of domain-independent generalisation.**"

**None of the confirmatory apparatus above (k=5 repetitions, bootstrap CIs, external task set, judge, external Arm D) exists yet.** Everything described in §5–§6 below ran under none of these controls and cannot be read against this section's criteria.

---

## 4. Frozen Arm B Treatment Specification

**Selector:** `services/invariants/taskScopedSelection.ts`, frozen at `TASK_SCOPED_SELECTOR_VERSION = 'task-scoped-v1'`.

### The corrected order (verbatim from the module header)

> 1. **Intent** — the task's own prompt text, verbatim.
> 2. **Functional necessity/relevance** — lexical-overlap eligibility gate + functional-role (`semanticType`) carried through, NEVER hard-gated.
> 3. **Relational completion** — graph expansion (`depends_on`/`composes`) from the relevant set, BEFORE truncation, so a structurally-required but not-directly-keyword-matched invariant is not discarded.
> 4. **Evidentiary standing** — `rankByStanding`, applied ONLY within the relevant+expanded set from stages 2–3, never across the whole domain.
> 5. **Consequence/value calibration** — RESERVED, NAMED NO-OP in this version.
> 6. **Bounded representation** — truncate to `limit` last.

**Standing cannot substitute for relevance.** This ordering is the direct, mechanical repair of an audited defect in the selector this module replaced: standing had been the *only* discriminating signal over an undifferentiated, task-blind pool — a global ranking criterion, not a calibrator among already-relevant, functionally comparable candidates. The frozen module enforces the required principle explicitly: *"Intent and functional relevance determine candidate eligibility. Standing calibrates evidentiary strength among sufficiently relevant, functionally comparable candidates. Standing must never substitute one invariant type or relational role for another that the intent requires."*

**Stage 5 (consequence/value/time-to-value/risk-of-repair calibration) is architected but inactive.** Every `TaskScopedSelectionItem`'s `valueEstimate` and `riskOfRepairEstimate` fields are `null`, untouched, uninvented, in this version — reserved as a future calibration stage rather than an active selection criterion, per explicit design decision: it is not yet supported by a ratified model or sufficient data, and activating it prematurely would introduce an unauthorized, unvalidated signal into the treatment.

### Selector-version assertion and treatment-fidelity tests

Every execution rehearsal asserts the live `TASK_SCOPED_SELECTOR_VERSION` against a pinned `FROZEN_ARM_B_SELECTOR_VERSION` constant before running — a run refuses outright on drift, so no rehearsal can silently execute against a changed selector. Treatment-fidelity properties (functional-role weighting present, relational completion runs before truncation, standing calibrates rather than substitutes, per-task variation exists, graph-expansion never discarded pre-truncation, Stage 5 stays null) are enforced by `tests/task-scoped-selection.test.ts`.

---

## 5. Internal Rehearsal Lineage (v1 → v4) — engineering/scientific-apparatus development, not a scientific record

Each stage below is an **apparatus finding**, never a scientific one. None used the registered protocol's controls (repetitions, external task set, judge, external Arm D).

| Stage | What it built/found | Apparatus finding |
|---|---|---|
| **Initial instrumentation** | First four-arm rehearsal harness (`expP1Rehearsal.ts`) — task loading, arm construction, retrieval, mechanical scoring, receipts, persistence — deliberately built with **no model-calling seam** for EXP-P1, to validate plumbing before any generation existed. | Confirmed the harness's non-model layers (persistence, receipting, scoring math) work; explicitly could not and did not measure anything about reasoning. |
| **Discovery: task-blind, standing-ranked Arm B** | Mechanical audit of the selector Arm B had been calling (`buildInvariantSlice`) found: task intent never represented; the only "eligibility" gate was domain/namespace/status (coarse, task-blind, identical for all 63 members); functional role never read; no relational structure consulted; standing was the *only* discriminating signal over an undifferentiated pool, called once per run outside the per-task loop (selection never varied across tasks). | A genuine selection-fidelity defect, not a scientific result — the runtime's B vs C comparison up to this point had never actually been task-scoped. |
| **Treatment-fidelity diagnosis** | The two prior rehearsal runs that used the old selector were permanently reclassified `treatment-fidelity-diagnostic` — instrument-validation evidence about the *old* selector's plumbing, never evidence for or against the runtime hypothesis. | Formal, permanent, non-reversible reclassification — those runs can never be cited as informative about B vs C. |
| **Corrected task-scoped selector (v1)** | Built `taskScopedSelection.ts` (§4 above), frozen at `task-scoped-v1`. No change made to relevance/graph-expansion/standing/budgeting behaviour in response to any observed outcome — the selector's own commit history predates the rehearsal results it was later evaluated against. | Apparatus repair, independently verified via treatment-fidelity tests. |
| **Unseen retrieval rehearsal (v2/v3)** | A fresh, unseen 16-task set (v3) — retrieval-only (selected-set recall, never generated-answer recall) — evaluated the corrected selector for the first time. Result: Arm B outperformed Arm C on retrieval-set recall (87.5% vs 46.9%). | **Retrieval-set recall only** — measures whether the selector *offers* the right invariants, never whether a generated answer *uses* them. Explicitly ruled non-confirmatory and insufficient to interpret without a genuine execution layer. |
| **Execution rehearsal (v4)** | Built the genuine per-arm execution/evidence-of-use layer (`expP1ExecutionRehearsal.ts`): real pinned-model calls per arm/task, structured self-citation + independent verification against what was actually offered (a citation to something not offered is fabricated, excluded, and counted), never inferring "used" from mere "supplied." A fresh, unseen 16-task v4 set (8 recall + 8 derivation) was authored, never reusing v3 (already observed). | The first run in this codebase's EXP-P1 history where "demonstrated use" is a real, verified measurement rather than a copy of the selected set. §6 reports its result. |
| **HTTP durability incident and correction** | The v4 run's original one-shot design (hold one HTTP request open across up to 64 concurrent model calls + synchronous persistence) exceeded the hosting gateway's ~30s ceiling; the browser saw an HTTP 504 while the server continued running and persisted the result anyway. Root-caused via persisted-state timing evidence + a pre-existing, independently-documented gateway-timeout comment — never inferred from the 504 status code alone. Corrected to a checkpointed start/step design: a fast, model-call-free "start" phase; bounded (12-concurrent-call), idempotent "step" batches; resume-in-place for an in-flight run; a single completion receipt written exactly once. | A pure orchestration fix — zero change to provider, model, temperature, prompt, selector, or scoring. The failed attempts were preserved as apparatus provenance, never retried, never promoted to a scientific result. |

---

## 6. v4 Apparatus Report

> ### ⚠ INTERNAL / PROVISIONAL / NON-CONFIRMATORY / APPARATUS VALIDATION
> This section reports one internal-pilot execution rehearsal against `Crystal vP2` (`internal-pilot` designation), using the frozen `task-scoped-v1` Arm B selector, mechanical proxy scoring, k=1 (no repetitions), no external task set, no judge, no external Arm D. **It answers "does the apparatus work correctly?", never "does the runtime help?"** No number in this section may be headlined as a scientific finding, cited as evidence toward the registered hypothesis, or used to argue for or against any change to the frozen selector, task budget, prompts, scoring mechanism, or scientific thresholds.

**Run:** `EXP-P1/execution-run/internal-rehearsal/2026-09-08T03:09:58.568Z` — `lifecycle:'executed'`, one completion receipt (`6bc1b446…`, `receipt_status:'dvn_pending'`), `runExecutionDesignation:'internal-rehearsal'`, `confirmatoryEligible:false`, `taskSetProvenance:'provisional'`. Completed under an apparatus design that has since been superseded (see §5's durability fix) — the run itself finished correctly; only the caller's HTTP connection was affected by the incident.

**Locked facts** (verified against the persisted artifact, read-only):

- **64 intended arm executions** (16 tasks × A/B/C/D). **60 completed, 4 provider timeouts** — C×3 (`rehearsal-v4-001`, `-013`, `-015`), D×1 (`-010`). Every timeout is visibly flagged (`executionOutcome:'timed_out'`, score 0, no fabricated success) — never masked as a genuine low-scoring completion.
- **No fabricated/unoffered citations** — `citationDiagnostics` is present and empty across all 64 executions.
- **All 16 Arm B executions completed** (0 timeouts on B).
- **B mean selected context = 9.5/63** (range 2–12, varying per task). **C fixed context = 25/63**, constant across all 16 tasks (39.7% fixed slice), including the 3 tasks where the call itself timed out.
- **B mean prompt tokens (1,464.4) lower than C's (1,888.2)** despite B's larger completions (mean 148.2 vs C's 142.1) — C's fixed 25-item slice is the larger context on average even though B is not budget-capped.
- Among the **14 B/C tasks with comparable completed executions** (excluding the 2 tasks where C's zero was a timeout artifact, not a reasoning outcome): **B wins 5, C wins 2, ties 7** on `demonstratedUseRecall`.
- **B's derivation selections hit the 12-item ceiling on all 8 derivation tasks** — recall tasks showed real variation (2–12), derivation tasks showed none. This is recorded as an **observed treatment characteristic of this run, not a defect and not something to tune in response to the rehearsal.**
- `demonstratedUseRecall` overall: A 0, B 0.554, C 0.271 — B ahead overall and on recall tasks (0.813 vs 0.188); C marginally ahead on derivation tasks (0.354 vs 0.296), the one class where the 12-item ceiling above may be a confound worth a closer read before any interpretation.
- `answerKeywordCoverage` (own-answer engagement proxy, never a correctness score, computed identically for all four arms): A 0.75, B 1.00, C 1.00 (n=13, timeouts excluded), D 0.933 (n=15).

**No scientific superiority claim is warranted from any of the above.** These are apparatus-validation numbers describing one uncontrolled, unrepeated, mechanically-scored internal run.

---

## 7. Known Limitations / Open Observations

- v4 recorded 4 provider timeouts (C×3, D×1) — not a defect in the harness (each is visibly flagged, scores 0, does not crash the run), but a real gap in this run's data; treat those 4 arm-executions as missing, not zero, in any further analysis.
- Citation evidence-of-use verifies citation **validity** (was the cited marker genuinely among what the arm was offered) — it does **not** perform ablation-grade causal attribution (whether the answer would actually change if the cited statement were removed). This is a stated limitation of the mechanism, never silently assumed closed.
- All scoring in the internal rehearsal lineage is a mechanical proxy (`demonstratedUseRecall`, `answerKeywordCoverage`, retrieval-set recall) — **never correctness adjudication**. No real judge or rubric exists anywhere in the internal apparatus.
- All 8 derivation tasks in v4 saturated Arm B's 12-item selection budget (§6) — an observed treatment characteristic, explicitly not to be tuned in response to this rehearsal.
- The Stage 5 consequence/value/time-to-value/risk-of-repair calibration stage (§4) is architected but inactive — not yet supported by a ratified model or sufficient data.
- **No external held-out task set, no expert-authored (external) Arm D, no independent judge/rubric, and no confirmatory repetitions (k=5) exist yet.** Every number in §6 comes from an internal, single-repetition, mechanically-scored run against a task set IRL itself authored — none of it substitutes for any part of §3's registered confirmatory design.

---

## 8. Explicit Austin Decisions/Deliverables

Converting the remaining confirmatory requirements (README.md §3, §5, §7, §8, §15) into discrete reviewer actions — each independently answerable, none blocking on the others except where noted:

| # | Decision/deliverable | Source requirement | Blocks |
|---|---|---|---|
| 1 | **Review/accept or challenge the experimental apparatus** — the internal-pilot rehearsal design, the frozen `task-scoped-v1` selector, the v1–v4 lineage (§5), and the durability fix. Austin's own three standing review questions (README.md, `AUSTIN_COVER_NOTE.md`): does the protocol adequately distinguish instrument behaviour from measurement artefacts; is the frozen methodology sufficiently specified to proceed; is the invariant substrate appropriate for the intended investigation. | Review posture | — |
| 2 | **Review the Arm B/C treatment distinction and the Mechanistic Difference Enumeration** (§3) — confirm the enumerated differences are complete and that no unenumerated mechanism is silently in play. | README.md §3.4 | Item 3 |
| 3 | **Approve/countersign the confirmatory protocol** — README.md §15, the x409 constitutional-agreement `authorize` action (owner-only, Institute side) is the actual mechanism; Austin's agent `accept`s, the operator `authorize`s. This single act is simultaneously the protocol freeze and Austin's agent's submission authorization. | README.md §15 | Items 4–7 (nothing below can begin until this freezes) |
| 4 | **Provide or control the sealed held-out confirmatory task set/answer key**, per protocol: "no task, key, or paraphrase thereof may exist in the crystal, its source corpus annotations, or any IRL prompt/config… keys hash-committed at freeze, revealed at adjudication." Selection authority is Austin's (README.md role table). | README.md §5.3–5.4, §15 | Confirmatory execution |
| 5 | **Provide/approve independent expert-prose Arm D** — authored/commissioned on Austin's side, without access to the invariant collection or its decomposition, token-budget-matched to Arm C (§9). | README.md §4, role table | Confirmatory execution |
| 6 | **Establish judge/rubric and the independent/secondary judging procedure** — judge configuration (pinned model + rubric file) specified by Austin's side, hash-committed at freeze; judge sees only (task, answer, answer key) triples, never prompts/grounding/arm labels; both parties run the judge independently and hash-compare score files; contested tasks go to a pre-named human adjudicator pair, one per side. | README.md §8 | Confirmatory execution, adjudication |
| 7 | **Confirm the repetition/statistical plan** — k=5 runs per task per arm, bootstrap 95% CIs (10,000 resamples), the pre-agreed signal threshold, and the five pre-specified comparisons in the fixed order (§3 above). | README.md §7 | Result interpretation |
| 8 | **Authorize confirmatory freeze when satisfied** — the same countersignature act as item 3, executed only once every other item above that the protocol requires before freeze is in place. | README.md §15 | Execution |

**Custody boundary (explicit):** where the protocol specifies external custody of sealed confirmatory material (item 4's task set/answer key, item 6's rubric/judge config until adjudication), no internal IRL operator or agent may see that sealed material. This kit and its companion documents describe the *mechanism* by which that custody is meant to be technically enforced (§9) — they do not themselves grant IRL operators any view into content Austin's side has not yet revealed.

---

*End of kit. See the accompanying chat report for the reviewer-UX assessment and proposed sequence — this document alone is not a decision to send anything.*
