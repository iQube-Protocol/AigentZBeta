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

## Addendum — second primary source: Dhrunal Belani Lehigh MFE capstone report (2026-09-13)

A second, independent Lehigh MFE capstone report (`Dhrunal_Belani_Final_Report_MetaMe_2.pdf`, sha256 `8693f29535c7cea8b72bb5831f18e24411fd368ddc539228512b199e2c9121eb`) has been read in full. It is a distinct document from the Amit Rajendra Patil / Data Risk for Marketplaces lineage above, not a revision of it. Separately, a re-upload of `copy_of_metame_practice_amit.py` supplied in the same batch was checked byte-for-byte (`diff` + `sha256sum`) against the already-committed `original_risk_matrix_amit_patil.py` in this corpus: **it is identical** (sha256 `679b70f63f5a9b275ca5f37c2c4669b70e9fae2d690d1123d7ca02832f4a86e3` on both) — no revised model exists in this batch, despite being framed as "the more recent risk model."

**What the Belani report contains:**

- Its own 32-dimension personal-data risk taxonomy (larger than the 22/23-dimension Patil/Atanda taxonomy — a related but independently-elaborated scheme, not a shared source file).
- A 5-source empirical weighting methodology: historical breach-incident frequency, a Delphi expert panel (reporting Kendall's W convergence rising across rounds: 0.470 → 0.749 → 0.855), regulatory fine structures, insurance/actuarial premium signals, and an ML/Ridge-regression fit (R² = 0.951) — which the report's own author flags as a possible overfitting indicator given the small sample.
- Context-transition multipliers and temporal decay models for how a data type's risk score evolves.
- Three candidate pricing formulas, one of which references "Proof of Time Saved (PoTS)" and credits "Dele Atanda."
- Its own internal usage of the term **"Proof of Risk"** — here naming a pipeline stage that outputs a calibrated risk score, not the CFS-052 constitutional construct and not the `ProofOfRisk` invariant-envelope type.

**Epistemic treatment — same boundary as above, extended to a third meaning of the term:**

This document is additional **primary-source evidence for the Lehigh risk-calibration lineage** — it independently corroborates that multiple, separately-elaborated calibration efforts exist under this research programme, with a richer 5-source weighting scheme and self-disclosed statistical caveats (the author's own overfitting flag on the R²=0.951 Ridge result should be taken at face value, not discounted). It does **not** strengthen, implement, or validate the CFS-052 Proof of Risk / Proof of Risk Reduction construct, and provides **no** evidence for Consequence Horizon, H1b, or longitudinal instrumentation.

There are now **three non-interchangeable uses of "Proof of Risk" in this corpus** and they must not be conflated:

| Usage | Source | What it names |
|---|---|---|
| Constitutional vocabulary | `CFS-052_evidence-architecture-and-dual-validation.md` | "Proof of Risk Reduction" — declared constitutional vocabulary, self-described as having no implementation |
| Invariant-envelope type | `types/invariantEnvelope.ts` | `ProofOfRisk` — an implemented, narrow per-intent relevance/evidence structure (risk vector + repair path + severity/probability/uncertainty + reversibility/blast-radius); explicitly not a prediction of occurrence |
| Pipeline-stage label | Dhrunal Belani report | A named stage in this document's own pricing pipeline that outputs a calibrated risk score — a document-local usage, not a reference to either of the above |

The report's reference to "Proof of Time Saved (PoTS)" in a new pricing-formula context is likewise **not** an extension of PoTS's canonical status (`services/venture/ventureOutcomeAccrual.ts` / the PoTS invariant) — it is this document's own proposed application of the name to a formula that has not been implemented, tested, or ratified anywhere in this codebase. Any future work drawing on this formula should treat it as new design material citing PoTS by name, not as evidence that PoTS already covers this pricing use case.

**Disposition:** `PRIMARY_SOURCE_VERIFIED / PROVENANCE_STRENGTHENED` (same as above) — extended to cover a second, independent Lehigh calibration lineage. Threshold 007.2's canonical status, frozen candidate, and ARR disposition remain untouched.

**Corpus note:** `Dhrunal_Belani_Final_Report_MetaMe_2.pdf` is recorded as a pending Auto Drive upload in `codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/README.md` (dense-material PDF, not committed to git per the Dense Materials rule). The re-uploaded `copy_of_metame_practice_amit.py` required no new corpus entry since it is byte-identical to the file already committed there.
