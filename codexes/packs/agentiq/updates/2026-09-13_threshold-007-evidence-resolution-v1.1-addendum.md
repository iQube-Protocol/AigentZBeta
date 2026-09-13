# Threshold 007 — Evidence-Resolution Pass v1.1 Addendum (Read-Only)

**Record type:** Read-only evidence-resolution addendum. Does **not** modify Threshold 007.2, `content_publication_gates`, `research_review_records`, `research_publication_records`, any experiment record, or any database state. This document extends `2026-09-13_threshold-007-evidence-resolution-pass.md` ("v1.0") without overwriting it — v1.0's findings are preserved below except where explicitly superseded, in which case the supersession is stated and reasoned, not silently applied.

**Role:** Evidence Agent. Not Aletheon, not the Longitudinal Adversary, not the ARR reviewer, not the Publication Gate, not an advocate for Threshold 007. This document establishes what exists, what it measures, its provenance, and what relationships between artifacts are supported by primary evidence. It does not argue the thesis is proven or unproven.

**Canonical boundary:** Threshold 007.2 is canonical and treated as immutable for this task. Nothing below edits the manuscript. Where new evidence would justify a future manuscript clarification, it is flagged as **FUTURE-EDITION CANDIDATE**, not applied.

**Method:** This addendum is built from a dedicated read-only research sweep conducted 2026-09-13 across the whole repository (grep + full-file reads of `services/invariants/riskField.ts`, `services/venture/ventureOutcomeAccrual.ts`, `services/factor/*`, `services/horizen/*`, `services/vela/*`, `services/crm/standingAccrualService.ts`, `services/receipts/activityReceiptService.ts`, `services/dvn/activityReceiptDvnPipeline.ts`, relevant CFS docs, the Vela accelerator doctrine set, and the Lehigh corpus files already committed under `codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/`), plus re-reads of `2026-09-13_threshold-007-evidence-resolution-pass.md` and `2026-09-13_lehigh-risk-calibration-primary-source-verification.md` (including its Dhrunal Belani addendum). File:line citations are given wherever the underlying sweep produced them.

---

## A. Updated Lehigh Risk / Value / Price Lineage

Reconstructed chronologically/conceptually from primary evidence. Phases J and K are not populated — no primary evidence supports them; see below.

| Phase | Artifact | Methodology / inputs / outputs | Executable? | Empirical basis | Calibration status | Validation status | Relation to preceding | Relation to 007 concepts |
|---|---|---|---|---|---|---|---|---|
| **A — Risk taxonomy** | `original_risk_matrix_amit_patil.py` (22 dims); Dhrunal Belani report (32 dims, independent elaboration) | Hand-authored dimension list (Reputation, Compliance, Legal, Strategic, Environmental, etc.) | Yes (raw dict + exploratory code) | Author-authored taxonomy, not derived from data | None (taxonomy is definitional) | N/A | Two independently-elaborated taxonomies, not one extending the other | Antecedent to all later risk scoring |
| **B — Expert-labelled risk data** | `Book4.xlsx` Sheet8 (105 data types × 19–23 dims, High/Medium/Low) — **pending upload, not re-verifiable this pass**; Belani report's Delphi panel (Kendall's W 0.470→0.749→0.855) | One hand-labelled spreadsheet; one small Delphi expert panel | N/A (data, not code) | One panel, one spreadsheet each | Frequency-weighted labels | Not validated against outcomes | Feeds Phase C | Primary-source substrate for "Lehigh calibration hypothesis" |
| **C — Risk weight derivation** | `metatMe_DataRisk.ipynb`, `Test_metatMe_DataRisk_1.ipynb` | `score = High×3 + Medium×2 + Low×1`, normalized to mean 1.0 | Yes, executed | Real executed run against Book4.xlsx | Calibrated to one panel | Not independently validated | Direct successor to A/B | Ancestor of `services/invariants/riskCalibration.ts`'s `derivePrevalenceWeights()` (confirmed reproduction of this exact formula) |
| **D — Executable risk scoring** | Same notebooks; 8 named iQube bundles (Open Bank Account, New Credit Card, Mortgage, Car Finance, Student Loan, Investment, Retirement Plan, Debt Management) | Weighted sum per bundle | Yes, executed with real output (Investment Qube: 60.90% unweighted vs. 67.54% weighted, crossing Medium→High) | Real single execution | Same as C | Not validated | Direct successor to C | This is the concrete example cited by prior evidence passes |
| **E — Temporal risk modeling** | Data Risk for Marketplaces v2.0 report (pending upload); Belani report's context-transition multipliers and decay models | Half-life/decay-growth of an *assessed risk score* over time | Formulas only (not re-verifiable this pass — dense PDF) | None found | None | None | Extends C/D with a time axis | **Concerns evolution of a risk score, not the temporal/causal projection of consequences** — this is not Consequence Horizon substrate (see v1.0 §D, reaffirmed below) |
| **F — Risk of Repair** | `services/invariants/riskField.ts`; `CFS-056` doctrine | See §B below | Yes (typed structures, discovery-ordering functions) | Unit-tested, not outcome-tested | Explicitly uncalibrated by its own module header | Not validated | Independent construct — **not demonstrated to descend from the Lehigh corpus at all**; the corpus and RoR share no common code path in this sweep | See §B |
| **G — Value modeling** | `value_engine.py` | `ValueEngineB`/`ValueConvergenceEngine`: per-dimension seller/buyer value scores from risk weights, temporal aging + risk-inversion, bilateral value-convergence score | Formulas present; imports an unsupplied `risk_engine` module, so it does not run standalone | None (no outcome data, no backtest — confirmed via targeted search of the file for backtest/validate/observed/ground-truth terms) | None | None | Builds on C's weights | Genuine risk→value linkage **at the level of formula/model, not calibration/validation** |
| **H — Price modeling** | Belani report's three pricing formulas; a PoTS-referencing formula crediting "Dele Atanda" (per prior addendum) | Not independently re-derivable this pass (dense PDF, not re-read) | Formulas only | None found | None | None | Builds on G conceptually per the report's own framing | This is the **only place** in the corpus that names PoTS explicitly — see §H below on why this does not import PoTS's canonical status |
| **I — Risk/Value/Price integration** | `value_engine.py` (risk→value) + Belani pricing formulas (value/risk→price, by report framing only) | See G, H | Partial (G) / no (H, not independently executable here) | None | None | None | A genuine attempted integration exists in formula form | Distinct from, and not evidence for, the later Golden Cycle's Information→TTV→Value→Price→Money→Information cycle (see §I below) |
| **J — Time-to-Value relationship** | — | — | — | — | — | — | — | **No primary evidence found in this corpus.** The corpus's "temporal" content is risk-score decay (Phase E), not Time-to-Value. Not populated. |
| **K — Consequence relationship** | — | — | — | — | — | — | — | **No primary evidence found in this corpus.** Not populated. |

