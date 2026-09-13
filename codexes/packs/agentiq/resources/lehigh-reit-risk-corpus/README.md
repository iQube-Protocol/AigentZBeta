# Lehigh / REIT Risk-Calibration Resource Corpus

**Added:** 2026-09-13. Companion to
`codexes/packs/agentiq/updates/2026-09-13_lehigh-risk-calibration-primary-source-verification.md`
(the read-only evidence-provenance record this corpus backs).

This directory is the durable, citable home for the primary-source risk-calibration and
value-engine material operator-supplied on 2026-09-13, so future research passes (B→C validation,
a future Threshold edition, REIT/DeFi application work) can cite these artifacts directly rather
than through filename/hash reference alone.

**Per `CLAUDE.md`'s Dense Materials rule, this directory carries source CODE and TEXT only.**
PDFs, spreadsheets, and binary documents from the same upload batch are NOT committed here — the
repo carries only the pointer. Those 8 dense files are now uploaded to **Supabase Storage**
(`content-assets` bucket, public, `research/lehigh-reit-risk-corpus/` prefix) in the live "Aigent Z"
Supabase project, per the Dense Materials rule's sanctioned home for "working drafts... anything the
app serves." See "Dense materials — Supabase Storage" below for the resolved URLs.

## Committed in this directory

GitHub URLs are pinned to commit `702300117` on `claude/cool-edison-5t0fc9` (the branch this work
shipped on). Once merged, prefer the same path on `dev`/`main`; the commit-pinned URLs below remain
valid indefinitely regardless of branch lifecycle as long as the commit stays reachable.

