# Threshold 007 — Evidence-Resolution Pass (Read-Only)

**Status:** Read-only research/evidence record. Does not assess publication fitness, does not argue
for or against the thesis, and does not modify the manuscript, `content_publication_gates`,
`research_review_records`, `research_publication_records`, or any other publication-gate state.
Threshold 007.2 is already canonical (`researchCompanionStatus = "canonical"`,
`gate_status = "approved"`) — this record establishes factual substrate for a subsequent
Longitudinal Adversary review; it is not itself that review.

## A. Experiment Evidence Table — EXP-001 through EXP-006

| # | Title | Executed? | Date(s) | Protocol source | Manipulated | Measured | Design shape | Legitimate claims | What 007 cannot cite it for |
|---|---|---|---|---|---|---|---|---|---|
| **EXP-001** | The First Living KnowledgeQube | Yes — `evaluation-results-2026-07-04.json` | 2026-07-04 (commit `e01bed96`) | `exp-001-living-knowledgeqube/evaluation-protocol.md` | Artifact format (article/report/story/infographic/combined) rendered from one fixed 18-invariant collection | Rubric scores: consistency, explainability, hallucination, coherence (one judge model) | Cross-sectional — one evaluator, one timestamp, no repeated measurement | That one fixed invariant set rendered consistently/coherently across 4 static formats, judged once by a non-authoring model | H1b, H3d, H4, any temporal/consequence claim |
| **EXP-002** | Invariant-Carried Video | Yes — `run2-results-2026-07-05.json`; formal judge-protocol scoring explicitly not done | 2026-07-05 (commit `117455ee`, backfilled 2026-07-06) | README "Evaluation (extends EXP-001's protocol)" | 4 generated video segments; **control arm**: same 4-clip set stitched forward vs. reversed (DCBA) | Style/continuity persistence (operator qualitative judgment, not independent-evaluator rubric); for the control arm, narrative-coherence degradation under reversed ordering | See §B below — this is the one genuinely temporally-structured element across EXP-001–006, precisely characterized there | Directional operator-graded finding that reversing clip order degrades narrative coherence while preserving semantic/style content | H1b, H3d, H4; cannot be cited as formally/independently scored |
| **EXP-003** | Rediscovery Savings | Yes — `results-2026-07-04.json` | 2026-07-04 (commit `f0ba5c7d`) | README Method (CFS-008 §2); `scripts/benchmark-rediscovery.mjs` | Cold vs. initialized (invariant closure block prepended), same 5 tasks/model/temp=0 | Output tokens, grounded-claim share, canon contradictions, invariants cited | Cross-sectional within-subject A/B, one run | Directional signal (26.7% token reduction, 78.4%→100% grounded-claim share) from one model, one run, five tasks — README's own words: "a strong directional signal, not a universal constant" | H1b, H3d, H4; any claim of generality beyond this one run |
| **EXP-004** | The Sovereignty Drill (PSE-1) | Asserted "run complete" in README; **confirmed via live DB query**: 4 real rows in `experiment_results` (providers chaingpt/openai×2/openai, 2026-07-10 to 2026-07-14), all `approved_at = null` | 2026-07-10 to 2026-07-14 (DB `created_at`) | `services/experiments/exp004.ts` | Provider class (venice "sovereign" vs. rehearsal-arm openai/chaingpt) on same 5+1 task battery | Whether battery completes at all (binary constitutional pass/fail) vs. EXP-003's recorded numbers | Comparative provider-arm design against a static prior baseline — not time-series | That the instrument exists and was invoked four times | 007's manuscript does not cite EXP-004 at all (0 grep hits) — no current overreach to name |
| **EXP-005** | Provider-Choice Drill (PSE-2) | Update doc claims "two live runs"; **DB shows exactly 1 row** (2026-07-21), `approved_at = null` — a factual discrepancy, see §F | 2026-07-21 03:08:26 UTC (DB) | `services/experiments/exp005.ts` | Provider identity via deterministic rotation `taskIndex % n` across 5 tasks; judge = next provider in rotation | Five-class outcome taxonomy (completed/constitutionally_failed/provider_unavailable/timed_out/judge_failed) | Single-pass, deterministic cross-provider striping. No longitudinal or consequence-over-time instrumentation — confirmed via source AND the DB aggregates row | Actual DB result: `verdict: "constitutional_failure"`, `constitutionalPortability: "broken"`, 1/5 tasks contradicted | 007 does not cite EXP-005 — no current overreach, but the result itself is a **failure**, not a pass |
| **EXP-006** | Intent → Invariant Projection Fidelity → EXP-006A | Yes — DB shows 2 rows (both 2026-07-20), though README prose claims "three runs" | 2026-07-20 (README + DB) | `services/experiments/irlExp001.ts`, `cirs.ts`, `exp006Baselines.ts` | Sovereign-router prediction vs. random/keyword/semantic baseline arms | Precision/recall/F1 against an independently generated reference set (CIRS) | Cross-sectional; 2–3 successive one-shot instrument-refinement runs same day, not repeated measurement of one subject over time | Sovereign F1 0.284→0.408 across runs, exceeding random/keyword but not semantic baseline (semantic advantage itself diagnosed as "peeking at the answer key") | 007 does not cite EXP-006 — no current overreach |