**Continuity assessment (per the instruction not to infer continuity from shared authorship):** Phases A→D form one demonstrable, code-evidenced lineage (same data, same notebooks, same formula reproduced downstream in `riskCalibration.ts`). Phase E is a plausible, but not independently re-verified this pass, extension (dense PDFs not re-read). Phases G/H are **a separate, later research thread** that reuses Phase C/D's *weights* as an input but introduces new constructs (value convergence, pricing) with no executable validation. Phase F (RoR as implemented in `riskField.ts`) is **not shown to descend from this corpus at all** — it is a structurally similar idea (risk vectors, severity/reversibility) but a distinct codebase construct with no shared file, import, or explicit cross-reference found. Treating F as "the same lineage" as A–D would be an unsupported inference; this addendum does not make it.

---

## B. Risk of Repair (RoR) Maturity Update

Per the requested 13-point ladder, using ABSENT / CONCEPTUAL / IMPLEMENTED / INSTRUMENTED / EXPERIMENTALLY EXERCISED / CALIBRATED / VALIDATED:

| # | Dimension | Status | Evidence |
|---|---|---|---|
| 1 | Concept | IMPLEMENTED (as doctrine) | `CFS-056_risk-field-invariant-discovery-and-crystal-vp2.md:57-76`, formula `RoR(I*, X) ≤ acceptable RoR`, self-disclosed as "methodological targets, not claims that TTV or RoR already have universally calibrated scalar forms" (line 76) |
| 2 | Definition | IMPLEMENTED | `services/invariants/riskField.ts` — `IntentRiskVector` (severity/likelihood/detectability/reversibility/repairCost/blastRadius/timeToConsequence) |
| 3 | Taxonomy | IMPLEMENTED | Same file — `RepairPath` (causalPrecursors/detectionConditions/containmentConditions/reversalConditions/irreversibleConditions) |
| 4 | Computational representation | IMPLEMENTED | `discoveryBearing()`, `convergeDiscoveryBearings()`, `selectMaterialRiskVectors()`, `researchRiskAdjustedValue()` — real functions, clamping/weighted-sum logic; module header states callers must supply calibrated thresholds/weights |
| 5 | Ordering/prioritization use | IMPLEMENTED | `services/devCommandCenter/bearingDiscovery.ts:10,242` — RoR explicitly framed as "a BEARING USED TO BROADEN DISCOVERY, not a report" |
| 6 | Data capture | INSTRUMENTED (partial) | `services/factor/standingProposal.ts:37,49,70` → `risk_of_repair_evidence_refs jsonb` column (`supabase/migrations/20260930190000_factor_aegis_constitution_reconciled.sql:383,397`); `golden_cycle_records.risk_cycle jsonb` (`supabase/migrations/20260912195402_golden_cycle_evidence_records.sql:70-71`) — schema exists, **no writer code found** for the Golden Cycle table |
| 7 | Quantitative scoring | ABSENT (as a used, activated score) | `services/invariants/taskScopedSelection.ts:88,251,403` — `riskOfRepairEstimate` is always `null` by explicit design, a "named no-op… RESERVED for a future ratified model"; ten tests assert it stays `null` |
| 8 | Temporal measurement | ABSENT | No time-series RoR measurement found anywhere |
| 9 | Repair-burden attribution | IMPLEMENTED (type only) / ABSENT (persistence) | `RepairPath` type exists; no found DB table or writer persists it |
| 10 | Observed repair | ABSENT | No rows, no code recording an actual repair event tied to a prior risk claim |
| 11 | Predicted-vs-observed repair | ABSENT | No comparison mechanism found |
| 12 | Empirical calibration | ABSENT | Confirmed: no frozen/validated numeric RoR formula exists anywhere (re-verified, matches v1.0 §C finding) |
| 13 | Causal validation | ABSENT | No causal test of RoR against real outcomes found |

