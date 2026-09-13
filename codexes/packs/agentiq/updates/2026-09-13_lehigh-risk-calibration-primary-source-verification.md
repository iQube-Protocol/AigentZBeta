# Lehigh Risk-Calibration Primary-Source Verification — 13 September 2026

**Status:** Read-only research/evidence update. Does **not** modify the manuscript, `content_publication_gates`, `research_review_records`, `research_publication_records`, or any other publication-gate state. Threshold 007.2 is already canonical (`researchCompanionStatus = "canonical"`, `gate_status = "approved"`) — this entry is post-publication research provenance for a future edition / B→C programme, not a retroactive change to what was published.

## What was verified

Primary-source artifacts underlying the Lehigh ERM/risk-calibration lineage documented in `CFS-056B_lehigh-erm-calibration-and-enforcement-lineage.md` have now been inspected directly rather than relied upon solely through filename/hash provenance. The verified material includes:

- The expert-labelled risk matrix (`Book4.xlsx`, Sheet8: 105 data types × 19–23 risk dimensions rated High/Medium/Low; `Sheet1`/`Identifiability` sheets carry the broader dimension/definition scaffold) and its raw Python source form (`copy_of_metame_practice_amit.py` — the original 105-record `risk_matrix` dict, 22 dimensions, attributed to Amit Rajendra Patil's original work).
- Executable frequency-weight derivation methodology, in two generations: `metatMe_DataRisk.ipynb` (the original exploratory notebook — iQube data structures, matrix operations, risk-matrix-to-DataFrame scoring) and `Test_metatMe_DataRisk_1.ipynb` (a cleaned, fully executed Colab version that loads `Book4.xlsx`, derives weights via `score = High×3 + Medium×2 + Low×1`, normalized to mean 1.0, and defines 8 named iQube bundles).
- A concrete executed scoring example: the "Investment Qube" bundle scored 60.90% (Medium Risk) unweighted vs. **67.54% (High Risk)** under the empirically-derived weights, with full per-dimension and per-data-type contribution breakdowns (top weighted dimensions: Reputation 1.378, Compliance 1.311, Legal 1.295, Strategic 1.295; lowest: Environmental/Military/Public Welfare 0.584).
- The **Data Risk for Marketplaces v2.0** methodology report (Dele Atanda, building on Amit Rajendra Patil's original work) — the 23 original + expanded temporal/contextual/technical/positive-value risk dimensions, the multi-source weighting integration (historical incident analysis, Delphi expert consensus, regulatory fine structures, insurance premium data, ML optimization), the data-risk half-life/decay-growth temporal models, non-linear combination/synergy models, and intent-based risk modulation.
- Associated pricing/value-engine material: a prose "Value Engine Logic" description and its corresponding runnable Python implementation (`value_engine.py`, importing from a companion `risk_engine` module), which derives seller/buyer-weighted value scores per dimension from the risk model's own weights, applies temporal aging and risk-inversion logic, and computes a bilateral seller/buyer value-convergence score.
- The **PoTS Protocol Integration Pack v0.1**.

This materially strengthens the **provenance and methodological legibility** of the Lehigh risk-calibration lineage. In particular, it establishes that the cited lineage is backed by substantive primary artifacts containing an explicit risk taxonomy, expert-labelled observations, reproducible weight derivation, executable scoring, and temporal treatment of risk-score evolution.

## Epistemic boundary

This verification does **not** constitute implementation or validation of the constitutional **Proof of Risk / Proof of Risk Reduction** construct (`CFS-052_evidence-architecture-and-dual-validation.md`, self-declared "constitutional vocabulary with no implementation"). It also does not establish that the Lehigh scoring methodology produces the separately implemented `ProofOfRisk` invariant-envelope object (`types/invariantEnvelope.ts` — a narrow, per-intent relevance/evidence claim: risk vector + repair path + severity/probability/uncertainty + reversibility/blast-radius, explicitly "not a prediction of occurrence"). These three constructs must remain distinguished; "Proof of Risk" is not a single mechanism in this codebase, and this upload set maps only onto the first.

The observed empirical weighting procedure is a documented **calibration hypothesis** derived from frequency-weighted expert labels — one 105-row hand-labeled spreadsheet, one small expert panel — not evidence that observed frequency establishes causal importance, actuarial validity, or general risk law. The epistemic ceiling stated in `CFS-056A_lehigh-source-grounding-for-ide-v2-and-crystal-vp2.md` ("valuable as a calibration hypothesis... MUST NOT be treated as proof that frequency equals causal importance") therefore remains in force, and is if anything reinforced by having now seen the underlying methodology directly.

The artifacts likewise provide **no new evidence for Consequence Horizon, H1b frontier extension, or longitudinal consequence projection**. Temporal decay/growth of a risk score (the half-life models in the Data Risk for Marketplaces report) concerns the evolution of an *assessed risk score* through time; it is not equivalent to measuring the temporal or causal distance over which *consequences of an action* can be projected reliably — the distinct construct Threshold 007's H1b addresses, which remains unmeasured by any existing instrument (see `2026-09-13_threshold-007-evidence-resolution-pass.md`-equivalent findings from the same day's audit).

Any REIT Qube schema derived subsequently from this taxonomy (OperatorQube / InvestorQube / DeFiLenderQube, drafted the same day as this verification) should be classified as **new design/application work**, not retrospective evidence supporting Threshold 007.

## Terminology note — three distinct things, not one

| Term | Status | What the new artifacts establish |
|---|---|---|
| **Lehigh risk calibration / scoring** | Primary methodology now directly verified | **Strengthened** |
| **CFS-052 Proof of Risk Reduction** | Constitutional vocabulary; no implementation per its own status | **Not strengthened as implementation/validation** |
| **`ProofOfRisk` invariant-envelope type** | Implemented narrow per-intent relevance/evidence structure | **Existence unchanged; not produced/validated by Lehigh artifacts** |

This is the difference between **genealogical evidence** (the Lehigh materials substantially improve this) and **validation evidence** (they do not, and should not be read as, laundering genealogy into validation).

## Evidence disposition

- **Disposition:** `PRIMARY_SOURCE_VERIFIED / PROVENANCE_STRENGTHENED`
- **Does not promote:** `Proof of Risk` validation, Consequence Horizon, H1b, H3d, H4, or the evidentiary maturity of Threshold 007 (remains B; conceptual/research ceiling remains C).
- **Research significance:** the material strengthens the historical and methodological substrate from which Risk of Repair, risk calibration, pricing/value experimentation, and later consequence-oriented research may draw. It establishes a richer antecedent research lineage; it does not by itself establish the later causal or constitutional claims.

## Disposition relative to Threshold 007.2

007.2's frozen candidate, ARR disposition (`PASS_WITH_DISCLOSED_GAPS`), and canonical publication record are unchanged and untouched by this entry. This is recorded as post-publication research provenance available to a future edition or the B→C validation programme.
