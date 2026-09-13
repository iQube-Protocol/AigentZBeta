# Threshold 007 — Evidence-Resolution Pass v1.1 Addendum (Read-Only)

**Record type:** Read-only evidence-resolution addendum. Does **not** modify Threshold 007.2, `content_publication_gates`, `research_review_records`, `research_publication_records`, any experiment record, or any database state. This document extends `2026-09-13_threshold-007-evidence-resolution-pass.md` ("v1.0") without overwriting it — v1.0's findings are preserved below except where explicitly superseded, in which case the supersession is stated and reasoned, not silently applied.

**Role:** Evidence Agent. Not Aletheon, not the Longitudinal Adversary, not the ARR reviewer, not the Publication Gate, not an advocate for Threshold 007. This document establishes what exists, what it measures, its provenance, and what relationships between artifacts are supported by primary evidence. It does not argue the thesis is proven or unproven.

**Canonical boundary:** Threshold 007.2 is canonical and treated as immutable for this task. Nothing below edits the manuscript. Where new evidence would justify a future manuscript clarification, it is flagged as **FUTURE-EDITION CANDIDATE**, not applied.

**Method:** This addendum is built from a dedicated read-only research sweep conducted 2026-09-13 across the whole repository (grep + full-file reads of `services/invariants/riskField.ts`, `services/venture/ventureOutcomeAccrual.ts`, `services/factor/*`, `services/horizen/*`, `services/vela/*`, `services/crm/standingAccrualService.ts`, `services/receipts/activityReceiptService.ts`, `services/dvn/activityReceiptDvnPipeline.ts`, relevant CFS docs, the Vela accelerator doctrine set, and the Lehigh corpus files already committed under `codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/`), plus re-reads of `2026-09-13_threshold-007-evidence-resolution-pass.md` and `2026-09-13_lehigh-risk-calibration-primary-source-verification.md` (including its Dhrunal Belani addendum). File:line citations are given wherever the underlying sweep produced them.

**2026-09-13 operator-directed refinement note (v1.1):** three subsections (B.1, D.1, G.1) were added after initial publication of this addendum, at the operator's explicit direction, to sharpen — not correct — the positive relationship between RoR and Consequence-Horizon substrate, the Vela/Horizon consequential-measurement pathway, and the Pilot-vs-Experiment epistemic complementarity. Two items the operator explicitly withheld from this document are recorded separately rather than here: a candidate research proposition on constitutional robustness under deceptive cognition (`2026-09-13_threshold-007-candidate-research-proposition-deceptive-cognition.md` and `research_candidate_experiments` row `threshold-007-constitutional-robustness-under-deception`), and infrastructure/backlog items — the Evidence Access ClusterQube and Lehigh-corpus constitutionalization — recorded in `research_backlog_items` and a companion backlog note, not in this evidence-resolution prose.

**2026-09-13 second refinement note (v1.2):** following resolution of the 8 previously-pending dense Lehigh corpus artifacts (uploaded to Supabase Storage, sha256-verified, downloaded and read in full), §A's lineage table Phases E/G/H/I are updated from "not re-verifiable this pass" to real content; §C gains a PoTS formulation registry; the Proof-of-Risk firewall is expanded from three to four usages; §L/§M/the JSON receipt are updated accordingly. **Per explicit operator instruction, divergent PoTS and Proof-of-Risk formulations are recorded separately with provenance/date/purpose/computational-role/evidence-status and are NOT reconciled, ranked, or treated as contradictions in this pass** — divergence is formalization/ontology debt for the forthcoming Vela/IRL experimental programme to resolve empirically, and the Lehigh `T_baseline − T_assisted` formulation is preserved as a legitimate historical measurement primitive in its own right, not superseded by the platform's own implementation.

---

## A. Updated Lehigh Risk / Value / Price Lineage

**Superseding update, 2026-09-13, following full read of the 8 previously-pending dense artifacts** (now Supabase-Storage-hosted, sha256-verified — see the corpus README). The lineage below replaces the "not re-verifiable this pass" rows this table previously carried for Phases E, G, H, I with real content, and adds authorship/team findings that clarify the corpus is one continuous programme, not several independent efforts. Phases J and K remain unpopulated — no primary evidence supports them even after this fuller read.

**Authorship lineage, newly established:** `Final_Report_metaMe1.pdf` is **Amit Rajendra Patil's original Lehigh GBUS 485 report** (team: Patil — risk-scoring engine; Toulupe Shoaga — pricing/commercial analysis; Edson Bope — future AI solutions architect, matching `Plan_v.02.pdf`'s author). `DATA_RISK_FOR_MARKETPLACES_V2.md` is explicitly **Dele Atanda's v2.0 enhancement, stated on its own title page to build on "original work by Amit Rajendra Patil."** `PoTS_Protocol_Integration_Pack_v0.1.pdf` explicitly self-declares its two source artifacts by title as `DATA_RISK_FOR_MARKETPLACES_V2.md` and `Pricng_Data_and_Risk_Final_Project_Paper.pdf`. This is one continuous, citation-verifiable lineage: Patil (2025) → Atanda v2.0 (June 2025) → pricing paper (May 2025, same team) → PoTS Integration Pack (Feb 2026) — not independent works merely sharing a topic.