| File | sha256 | GitHub (blob / raw) | What it is |
|---|---|---|---|
| `original_risk_matrix_amit_patil.py` | `679b70f63f5a9b275ca5f37c2c4669b70e9fae2d690d1123d7ca02832f4a86e3` | [blob](https://github.com/iQube-Protocol/AigentZBeta/blob/70230011/codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/original_risk_matrix_amit_patil.py) · [raw](https://raw.githubusercontent.com/iQube-Protocol/AigentZBeta/70230011/codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/original_risk_matrix_amit_patil.py) | The original 105-record × 22-dimension personal-data risk matrix (Amit Rajendra Patil's original work, per the Data Risk for Marketplaces v2.0 report's own attribution) as a raw Python dict, plus early exploratory scoring/classification code (k-means-adjacent, z-score, itertools combination testing). A second, byte-identical copy of this same file (sha256-confirmed) was re-supplied 2026-09-13; no revision exists, both uploads are the same artifact. |
| `metatMe_DataRisk.ipynb` | `6c809698ed1997bacadb6afa43808d5c7b040ab6e8864bc903bca2a2eec1573f` | [blob](https://github.com/iQube-Protocol/AigentZBeta/blob/70230011/codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/metatMe_DataRisk.ipynb) · [raw](https://raw.githubusercontent.com/iQube-Protocol/AigentZBeta/70230011/codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/metatMe_DataRisk.ipynb) | The original exploratory Colab notebook — iQube-oriented data structures, matrix operations, early risk-matrix-to-DataFrame scoring logic. Matches `CFS-056B_lehigh-erm-calibration-and-enforcement-lineage.md`'s citation of `metatMe_DataRisk.ipynb`. |
| `Test_metatMe_DataRisk_1.ipynb` | `8a228d17e6cbd9920ef2dd57379bc5df172f52b367bbf832d2aa83265eeb4a68` | [blob](https://github.com/iQube-Protocol/AigentZBeta/blob/70230011/codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/Test_metatMe_DataRisk_1.ipynb) · [raw](https://raw.githubusercontent.com/iQube-Protocol/AigentZBeta/70230011/codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/Test_metatMe_DataRisk_1.ipynb) | The cleaned, fully-executed successor notebook. Loads `Book4.xlsx` (Sheet8), derives dimension weights empirically (`score = High×3 + Medium×2 + Low×1`, normalized to mean 1.0), defines 8 named iQube bundles (Open Bank Account, New Credit Card, Mortgage Application, Car Finance, Student Loan, Investment, Retirement Plan, Debt Management Qube), and includes real executed output — e.g. "Investment Qube" scoring 60.90% (Medium Risk) unweighted vs. 67.54% (**High Risk**) under the derived weights. This is the executable lineage cited (as `Test metatMe_DataRisk.ipynb`) in `CFS-056B`, and is the direct ancestor of `services/invariants/riskCalibration.ts`'s `derivePrevalenceWeights` (which reproduces this exact formula). |
| `value_engine.py` | `64ede5fd0d3d6c8af95a97c63b0bbef8b2f03affb76e1fe2bff2ee7d0eddeff6` | [blob](https://github.com/iQube-Protocol/AigentZBeta/blob/70230011/codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/value_engine.py) · [raw](https://raw.githubusercontent.com/iQube-Protocol/AigentZBeta/70230011/codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/value_engine.py) | A runnable value-scoring engine (`ValueEngineB`, `ValueConvergenceEngine`) that imports from a companion `risk_engine` module (not yet supplied — imports will not resolve standalone). Derives seller/buyer-weighted value scores per dimension from the risk model's own weights, applies temporal aging + risk-inversion logic per dimension, and computes a bilateral seller/buyer value-convergence score. Implements, in code, what `Value_engine_Logic.docx` (pending Auto Drive upload, see below) describes in prose. |

**Epistemic status, per the evidence-provenance record this corpus backs:** this is primary-source
material for the Lehigh risk-calibration lineage — a documented calibration hypothesis (frequency-
weighted expert labels from one panel, one spreadsheet), not validated causal/actuarial science.
It does not implement or validate the constitutional Proof of Risk / Proof of Risk Reduction
construct, and provides no evidence for Consequence Horizon, H1b, or longitudinal instrumentation.
See the linked update doc for the full epistemic boundary.

## Dense materials — Supabase Storage (uploaded 2026-09-13)

Per `CLAUDE.md`: "Manuscripts, corpora, media and build output do not belong in git. The repo
carries the POINTER... never the bytes." These 8 files were supplied across the 2026-09-13 upload
batch and are now uploaded to Supabase Storage — `content-assets` bucket (public,
`research/lehigh-reit-risk-corpus/` prefix), project `bsjhfvctmduxhohtllly` ("Aigent Z", the live
project verified by schema match — `codex_media_assets`, `content_publication_gates`,
`golden_cycle_records`, `venture_qubes` all present). Upload was done via a temporary,
secret-gated Edge Function that streamed each file's raw bytes directly from disk to Storage using
the project's own service-role credential (never exposed to or handled by the agent); the function
has since been retired (redeployed as an inert 410 stub — no delete-function capability was
available via MCP at the time). **Every post-upload sha256 was recomputed server-side and matches
the pre-upload fingerprint below exactly** — no transcription step was involved, so there is no
truncation/corruption risk to disclose here (contrast the earlier blocked cover-image upload
attempt, which hit a base64-transcription limit; this path avoided that failure mode entirely by
never routing file bytes through the conversation).

| File | sha256 (confirmed pre- and post-upload) | Size | Supabase Storage URL |
|---|---|---|---|
| `DATA_RISK_FOR_MARKETPLACES_V2.md` | `b98acea6442d6ca6298d078cf6f8e5fa064ffd40006db35c6d59bfb21ddcb468` | 186,139 bytes | https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-assets/research/lehigh-reit-risk-corpus/DATA_RISK_FOR_MARKETPLACES_V2.md |
| `Pricng_Data_and_Risk_Final_Project_Paper.pdf` | `5667a6789e216db3c0888f1932950ef4a281b5f4379491467626ded98a16458c` | 876,491 bytes | https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-assets/research/lehigh-reit-risk-corpus/Pricng_Data_and_Risk_Final_Project_Paper.pdf |
| `Plan_v.02.pdf` | `b01b26728361d6a941813f398efdb3ca4ad7d4f76ba9b17bfc3268fd7851f7c3` | 195,719 bytes | https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-assets/research/lehigh-reit-risk-corpus/Plan_v.02.pdf |
| `Final_Report_metaMe1.pdf` | `d1eb8f10ae86de3edad770163a49d4662f4c4486787002cd2b035feb87a59084` | 1,785,178 bytes | https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-assets/research/lehigh-reit-risk-corpus/Final_Report_metaMe1.pdf |
| `PoTS_Protocol_Integration_Pack_v0.1.pdf` | `ba9605a8074549d9414898000eaf27823947e46a923c09422a16fd4373d89d88` | 206,460 bytes | https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-assets/research/lehigh-reit-risk-corpus/PoTS_Protocol_Integration_Pack_v0.1.pdf |
| `Value_engine_Logic.docx` | `2e5316369b71a0f75f70a2c5cc31ef69ee8e8012bcae8088b5f03dabdce5128f` | 17,274 bytes | https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-assets/research/lehigh-reit-risk-corpus/Value_engine_Logic.docx |
| `Book4.xlsx` | `34858ed95809431e8e2923857f0e6df157c34a2aac0bfb420d3819626ccd773d` | 1,002,273 bytes | https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-assets/research/lehigh-reit-risk-corpus/Book4.xlsx — the expert-labelled 105×19 risk matrix `Test_metatMe_DataRisk_1.ipynb` (above) loads |
| `Dhrunal_Belani_Final_Report_MetaMe_2.pdf` | `8693f29535c7cea8b72bb5831f18e24411fd368ddc539228512b199e2c9121eb` | 404,058 bytes | https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-assets/research/lehigh-reit-risk-corpus/Dhrunal_Belani_Final_Report_MetaMe_2.pdf — Lehigh MFE capstone report; a second, independent risk-calibration writeup (32-dimension taxonomy, 5-source empirical weighting). Uses "Proof of Risk" as a third, non-equivalent term and references PoTS in a new, unvalidated pricing-formula context — see the terminology caveat in `2026-09-13_lehigh-risk-calibration-primary-source-verification.md`. |

**Not registered in `codex_media_assets`.** These uploads went directly to Storage via the
mechanism above, bypassing the app's normal `upload_content_asset` → `codex_media_assets` →
iQube-trinity registration pipeline (that pipeline targets Autonomys Auto Drive for canonical,
provenance-bearing content, not Supabase Storage, and was unavailable this session — the
`threshold` MCP connector required OAuth re-authorization). These files are plain public Storage
objects: durable, directly linkable, and sha256-verified, but **not** iQube-registered artifacts. If
a future pass wants them to carry iQube metadata/registry entries, that is separate work, not
implied by this upload.

## Update this manifest

If any file above is superseded (a corrected version, an Auto Drive/iQube-registered promotion),
replace its row with the new pointer and re-confirm the sha256 before marking the old row
superseded rather than silently overwritten.