## B. Longitudinal/Temporal Instrumentation Findings

**None of EXP-001–006 contain longitudinal instrumentation** in the strict sense of repeated
measurement of the same subject/system across elapsed real time to observe a consequence of an
intervening action.

**EXP-002's clip-sequencing control arm is the one genuinely temporally-structured element across
the whole set, and it deserves a more precise characterization than a flat "not longitudinal."**
Two distinct axes are in play, and they should not be collapsed into each other:

- **Longitudinal** (repeated-measures over elapsed real time — the same subject/system measured at
  multiple points to observe what changed as a consequence of something that happened in between).
  EXP-002 does not do this: the forward and reversed cuts of the same fixed footage were both
  produced from pre-existing material and viewed once each, in one session.
- **Temporally-sequenced / order-sensitive** (the variable under test *is* an ordering or sequence
  relationship, examined once, rather than requiring elapsed real time or repeated sessions to
  exist as a meaningful test). EXP-002's control arm squarely occupies this axis: it holds the
  clip set fixed and varies **sequencing** (forward vs. reversed order), then measures whether
  narrative coherence depends on that ordering. Time-as-a-research-domain does not require
  linearity or repeated real-time sampling to be genuinely under test — a single, well-constructed
  comparison of two orderings of the same material is a legitimate (if narrow, single-run,
  operator-graded) test of a temporal/sequential relationship between segments.

So the accurate statement is: **EXP-002 contains real, if narrow, temporal-sequencing
instrumentation (order-dependence of coherence) — it does not contain longitudinal instrumentation
(repeated measurement over elapsed time), and the two should not be conflated in either direction.**
Neither this correction, nor the original finding, changes the conclusion that **none of EXP-001–006
measures a consequence unfolding over elapsed real time**, which remains the load-bearing fact for
the Longitudinal Adversary's actual question.

EXP-005 and EXP-006, checked with the same scrutiny: EXP-005 is a single deterministic
provider-rotation pass (each task answered/judged exactly once; its lone time-adjacent feature is a
same-provider retry-on-error, which is failure recovery, not measurement design). EXP-006 is 2–3
same-day one-shot re-scorings of a static reference set with instrument refinements between runs,
not repeated measurement of one subject's state over time. Neither contains temporal-sequencing
instrumentation of the kind EXP-002's control arm does, let alone longitudinal instrumentation.

## C. Risk / Proof-of-Risk / Risk-of-Repair Provenance