| Phase | Artifact | Methodology / inputs / outputs | Executable? | Empirical basis | Calibration status | Validation status | Relation to preceding | Relation to 007 concepts |
|---|---|---|---|---|---|---|---|---|
| **A — Risk taxonomy** | `original_risk_matrix_amit_patil.py` / `Final_Report_metaMe1.pdf` (23-dim core taxonomy: Identifiability, Sensitivity, Confidentiality, Competitiveness, Reputation, Compliance, Financial, Political, Diplomatic, Emotional, Commercial, Legal, Geopolitical, Military, Intelligence, Social, Public Welfare, Strategic, Operational, Environmental, Security, Health&Safety, Verifiability); `DATA_RISK_FOR_MARKETPLACES_V2.md` layers on 16 further dimensions (temporal, contextual, technical, "positive value") for 39 total; Dhrunal Belani report (32 dims, independently elaborated) | Hand-authored dimension lists with one-line definitions | Yes (raw dict + exploratory code; taxonomy also fully tabulated in prose) | Author-authored taxonomy, not derived from data | None (taxonomy is definitional) | N/A | v2.0 explicitly extends the 23-dim original; Belani's 32-dim scheme remains independently elaborated, not shown to extend either | Antecedent to all later risk scoring |
| **B — Expert-labelled risk data** | `Book4.xlsx`, now read in full: **Sheet8, 104 records × 19 dimensions**, High/Medium/Low (closely matching, not exactly, prior "105×19–23" characterization — Identifiability/Sensitivity/Confidentiality are broken into separate dedicated sheets rather than included in Sheet8); 22 further per-dimension pairwise-relatedness sheets; Belani report's Delphi panel (Kendall's W 0.470→0.749→0.855) | One hand-labelled spreadsheet (25 sheets total); one small Delphi expert panel | N/A (data, not code) | One panel, one spreadsheet each | Frequency-weighted labels | Not validated against outcomes | Feeds Phase C | Primary-source substrate for "Lehigh calibration hypothesis" |
| **C — Risk weight derivation** | `metatMe_DataRisk.ipynb`, `Test_metatMe_DataRisk_1.ipynb` | `score = High×3 + Medium×2 + Low×1`, normalized to mean 1.0 | Yes, executed | Real executed run against Book4.xlsx | Calibrated to one panel | Not independently validated | Direct successor to A/B | Ancestor of `services/invariants/riskCalibration.ts`'s `derivePrevalenceWeights()` (confirmed reproduction of this exact formula) |
| **D — Executable risk scoring** | Same notebooks (8 iQube bundles, real output e.g. Investment Qube 60.90%→67.54%); **`Final_Report_metaMe1.pdf`'s own exhaustive run, now read**: 65,535+ combinations across 16 flagship Qubes, k-means dynamic Low/Medium/High classification, verifiability-adjustment formula `S_adjusted = max(S_base−2,1)` (unverified High) | Weighted sum per bundle; k-means classification; verifiability discount | Yes, executed with real output | Real executed runs (two independent scoring passes over the same underlying data/methodology) | Same methodology as C, self-consistency only | Model self-consistency (exhaustive combinatorics over the framework's own scoring engine), **not validation against independent real-world outcome/incident data** | Direct successor to C; `Final_Report_metaMe1.pdf` is a separate, larger-scale execution of essentially the same scoring engine as the notebooks | This is the concrete example cited by prior evidence passes; **three different "Investment Qube" percentages appear across the corpus for the same nominal bundle** (60.90%/67.54% in the notebook two-way comparison, 68.6% in `Final_Report_metaMe1.pdf`'s worked toy example, 82% in that same report's full 16-Qube run) — these are not contradictory once the differing scope/weighting-run is accounted for, but an adversary should not assume a single canonical "Investment Qube risk %" exists in this corpus |
| **E — Temporal risk modeling** | `DATA_RISK_FOR_MARKETPLACES_V2.md`, now read in full: explicit formulas — exponential decay `f(t)=e^{-λt}`, linear decay, sigmoid decay, half-life model `R(t)=R₀·2^{-t/H}` (decay) / `R₀·2^{t/H}` (growth), composite weighted sum across models, regulatory-velocity adjustment, context-transition matrices, "dynamic risk tensors" (conceptual, no worked numeric example) | All formulas given as literal Python-style pseudocode | **No** — confirmed on full read: `incident_database`, `expert_panel`, `regulations`, `insurance_data` are undefined inputs throughout; no dataset is ever supplied or run | None found | None | None — the document's own "Empirical Validation" section (Historical Incident Backtesting, Controlled A/B Testing, Delphi Validation, Real-World Pilot Deployment) is confirmed to be **methodology/pseudocode only, referencing undefined data sources, with no executed backtest** | Extends C/D with a time axis | **Concerns evolution of a risk score, not the temporal/causal projection of consequences** — this is not Consequence Horizon substrate (confirmed on full read: zero occurrences of "Consequence Horizon," "Time-to-Value," "Golden Cycle," or "Risk of Repair" anywhere in this 4,426-line document) |
| **F — Risk of Repair** | `services/invariants/riskField.ts`; `CFS-056` doctrine | See §B below | Yes (typed structures, discovery-ordering functions) | Unit-tested, not outcome-tested | Explicitly uncalibrated by its own module header | Not validated | Independent construct — **not demonstrated to descend from the Lehigh corpus at all**; the corpus and RoR share no common code path in this sweep, and none of the 8 documents read this pass uses the term "Risk of Repair" | See §B |
| **G — Value modeling** | `value_engine.py` + `Value_engine_Logic.docx` (its prose companion, now read in full) | `Value_engine_Logic.docx` describes: borrowing risk-model dimension weights with a per-dimension "+1/−1" risk-to-value sign flip, a simulated three-round expert-consensus weight blend (50/50 with the risk model's own weights), seller/buyer-differentiated scorecards (seller-relevant dims ×1.7, shared ×1.2, buyer-only ×0.3, and the mirror for buyer), intent/buyer-type multipliers (resale ×1.5, academic ×0.8; broker ×1.35, unverified buyer ×0.70), and a described (not numerically executed in the prose) worked example | Formulas/logic present in both code and its prose description; `value_engine.py` imports an unsupplied `risk_engine` module, so it does not run standalone; the docx gives inputs for a worked example but **no final computed output number** | None (no outcome data, no backtest in either the code or its prose companion) | None | None | Builds on C's weights, now confirmed identically described in both the code and its independent prose specification | Genuine risk→value linkage **at the level of formula/model, not calibration/validation** — confirmed by both artifacts agreeing on the same uncalibrated methodology |
| **H — Price modeling** | `Pricng_Data_and_Risk_Final_Project_Paper.pdf`, now read in full: two frameworks — Risk-Based Valuation (`Spot Price = Net Profit × Risk Score × e^{-r}`; long-term variant with a CDF-based "probability risk score changes" term) and Market-Based Valuation (`Price = Data Replication Cost + GDPR Compliance Risk + Time Value Risk + Market Risk`, each a separate exponential-discounted term); a second embedded sub-document describes a Dutch-auction/second-highest-bid pricing mechanism with 95%-CI guardrails | All formulas given explicitly | **Yes, partially** — this is the one phase-H artifact with real executed numeric output: Spot Price model run (`net_profit=100, risk_score=0.63` → **$59.93**), a 20-year Market-Based run (**$116.33**), and a 10,000-run Monte Carlo simulation (mean **$116.15**, variance 786.84) | Real executed runs, but on **randomly generated, not historical, inputs** — the paper's own text states results "did not yield a robust or quantifiable model" and calls the output "indicative rather than conclusive" | None (self-disclosed as not yet backtested; real-world benchmarking and Monte Carlo-with-real-data are listed as explicit future work) | Builds on G conceptually; the Dutch-auction sub-mechanism is later cited **by name** in the PoTS Integration Pack as its unchanged "Proof of Price" clearing rule — a confirmed, explicit textual descent, not an inferred one | This is the **only place** in the corpus with genuinely executed price-model output, but per its own text the output is **not validated/robust** — do not read the $59.93/$116.33 figures as evidence the pricing model works, only as evidence the formulas are coded and runnable |
| **I — Risk/Value/Price integration** | `PoTS_Protocol_Integration_Pack_v0.1.pdf`, now read in full — this is the corpus's actual integration attempt, not `value_engine.py` alone. It defines: Proof of Intent (PoI, reusing v2.0's `0.3×declared+0.3×contextual+0.4×behavioral` formula verbatim), **Proof of Risk (PoR)** as a named protocol layer (`AdjustedRisk = BaseRisk × IntentFactor`, feeding access-control/mitigation tiers — see the Proof-of-Risk firewall note below), Proof of Value (PoV, a vector combining PoTS with the "positive value" dimensions lifted from v2.0), Proof of Price (PoP, explicitly keeping the pricing paper's auction mechanism "unchanged"), and a Proof-of-Time-Saved formula **`PoTS_real = T_baseline − T_assisted`** | Fully specified as a document; **explicitly an unbuilt specification** — its own "Implementation plan" lists Phase 0 (spec/data model) through Phase 3 (pricing feedback loop) as un-started sprints; no code, no receipts, no executed run exist for this integration anywhere in the corpus | No | None | None | This is the real Risk→Value→Price integration point the earlier version of this table could not verify — it exists, in full formula/specification form, as of Feb 2026 | Distinct from, and not evidence for, the later Golden Cycle's Information→TTV→Value→Price→Money→Information cycle — no shared terminology, no cross-reference either direction. **Materially important finding: this document's `PoTS_real = T_baseline − T_assisted` formula is a two-term calculation. It does NOT include a Repair Burden or Risk Burden subtraction term, and therefore does not match the canonical four-term doctrine formula `PoTS = Baseline Time − Actual Time − Repair Burden − Risk Burden` (`codexes/packs/polity-core/items/commentary/coyn-thesis/03-proof-of-time-saved.md:191,200`).** Risk is handled in this document as a separate multiplicative gate (PoR), not as a term subtracted inside PoTS itself. This is the same name, the same "time avoided vs. baseline" concept, but **not the same equation** — see §C's update below. |
| **J — Time-to-Value relationship** | — | — | — | — | — | — | — | **No primary evidence found in this corpus, confirmed on full read of all 8 documents.** The corpus's "temporal" content is risk-score decay (Phase E) and the PoTS pack's `T_baseline − T_assisted` (Phase I); neither document uses the term "Time-to-Value." Not populated. |
| **K — Consequence relationship** | — | — | — | — | — | — | — | **No primary evidence found in this corpus, confirmed on full read of all 8 documents.** "Consequence Horizon," "Golden Cycle," and "Risk of Repair" occur zero times across all 8 documents. Not populated. |

**Continuity assessment — updated on full read (per the instruction not to infer continuity from shared authorship, now confirmed rather than merely plausible):** Phases A→D form one demonstrable, code-evidenced lineage (same data, same notebooks, same formula reproduced downstream in `riskCalibration.ts`, and now independently corroborated by `Final_Report_metaMe1.pdf`'s own larger-scale exhaustive execution). Phase E (`DATA_RISK_FOR_MARKETPLACES_V2.md`) is now **confirmed**, not merely plausible, as a direct extension — the document's own title page states it builds on "original work by Amit Rajendra Patil" (Phase A/D's author). Phases G/H are **a separate, later research thread** that reuses Phase C/D's *weights* as an input but introduces new constructs (value convergence, pricing) with no executable validation on real data — this is now confirmed by direct reading rather than inferred: the pricing paper's own text states its Monte Carlo output is "indicative rather than conclusive," and `Value_engine_Logic.docx` describes no real backtest either. Phase I (`PoTS_Protocol_Integration_Pack_v0.1.pdf`) is now confirmed as a **real, citation-explicit integration attempt** across the whole corpus — it names both `DATA_RISK_FOR_MARKETPLACES_V2.md` and the pricing paper as its stated source basis — but remains an unbuilt specification with an explicit un-started implementation roadmap. Phase F (RoR as implemented in `riskField.ts`) is **still not shown to descend from this corpus at all** — none of the 8 corpus documents read this pass use the term "Risk of Repair," confirming rather than merely preserving the prior finding. Treating F as "the same lineage" as A–D remains an unsupported inference; this addendum still does not make it.

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

### B.1 — Risk-of-Repair as Consequence-Horizon Substrate (operator-directed addendum)

The absence of direct Consequence-Horizon measurement should not be interpreted as absence of relevant measurement substrate. The Lehigh risk-calibration lineage was not designed to measure Consequence Horizon. Its relevance is antecedent: it establishes substantive methodology for risk identification, scoring and calibration from which Risk-of-Repair instrumentation may develop. RoR and Consequence Horizon are distinct but coupled research quantities. Consequence Horizon concerns how far consequential projection remains sufficiently reliable; RoR concerns the repair exposure associated with acting when such projection or intervention proves wrong. The candidate constitutional relationship therefore concerns CH together with calibration, uncertainty, reversibility and RoR in determining a warranted action boundary. This relationship remains a research proposition rather than an experimentally established law.

This is consistent with, and sharpens, §H below (the RoR → Consequence-Horizon Substrate Relationship table): RoR remains the most concrete of that relationship's five components, without itself constituting CH measurement.

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

**Additional PoTS formulation identified, following full read of `PoTS_Protocol_Integration_Pack_v0.1.pdf` (2026-09-13) — recorded as a distinct formulation, not a correction against a canonical baseline.** Per operator direction: no single PoTS formulation is presumed canonical unless primary evidence explicitly establishes canonical status, and divergence between formulations is formalization/ontology debt for the forthcoming Vela/IRL experimental programme to resolve empirically — not a contradiction to adjudicate here. Three PoTS formulations are now on record; each is preserved with its own provenance rather than ranked against the others:

| Formulation | Provenance | Date | Stated purpose | Computational role | Evidence status |
|---|---|---|---|---|---|
| `PoTS = Baseline Time − Actual Time − Repair Burden − Risk Burden` (four-term, "after validity clears") | `codexes/packs/polity-core/items/commentary/coyn-thesis/03-proof-of-time-saved.md:191,200` | Canonized `inv.polity.161`/`inv.polity.198`, 2026-07-17 | Constitutional/doctrinal measurement stack for the platform's own Golden Cycle framing | Not directly executed as a four-term formula anywhere found; the platform's own code approximates a two-term reduction of it (see next row) | CONCEPTUAL (doctrine), canonized as platform vocabulary |
| `netValueAccelerationHours = max(0, timeSavedHours − riskRepairHours)` (two-term reduction) | `services/venture/ventureOutcomeAccrual.ts` | Implemented, date not independently dated this pass | Real, callable code computing a Standing-feeding value from a caller-supplied time-saved and repair-hours pair | Real, wired into an admin-gated verify/accrue API route → `accrueStanding()` | IMPLEMENTED/INSTRUMENTED (§C above); production-data observation status unresolved |
| `PoTS_real = T_baseline − T_assisted` (two-term, no repair/risk subtraction — risk handled as a separate `AdjustedRisk = BaseRisk × IntentFactor` gate) | `PoTS_Protocol_Integration_Pack_v0.1.pdf` | February 18, 2026 | A proposed Lehigh-lineage protocol integrating Proof of Intent/Risk/Value/Price around a "time avoided relative to a defensible baseline" primitive | Specification only — explicit un-started Phase 0–3 implementation roadmap; no code, no receipts | CONCEPTUAL/PROPOSED (specification); a legitimate historical measurement primitive in its own right, not superseded by the other two rows absent evidence |

**What is and is not established by this table:** all three rows measure "time saved/avoided relative to a baseline" — that much is shared. Whether the platform's `netValueAccelerationHours()` formulation and the Lehigh `PoTS_Protocol_Integration_Pack_v0.1.pdf` formulation are the same primitive with different conditioning terms added (repair/risk as a subtracted term vs. a separate multiplicative gate), two independent formalizations of an unrelated shared concept, or a historical precursor and a later elaboration, **is not resolved by this evidence pass** — no cross-reference, shared file, or explicit citation between the two was found in either direction (see the Unresolved Gaps entry on this below). Per operator instruction, this is recorded as **formalization/ontology debt**, to be resolved by future Vela/IRL experimentation designed to instrument the shared primitive variables (baseline time, actual/assisted time, repair burden, risk burden/factor) richly enough to compare the competing formulations empirically, rather than by this evidence pass selecting one as canonical or "correct."

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

### D.1 — Vela/Horizon and Consequential Measurement (operator-directed addendum)

PoTS (Proof of Time Saved) and Risk of Repair form central candidate measurement surfaces in the Vela/Horizon financial-services pilot architecture, alongside consequential signals including Pulse, P&L and Standing/evidence accrual where implemented. The governing proposition is that information or intelligent intervention should compress Time-to-Value without exporting unacceptable Risk of Repair. This creates an operational pathway from antecedent risk calibration toward observed consequential measurement. Venture Lab/pilot telemetry must not be retrospectively classified as controlled scientific validation; equally, its consequential character should not be dismissed merely because it is not an IRL experiment. The Venture Lab provides a real-world environment in which intervention, value, time, financial consequence and repair can potentially become observable. IRL provides the controlled environment in which relationships surfaced through that pilot can subsequently be isolated, calibrated and falsified.

This framing is what the table above already shows in practice: PoTS is IMPLEMENTED/INSTRUMENTED, RoR is present but not yet a dedicated Vela/Horizon KPI, and Standing/Pulse/P&L sit at varying degrees of operational maturity — none of which amounts to controlled validation, and none of which should be dismissed as irrelevant to it.

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

### G.1 — Pilot versus Experiment (operator-directed addendum, sharpened)

Within the emerging research architecture, controlled experimentation and consequential piloting perform complementary epistemic functions. IRL experimentation isolates and falsifies candidate relationships under controlled conditions. Venture Lab piloting exposes those relationships to consequential reality, including live uncertainty, incentives, changing state, external actors, financial effects, tacit behaviour and repair. Accordingly, the Vela/Horizon pilot may provide the programme's most tangible operational environment for observing a Consequence Horizon, while IRL research supplies the instrumentation and controls necessary to establish whether the apparent relationships are scientifically invariant. Pilot observation is therefore neither equivalent to scientific validation nor epistemically irrelevant to it.

This restates and sharpens §I below (Venture Lab as Potential Operational Consequence-Horizon Environment): the operational-environment/instrument/scientific-evidence distinction drawn there is the concrete form of the pilot-versus-experiment complementarity stated here.

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
4. **Genuine correction (not merely a refinement), following full read of the 8 previously-pending dense artifacts:** an earlier version of this addendum's §A table stated Phases E/G/H/I as "not re-verifiable this pass" and characterized §H (price modeling) as "the only place in the corpus that names PoTS explicitly." Both statements are now superseded: all four phases have been directly read, and **PoTS is named explicitly in `PoTS_Protocol_Integration_Pack_v0.1.pdf` (Phase I), not in the pricing paper (Phase H)** — the pricing paper itself does not use the term "PoTS" or "Time-to-Value." The corrected Phase H/I rows above reflect this.
5. **Not a correction — a newly identified divergent formulation, recorded without presuming a canonical baseline:** the Lehigh corpus's PoTS formula (`T_baseline − T_assisted`, two terms, risk handled as a separate gate) differs from both the four-term doctrine formula and the platform's own `netValueAccelerationHours()` two-term reduction. Per operator direction, this is not treated as an error to correct or a weaker variant to rank — see §C's formulation-registry table above, which records all three with provenance/date/purpose/computational-role/evidence-status and defers resolution to future Vela/IRL experimentation rather than adjudicating a winner here.
6. **New finding, not previously identified:** a **fourth, distinct usage of "Proof of Risk"** exists in this corpus — `PoTS_Protocol_Integration_Pack_v0.1.pdf` names "Proof of Risk (PoR)" as a formal protocol layer (`AdjustedRisk = BaseRisk × IntentFactor`), separate from (a) the CFS-052 constitutional-vocabulary "Proof of Risk Reduction," (b) the implemented `ProofOfRisk` invariant-envelope type, and (c) the Dhrunal Belani report's pipeline-stage usage. See the Proof-of-Risk firewall update immediately below.

### Proof-of-Risk Firewall — Updated to Four Usages (not three)

Prior evidence-resolution work (v1.0, the Lehigh verification doc, and this addendum's earlier draft) distinguished three non-interchangeable uses of "Proof of Risk." A full read of `PoTS_Protocol_Integration_Pack_v0.1.pdf` adds a fourth:

| # | Usage | Source | What it names |
|---|---|---|---|
| 1 | Constitutional vocabulary | `CFS-052_evidence-architecture-and-dual-validation.md` | "Proof of Risk Reduction" — declared constitutional vocabulary, self-described as having no implementation |
| 2 | Invariant-envelope type | `types/invariantEnvelope.ts` | `ProofOfRisk` — implemented, narrow per-intent relevance/evidence structure; explicitly not a prediction of occurrence |
| 3 | Pipeline-stage label (Belani report) | `Dhrunal_Belani_Final_Report_MetaMe_2.pdf` | A document-local pipeline stage outputting a calibrated risk score |
| 4 | **Named protocol layer (new)** | `PoTS_Protocol_Integration_Pack_v0.1.pdf` | **"Proof of Risk (PoR)"** — `AdjustedRisk = BaseRisk × IntentFactor`, feeding access-control/mitigation tiers within this document's own proposed Proof-of-Intent/Risk/Value/Price protocol stack |

None of these four usages establishes a relationship to any of the others by primary evidence — shared naming does not manufacture shared lineage. Usage 4 is, by the document's own text, an unbuilt specification (no code, no receipts, no executed run), same as usages 1 and 3 in that respect; only usage 2 is implemented and exercised in real code.

---

## M. Claims Whose Status Has Actually Changed

| Claim | Previous status (v1.0) | New evidence | New status | Reason |
|---|---|---|---|---|
| PoTS is conditioned by Risk of Repair | Asserted as doctrinal connection only | `netValueAccelerationHours()` code inspected directly | **CONFIRMED as coded, not merely doctrinal** | Direct code inspection this pass |
| PoTS instrumentation | Not separately assessed in v1.0 | Real admin-gated verify/accrue route found, wired to Standing | **INSTRUMENTED/OPERATIONAL (machinery)**; observed-data status remains open | New file-level evidence |
| Golden Cycle evidence table | Not previously located precisely | `golden_cycle_records` schema found, zero writer code | **IMPLEMENTED (schema) / ABSENT (instrumentation)**, now schema-precise | Direct migration file inspection |
| Vela terminology | Treated as one system in prior general discussion | Found to name two unrelated systems + a third (Horizen) | **Disambiguated** — no prior single-system claim stands unqualified | Direct code inspection across `services/vela/` vs. `docs/vela/accelerator/` vs. `services/horizen/` |
| Lehigh corpus authorship/lineage | Treated as one undifferentiated "Lehigh corpus" | `Final_Report_metaMe1.pdf` = Patil's original; `DATA_RISK_FOR_MARKETPLACES_V2.md` = Atanda's explicit v2.0 extension; `PoTS_Protocol_Integration_Pack_v0.1.pdf` explicitly cites both by title | **STRENGTHENED** — confirmed single continuous lineage with named authors/team, not inferred from topic similarity | Direct full read of all 4 documents |
| PoTS formulation count | Treated as one doctrine formula plus one platform implementation | Lehigh corpus's own PoTS formula (`T_baseline − T_assisted`) read in full | **EXPANDED to three recorded formulations, none presumed canonical** — doctrine four-term, platform two-term (`netValueAccelerationHours`), Lehigh two-term with risk as a separate gate; recorded with provenance in §C's formulation registry as formalization/ontology debt for future Vela/IRL experimentation, not adjudicated here | Direct read of `PoTS_Protocol_Integration_Pack_v0.1.pdf`; per operator direction, divergence is not treated as contradiction |
| "Proof of Risk" usage count | Three non-interchangeable usages identified | `PoTS_Protocol_Integration_Pack_v0.1.pdf` names "Proof of Risk (PoR)" as a fourth, distinct protocol-layer usage | **EXPANDED to four usages** — none newly shown to relate to any other | Direct read of `PoTS_Protocol_Integration_Pack_v0.1.pdf` |
| Risk→Value→Price integration existence | Believed absent/unverifiable (dense PDFs not read) | `PoTS_Protocol_Integration_Pack_v0.1.pdf` is a real, citation-explicit integration specification (PoI/PoR/PoV/PoP stack) | **STRENGTHENED (as specification) / UNCHANGED (as implementation — still unbuilt, explicit un-started roadmap)** | Direct full read |
| Price-model executed output | Unknown (dense PDF not read) | Pricing paper contains real executed runs ($59.93 spot price, $116.33 20-year model, Monte Carlo stats) | **STRENGTHENED (executable) / UNCHANGED (unvalidated)** — the paper's own text states the output is "indicative rather than conclusive," run on random not historical inputs | Direct full read of `Pricng_Data_and_Risk_Final_Project_Paper.pdf` |

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

1. Whether any real `ProofOfOutcomeClaim` rows have been verified/accrued in the live Supabase project — **UNKNOWN**, no DB read access this pass. Still open as of the final pass — this required a live query, not a document read, and remains the single largest observed-data gap in the whole evidence-resolution effort.
2. ~~Whether `Book4.xlsx` contains any data beyond notebook-disclosed output~~ — **RESOLVED 2026-09-13**: read in full (25 sheets; Sheet8 = 104 records × 19 dimensions High/Medium/Low, closely but not exactly matching prior "105×19–23" characterization; 22 further per-dimension pairwise-relatedness sheets; Sheet1 legend; Sheet24 reordered mirror). No backtesting/outcome data found in the spreadsheet itself — it is raw expert-labelled input, consistent with its role as C/D's data source.
3. ~~Whether the dense pending-upload PDFs contain backtesting/validation content~~ — **RESOLVED 2026-09-13**: all 5 read in full. None contain executed backtesting against real/historical data. Two (the pricing paper, `Final_Report_metaMe1.pdf`) contain real executed *model* output (see §A Phases D/H) but explicitly disclose it as unvalidated/self-consistency-only, not backtested.
4. Whether `journey_states`/`orchestration_events` join to any of the RoR/PoTS/Golden-Cycle apparatus — **not verified column-by-column this pass**; flagged as open rather than assumed either way. Still open — not addressed by the corpus reading.
5. **New, from the full corpus read:** whether the platform's own `ventureOutcomeAccrual.ts` PoTS implementation was ever informed by, or is otherwise related to, the Lehigh corpus's `PoTS_Protocol_Integration_Pack_v0.1.pdf` specification — no shared file, import, commit reference, or cross-citation was found in either direction. Given they use the same name but materially different formulas (two-term vs. the doctrine's four-term shape the platform code approximates), this should be treated as two independent PoTS-naming efforts rather than one implementation descending from the other, absent evidence to the contrary.

---

## Machine-Readable Evidence Receipt

```json
{
  "record_type": "threshold-007-evidence-resolution-addendum",
  "record_version": "1.2",
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
    "codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/Test_metatMe_DataRisk_1.ipynb",
    "DATA_RISK_FOR_MARKETPLACES_V2.md (sha256 b98acea6442d6ca6298d078cf6f8e5fa064ffd40006db35c6d59bfb21ddcb468)",
    "Pricng_Data_and_Risk_Final_Project_Paper.pdf (sha256 5667a6789e216db3c0888f1932950ef4a281b5f4379491467626ded98a16458c)",
    "Plan_v.02.pdf (sha256 b01b26728361d6a941813f398efdb3ca4ad7d4f76ba9b17bfc3268fd7851f7c3)",
    "Final_Report_metaMe1.pdf (sha256 d1eb8f10ae86de3edad770163a49d4662f4c4486787002cd2b035feb87a59084)",
    "PoTS_Protocol_Integration_Pack_v0.1.pdf (sha256 ba9605a8074549d9414898000eaf27823947e46a923c09422a16fd4373d89d88)",
    "Value_engine_Logic.docx (sha256 2e5316369b71a0f75f70a2c5cc31ef69ee8e8012bcae8088b5f03dabdce5128f)",
    "Book4.xlsx (sha256 34858ed95809431e8e2923857f0e6df157c34a2aac0bfb420d3819626ccd773d)"
  ],
  "risk_lineage_status": "CONCEPTUAL_TO_EXPERIMENTALLY_EXERCISED",
  "value_lineage_status": "CONCEPTUAL_FORMULA_AND_PROSE_SPECIFIED_NOT_BACKTESTED",
  "price_lineage_status": "EXPERIMENTALLY_EXERCISED_ON_SYNTHETIC_INPUTS_NOT_VALIDATED",
  "risk_value_price_integration_status": "SPECIFICATION_EXISTS_POTS_PROTOCOL_PACK_UNIMPLEMENTED",
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
    "Constitutional-computing-enforces-at-point-of-action doctrine located and cross-referenced against Threshold 007's own Alternative Explanation 4 (H3 vs governance) register",
    "Lehigh corpus authorship/lineage confirmed as one continuous programme (Patil -> Atanda v2.0 -> pricing paper -> PoTS Integration Pack), not inferred",
    "Risk-Value-Price integration exists as a real, citation-explicit specification (PoTS_Protocol_Integration_Pack_v0.1.pdf), previously unverifiable"
  ],
  "claims_unchanged": [
    "Lehigh calibration hypothesis ceiling",
    "CFS-052 Proof of Risk Reduction non-implementation",
    "ProofOfRisk invariant-envelope narrow scope",
    "Consequence Horizon / H1b / H3d / H4 unmeasured status",
    "EXP-002 temporal-sequencing vs. longitudinal distinction",
    "No Time-to-Value, Consequence Horizon, Golden Cycle, or Risk of Repair terminology found anywhere in the 8-document Lehigh corpus"
  ],
  "claims_weakened": [],
  "pots_formulation_registry": [
    {"formulation": "PoTS = Baseline Time - Actual Time - Repair Burden - Risk Burden (after validity clears)", "provenance": "codexes/packs/polity-core/items/commentary/coyn-thesis/03-proof-of-time-saved.md:191,200", "date": "canonized 2026-07-17 (inv.polity.161/198)", "purpose": "constitutional/doctrinal measurement stack", "computational_role": "not directly executed as a four-term formula anywhere found", "evidence_status": "CONCEPTUAL_DOCTRINE_CANONIZED"},
    {"formulation": "netValueAccelerationHours = max(0, timeSavedHours - riskRepairHours)", "provenance": "services/venture/ventureOutcomeAccrual.ts", "date": "not independently dated this pass", "purpose": "real callable code feeding Standing accrual", "computational_role": "wired into admin-gated verify/accrue API route", "evidence_status": "IMPLEMENTED_INSTRUMENTED_OBSERVED_DATA_UNRESOLVED"},
    {"formulation": "PoTS_real = T_baseline - T_assisted (risk handled as separate AdjustedRisk = BaseRisk x IntentFactor gate)", "provenance": "PoTS_Protocol_Integration_Pack_v0.1.pdf", "date": "2026-02-18", "purpose": "proposed Lehigh-lineage Proof of Intent/Risk/Value/Price protocol integration", "computational_role": "specification only, explicit un-started implementation roadmap", "evidence_status": "CONCEPTUAL_PROPOSED_LEGITIMATE_HISTORICAL_PRIMITIVE_NOT_SUPERSEDED"}
  ],
  "pots_formulation_reconciliation_policy": "NOT_RECONCILED_BY_THIS_PASS -- per operator direction, no formulation is presumed canonical, divergence is formalization/ontology debt for the forthcoming Vela/IRL experimental programme, and future experiments should instrument shared primitive variables richly enough to compare formulations empirically rather than select a winner",
  "contradictions_found": [
    "Three different 'Investment Qube' risk percentages appear across the corpus for the same nominal bundle (60.90%/67.54% notebook comparison, 68.6% toy example, 82% full-scale run in Final_Report_metaMe1.pdf) -- not necessarily contradictory once differing scope/weighting-run is accounted for, but flagged so an adversary does not assume a single canonical figure exists"
  ],
  "unresolved_gaps": [
    "Whether real ProofOfOutcomeClaim rows exist in production (no DB access this pass) -- still open",
    "journey_states/orchestration_events linkage to RoR/PoTS/Golden-Cycle apparatus (not verified column-by-column) -- still open",
    "Whether the platform's ventureOutcomeAccrual.ts PoTS formulation and the Lehigh corpus's PoTS_Protocol_Integration_Pack_v0.1.pdf formulation share a primitive with different conditioning terms added, are independent formalizations of a related concept, or are a precursor/elaboration pair -- no cross-reference found either direction; per operator direction this is formalization/ontology debt for future Vela/IRL experimentation, not resolved by this pass and not adjudicated as one superseding the other"
  ],
  "primary_source_receipt": "read-only repository sweep, 2026-09-13, no database access, file:line citations recorded inline above",
  "constitutional_enforcement_locus_status": "PRIMARY_SOURCE_VERIFIED_DOCTRINE_ACTION_LAYER_NOT_REASONING_LAYER_CONSISTENT_WITH_ALTERNATIVE_4_NOT_DISPOSITIVE",
  "ror_consequence_horizon_substrate_status": "RESEARCH_PROPOSITION_NOT_EXPERIMENTALLY_ESTABLISHED_SEE_B1_H",
  "vela_horizon_consequential_pathway_status": "OPERATIONAL_PATHWAY_ARTICULATED_NOT_VALIDATED_SEE_D1",
  "pilot_vs_experiment_epistemic_role_status": "ARCHITECTURAL_METHODOLOGICAL_PROPOSITION_SUPPORTED_BY_IMPLEMENTATION_SEE_G1_I",
  "deferred_out_of_scope_items": [
    "candidate research proposition: constitutional robustness under deceptive cognition -- recorded separately, not as evidence-resolution fact (see 2026-09-13_threshold-007-candidate-research-proposition-deceptive-cognition.md and research_candidate_experiments row threshold-007-constitutional-robustness-under-deception)",
    "Evidence Access ClusterQube -- infrastructure/backlog, recorded in research_backlog_items, not evidence-resolution prose",
    "Lehigh corpus constitutionalization -- infrastructure/backlog, recorded in research_backlog_items, not evidence-resolution prose"
  ]
}
```

---

## Final Evidence-Agent Verdict

1. **What the newer Risk/Value/Price material genuinely changes:** it establishes, with file-level precision not previously recorded, that PoTS is the most mature construct in this entire evidentiary area — a real code reduction of the doctrinal formula, wired into a real admin-gated verify/accrue pipeline, with a confirmed (not assumed) coded RoR-conditioning relationship. It also establishes that the Golden Cycle's evidence substrate exists as schema with zero writers, that "Vela" is a three-way terminology trap, that a same-named-but-unrelated "Raw Capability Standing" score must not be mistaken for the Threshold 006 Raw/Effective Capability dichotomy, and — following the full read of all 8 Lehigh corpus documents — that a real, citation-explicit Risk→Value→Price integration specification exists (`PoTS_Protocol_Integration_Pack_v0.1.pdf`), that the corpus is one confirmed continuous authorship lineage (Patil→Atanda→pricing paper→PoTS pack), and that a third PoTS formulation and a fourth "Proof of Risk" usage are now on record. It surfaces a structural gap: the longitudinal chain is real in two disconnected halves with no unifying causal ID.

2. **What it does NOT change:** the Lehigh calibration hypothesis remains uncalibrated/unvalidated as causal or actuarial science. CFS-052 Proof of Risk Reduction remains unimplemented constitutional vocabulary. The `ProofOfRisk` invariant-envelope type remains a narrow relevance claim, not a risk model. Consequence Horizon, H1b, H3d, and H4 remain unmeasured, exactly as the manuscript's own text discloses — confirmed rather than merely reaffirmed, since none of the 8 newly-read documents contains the terms "Consequence Horizon," "Time-to-Value," "Golden Cycle," or "Risk of Repair" at all. The EXP-002 temporal-sequencing-vs.-longitudinal distinction from v1.0 is preserved unaltered.

3. **Whether the existing Evidence-Resolution Pass requires factual correction, evidentiary enrichment, or both:** primarily evidentiary enrichment, with one genuine correction (the pricing paper, not the master v2.0 document, was previously mischaracterized as "the only place PoTS is named" — PoTS is actually named in the Integration Pack). Per operator direction, the newly identified PoTS formula divergence (three formulations now on record) and the fourth "Proof of Risk" usage are recorded as formalization/ontology debt and additional distinct usages respectively — **not** as corrections requiring reconciliation, and not ranked against each other.

4. **Whether the evidence substrate is now sufficiently resolved to hand to the Longitudinal Adversary:** yes, with the disclosed gaps above (production-data status of PoTS claims, unverified journey/orchestration linkage, the unresolved relationship between the platform's and the Lehigh corpus's PoTS formulations) explicitly carried forward rather than silently omitted or prematurely resolved.

**EVIDENCE RESOLUTION — COMPLETE WITH DISCLOSED GAPS**