**One partially-operationalized exception**, newly and precisely identified this pass: `services/venture/ventureOutcomeAccrual.ts`'s `netValueAccelerationHours()` computes `max(0, timeSavedHours − riskRepairHours)` — a real, coded subtraction of a caller-supplied `riskRepairHours` value from a time-saved figure, feeding the Standing keystone. This is **the one place in the codebase where a repair-burden number mechanically reduces a PoTS-family measurement.** It is not the `riskField.ts` RoR construct (no shared code path), and `riskRepairHours` itself is a caller-supplied raw number with no calibration behind it — so this remains **INSTRUMENTED, not CALIBRATED or VALIDATED**, but it is a materially more concrete finding than v1.0 reported (v1.0 found RoR "doctrine and implementation substrate" without identifying this specific operational conditioning point).

**RoR maturity summary, unchanged in ceiling from v1.0, refined in detail:** doctrine → typed structures → discovery-ordering use → partial data-capture schema, **stopping there**. No calibrated scalar, no experimentally-exercised scoring run against real repair outcomes, no causal validation.

---

## C. PoTS / Time-to-Value Evidence Status

**This is the single most materially strengthened finding of this addendum relative to v1.0**, which had not isolated PoTS as its own line item.

- **Definition (doctrine):** Four-term stack, `PoTS = Baseline Time − Actual Time − Repair Burden − Risk Burden, after validity clears` (`codexes/packs/polity-core/items/commentary/coyn-thesis/03-proof-of-time-saved.md:191,200`; canonized as `inv.polity.161`/`inv.polity.198`).
- **Implementation:** `services/venture/ventureOutcomeAccrual.ts` — `netValueAccelerationHours()` and `claimContributionScore()`, a real two-term code reduction of the four-term doctrine formula. **IMPLEMENTED.**
- **Instrumentation:** `app/api/venture/qubes/[ventureId]/verify-outcome/route.ts` — a real, admin-gated (`persona.cartridgeFlags.isAdmin`) POST route moving a `ProofOfOutcomeClaim` from `claimed`→`verified`/`rejected`, calling `accrueVentureOutcomes()`, which sweeps unaccrued verified claims and calls `accrueStanding()` (the real Standing keystone). Idempotent via `claim.accruedAt`. **INSTRUMENTED / OPERATIONAL machinery.**
- **Storage shape:** `ProofOfOutcomeClaim[]` as JSONB inside `venture_qubes.layers.outcome.proofOfOutcomeClaims` (`types/ventureQube.ts:718-750`) — not a dedicated relational table.
- **RoR conditioning:** **Confirmed, not assumed** — `riskRepairHours` is subtracted before Standing credit. This is the concrete answer to the v1.0 open question of whether PoTS is "explicitly conditioned by Risk of Repair anywhere."
- **Vela/Horizon KPI status:** cited as the resolved implementation of "PoTS/Net Value Acceleration" in `codexes/packs/agentiq/updates/2026-09-12_threshold-007-aletheon-draft-citation-hardening.md:34` and `2026-09-12_threshold-007-mandatory-lineage-anchors.md:18,40`, within a "Golden Cycle → PoTS/RoR → Horizen Consequential Environment" lineage description. No separate KPI dashboard was found calling this code outside the one API route.
- **Time-to-Value connection:** explicit, doctrinal and code-level: `types/resolutionRecords.ts:376-380` states the three-layer relationship (public mental model = Time-to-Value; internal metric = PoTS; constitutional principle = Net Value Acceleration = Time-to-Value minus Risk Repair Burden) and `netValueAccelerationHours` is literally that subtraction in code.
- **Observed data:** **UNKNOWN from static code** — this session had no live database read access, so whether any real claims have actually been verified/accrued in production could not be confirmed or denied. This is an evidence gap, not a code gap, and should be stated as such rather than assumed either way.

**Status:** CONCEPTUAL (doctrine, well-elaborated) → IMPLEMENTED (code) → INSTRUMENTED/OPERATIONAL (gated route wired to Standing) → OBSERVED status **UNRESOLVED** (no DB access this pass).

---

## D. Vela / Horizon KPI and Measurement Status

**Critical disambiguation surfaced this pass, absent from v1.0:** "Vela" names two unrelated things in this codebase, and conflating them would misstate maturity in either direction:

1. **Vela the TEE/confidential-compute protocol** (`services/vela/velaTypes.ts`, `velaClientAdapter.ts`, `velaProjectionProvider.ts`, `velaFactorProvider.ts`) — real wire-format types, real ECDH→HKDF-SHA256→AES-256-GCM crypto documented against an external pinned protocol, real scripts (`scripts/vela-slice2g-live-proof.ts`, `vela-slice2e-live-composition.ts`, `vela-slice2b-live-projection.ts`) suggesting actual deployed on-chain interaction. → **IMPLEMENTED, apparently OPERATIONAL** for the compute-protocol capability itself. This is infrastructure plumbing unrelated to the financial-accelerator doctrine below.
2. **"Vela accelerator" doctrine** (`docs/vela/accelerator/constitutional-financial-services/*`) — the Golden Cycle/Constitutional Yield/MoneyPenny disclosure/Use Case Zero material. Self-disclosed: *"These are positioning hypotheses, not validated demand or promised returns. The baseline is synthetic and unilateral… A named insurer, family office or Horizen client is not assumed committed"* (`07_CONSTITUTIONAL_RISK_MARKETS_VENTURE_INCUBATION_v0.1.md:148`). → **CONCEPTUAL/PROPOSED.**
3. **Horizen** (agent registration, Pulse, P&L onboarding — `services/horizen/*`, `app/api/journey/moneypenny-horizen/*`) — a **third, genuinely operational surface**, distinct from both: real named-partner integration (John Camardo, CTO, Horizen Labs, per a documented 2026-07-28 operator ruling), real ceremony/reconciliation code. Pulse health-check specifically: `resolvePulseEndpoint()` resolves to `null` for every agent today because no Agent Card has yet declared a runtime descriptor — its own code comment says so, and the verify route fails closed (`NO_RUNTIME_ENDPOINT`) rather than guessing. → **IMPLEMENTED/TELEMETRY-CAPABLE, not yet OBSERVED** for Pulse specifically.

| KPI/concept | Status | Evidence |
|---|---|---|
| Pulse | IMPLEMENTED / TELEMETRY-CAPABLE, not OBSERVED | `services/horizen/pulseEndpoint.ts` — resolves `null` today by design |
| P&L | IMPLEMENTED (onboarding/verification plumbing) | `services/horizen/pnlOnboardingClient.ts`, `pnlServiceVerification.ts`, `pnlVerificationBoundary.ts` — identity/verification code, not a TTV computation |
| Time-to-Value | CONCEPTUAL (as a Vela/Horizon-specific measurement); IMPLEMENTED (as the PoTS/NVA proxy above) | No dedicated Vela/Horizon TTV computation found beyond the PoTS route |
| Risk of Repair | ABSENT (as a dedicated Vela/Horizon KPI) | No RoR-specific surfacing found in `services/vela/` or `services/horizen/`; only the generic Factor evidence-refs presence-gate |
| PoTS | IMPLEMENTED / INSTRUMENTED | Section C above |
| Standing | OPERATIONAL | `services/crm/standingAccrualService.ts` — mature, real accrual, wired from the PoTS route |
| Golden Cycle records | IMPLEMENTED (schema only) | Section E below |
| Factor | IMPLEMENTED, substantially OPERATIONAL | `services/factor/authorityChain.ts` — real, reconciled delegation-chain implementation backed by real tables |

---

## E. Golden Cycle Status Update

No standalone "Golden Cycle" thesis document exists — confirmed by a prior pass (`2026-09-12_threshold-007-golden-cycle-thesis-resolved.md`) and re-confirmed here: the label names this repo's P1→P2→P3→P4 EXP programme, per `docs/vela/accelerator/constitutional-financial-services/README.md:56,60`, which itself states records remain "operational / hypothesis-generating… unless and until separately registered under the scientific programme."

The cycle's actual proposed form in the doctrine (`01_CONSTITUTIONAL_YIELD_AND_RISK_THESIS_v0.2.md:10-14,128`): *Information → Consequence → Risk of Repair → Risk Price → Coverage/Settlement → Observed Outcome → Information*, governed by "useful time may be returned to a principal only without exporting risk of repair" — a variant framing of, not textually identical to, the Information→TTV→Value→Price→Money→Information cycle referenced in the task instructions; both share the same governing constraint (time compression must not export unacceptable repair exposure).

**Evidence table:** `golden_cycle_records` (`supabase/migrations/20260912195402_golden_cycle_evidence_records.sql`) is real, with `risk_cycle jsonb` (the RoR-carrying column) and an explicit `evidence_status` enum (`doctrine, planned, implemented, operational_hypothesis_generating, controlled_research_evidence, demonstrated`), and a header stating this is "an evidence SUBSTRATE, not scientific validation." → **IMPLEMENTED at schema level.**

**No writer code exists.** A repo-wide search for `golden_cycle_records` in `.ts`/`.tsx` returned zero hits outside the migration file. → **data-capture layer is ABSENT; no observed rows.**

**Status, unchanged in substance from v1.0 but now schema-precise:** CONCEPTUAL (thesis) → IMPLEMENTED (schema) → **no instrumentation, no observed data.**

---

## F. Venture Lab vs. IRL Epistemic Roles

The evidence supports treating these as distinct epistemic roles, consistent with the task's proposed framing, though this remains an **architectural/methodological proposition supported by implementation**, not a scientifically validated law:

- **Venture Lab / pilot** (Vela-accelerator doctrine, Horizen partner integration, Factor authority chains, venture-outcome PoTS accrual) exhibits real consequential exposure and operational observation machinery: gated verify/accrue routes, real Standing consequences, real partner-named integrations, real authority/delegation/revocation code.
- **IRL / controlled research** (the CFS-0xx experiment registry, EXP-001–006, the ARR gate apparatus) exhibits invariant isolation, controlled comparison, and falsification-oriented protocol design (per v1.0's earlier findings, reaffirmed and not re-litigated here).

Both are real and implemented in this codebase; nothing in this sweep collapses the distinction or shows one subsuming the other.

---

## G. Pilot vs. Experiment Distinction

The task's proposed formulation — "Experimentation isolates a relationship. Piloting exposes it to reality." — is **not contradicted** by anything found this pass, and the codebase does implement mechanisms consistent with each half (isolated/controlled testing infrastructure for IRL; consequential, partner-facing, gated-accrual infrastructure for Venture Lab/Horizen). This is recorded per the task's own instruction as an **ARCHITECTURAL / METHODOLOGICAL PROPOSITION SUPPORTED BY IMPLEMENTATION**, explicitly **not** a scientifically validated law — no experiment in this codebase tests the proposition itself.

---

## H. Risk of Repair → Consequence-Horizon Substrate Relationship

Per the task's explicit instruction not to test straw-man versions of this claim (RoR ≠ Consequence Horizon; risk-score decay ≠ Consequence Horizon), the actual candidate relationship investigated is:

**Consequence Horizon × Calibration × Reversibility × Risk of Repair → Constitutional Action Boundary**

Component-by-component status:

| Component | Doctrine | Implementation | Instrumentation | Observations | Experimental evidence |
|---|---|---|---|---|---|
| Consequence Horizon | Yes (Threshold 007 itself, H1b) | No | No | No | No — self-disclosed unmeasured |
| Calibration/uncertainty at a horizon | Partial (general calibration language exists in CFS docs) | No horizon-indexed calibration found | No | No | No |
| Risk of Repair | Yes (`CFS-056`) | Yes (`riskField.ts`, §B above) | Partial (evidence-refs gate) | No | No |
| Reversibility | Yes, as a field on `IntentRiskVector`/`RepairPath` | Yes (typed) | No persistence found | No | No |
| Constitutional Action Boundary | Yes (Threshold 005/006 "Effective Capability" framing, §I below) | No (dichotomy itself uncoded) | No | No | No |

**No component of this candidate relationship has moved past CONCEPTUAL/IMPLEMENTED-in-isolation.** RoR is the most concrete of the five (real types, real discovery-ordering use), but nothing found this pass wires RoR into a horizon-indexed or action-boundary computation. This preserves v1.0's finding and sharpens it: RoR is a plausible **candidate contributing variable** for a future Consequence Horizon / action-boundary model, not evidence that such a model exists.

---

## I. Venture Lab as Potential Operational Consequence-Horizon Environment

Distinguishing, per the task's instruction, **operational CH environment** (real consequential exposure exists) from **CH instrument** (something actually measures horizon-indexed uncertainty/reach) from **CH scientific evidence** (a validated result):

- **Operational CH environment:** partially supported. Real consequential machinery exists — verified claims produce real Standing changes (`accrueStanding`), real DVN-anchored receipts exist for a restricted allowlist of consequential action types (`ANCHORABLE_ACTION_TYPES`, `services/dvn/activityReceiptDvnPipeline.ts:50-67`), and real partner-facing Horizen integration exists. This is genuine exposure to real, if currently modest-scale, consequence.
- **CH instrument:** **ABSENT.** Nothing in the Venture Lab/Horizen/Factor code computes a horizon-indexed quantity (how far into the future/causal-distance a claim is being made) — every mechanism found operates on a single time-of-claim / time-of-verification pair, not a horizon.
- **CH scientific evidence:** **ABSENT**, consistent with §F/H above and v1.0.

**Finding:** it is possible, and appears to be the case here, for an operational consequence environment to exist before either an instrument or scientific evidence for Consequence Horizon exists. This addendum records that as the current state, not as evidence that CH itself has been measured.

---

## J. Raw vs. Effective Capability Implementation Relationship

The dichotomy (Threshold 006, `006-reading-edition.md:121-127`; echoed in `007-research-edition.md:375-379,870,884,1010`) is doctrine, explicitly self-qualified elsewhere as hypothesis (`ocsg-constitutional-agentic-network-experiment-proposal.md:82`: "a hypothesis, but not yet an empirical equation").

**No code implements or labels "Raw Capability"/"Effective Capability" as such.** A **false-friend finding**, new this pass: `services/crm/standingAccrualService.ts:507,560` computes a "Raw Capability Standing score" — but this is the raw (unrounded) output of the unrelated Capability-Standing ledger lane's own formula (`capability-standing/v1.1`), not an instance of the Threshold 006 dichotomy. **This must not be cited as implementation evidence for Raw/Effective Capability** — it is a naming coincidence.

What genuinely is implemented, and instantiates the *underlying idea* (capability bounded by authority/trust) without using this vocabulary:
- `services/access/evaluateAccess.ts` — real access gating composing persona context, content descriptors, ownership, and cartridge-flag credentials.
- `services/factor/authorityChain.ts` — real direct-vs.-mediated delegation chains with explicit revocation state.
- `services/delegation/delegationGrantStore.ts` — the canonical bounded-delegation ledger.
- `standingAccrualService.ts` — real trust/Standing accrual.

**Relationship recorded:** implementation relationship only (these mechanisms instantiate the *spirit* of capability-bounded-by-trust), **not** scientific validation of the Raw×Trust→Effective Capability conceptual model, per the task's explicit instruction.

---

## K. Longitudinal Telemetry Readiness

The t0→t5 chain (intervention → immediate outcome → value/price consequence → downstream consequence → repair/reversal → standing/authority change) is real in **two disconnected segments**, with no single ID unifying them:

| Transition | Schema | Real writer | Cross-linked to neighbors |
|---|---|---|---|
| t0 intent→action | Yes (`activity_receipts`, `intentId`/`parentIntentId`/`rootIntentId`) | Yes | Yes (parent/root intentId) |
| t1 action→DVN/anchor | Yes (`receiptStatus`, `dvnReceiptId`, `posStatus`, `btcAnchorTxid`) | Yes, gated | Yes (same row) |
| t2 value/price consequence | Partial (`venture_qubes.layers.outcome.proofOfOutcomeClaims` JSONB) | Yes | **No** FK to t0/t1 |
| t3 downstream consequence | Type only (`RepairPath`) | **No** | N/A |
| t4 repair/reversal | Type only (`RepairPath`) | **No** | N/A |
| t5 standing/authority change | Yes (`accrueStanding`) | Yes | Linked to t2 only, not t0/t1 |

**Finding:** the platform can trace t0→t1 (intent to anchored receipt) and, separately, t2→t5 (a verified value claim to a Standing delta) — but **no code path or shared identifier links an anchored activity receipt to the venture-outcome claim it may have caused**, and t3/t4 exist only as an unwired type definition with no persistence layer. This is a genuine **infrastructure gap**, not a recordability question already answered "yes": constructing the full six-stage chain would require new instrumentation (a shared ID between `activity_receipts` and `venture_qubes` claims at minimum, plus a persisted `RepairPath` writer).

---

## L. Corrections to the Previous Evidence Pass

None of v1.0's findings are contradicted. Refinements (not corrections) are:

1. v1.0 described RoR as having "doctrine and implementation substrate" without identifying the specific `netValueAccelerationHours()` repair-hours subtraction as the one place RoR-adjacent data mechanically conditions a downstream measurement. This addendum adds that precision; it does not change v1.0's ceiling assessment (still no calibrated/validated RoR).
2. v1.0 did not disambiguate "Vela" as naming two unrelated systems (the TEE protocol vs. the financial-accelerator doctrine). This addendum adds that disambiguation as new information, not a correction of an error.
3. v1.0 did not identify the `standingAccrualService.ts` "Raw Capability Standing score" naming coincidence as a potential false-friend for the Threshold 006 Raw/Effective Capability dichotomy. Flagged here to prevent future misattribution.

---

## M. Claims Whose Status Has Actually Changed

| Claim | Previous status (v1.0) | New evidence | New status | Reason |
|---|---|---|---|---|
| PoTS is conditioned by Risk of Repair | Asserted as doctrinal connection only | `netValueAccelerationHours()` code inspected directly | **CONFIRMED as coded, not merely doctrinal** | Direct code inspection this pass |
| PoTS instrumentation | Not separately assessed in v1.0 | Real admin-gated verify/accrue route found, wired to Standing | **INSTRUMENTED/OPERATIONAL (machinery)**; observed-data status remains open | New file-level evidence |
| Golden Cycle evidence table | Not previously located precisely | `golden_cycle_records` schema found, zero writer code | **IMPLEMENTED (schema) / ABSENT (instrumentation)**, now schema-precise | Direct migration file inspection |
| Vela terminology | Treated as one system in prior general discussion | Found to name two unrelated systems + a third (Horizen) | **Disambiguated** — no prior single-system claim stands unqualified | Direct code inspection across `services/vela/` vs. `docs/vela/accelerator/` vs. `services/horizen/` |

## N. Claims Whose Status Has Not Changed

- Lehigh risk calibration/scoring: still a documented calibration hypothesis (one panel, one spreadsheet), not causal/actuarial validation. **UNCHANGED.**
- CFS-052 Proof of Risk Reduction: still constitutional vocabulary with no implementation. **UNCHANGED.**
- `ProofOfRisk` invariant-envelope type: still a narrow per-intent relevance/evidence object, not a prediction of occurrence. **UNCHANGED.**
- Consequence Horizon / H1b / H3d / H4: still unmeasured, self-disclosed as such in the very corpus that defines them. **UNCHANGED.**
- Temporal vs. longitudinal distinction (EXP-002): preserved exactly as v1.0 stated it — EXP-002 contains genuine order-dependence/sequencing instrumentation, not longitudinal measurement; the two are not conflated in either direction. **UNCHANGED.**

---

## O. Constitutional Enforcement Acts on Action, Not Reasoning — Primary-Source Confirmation

A distinct primary-source finding, surfaced mid-pass and folded in here because it bears directly on §H/§J's "Constitutional Action Boundary" discussion and on Threshold 007's own falsification register.

**Location:** `codexes/packs/polity-core/items/commentary/constitutional-internet/01-controlling-manuscript-v1.0-publication-candidate.md:3568-3599` (identical passage also present in `01-working-manuscript.md`, `01-controlling-manuscript-v0.3.md`, `01-controlling-manuscript-v0.4.md` — same text carried across manuscript revisions, not a one-off). Quoted directly:

> "This is constitutional computing. It does not mean that software becomes the final interpreter of constitutional law. It means the software preserves and enforces known constitutional constraints at the point of action. The code remains subordinate to doctrine, ratified rules, lawful authority, and human interpretation. The system may refuse an action because no valid mandate exists. It may prevent information from being disclosed outside the permitted purpose. It may require stronger proof for a high-risk operation. It may generate a receipt. It may escalate a conflict to human review. It may preserve evidence for remedy. The machine does not decide the constitution. It observes the constitutional conditions embodied within its authority."

**What this establishes:** the Constitutional Internet book's own doctrine — carried unchanged across at least four manuscript revisions — defines constitutional computing as enforcement **at the point of action** (gate/refuse/require-proof/receipt/escalate), explicitly **not** as the software interpreting or deciding constitutional law, and not framed as an intervention on an actor's reasoning process. This is doctrine, and it is consistent with (not merely asserted alongside) the real gating implementations found elsewhere in this sweep — `services/access/evaluateAccess.ts` (allow/deny at the point of a request), the DVN anchoring allowlist (`ANCHORABLE_ACTION_TYPES`), and Factor's authority-chain revocation — all of which act at the point of action (permit/refuse/receipt), none of which alter or measure an agent's internal reasoning process.

**Why this matters for Threshold 007's own falsification register:** `docs/qriptopian/thresholds/007-research-edition.md:1084` already registers, as **Alternative Explanation 4** (a live alternative to be ruled out, not a settled finding): *"H3 Is Just Governance. Constitutional mechanisms improve safety or permission but not reasoning. Required response: test whether constitutional conditions measurably alter signal integrity, structural variables, learning or transfer."*

The primary-source doctrine above is **consistent with, and arguably supportive of, Alternative 4 rather than against it**: the book's own description of constitutional computing is that it acts at the point of action (a governance/permission function — refuse, gate, require proof, receipt) and explicitly disclaims deciding or interpreting constitutional law itself. Nothing in this doctrine, nor in any implementation found in this sweep (`evaluateAccess.ts`, DVN allowlisting, Factor revocation, RoR's discovery-ordering use), demonstrates an effect on reasoning, signal integrity, structural variables, learning, or transfer — the specific things Alternative 4's required response asks to be tested. **This finding does not resolve H3 vs. Alternative 4 either way** — it is not an experiment and tests nothing — but it does mean: (a) the "action, not reasoning" framing the user pointed to is a real, repeatedly-carried primary-source doctrinal statement, correctly located in the Constitutional Internet book rather than the Embodied series (a targeted search of `The Polity Embodied Series.txt` for this framing found no match); and (b) it should be read as **corroborating evidence for how the platform's own doctrine defines constitutional enforcement's scope** (action-layer, not reasoning-layer) — which is directly relevant substrate for whoever runs the Alternative 4 falsification test, not a resolution of it.