- **Proof of Risk**: two distinct constructs share the name. (1) `CFS-052_evidence-architecture-and-dual-validation.md:148-155` lists "Proof of Risk Reduction" as constitutional vocabulary explicitly self-declared "no implementation." (2) A narrower, actually-implemented `ProofOfRisk` type exists (`types/invariantEnvelope.ts:394-416`, constructor `services/devCommandCenter/implementationContext.ts:41-79`) — "a claim about relevance to this intent... not a second risk model." These must not be conflated.
- **Risk of Repair (RoR)**: canonical formula (`CFS-056...md:57-76`) is explicitly "a methodological target, not a claim that RoR already ha[s] a universally calibrated scalar form." Real code uses RoR as a discovery-ordering bearing (`bearingDiscovery.ts`) and a real jsonb evidence column exists (`golden_cycle_records.risk_cycle`) — but no frozen/validated numeric RoR formula exists anywhere.
- **Lehigh**: a real, named, SHA-256-hashed artifact set (Lehigh GBUS 485 coursework), documented and reproduced into production TypeScript (`riskCalibration.ts`, `riskField.ts`). Explicitly labeled "a calibration hypothesis... MUST NOT be treated as proof that frequency equals causal importance" (`CFS-056A...md:52-54`). **Now independently strengthened** by direct primary-source verification of the underlying spreadsheets/notebooks — see `2026-09-13_lehigh-risk-calibration-primary-source-verification.md` and the corpus at `codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/`.
- **Actuarial/insurance methodology**: found only as rhetorical/aspirational framing with explicit self-disclaimers ("the pilot does not establish... actuarial-grade calibration"). Not evidenced as real methodology or data anywhere in this repo.

## D. Consequence Horizon Measurement Substrate Assessment

Threshold 007's own text states, verbatim: "None of EXP-P1–P4 can currently measure
`CH_Invariant > CH_Baseline`." Its own evidence table classifies the H1b CH metric as "Hypothesized
/ not yet registered or executed," "Newly proposed in 007." Zero hits anywhere in
`codexes/packs/irl/foundation/experiments/` for "Consequence Horizon"; no `CH_Invariant`,
`CH_Baseline`, or `CH_ComputeMatchedBaseline` field exists in any code/schema.

Adjacent-but-distinct real instrumentation exists (`unifiedConsequenceProjection.ts` — a shipped,
per-action ACCEPTABLE/UNACCEPTABLE/UNRESOLVED consequence-projection gate; RoR discovery-ordering;
`golden_cycle_records.risk_cycle`) — none has any depth/breadth/temporal-distance/causal-distance
field.

**Most precise formulation:** there is a partial, adjacent consequence/risk substrate (single-action
consequence acceptability, risk-of-repair discovery ordering), but no instrument — partial or
otherwise — measures Consequence Horizon itself, and 007's own H1b metric is hypothesized, not
registered, and self-declared currently unmeasurable by any existing experiment.

## E. Standing vs. Reputation Evidence Record

