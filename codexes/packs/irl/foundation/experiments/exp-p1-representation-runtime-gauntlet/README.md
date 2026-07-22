# EXP-P1 — The Representation & Runtime Gauntlet

**Chrysalis Foundation · Validation Programme v1 · Experiment A (Comparative) · Status: DRAFT FOR SIGN-OFF**
**Hypothesis class:** Comparative (see `foundation/IRL_VALIDATION_ROADMAP.md`).
**Constitutional anchor:** `foundation/CFS-033_constitutional-evaluation.md` (evaluation is a pluggable, receipted, versioned component of every experiment).
**Prepared by:** Austin Ambrozi (Autonomi Solutions LLC) for joint sign-off with the Invariant Research Lab.
**Status:** DRAFT FOR SIGN-OFF — frozen upon joint signature and hash commitment; no design changes after freeze.

## Designation note

This is the **externally-countersigned freeze** of the four-arm design chartered internally as **EXP-010** (`foundation/experiments/exp-010-representation-gauntlet/`). EXP-010 authored the Cold/Runtime/Flattened/Expert arms + the §7A Phase-1 freeze, the Mechanistic Difference Enumeration, and the generative-sufficiency probe. EXP-P1 instantiates that frozen design as a *joint pre-registration protocol* with an external protocol designer — banking every concession from the 2026-07-16/17 exchange as a binding term. Per the no-number-reuse rule (EXP-009 designation history), EXP-010 keeps its number; EXP-P1 is the joint-signature instance in the Validation Programme series. **The Institute owns the hypotheses; the external reviewer hardens the validation methodology** (`IRL_VALIDATION_ROADMAP.md`).

## Hypothesis

Does invariant **representation** (discrete, typed, decomposed statements) and the invariant **runtime** (live intent-scoped selection + machinery) provide measurable benefit beyond conventional context engineering, at equal token budget, under externally specified controls? Each arm-delta owns one framing (§1) — the hypothesis disagreement is resolved by design, not argument.

## Reuse / build surface

- **Reuse (built):** `scripts/export-grounding-slice.mjs` (Arm-C verbatim slice + sha256 manifest), `scripts/evaluate-exp001.mjs --judge-config` (external hashed judge, provider-conflict guard), the `experiment_results` + `experiment_result_published` DVN publication path, the four `/api/public/irl/*` read routes.
- **Build (composes on the above, do not duplicate):** the crystal-freeze snapshot script (EXP-009 fields), the Phase-1 gauntlet runner over `services/invariants/grounding.ts::buildInvariantSlice` (Arm B), the selection-neutral/selection-sensitive classifier (invariant-ID set comparison), the mutation-probe runner, the pre-registration bundle assembler (CFS-033 §2/§3 EvaluationConfiguration / Research Package), and a bootstrap-CI statistics module. Building these is the sign-off-gated work.

---

# The protocol (pre-registration draft v1.0 — verbatim, frozen upon signature)

## 1. Purpose and Scope

EXP-P1 tests, in one factorial design, the questions this exchange has converged on. It does **not** test IRL's primary structural hypothesis (invariant substrate vs raw experience, "Layer 1 vs Layer 2"); that is the companion experiment (**EXP-P2**, `foundation/experiments/exp-p2-structural-invariance/`), to be run under identical rigor.

What EXP-P1 isolates, by arm-delta:

| Delta | Question | Whose framing it tests |
|---|---|---|
| D − A | Does good curated context help? (sanity baseline) | Uncontested |
| C − D | Does **invariant representation** (discrete, typed, decomposed statements) outperform expert prose at equal tokens? | IRL's representation claim |
| B − C | Does the **runtime** (live intent-scoped selection + machinery) add within-call value beyond a frozen flattened export? | Austin's scaffold-control question |
| Sufficiency probe (C vs D, derivation subset) | Does invariant compression preserve **generative structure** (reconstructability)? | IRL's strongest philosophical claim, made scoreable |
| Mutation probe | Does **objecthood** deliver update locality that flattened text lacks? | The lifecycle claim, jointly endorsed |

The hypothesis disagreement from the 2026-07-16/17 exchange is resolved by design, not argument: each side's framing owns a delta.

## 2. Pre-Registered Predictions (locked at freeze)

Both parties commit predictions **before** any run. Recorded here; amendable only before joint signature.

