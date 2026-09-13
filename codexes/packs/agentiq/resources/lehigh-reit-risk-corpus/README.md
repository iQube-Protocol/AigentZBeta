# Lehigh / REIT Risk-Calibration Resource Corpus

**Added:** 2026-09-13. Companion to
`codexes/packs/agentiq/updates/2026-09-13_lehigh-risk-calibration-primary-source-verification.md`
(the read-only evidence-provenance record this corpus backs).

This directory is the durable, citable home for the primary-source risk-calibration and
value-engine material operator-supplied on 2026-09-13, so future research passes (B→C validation,
a future Threshold edition, REIT/DeFi application work) can cite these artifacts directly rather
than through filename/hash reference alone.

**Per `CLAUDE.md`'s Dense Materials rule, this directory carries source CODE and TEXT only.**
PDFs, spreadsheets, and binary documents from the same upload batch are NOT committed here — they
are listed below as pending pointers, to be uploaded to Autonomys Auto Drive (their correct home
per that rule) once the two upload-side credentials are available. See "Pending Auto Drive
uploads" below.

## Committed in this directory

| File | sha256 | What it is |
|---|---|---|
| `original_risk_matrix_amit_patil.py` | `679b70f63f5a9b275ca5f37c2c4669b70e9fae2d690d1123d7ca02832f4a86e3` | The original 105-record × 22-dimension personal-data risk matrix (Amit Rajendra Patil's original work, per the Data Risk for Marketplaces v2.0 report's own attribution) as a raw Python dict, plus early exploratory scoring/classification code (k-means-adjacent, z-score, itertools combination testing). |
| `metatMe_DataRisk.ipynb` | `6c809698ed1997bacadb6afa43808d5c7b040ab6e8864bc903bca2a2eec1573f` | The original exploratory Colab notebook — iQube-oriented data structures, matrix operations, early risk-matrix-to-DataFrame scoring logic. Matches `CFS-056B_lehigh-erm-calibration-and-enforcement-lineage.md`'s citation of `metatMe_DataRisk.ipynb`. |
| `Test_metatMe_DataRisk_1.ipynb` | `8a228d17e6cbd9920ef2dd57379bc5df172f52b367bbf832d2aa83265eeb4a68` | The cleaned, fully-executed successor notebook. Loads `Book4.xlsx` (Sheet8), derives dimension weights empirically (`score = High×3 + Medium×2 + Low×1`, normalized to mean 1.0), defines 8 named iQube bundles (Open Bank Account, New Credit Card, Mortgage Application, Car Finance, Student Loan, Investment, Retirement Plan, Debt Management Qube), and includes real executed output — e.g. "Investment Qube" scoring 60.90% (Medium Risk) unweighted vs. 67.54% (**High Risk**) under the derived weights. This is the executable lineage cited (as `Test metatMe_DataRisk.ipynb`) in `CFS-056B`, and is the direct ancestor of `services/invariants/riskCalibration.ts`'s `derivePrevalenceWeights` (which reproduces this exact formula). |
| `value_engine.py` | `64ede5fd0d3d6c8af95a97c63b0bbef8b2f03affb76e1fe2bff2ee7d0eddeff6` | A runnable value-scoring engine (`ValueEngineB`, `ValueConvergenceEngine`) that imports from a companion `risk_engine` module (not yet supplied — imports will not resolve standalone). Derives seller/buyer-weighted value scores per dimension from the risk model's own weights, applies temporal aging + risk-inversion logic per dimension, and computes a bilateral seller/buyer value-convergence score. Implements, in code, what `Value_engine_Logic.docx` (pending Auto Drive upload, see below) describes in prose. |

**Epistemic status, per the evidence-provenance record this corpus backs:** this is primary-source
material for the Lehigh risk-calibration lineage — a documented calibration hypothesis (frequency-
weighted expert labels from one panel, one spreadsheet), not validated causal/actuarial science.
It does not implement or validate the constitutional Proof of Risk / Proof of Risk Reduction
construct, and provides no evidence for Consequence Horizon, H1b, or longitudinal instrumentation.
See the linked update doc for the full epistemic boundary.

## Pending Auto Drive uploads (dense materials — not committed here)

Per `CLAUDE.md`: "Manuscripts, corpora, media and build output do not belong in git. The repo
carries the POINTER... never the bytes." These files were supplied in the same batch and are
listed here with their sha256 fingerprints so the pointer records can be filled in once uploaded
via `upload_content_asset` (requires either the two upload-side secrets, `AUTONOMYS_API_KEY` +
`CODEX_MASTER_KEY`, to script the upload locally reading bytes directly off disk with no
transcription step, or a native admin-UI upload by the operator whose resulting asset id/CID can
then be recorded here):

| File | sha256 | Size | Status |
|---|---|---|---|
| `DATA_RISK_FOR_MARKETPLACES_V2.md` | `b98acea6442d6ca6298d078cf6f8e5fa064ffd40006db35c6d59bfb21ddcb468` | 186 KB | pending — treated as long-form research report, not source code |
| `Pricng_Data_and_Risk_Final_Project_Paper.pdf` | `5667a6789e216db3c0888f1932950ef4a281b5f4379491467626ded98a16458c` | 856 KB | pending |
| `Plan_v.02.pdf` | `b01b26728361d6a941813f398efdb3ca4ad7d4f76ba9b17bfc3268fd7851f7c3` | 196 KB | pending |
| `Final_Report_metaMe1.pdf` | `d1eb8f10ae86de3edad770163a49d4662f4c4486787002cd2b035feb87a59084` | 1.78 MB | pending |
| `PoTS_Protocol_Integration_Pack_v0.1.pdf` | `ba9605a8074549d9414898000eaf27823947e46a923c09422a16fd4373d89d88` | 206 KB | pending |
| `Value_engine_Logic.docx` | `2e5316369b71a0f75f70a2c5cc31ef69ee8e8012bcae8088b5f03dabdce5128f` | 17 KB | pending |
| `Book4.xlsx` | `34858ed95809431e8e2923857f0e6df157c34a2aac0bfb420d3819626ccd773d` | 1.0 MB | pending — the expert-labelled 105×19 risk matrix `Test_metatMe_DataRisk_1.ipynb` (above) loads |

**Why these aren't in git:** even setting the Dense Materials rule aside, several of these exceed
what can be reliably transcribed through a single MCP tool-call argument in this session (base64
payloads above roughly 150–200 KB have been observed to exceed this environment's per-call read/
context limits, risking silent truncation-driven corruption with no cheap way to detect it). The
correct path is a local upload script reading these files directly off disk (no transcription
through the conversation at all), which requires the two upload-side secrets named above.

## Update this manifest

Once any pending file is uploaded, replace its row above with: CID, `codex_media_assets` id,
upload timestamp, and confirm the sha256 matches post-upload before marking it resolved.