**Status:** PRIMARY_SOURCE_VERIFIED (doctrine) / IMPLEMENTATION_CONSISTENT (the real action-layer gates found elsewhere in this sweep operate the same way) / **does not itself constitute evidence for or against H3** — that remains an open falsification test per the manuscript's own register.

---

## Unresolved Gaps

1. Whether any real `ProofOfOutcomeClaim` rows have been verified/accrued in the live Supabase project — **UNKNOWN**, no DB read access this pass.
2. Whether `Book4.xlsx` (the actual expert-labelled spreadsheet the notebooks load) contains any data beyond what the notebooks' own executed output already discloses — **cannot be re-verified**, file is a pending Auto Drive upload, not re-readable this pass.
3. Whether the dense pending-upload PDFs (Data Risk for Marketplaces v2.0, Plan v.02, Final Report metaMe1, PoTS Protocol Integration Pack v0.1, Value Engine Logic docx) contain any backtesting/validation content not visible from the executable files alone — **not independently re-verified this pass**; prior verification doc's characterization is carried forward, not re-derived.
4. Whether `journey_states`/`orchestration_events` join to any of the RoR/PoTS/Golden-Cycle apparatus — **not verified column-by-column this pass**; flagged as open rather than assumed either way.

---

## Machine-Readable Evidence Receipt