**IRL's stated predictions (from IRL correspondence, 2026-07-17):**
- P-IRL-1: **B ≈ C on single-call recall tasks** with a fixed matched slice, by construction (serialization is identical; exporter mirrors runtime slice marker-for-marker). A null B−C on recall is a *confirmation* of the two-layer doctrine, not a failure.
- P-IRL-2: B > C where per-task **intent-scoped selection** materially changes which invariants ground the answer (i.e., tasks whose optimal slice differs from the fixed pre-registered slice).
- P-IRL-3: C > D on **derivation** tasks specifically (reconstructability), not merely on recall.

**Austin's predictions:**
- P-AA-1: D − A will be large (curated context works; established effect).
- P-AA-2: C − D overall will be small or null at equal token budget.
- P-AA-3: B − C on recall will be ≈ 0 (agreeing with P-IRL-1); B − C on selection-sensitive tasks is the open question and the experiment's primary informative comparison.

**Interpretation is fixed in §12 regardless of whose prediction wins.**

## 3. Materials, Pinning, and Freezing

1. **Crystal snapshot.** All arms draw from a single frozen crystal version (`Crystal vP1`), snapshotted per the EXP-009 freeze mechanism: `(seed_id, times_validated, times_contradicted, standing, reach)` to a versioned record. Snapshot hash committed at freeze. No live-table reads during the experiment except Arm B's selection step, which reads the same frozen snapshot.
2. **Exporter.** Arm C slices produced by `scripts/export-grounding-slice.mjs` (built and hash-committed). Exporter source hash recorded in the pre-registration bundle.
3. **Model pinning.** One target model, pinned by exact model string, identical for all arms. Temperature and sampling parameters fixed and recorded. Any provider-side model update mid-experiment voids affected runs (re-run required).
4. **Mechanistic Difference Enumeration (MDE).** IRL's enumeration (per EXP-010 §7A) is included in the pre-registration bundle as a signed artifact: the complete list of points where Arm B's inference path differs from Arm C. Current stated content: (i) per-task intent-scoped live selection [load-bearing]; (ii) crystal state timing [non-effect under freeze]; (iii) post-call citation/standing return path [lifecycle; cannot affect the in-call answer]. **No mechanism absent from the MDE may be invoked to explain any result.**
5. **Mechanistic Trace.** One fully worked inference per arm (corpus → selection → composition → serialization → model → evaluation), published alongside results. Enumeration and trace start at the corpus, not the prompt.
6. **Collection-size guard (from the Austin review — locked at freeze).** `Crystal vP1` must be large enough that the **fixed Arm C slice is a genuine subset** of the collection — pre-registered constraint: **the fixed Arm C slice ⊆ 40% of `Crystal vP1`**. Rationale: if the fixed slice approaches the whole collection, Arm B's per-task live selection cannot differ from Arm C's fixed slice, the selection-neutral / selection-sensitive split (§5, P-IRL-2) has no domain to be tested on, and Arm C ≈ Arm B degenerately (not by finding). If the current 18-invariant doctrine collection is too small to satisfy this at a meaningful task set, `Crystal vP1` must be enlarged (or a neutral-domain collection substituted) **before** freeze. The slice fraction is recorded in the pre-registration bundle (§10).

## 4. Arms

All arms answer the identical task set (§5) under the identical pinned model and parameters.

**Arm A — Cold.** Task prompt only. No grounding material.