| Claim | Verdict | Key citation |
|---|---|---|
| Reputation is identity-bound | Supported | `personhood-identity-standing-reputation.md:52,56` (ratified 2026-08-16) |
| Standing is personhood-bound | Supported | Same doc:54; `inv.polity.315` (canonical) |
| Standing accrues from action/evidence, not popularity | Supported, with a disambiguation flag | `inv.polity.162` (canonical); real code: `standingSignalService.ts`, `standingAccrualService.ts`. Caution: `lifecycle.ts::computeStandingScore()` computes a *different* "Standing" (an invariant's own confidence score) — do not conflate. |
| Standing has protections/continuity Reputation lacks | Partially supported | Continuity/non-transferability: yes. "Cannot be arbitrarily revoked": not found — `inv.polity.169` (canonical) states agent-held Standing rights are explicitly "revocable." |
| Standing and Reputation are separate signals, not aliases | Supported | `agentManifest.ts:22` distinctions array; ratified Canon II: "different outputs... Reputation does not mechanically convert into Standing." |

Caveat: the specific invariant-registry rows (`inv.constitutional.012/013/018/066`) code cites for
this distinction are recorded `status: "proposed"`, not `"canonical"` — even though the substance is
separately ratified via Canon II (2026-08-16) and the Standing Charter (ratified 2026-06-17).

## F. Corrections to the Longitudinal Adversary's Prior Factual Premises

1. **EXP-005 "two live runs" does not match the database** — the update doc asserts two runs; the live `experiment_results` table contains exactly one EXP-005 row.
2. **That one EXP-005 row's actual verdict is `constitutional_failure`** — a negative result, not a pass.
3. **EXP-006 "three runs" (README) vs. two DB rows** — a third run, if it occurred, is not present as a distinct DB record found in this pass.
4. **None of EXP-004/005/006 is cited anywhere in Threshold 007's manuscript** — any adversary premise assuming otherwise is incorrect; conversely, the manuscript's own evidence register is incomplete relative to what exists in `services/experiments/` and the database.
5. **All six EXP-004/005/006 database rows have `approved_at = null`** — none has passed through this table's own approval workflow.
6. **On Consequence Horizon**: any premise assuming CH is measured by any existing experiment (including EXP-P1 or EXP-001–006) is incorrect — the manuscript itself disclaims this.
7. **On Standing/Reputation**: any premise asserting Standing is unconditionally non-revocable is incorrect for agent/participant-held Standing specifically (`inv.polity.169`), though it holds for person-level Standing continuity.
8. **On EXP-002's sequencing control arm** (added 2026-09-13, per operator correction): do not read the original "not longitudinal" finding as "not temporal at all." EXP-002 contains genuine order-sensitivity/temporal-sequencing instrumentation (§B) — it simply does not contain longitudinal (repeated-measures-over-elapsed-time) instrumentation. Both halves of that distinction are load-bearing for an adversary review and should be stated together, not one without the other.

## G. Evidence Receipt

**Primary sources**: `codexes/packs/irl/foundation/experiments/exp-00{1,2,3}-*/README.md` + result JSONs; `services/experiments/exp00{4,5,6}.ts`, `irlExp001.ts`, `cirs.ts`, `exp006Baselines.ts`; commits `e01bed96`, `117455ee`, `f0ba5c7d`, `5a515890c`/`5db7c45dc`/`d9d63b031`, `7dce73d80`, `1f888d0cf`/`9d9d0fdb2`; `docs/qriptopian/thresholds/007-research-edition.md` (lines 1006, 1018-1020, 1601, 1712-1726, 1723); `CFS-052`, `CFS-056`, `CFS-056A`, `CFS-056B`; `services/constitutionalCommerce/unifiedConsequenceProjection.ts`, `services/consequence/stages.ts`, `services/devCommandCenter/bearingDiscovery.ts`; `docs/vela/accelerator/constitutional-financial-services/01_CONSTITUTIONAL_YIELD_AND_RISK_THESIS_v0.2.md`; `codexes/packs/polity-core/constitutional-records/personhood-identity-standing-reputation.md`; `codexes/packs/polity-core/items/STANDING_CHARTER.md`; `canonical-invariants.seed.json` (`inv.polity.162`, `.169`, `.315`; `inv.constitutional.012/013/018/066`); `services/threshold/agentManifest.ts:22`, `services/threshold/irlAdapter.ts:78-83,130-139`.

**Database**: `experiment_results` table, project `bsjhfvctmduxhohtllly` — 4 EXP-004 rows, 1 EXP-005 row (verdict `constitutional_failure`), 2 EXP-006 rows — queried live, read-only, 2026-09-13.

**Unresolved gaps, disclosed rather than guessed**: EXP-004/006 result content beyond the `aggregates` column was not fully pulled. No content hash / commit-pinning was independently re-verified for the CFS-05x doctrine docs beyond their own stated dates. Whether a "third" EXP-006 run's numbers exist under a different table/column was not exhaustively ruled out.