```json
{
  "record_type": "threshold-007-evidence-resolution-addendum",
  "record_version": "1.1",
  "review_role": "evidence-agent",
  "review_date": "2026-09-13",
  "canonical_threshold": "007.2",
  "canonical_threshold_status": "canonical",
  "previous_evidence_record": "codexes/packs/agentiq/updates/2026-09-13_threshold-007-evidence-resolution-pass.md",
  "new_primary_artifacts_reviewed": [
    "services/invariants/riskField.ts",
    "services/venture/ventureOutcomeAccrual.ts",
    "app/api/venture/qubes/[ventureId]/verify-outcome/route.ts",
    "services/factor/standingProposal.ts",
    "services/factor/authorityChain.ts",
    "services/horizen/evidence.ts",
    "services/horizen/pulseEndpoint.ts",
    "services/vela/velaTypes.ts",
    "services/crm/standingAccrualService.ts",
    "services/receipts/activityReceiptService.ts",
    "services/dvn/activityReceiptDvnPipeline.ts",
    "supabase/migrations/20260912195402_golden_cycle_evidence_records.sql",
    "supabase/migrations/20260930190000_factor_aegis_constitution_reconciled.sql"
  ],
  "newer_lehigh_artifacts_reviewed": [
    "codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/value_engine.py",
    "codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/original_risk_matrix_amit_patil.py",
    "codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/metatMe_DataRisk.ipynb",
    "codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/Test_metatMe_DataRisk_1.ipynb"
  ],
  "risk_lineage_status": "CONCEPTUAL_TO_EXPERIMENTALLY_EXERCISED",
  "value_lineage_status": "CONCEPTUAL",
  "price_lineage_status": "CONCEPTUAL",
  "risk_value_price_integration_status": "FORMULA_ONLY_NOT_VALIDATED",
  "ror_status": "IMPLEMENTED_NOT_CALIBRATED",
  "pots_status": "INSTRUMENTED_OPERATIONAL_MACHINERY_OBSERVED_DATA_UNKNOWN",
  "time_to_value_status": "IMPLEMENTED_VIA_POTS_PROXY",
  "golden_cycle_lineage_status": "IMPLEMENTED_SCHEMA_ONLY_NO_WRITER",
  "vela_horizon_measurement_status": "MIXED_SEE_SECTION_D",
  "venture_lab_consequence_status": "OPERATIONAL_PARTIAL",
  "irl_scientific_status": "UNCHANGED_FROM_V1.0",
  "longitudinal_telemetry_status": "TWO_DISCONNECTED_SEGMENTS_T0_T1_AND_T2_T5",
  "consequence_horizon_environment_status": "OPERATIONAL_ENVIRONMENT_PARTIALLY_PRESENT",
  "consequence_horizon_instrument_status": "ABSENT",
  "consequence_horizon_evidence_status": "ABSENT",
  "h1b_status": "UNCHANGED_UNMEASURED",
  "h3d_status": "UNCHANGED_UNMEASURED",
  "h4_status": "UNCHANGED_UNMEASURED",
  "claims_strengthened": [
    "PoTS implementation and instrumentation detail",
    "PoTS-RoR coded conditioning relationship",
    "Golden Cycle evidence-table schema precision",
    "Constitutional-computing-enforces-at-point-of-action doctrine located and cross-referenced against Threshold 007's own Alternative Explanation 4 (H3 vs governance) register"
  ],
  "claims_unchanged": [
    "Lehigh calibration hypothesis ceiling",
    "CFS-052 Proof of Risk Reduction non-implementation",
    "ProofOfRisk invariant-envelope narrow scope",
    "Consequence Horizon / H1b / H3d / H4 unmeasured status",
    "EXP-002 temporal-sequencing vs. longitudinal distinction"
  ],
  "claims_weakened": [],
  "contradictions_found": [],
  "unresolved_gaps": [
    "Whether real ProofOfOutcomeClaim rows exist in production (no DB access this pass)",
    "Book4.xlsx content beyond notebook-disclosed output (pending upload, not re-readable)",
    "Dense pending-upload PDFs' backtesting/validation content (not independently re-verified this pass)",
    "journey_states/orchestration_events linkage to RoR/PoTS/Golden-Cycle apparatus (not verified column-by-column)"
  ],
  "primary_source_receipt": "read-only repository sweep, 2026-09-13, no database access, file:line citations recorded inline above",
  "constitutional_enforcement_locus_status": "PRIMARY_SOURCE_VERIFIED_DOCTRINE_ACTION_LAYER_NOT_REASONING_LAYER_CONSISTENT_WITH_ALTERNATIVE_4_NOT_DISPOSITIVE"
}
```