**Arm D — Expert Prose.** A conventional expert-curated context: continuous prose covering the same knowledge domain as the crystal's source material, written/edited without access to the invariant collection or its decomposition, by a competent curator on Austin's side. Token budget: matched to Arm C (§9). Fixed once at freeze; identical across all tasks (to mirror Arm C's fixed-slice property).

**Arm C — Flattened Invariants.** The verbatim exporter output for a fixed, pre-registered slice of `Crystal vP1`: the invariant statements with their decomposition preserved (discrete, typed statements), but with **no** runtime — no live selection, no standing weighting, no receipts, no post-call path. One fixed slice for all tasks, selected before task-set finalization by IRL's standard slice-construction procedure applied to the domain (not to the specific tasks), and hash-committed.

**Arm B — Full Runtime.** IRL's complete pipeline against `Crystal vP1`: per-task intent-scoped selection, prompt assembly, orchestration, evaluation gates, and post-call citation as normally operated. Everything Arm B does that Arm C does not must appear in the MDE.

**Blinding note.** Because Arm B selects per task and Arm C is fixed, the recall/selection-sensitivity split in §5 exists precisely to separate "selection changed the slice" effects from "machinery" effects. For each Arm B run, the actually-selected slice is logged; tasks where B's selected slice ⊆ C's fixed slice are classified post-hoc as **selection-neutral** (P-IRL-1's domain), others as **selection-sensitive** (P-IRL-2's domain). Classification is mechanical (set comparison on invariant IDs), not judged.

## 5. Task Set

1. **Selection authority:** Austin selects/creates the task set, with the constraint that tasks are answerable from the crystal's source domain. IRL provides the domain corpus boundary; IRL does not see tasks before freeze.
2. **Size and composition:** minimum **24 tasks**: 12 **recall** (answer is stated in or directly entailed by the grounding material) and 12 **derivation** (answer follows from the material by multi-step inference but is nowhere stated — the generative sufficiency probe set).
3. **Answer keys:** ground-truth keys authored at task creation, before any arm produces output; keys hash-committed at freeze, revealed at adjudication.
4. **Held-out guarantee:** no task, key, or paraphrase thereof may exist in the crystal, its source corpus annotations, or any IRL prompt/config. IRL attests to this at sign-off; violation discovered post-hoc voids the affected task.

## 6. Probes

**6.1 Generative Sufficiency Probe.** The 12 derivation tasks, scored separately. Primary comparison: **C vs D on derivation accuracy**. If C ≈ D on derivation at matched tokens, the reconstructability claim is unsupported at current scale (per IRL's own statement, 2026-07-17). If C > D on derivation but C ≈ D on recall, representation preserves generative structure — a genuine, publishable structural finding.

**6.2 Mutation Probe (lifecycle).** After main runs complete:
1. Select the 3 invariants most frequently cited across Arm B/C answers (mechanical selection by citation count).
2. For each, author a corrected/superseding version embodying a defined ground-truth change; the change alters the correct answer for an identifiable task subset (the **affected set**, determined from answer keys before mutation runs).
3. **Arm B path:** apply supersession through the runtime's lifecycle mechanism; re-run the affected set plus 6 unaffected control tasks.
4. **Arm C path:** a human editor, time-boxed to 15 minutes per mutation, edits the flattened text to reflect the same change; re-run the same tasks.
5. **Metrics:** stale-conclusion elimination rate (affected set now answered per updated truth), collateral breakage (control tasks that were correct and became incorrect), and cost (wall-clock, editor effort, tokens).

## 7. Runs and Statistics

- **Repetitions:** k = 5 runs per task per arm at fixed temperature (T recorded at freeze). Total main-phase runs: 24 tasks × 4 arms × 5 reps = 480 inference runs.
- **Primary metrics per run:** correctness vs answer key (0–100 rubric, §8); grounded-claim rate; contradiction count; prompt + completion tokens; orchestration steps (Arm B); answer consistency across the 5 reps (exact/semantic agreement rate).
- **Reporting:** per-arm distributions with medians and bootstrap 95% CIs (10,000 resamples). No single-number results without variance bands — the standing critique of EXP-001–004, remedied here.
- **Signal threshold (pre-agreed):** a delta counts as signal only if (a) bootstrap 95% CIs of the arm medians do not overlap **and** (b) absolute median improvement ≥ 5 points on the 0–100 rubric (or ≥ 10% relative on token economy for efficiency claims). Anything smaller is reported as null.
- **Pre-specified comparisons (in order):** ① B − C on selection-neutral recall (the by-construction null check); ② B − C on selection-sensitive tasks (primary informative comparison); ③ C − D on derivation (sufficiency probe); ④ C − D overall; ⑤ D − A (sanity). No other comparisons may be reported as confirmatory; anything else is exploratory and labeled as such.

## 8. Judging

1. **Judge configuration:** pinned judge model + rubric file **specified by Austin's side**, hash-committed at freeze, runnable by either party in the external environment IRL has offered. IRL confirms `--judge-config <file>.json` support (per IRL, 2026-07-17).
2. **Blinding:** the judge scores (task, answer, answer key) triples only. It never sees prompts, grounding material, or arm labels. Answers are stripped of any arm-identifying boilerplate before judging (mechanical strip step, script published).
3. **Dual-run verification:** both parties run the judge independently on the full output set; score files are hash-compared. Divergence beyond rounding triggers joint inspection of the judge harness before any results are read — instrument integrity first (per IRL Principle 004 and the lab's own recorded harness incident).
4. **Disagreement handling:** tasks where judge scoring is contested by either party after reveal go to a pre-named human adjudicator pair (one per side) scoring blind against the answer key; adjudicated scores are final and flagged in the dataset.

## 9. Token Accounting

Token-budget equality across Arms C and D is measured on the **final rendered prompt as tokenized by the pinned target model**. Structured decomposition's formatting overhead is neither taxed nor subsidized: C's budget is set by its exporter output for the frozen slice; D is authored to within ±2% of that count. Arm B's per-task rendered prompts are logged and reported (B is not budget-capped, but its token consumption is a reported economy metric).

## 10. Pre-Registration Bundle (hash-committed before any run)

1. This protocol (signed).
2. `Crystal vP1` snapshot hash.
3. Exporter source hash + Arm C slice hash.
4. Arm D prose hash.
5. Task set + answer key hashes (contents sealed until adjudication).
6. MDE artifact (signed).
7. Judge config + rubric hashes.
8. Model string, sampling parameters, k, thresholds.
9. Both parties' predictions (§2).

Bundle hash published (IRL OS cartridge public URL and/or independent timestamping). **Post-freeze changes void the affected component and are logged, never silently applied.**

## 11. Data Publication

Upon completion: all rendered prompts, raw model outputs, judge outputs, selection logs (Arm B per-task slices), mutation-probe artifacts, and analysis scripts are published to the shared environment, hash-consistent with the bundle. Either party may republish in full. No results are quotable externally except against the published dataset.

**Publication is two-phase (CFS-042):**
- **Phase 1 — internally executed.** The Institute publishes the result set admin-gated through `POST /api/experiments/results` (receipted, `content_hash`-committed, DVN-anchorable, verifiable trustlessly against the frozen bundle). This is the deliverable that ships first; nothing about it depends on the external-submission path.
- **Phase 2 — passport-delegated external submission.** Austin's *agent* may submit its independently-run result set directly into constitutional memory through `POST /api/experiments/results/external`, under a **Polity Passport + bounded `DelegatedAuthority`**, authorized once by an **x409 Constitutional Agreement** the operator countersigns, and cohort/payment-tier gated. The submission carries `origin:'external'` + the agreement/agent commitments (T2-safe — no raw ids), is honestly labelled *independently submitted* vs *internally executed* (§13), and is verified by the identical hash-consistency check. Full charter: `foundation/CFS-042_external-result-submission.md`. Phase 2 does not replace Phase 1's admin door; it adds a second, bounded, revocable door beside it.

**Onboarding posture (operator direction, 2026-07-18): Austin adopts Phase 2 from the outset.** The **x409 agreement he signs to freeze this protocol (§15) is the same act that authorizes his agent's submission** — the pre-registration signature, the delegation grant, and the submission capability collapse into one constitutional handshake, bringing the partner into the constitutional operating model from day one rather than staging it behind a Phase-1 interval. This does not gate the timeline: the signature composes already-built primitives (form → agent-accept → operator-authorize) and happens at freeze; the submission *endpoint* is only exercised once runs complete (§13 window), so its build never blocks getting started (CFS-042 §9). The staged two-phase rollout still governs the wider IRL OS population.

## 12. Interpretation Table (agreed in advance; no post-hoc reframing)

| Outcome pattern | Agreed interpretation |
|---|---|
| B ≈ C (selection-neutral recall) | Confirms the by-construction prediction; no one cites this as evidence for or against anything beyond serialization equivalence. |
| B > C (selection-sensitive) at threshold | **Selection-under-intent is a real within-call mechanism.** The runtime's within-call value is established and localized to selection. |
| B ≈ C (selection-sensitive) | Within-call value lives entirely in representation + content; runtime value is lifecycle-only. Venture thesis reprices to governed knowledge lifecycle infrastructure — per IRL's own two-layer doctrine, pre-committed 2026-07-17. |
| C > D on derivation, C ≈ D on recall | **Reconstructability supported at current scale.** First evidence that invariant representation preserves generative structure. Strongest possible Phase 1 outcome for IRL's structural claim. |
| C ≈ D on derivation | Reconstructability unsupported at current scale (IRL's pre-agreed wording). Structural hypothesis moves to the companion experiment with a null prior from this probe. |
| C ≈ D overall and B ≈ C everywhere | Phase 1 value is content-only: excellent knowledge curation. Commercially real, differently priced. Companion experiment proceeds only with redefined mechanism claims. |
| Mutation: B eliminates stale conclusions with less breakage/cost than hand-edit | **Objecthood/locality demonstrated** — the lifecycle claim earns its first controlled evidence. |
| Mutation: hand-edit matches B | Update locality not yet differentiating at current crystal scale. |
| D ≈ A | Task set or judge is broken; halt and repair before reading anything else (instrument check). |

**Pre-registered domain limitation (inv.reasoning.349, agreed in advance — from the Austin review).** Phase 1 intentionally evaluates the runtime against the constitutional corpus from which it was derived (`Crystal vP1` = the platform's own doctrine collection). It is a validation of **internal coherence, not a claim of domain generality** — the task–collection affinity is by design (§3), and the maximally-friendly, self-referential domain is acknowledged as such. **No EXP-P1 outcome, however strong, may be read as evidence of domain-independent generalisation.** Domain-independent validation on a neutral-domain collection is explicitly sequenced as a distinct later phase (the EXP-P2 medicine-style framing shows the Institute can extract one). This limitation is pre-registered, not a post-hoc caveat.

**Interpretation freeze (inv.reasoning.346–348).** This table is the frozen interpretation of EXP-P1. Per the frozen-protocol discipline, an outcome's meaning is fixed here **before any result exists**; the experiment may generate new hypotheses but may not redefine its own success criteria after observation. Any new insight belongs to the *next* protocol, never this one.

## 13. Roles, Environment, Logistics

- **IRL:** frozen snapshot, exporter run, Arm B execution, MDE + trace artifacts, external environment access with independent-execution capability for Austin's side, judge-config support, held-out attestation.
- **Austin:** task set + answer keys, Arm D authoring/commissioning, judge config + rubric, independent judge run, adjudicator (one of two).
- **Environment:** IRL's offered external environment; Austin's side receives credentials sufficient to re-run any arm and the judge without IRL mediation. If independent re-run is not technically supported for any component, that component's results are labeled *internally executed* in all reporting.
- **Timeline target:** freeze within 7 days of sign-off; main runs within 14 days of freeze; mutation probe within 7 days after; joint results reading within 7 days after that. Slippage is fine; silent slippage is not — delays logged with reasons.

## 14. Companion Experiment Interface (IRL's structural brief → EXP-P2)

IRL's Layer 1 vs Layer 2 experiment (raw corpus vs expert summary vs invariant substrate at matched tokens — the medicine-style design) is welcomed as the next pre-registered study, **not** a Phase 1 addition. It is chartered as **EXP-P2** (`foundation/experiments/exp-p2-structural-invariance/`). To be accepted for joint execution its brief must contain the same skeleton: pre-registered predictions from both parties; matched token accounting (§9 rule); Austin-selected or jointly-sealed held-out tasks with pre-committed answer keys; recall/derivation split; blind external-specifiable judge; variance-banded statistics with pre-agreed thresholds; an interpretation table signed before any run; and full data publication. The critical additional control it must specify: **the invariant substrate must be extracted from the same corpus the raw arm uses**, by a documented procedure, so the comparison is representation-vs-representation and not corpus-vs-corpus.

## 15. Sign-Off

| Party | Name | Entity | Signature | Date |
|---|---|---|---|---|
| Reviewer | Austin Ambrozi | Autonomi Solutions LLC | ____________ | ____ |
| Institute | Dele Atanda | Invariant Research Lab / iQubes | ____________ | ____ |

*Upon both signatures: bundle assembled, hashed, published. The design is frozen. Everything after this is measurement.*

---

## Ratification record

- [x] REGISTERED 2026-07-17 as the joint pre-registration instance of EXP-010's frozen Phase-1 design (by operator direction).
- [ ] Predictions (§2) locked — both parties, before signature.
- [ ] Pre-registration bundle (§10) assembled + hashed + published to IRL OS.
- [ ] Joint signature (§15) — freeze.
- [ ] Runs executed; results published hash-consistent with the bundle.