---

## Final Evidence-Agent Verdict

1. **What the newer Risk/Value/Price material genuinely changes:** it establishes, with file-level precision not previously recorded, that PoTS is the most mature construct in this entire evidentiary area — a real code reduction of the doctrinal formula, wired into a real admin-gated verify/accrue pipeline, with a confirmed (not assumed) coded RoR-conditioning relationship. It also establishes that the Golden Cycle's evidence substrate exists as schema with zero writers, that "Vela" is a three-way terminology trap, and that a same-named-but-unrelated "Raw Capability Standing" score must not be mistaken for the Threshold 006 Raw/Effective Capability dichotomy. It surfaces a structural gap: the longitudinal chain is real in two disconnected halves with no unifying causal ID.

2. **What it does NOT change:** the Lehigh calibration hypothesis remains uncalibrated/unvalidated as causal or actuarial science. CFS-052 Proof of Risk Reduction remains unimplemented constitutional vocabulary. The `ProofOfRisk` invariant-envelope type remains a narrow relevance claim, not a risk model. Consequence Horizon, H1b, H3d, and H4 remain unmeasured, exactly as the manuscript's own text discloses. The EXP-002 temporal-sequencing-vs.-longitudinal distinction from v1.0 is preserved unaltered.

3. **Whether the existing Evidence-Resolution Pass requires factual correction, evidentiary enrichment, or both:** evidentiary enrichment only. No factual correction to v1.0 was required; this addendum adds precision (specific file:line findings, the Vela disambiguation, the false-friend flag) without contradicting any prior finding.

4. **Whether the evidence substrate is now sufficiently resolved to hand to the Longitudinal Adversary:** yes, with the disclosed gaps above (production-data status of PoTS claims, unre-verified dense PDFs, unverified journey/orchestration linkage) explicitly carried forward rather than silently omitted.

**EVIDENCE RESOLUTION — COMPLETE WITH DISCLOSED GAPS**
