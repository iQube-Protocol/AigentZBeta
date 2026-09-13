# Threshold 007 — Longitudinal Evidence Bundle v1.0 (FROZEN)

**Status: FROZEN at commit `cdcec90aa7e62550e44eda20802f873452f287eb`, 2026-09-13T20:51:15Z.** This is a manifest and consolidation document, not a rewrite of prior evidence-resolution work. It resolves stable references to the component documents/artifacts, consolidates the claim-change ledger and unresolved-gaps register across all of them, adds the cross-cutting analyses the instructing task required (Consequence Horizon 7-way status, longitudinal telemetry classification, Raw vs Effective Capability, tacit-observation status), and freezes the whole as one identifiable handoff candidate for the Longitudinal Adversary.

**Role:** Evidence Agent. Not Aletheon, not the Longitudinal Adversary, not the ARR reviewer, not the Publication Gate, not an advocate for or against Threshold 007. This bundle establishes what exists, what it measures, its provenance, what has been implemented, what has been observed, what has been experimentally exercised, what remains hypothesis, and what remains unresolved. It does not perform the Longitudinal Adversary's scientific interpretation, does not adjudicate the deception research question, and does not decide B→C.

**Governing rule applied throughout:** do not optimize for the thesis; do not optimize against it. Negative evidence, discrepancies, and unresolved gaps are preserved, not cleaned. Divergent formulations (PoTS, "Proof of Risk") are recorded with provenance, not reconciled or ranked, per explicit operator instruction.

---

## Bundle Manifest

### Evidence-resolution documents (component parts of this bundle, by reference — not duplicated here)

| Document | Path | SHA-256 (as committed at `cdcec90aa`) |
|---|---|---|
| Evidence-Resolution Pass v1.0 | `codexes/packs/agentiq/updates/2026-09-13_threshold-007-evidence-resolution-pass.md` | `0098e600f9bb52caa37a09fd259d258c6db317541198efb6694af408fb8c9441` |
| Evidence-Resolution Pass v1.2 (the "v1.1 addendum" file — three operator-directed sections plus the full Lehigh corpus fold-in) | `codexes/packs/agentiq/updates/2026-09-13_threshold-007-evidence-resolution-v1.1-addendum.md` | `512489040cf6b7fd819222d0fd78e1659a0f8921b33038dd18622e9cfa167b8d` |
| Lehigh Risk-Calibration Primary-Source Verification (+ Dhrunal Belani addendum) | `codexes/packs/agentiq/updates/2026-09-13_lehigh-risk-calibration-primary-source-verification.md` | `3509b4388c35d3d41479af74454c7d8cdcd21900a41158705af93c2f32a440a3` |
| Candidate research proposition: constitutional robustness under deceptive cognition (PROPOSED, not evidence, not adjudicated) | `codexes/packs/agentiq/updates/2026-09-13_threshold-007-candidate-research-proposition-deceptive-cognition.md` | `f275de2feffdbc26f8facd70794a059591b636a51d6e72a2d97e0fcea4fce44c` |
| Infrastructure/backlog note (Evidence Access ClusterQube; Lehigh corpus constitutionalization) | `codexes/packs/agentiq/updates/2026-09-13_threshold-007-infrastructure-backlog-note.md` | `9a927a31bf6b59f7dfe4faea698f0a62880ad52642b8bcb3538e6f7cd29e5ffd` |
| Lehigh REIT risk corpus manifest/README | `codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/README.md` | `f460d9baa1b4d5a1e955efb0a75965127f74c33cd9971c3d6f28c0aa2923dfe5` |

### Primary source-code artifacts (Lehigh, committed to repo)

| Artifact | Path | SHA-256 |
|---|---|---|
| Original risk matrix (Amit Patil) | `codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/original_risk_matrix_amit_patil.py` | `679b70f63f5a9b275ca5f37c2c4669b70e9fae2d690d1123d7ca02832f4a86e3` |
| Original exploratory notebook | `codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/metatMe_DataRisk.ipynb` | `6c809698ed1997bacadb6afa43808d5c7b040ab6e8864bc903bca2a2eec1573f` |
| Cleaned/executed successor notebook | `codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/Test_metatMe_DataRisk_1.ipynb` | `8a228d17e6cbd9920ef2dd57379bc5df172f52b367bbf832d2aa83265eeb4a68` |
| Value-scoring engine | `codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/value_engine.py` | `64ede5fd0d3d6c8af95a97c63b0bbef8b2f03affb76e1fe2bff2ee7d0eddeff6` |

### Primary dense-material artifacts (Lehigh, Supabase Storage — public bucket, constitutional registration PENDING, see backlog note above)

All hashes recomputed server-side post-upload and independently re-verified again on 2026-09-13 by direct download + `sha256sum` for this bundle; every value matches exactly.

| Artifact | Storage path | SHA-256 |
|---|---|---|
| Data Risk for Marketplaces v2.0 (master document, Dele Atanda) | `content-assets/research/lehigh-reit-risk-corpus/DATA_RISK_FOR_MARKETPLACES_V2.md` | `b98acea6442d6ca6298d078cf6f8e5fa064ffd40006db35c6d59bfb21ddcb468` |
| Pricing Data and Risk Final Project Paper | `content-assets/research/lehigh-reit-risk-corpus/Pricng_Data_and_Risk_Final_Project_Paper.pdf` | `5667a6789e216db3c0888f1932950ef4a281b5f4379491467626ded98a16458c` |
| Plan v.02 (Edson Bope, Curation workstream plan) | `content-assets/research/lehigh-reit-risk-corpus/Plan_v.02.pdf` | `b01b26728361d6a941813f398efdb3ca4ad7d4f76ba9b17bfc3268fd7851f7c3` |
| Final Report metaMe1 (Amit Patil's original Lehigh GBUS 485 report) | `content-assets/research/lehigh-reit-risk-corpus/Final_Report_metaMe1.pdf` | `d1eb8f10ae86de3edad770163a49d4662f4c4486787002cd2b035feb87a59084` |
| PoTS Protocol Integration Pack v0.1 | `content-assets/research/lehigh-reit-risk-corpus/PoTS_Protocol_Integration_Pack_v0.1.pdf` | `ba9605a8074549d9414898000eaf27823947e46a923c09422a16fd4373d89d88` |
| Value Engine Logic (prose) | `content-assets/research/lehigh-reit-risk-corpus/Value_engine_Logic.docx` | `2e5316369b71a0f75f70a2c5cc31ef69ee8e8012bcae8088b5f03dabdce5128f` |
| Book4.xlsx (expert-labelled risk matrix, 25 sheets) | `content-assets/research/lehigh-reit-risk-corpus/Book4.xlsx` | `34858ed95809431e8e2923857f0e6df157c34a2aac0bfb420d3819626ccd773d` |
| Dhrunal Belani Final Report MetaMe 2 (second, independent Lehigh capstone) | `content-assets/research/lehigh-reit-risk-corpus/Dhrunal_Belani_Final_Report_MetaMe_2.pdf` | `8693f29535c7cea8b72bb5831f18e24411fd368ddc539228512b199e2c9121eb` |

Full public URL prefix: `https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-assets/research/lehigh-reit-risk-corpus/<filename>`. **Constitutional/iQube registration status: PENDING** (see Infrastructure Backlog Note above) — these are direct Storage objects, not `codex_media_assets`-registered artifacts. This affects registration/access governance, not the evidentiary content, per operator instruction.

### Canonical Threshold 007.2 (reviewed, not modified)

| Field | Value |
|---|---|
| Content ID | `a61343cb-d000-4359-a307-e9d380740eaa` |
| Slug / title | `invariant-intelligence` / "Invariant Intelligence" |
| `researchCompanionStatus` | `canonical` |
| Gate status | `approved` |
| ARR disposition | `PASS_WITH_DISCLOSED_GAPS` |
| Candidate text SHA-256 (007.2) | `6648f21f308e7395cba0c8d85bf48978f94b27d6f014f11f2ffa5c96ff2f3895` |
| Canonical predecessor edition / SHA-256 | `007.1` / `79e3d2bef9bd83c0bb57d485c3fabb996bfdd3e32b3068b4b121a336db3db8fe` |
| `research_publication_records` row | `baaaf1e5-d9c6-4204-af26-c93ad38efa0b`, `publication_status = CANONICAL`, created `2026-09-13 14:48:25.759218+00` |

Both `ai_metadata.currentResearchGate.candidateTextSha256` and the `research_publication_records.candidate_sha256` row independently agree on the same hash — cross-checked live, read-only, 2026-09-13. This bundle does not modify any of the above.

### Implementation anchors resolved (file:line, from the v1.2 addendum sections A–O)

`services/invariants/riskField.ts`, `services/venture/ventureOutcomeAccrual.ts`, `app/api/venture/qubes/[ventureId]/verify-outcome/route.ts`, `services/factor/standingProposal.ts`, `services/factor/authorityChain.ts`, `services/horizen/evidence.ts`, `services/horizen/pulseEndpoint.ts`, `services/vela/velaTypes.ts`, `services/crm/standingAccrualService.ts`, `services/receipts/activityReceiptService.ts`, `services/dvn/activityReceiptDvnPipeline.ts`, `services/access/evaluateAccess.ts`, `services/delegation/delegationGrantStore.ts`, `services/invariants/taskScopedSelection.ts`, `supabase/migrations/20260912195402_golden_cycle_evidence_records.sql`, `supabase/migrations/20260930190000_factor_aegis_constitution_reconciled.sql`. Full citations with line numbers are in the referenced documents above, not repeated here.

### Experiment records resolved (live, re-verified 2026-09-13 for this bundle)

`experiment_results` table, project `bsjhfvctmduxhohtllly`, queried read-only:

| Experiment | Row count | `approved_at` non-null | Verdict (`aggregates->>'verdict'`) |
|---|---|---|---|
| EXP-001 | 2 | 0 | null, null |
| EXP-002 | 1 | 0 | null |
| EXP-003 | 1 | 0 | null |
| EXP-004 | 4 | 0 | null ×4 |
| EXP-005 | 1 | 0 | **`constitutional_failure`** |
| EXP-006 | 2 | 0 | null, null |

**Negative/unresolved evidence preserved (do not clean this up):** every EXP-001–006 row across the entire table has `approved_at = null` — none has passed the table's own approval workflow, including EXP-001–003, which the manuscript's own experiment register cites. EXP-005's sole recorded run has an explicit negative verdict (`constitutional_failure`). None of EXP-004/005/006 is cited anywhere in Threshold 007's manuscript (per v1.0's finding, re-confirmed). None of EXP-001–006 contains longitudinal instrumentation in the strict repeated-measures-over-time sense (per v1.0 §B, preserved); EXP-002's clip-sequencing control arm is real order-sensitivity instrumentation, not longitudinal instrumentation — both halves of that distinction remain load-bearing and are stated together per prior operator correction.

---

## Consequence Horizon — Precise Status (7-way distinction, per instructing task §7)

| # | Claim | Status | Evidence |
|---|---|---|---|
| A | Consequence-Horizon doctrine | **PRESENT** | Threshold 007 itself (H1b); `docs/qriptopian/thresholds/007-research-edition.md` |
| B | Consequence-projection implementation | **ABSENT** | No code computes a horizon-indexed causal-distance or prediction-horizon quantity anywhere found in this or prior passes |
| C | Operational environment in which consequential reach can be observed | **PARTIALLY PRESENT** | Real consequential machinery exists (verified claims → real Standing deltas via `accrueStanding()`; DVN-anchored receipts for a restricted `ANCHORABLE_ACTION_TYPES` allowlist; real partner-facing Horizen integration) — genuine, if currently modest-scale, exposure to real consequence, but none of it is horizon-indexed |
| D | Longitudinal telemetry capable of supporting future CH measurement | **PARTIALLY PRESENT** | See the t0–t5 table below — two real, disconnected segments exist; a full chain would need new instrumentation (shared IDs, a persisted `RepairPath` writer) |
| E | Formal CH measurement instrument | **ABSENT** | Nothing found computes or records a horizon-indexed reliability/uncertainty quantity |
| F | Controlled CH experimental evidence | **ABSENT** | No experiment registry entry tests CH |
| G | Matched-baseline H1b evidence (`CH_Invariant > CH_ComputeMatchedBaseline`) | **ABSENT, reconfirmed after the full Lehigh corpus read** | None of the 8 newly-read documents contains the term "Consequence Horizon" or any matched-baseline comparison; the manuscript's own text discloses this remains unmeasured (v1.0 §D, v1.2 §L/N) |

These are seven distinct claims. A/C/D being partially or fully present does not imply E/F/G — this bundle does not conflate an operational consequential environment with a measurement instrument or with experimental evidence, per the instructing task's explicit requirement.

---

## Longitudinal Telemetry Readiness — t0→t5 (per instructing task §8)

| Transition | RECORDABLE NOW | ACTUALLY RECORDED | LINKABLE | TIMESTAMPED | ATTRIBUTABLE | MISSING INSTRUMENTATION |
|---|---|---|---|---|---|---|
| t0 intent/recommendation/intervention | Yes | Yes (`activity_receipts`) | Yes (`intentId`/`parentIntentId`/`rootIntentId`) | Yes | Yes | — |
| t1 authorized action → DVN/anchor | Yes | Yes, gated (`ANCHORABLE_ACTION_TYPES`) | Yes (same row as t0) | Yes | Yes | — |
| t2 immediate time/value/financial effect | Yes | Yes (`venture_qubes.layers.outcome.proofOfOutcomeClaims` JSONB, verify-outcome route) | **No** — no FK/shared ID to t0/t1 | Yes (`accruedAt`) | Partial (claim-level, not linked to originating intent) | A shared identifier between `activity_receipts` and `venture_qubes` claims |
| t3 downstream consequence | Partial — `RepairPath` type shape exists | **No** | No | No | No | A persistence layer/writer for `RepairPath`; currently type-only |
| t4 repair/reversal/escalation | Partial — same `RepairPath` type | **No** | No | No | No | Same as t3 |
| t5 Standing/trust/authority/future-delegation change | Yes | Yes (`accrueStanding()`, real calls from the PoTS route) | Linked to t2 only, not t0/t1 | Yes | Yes (persona-level) | A shared ID reaching back to t0/t1 |

**Finding, unchanged from v1.2:** the platform can trace t0→t1 and, separately, t2→t5, but no code path links an anchored activity receipt to the venture-outcome claim it may have caused, and t3/t4 exist only as an unwired type. Recordability at t3/t4 is a design shape, not present instrumentation — this bundle does not equate the two, per the instructing task's explicit caution.

---

## Raw vs. Effective Capability — Implementation-Only Assessment (per instructing task §9)

The dichotomy itself (Threshold 006/007 doctrine) has **no code implementing or labeling it as such**. A same-named-but-unrelated "Raw Capability Standing score" in `services/crm/standingAccrualService.ts` is a naming coincidence, not implementation evidence, and must not be cited as such (flagged in v1.2 §J and §L item 3).

What is genuinely implemented and instantiates the *underlying idea* — capability bounded by authority, delegation, risk, trust/Standing, revocation — without using this vocabulary:

- `services/access/evaluateAccess.ts` — real access gating.
- `services/factor/authorityChain.ts` — real direct-vs.-mediated delegation chains with explicit revocation state.
- `services/delegation/delegationGrantStore.ts` — the canonical bounded-delegation ledger.
- `services/crm/standingAccrualService.ts` — real trust/Standing accrual.

**Classification: implementation relationship only.** This is not scientific validation of the Raw Capability × Trust → Effective Capability conceptual model — no experiment in this codebase tests that relationship, and this bundle does not claim otherwise, per the instructing task's explicit prohibition on that inference.

---

## Tacit-Observation Substrate — Precise Status (per instructing task §10)

No dedicated tacit-knowledge-discovery instrumentation was found in Venture Lab/Factor/Vela/Horizen code across any pass this session. What exists:

- **TELEMETRY-CAPABLE**: `services/horizen/pulseEndpoint.ts` (health-check surface, resolves to `null` for every agent today — no Agent Card has declared a runtime descriptor, per its own code comment); `activity_receipts` (`toolsUsed`, `agentsInvoked`, `invariantsUsed` fields could in principle surface behavioral patterns, but no analysis code was found consuming them for that purpose).
- **ACTUALLY OBSERVED**: none found — no code path aggregates or analyzes operator-intervention/override/behavioral-pattern data from any of the above.
- **SCIENTIFICALLY INFERRED TACIT STRUCTURE**: absent. No experiment or analysis in this codebase claims to have inferred tacit/latent-capability structure from telemetry.

**This bundle does not promote telemetry capability into tacit-knowledge discovery** — the gap between "a field exists that could carry this signal" and "this signal has been observed or analyzed" is preserved, per the instructing task's explicit caution.

---

## Consolidated Claim-Change Ledger

This consolidates the ledgers already published in v1.0 and v1.2, adding items required by the instructing task not previously tabulated in one place (Factor, Pulse/P&L/Standing, tacit observation, Raw/Effective Capability, the 7-way CH split). Full reasoning and citations for each row are in the referenced source document; this table is the index, not a restatement of every citation.

| Claim | Previous status | New primary evidence | Current status | Change/Unchanged | Limitation |
|---|---|---|---|---|---|
| Lehigh risk calibration | Documented calibration hypothesis (one panel, one spreadsheet) | Full corpus read (8 docs); authorship lineage confirmed | Documented calibration hypothesis, now with confirmed continuous authorship lineage | **Strengthened (provenance) / Unchanged (validation ceiling)** | Still no causal/actuarial validation |
| Risk of Repair | Doctrine + typed structures, no calibration | `netValueAccelerationHours()` repair-hours subtraction identified precisely | IMPLEMENTED, not calibrated; one concrete operational conditioning point now identified | **Refined (not corrected)** | No temporal measurement, no observed-vs-predicted repair, no causal validation |
| Risk → Value | Not verifiable (dense PDFs unread) | `Value_engine_Logic.docx` + `value_engine.py` read; both agree on an uncalibrated methodology | Genuine risk→value linkage at formula/model level | **Strengthened (existence confirmed) / Unchanged (validation)** | No backtest in either artifact |
| Value → Price | Not verifiable (dense PDFs unread) | Pricing paper read in full: two frameworks, real executed output on synthetic inputs | Formula + executed-but-unvalidated model | **Strengthened (existence + execution) / Unchanged (validation)** | Paper's own text: "indicative rather than conclusive" |
| Risk → Price | Not verifiable | Same pricing paper | Same as Value→Price row | **Strengthened / Unchanged (validation)** | Same |
| Time-to-Value | Doctrinally connected to PoTS | `netValueAccelerationHours` inspected directly | Confirmed as coded, not merely doctrinal, via the PoTS proxy | **Strengthened** | No Vela/Horizon-specific TTV computation beyond the PoTS route |
| PoTS | Doctrine + partial implementation | Full corpus read: a third formulation found (`PoTS_Protocol_Integration_Pack_v0.1.pdf`) | Three formulations now on record (doctrine, platform, Lehigh), **not reconciled** — see the formulation registry in the v1.2 addendum §C | **Expanded (recorded), not resolved** | Relationship between platform and Lehigh formulations unestablished either direction |
| Golden Cycle | Not previously located precisely | `golden_cycle_records` schema found, zero writer code | Schema-only, no instrumentation, no observed data | **Refined (schema-precise)** | Zero rows, zero writers found |
| Vela/Horizon consequential measurement | Treated as one system | Three-way disambiguation (TEE protocol / accelerator doctrine / Horizen) | Disambiguated; PoTS is the most mature KPI, RoR is not a dedicated Vela/Horizon KPI | **Disambiguated** | See v1.2 §D |
| Factor consequential implementation | Not previously assessed as its own item | `services/factor/authorityChain.ts` read in full | IMPLEMENTED, substantially OPERATIONAL — real delegation chains with revocation | **New finding, strengthened** | Broader "economic discovery" doctrine role is wider than what is coded |
| Longitudinal telemetry | Not previously tabulated by transition | t0–t5 table above | Real in two disconnected segments (t0–t1; t2/t5); t3/t4 type-only | **Refined (precise per-transition table)** | No shared ID reaching t0/t1 to t2–t5 |
| Consequence Horizon doctrine | Present | Reconfirmed | Present | **Unchanged** | — |
| CH operational environment | Not previously separated from doctrine | Partially present, per the 7-way table above | Partially present | **New finding (disaggregated)** | Not horizon-indexed |
| CH measurement instrument | Absent | Reconfirmed, including after full corpus read | Absent | **Unchanged** | — |
| CH experimental evidence | Absent | Reconfirmed | Absent | **Unchanged** | — |
| H1b (`CH_Invariant > CH_ComputeMatchedBaseline`) | Unmeasured | Reconfirmed after full corpus read; zero occurrences of the term in any of the 8 new documents | Unmeasured | **Unchanged** | — |
| H3d | Unmeasured | No new evidence found | Unmeasured | **Unchanged** | — |
| H4 | Unmeasured | No new evidence found | Unmeasured | **Unchanged** | — |
| Tacit-observation substrate | Not previously assessed | See section above | TELEMETRY-CAPABLE only, nothing observed or inferred | **New finding** | Pulse resolves null for every agent today |
| Raw vs. Effective Capability implementation | Not previously assessed as its own item | See section above | Real underlying mechanics implemented (access/delegation/standing); the dichotomy itself is uncoded; a false-friend naming coincidence flagged | **New finding (refined)** | Not scientific validation of the conceptual model |
| "Proof of Risk" usage count | Three usages | Full corpus read: a fourth (`PoR` protocol layer in the PoTS pack) | Four non-interchangeable usages, none shown related to another | **Expanded** | — |
| EXP-001–006 approval/verdict state | EXP-004/005/006 `approved_at` null; EXP-005 `constitutional_failure` | Live re-query 2026-09-13 for this bundle | **All six experiments (EXP-001–006) have `approved_at = null`** — not just 004/005/006 as previously stated | **Corrected (broadened negative finding)** | This is a stronger negative result than v1.0 reported |

---

## Unresolved-Gaps Register (consolidated)

1. Whether any real `ProofOfOutcomeClaim` rows have been verified/accrued in the live Supabase project — **UNKNOWN**, no live query of `venture_qubes.layers.outcome.proofOfOutcomeClaims` content performed this session (schema and route confirmed real; row-level content not inspected).
2. Whether `journey_states`/`orchestration_events` join to any of the RoR/PoTS/Golden-Cycle apparatus — not verified column-by-column.
3. Whether the platform's `netValueAccelerationHours()` PoTS formulation and the Lehigh corpus's `PoTS_Protocol_Integration_Pack_v0.1.pdf` formulation share a primitive with different conditioning terms, are independent formalizations, or are a precursor/elaboration pair — no cross-reference found either direction; explicitly not adjudicated per operator instruction, recorded as formalization/ontology debt for future Vela/IRL experimentation.
4. Whether the dense pending-upload PDFs contain content beyond what this pass's direct reads surfaced (e.g., appendices, footnotes not fully transcribed in the research-agent's extraction) — the corpus was read cover-to-cover by an agent, not independently double-checked page-by-page by a second reader in this pass.
5. Whether any experiment beyond EXP-001–006 tests any part of the Consequence-Horizon substrate relationship (§H of the v1.2 addendum) — not exhaustively ruled out beyond the experiment registry query above.
6. The deception/constitutional-robustness research proposition remains explicitly unadjudicated (recorded separately, `status: proposed`, per operator instruction) — this bundle does not resolve it and the Longitudinal Adversary should treat it as open.

---

## Evidence Bundle Receipt

**EVIDENCE BUNDLE STATUS:** FROZEN

**EVIDENCE BUNDLE ID:** `TB007-LEB-v1.0-20260913`

**EVIDENCE RECORD VERSION:** 1.2 (the `2026-09-13_threshold-007-evidence-resolution-v1.1-addendum.md` file, internally versioned 1.2 in its own machine-readable receipt)

**EVIDENCE RECORD SHA-256:** `512489040cf6b7fd819222d0fd78e1659a0f8921b33038dd18622e9cfa167b8d`

**BUNDLE / MANIFEST SHA-256:** computed post-commit over this file as committed to `claude/cool-edison-5t0fc9`; see the commit that introduces this file for the exact git blob hash (not self-embedded here to avoid a circular self-hash reference — the file cannot contain its own hash of itself). Resolve via `git show <commit>:codexes/packs/agentiq/updates/2026-09-13_threshold-007-longitudinal-evidence-bundle-v1.0.md | sha256sum`.

**CANONICAL THRESHOLD REVIEWED:** Threshold 007.2 (`invariant-intelligence`, content id `a61343cb-d000-4359-a307-e9d380740eaa`), candidate text SHA-256 `6648f21f308e7395cba0c8d85bf48978f94b27d6f014f11f2ffa5c96ff2f3895`

**PRIMARY ARTIFACTS RESOLVED:** 6 evidence-resolution documents (see manifest); 4 committed Lehigh source-code artifacts; 8 Lehigh dense-material artifacts (Supabase Storage, sha256-verified twice — server-side post-upload and independently re-downloaded for this bundle)

**NEW LEHIGH ARTIFACTS RESOLVED:** all 8 previously-pending dense materials, read in full this pass (see manifest above for hashes)

**IMPLEMENTATION ANCHORS RESOLVED:** 16 files/migrations (see manifest section above)

**EXPERIMENT RECORDS RESOLVED:** EXP-001 through EXP-006, live-queried 2026-09-13 (2/1/1/4/1/2 rows respectively; zero approvals across all six; EXP-005's sole verdict is `constitutional_failure`)

**CLAIMS STRENGTHENED:** Lehigh corpus provenance/authorship lineage; PoTS implementation/instrumentation detail; RoR-PoTS coded conditioning; Risk→Value and Value→Price existence (formula + execution, not validation); Factor consequential implementation; constitutional-computing-action-layer doctrine cross-referenced against Threshold 007's own Alternative Explanation 4

**CLAIMS UNCHANGED:** CFS-052 Proof of Risk Reduction non-implementation; `ProofOfRisk` invariant-envelope narrow scope; Consequence Horizon / H1b / H3d / H4 unmeasured status (reconfirmed after full corpus read); EXP-002 temporal-sequencing-vs-longitudinal distinction; no Time-to-Value/Consequence Horizon/Golden Cycle/Risk of Repair terminology anywhere in the 8-document Lehigh corpus

**CLAIMS WEAKENED:** none — divergent PoTS/Proof-of-Risk formulations are recorded as formalization/ontology debt, not as weakening any prior claim, per operator instruction

**CONTRADICTIONS / DISCREPANCIES:** three differing "Investment Qube" risk percentages across the corpus (60.90%/67.54%, 68.6%, 82%) for differently-scoped runs of the same nominal bundle, flagged so an adversary does not assume a single canonical figure; the broadened negative finding that all six EXP-001–006 experiments, not only 004–006, have zero approvals

**UNRESOLVED GAPS:** 6 items, listed in full above — most materially, whether any `ProofOfOutcomeClaim` has actually been verified/accrued in production, and the unresolved relationship between the platform's and Lehigh's PoTS formulations

**RISK → VALUE → PRICE LINEAGE STATUS:** Risk taxonomy/calibration/scoring — CONCEPTUAL through EXPERIMENTALLY EXERCISED (self-consistency only); Risk→Value — CONCEPTUAL, formula/prose-specified, not backtested; Value→Price — EXPERIMENTALLY EXERCISED on synthetic inputs, self-disclosed as not validated; full integration — a real, citation-explicit but entirely unbuilt specification (`PoTS_Protocol_Integration_Pack_v0.1.pdf`)

**RISK-OF-REPAIR STATUS:** IMPLEMENTED (typed structures, discovery-ordering use, one concrete operational conditioning point in `netValueAccelerationHours()`); NOT CALIBRATED; NOT VALIDATED

**PoTS / TIME-TO-VALUE STATUS:** IMPLEMENTED and INSTRUMENTED (real admin-gated verify/accrue route wired to Standing); production-observed-data status UNRESOLVED; three formulations on record, not reconciled

**VELA / HORIZON CONSEQUENTIAL-PILOT STATUS:** MIXED — TEE protocol IMPLEMENTED/apparently OPERATIONAL; accelerator doctrine CONCEPTUAL/PROPOSED; Horizen agent-registration IMPLEMENTED/partially OPERATIONAL; Pulse TELEMETRY-CAPABLE not OBSERVED

**LONGITUDINAL TELEMETRY STATUS:** two disconnected real segments (t0–t1; t2/t5); t3/t4 type-only, no persistence

**CONSEQUENCE-HORIZON DOCTRINE STATUS:** PRESENT

**CONSEQUENCE-HORIZON OPERATIONAL-ENVIRONMENT STATUS:** PARTIALLY PRESENT

**CONSEQUENCE-HORIZON INSTRUMENT STATUS:** ABSENT

**CONSEQUENCE-HORIZON SCIENTIFIC-EVIDENCE STATUS:** ABSENT

**H1b STATUS:** UNMEASURED (reconfirmed)

**H3d STATUS:** UNMEASURED (unchanged, no new evidence)

**H4 STATUS:** UNMEASURED (unchanged, no new evidence)

**TACIT-OBSERVATION SUBSTRATE STATUS:** TELEMETRY-CAPABLE only; nothing actually observed or scientifically inferred

**RAW-vs-EFFECTIVE-CAPABILITY IMPLEMENTATION STATUS:** underlying mechanics (access/delegation/standing) IMPLEMENTED and substantially OPERATIONAL; the dichotomy itself uncoded; a false-friend naming coincidence flagged and must not be cited as evidence

**CONSTITUTIONAL / iQUBE REGISTRATION STATUS:** the 8 Lehigh dense-material artifacts are PENDING registration — currently direct public Supabase Storage objects, not `codex_media_assets`/iQube-trinity-registered; integrity and availability are ESTABLISHED; this affects governance/access status only, not evidentiary content (see the Infrastructure Backlog Note)

**EVIDENCE AGENT:** Claude (session `claude/cool-edison-5t0fc9`, iQube-Protocol/AigentZBeta)

**RESOLVED AT:** 2026-09-13T20:51:15Z

**FINAL HANDOFF STATUS:** EVIDENCE RESOLUTION — COMPLETE / LONGITUDINAL ADVERSARY READY

---

## Machine-Readable Bundle Receipt

```json
{
  "record_type": "threshold-007-longitudinal-evidence-bundle",
  "record_version": "1.0",
  "evidence_bundle_id": "TB007-LEB-v1.0-20260913",
  "evidence_record_sha256": "512489040cf6b7fd819222d0fd78e1659a0f8921b33038dd18622e9cfa167b8d",
  "bundle_manifest_sha256": null,
  "bundle_manifest_sha256_note": "computed post-commit over this file's own committed content; intentionally not self-embedded to avoid circular self-hashing -- resolve via git show <commit>:<this file path> | sha256sum",
  "canonical_threshold_id": "a61343cb-d000-4359-a307-e9d380740eaa",
  "canonical_threshold_version": "007.2",
  "canonical_threshold_sha256": "6648f21f308e7395cba0c8d85bf48978f94b27d6f014f11f2ffa5c96ff2f3895",
  "review_role": "evidence-agent",
  "resolved_at": "2026-09-13T20:51:15Z",
  "primary_artifacts": [
    "codexes/packs/agentiq/updates/2026-09-13_threshold-007-evidence-resolution-pass.md :: 0098e600f9bb52caa37a09fd259d258c6db317541198efb6694af408fb8c9441",
    "codexes/packs/agentiq/updates/2026-09-13_threshold-007-evidence-resolution-v1.1-addendum.md :: 512489040cf6b7fd819222d0fd78e1659a0f8921b33038dd18622e9cfa167b8d",
    "codexes/packs/agentiq/updates/2026-09-13_lehigh-risk-calibration-primary-source-verification.md :: 3509b4388c35d3d41479af74454c7d8cdcd21900a41158705af93c2f32a440a3",
    "codexes/packs/agentiq/updates/2026-09-13_threshold-007-candidate-research-proposition-deceptive-cognition.md :: f275de2feffdbc26f8facd70794a059591b636a51d6e72a2d97e0fcea4fce44c",
    "codexes/packs/agentiq/updates/2026-09-13_threshold-007-infrastructure-backlog-note.md :: 9a927a31bf6b59f7dfe4faea698f0a62880ad52642b8bcb3538e6f7cd29e5ffd",
    "codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/README.md :: f460d9baa1b4d5a1e955efb0a75965127f74c33cd9971c3d6f28c0aa2923dfe5"
  ],
  "new_lehigh_artifacts": [
    "DATA_RISK_FOR_MARKETPLACES_V2.md :: b98acea6442d6ca6298d078cf6f8e5fa064ffd40006db35c6d59bfb21ddcb468",
    "Pricng_Data_and_Risk_Final_Project_Paper.pdf :: 5667a6789e216db3c0888f1932950ef4a281b5f4379491467626ded98a16458c",
    "Plan_v.02.pdf :: b01b26728361d6a941813f398efdb3ca4ad7d4f76ba9b17bfc3268fd7851f7c3",
    "Final_Report_metaMe1.pdf :: d1eb8f10ae86de3edad770163a49d4662f4c4486787002cd2b035feb87a59084",
    "PoTS_Protocol_Integration_Pack_v0.1.pdf :: ba9605a8074549d9414898000eaf27823947e46a923c09422a16fd4373d89d88",
    "Value_engine_Logic.docx :: 2e5316369b71a0f75f70a2c5cc31ef69ee8e8012bcae8088b5f03dabdce5128f",
    "Book4.xlsx :: 34858ed95809431e8e2923857f0e6df157c34a2aac0bfb420d3819626ccd773d",
    "Dhrunal_Belani_Final_Report_MetaMe_2.pdf :: 8693f29535c7cea8b72bb5831f18e24411fd368ddc539228512b199e2c9121eb"
  ],
  "implementation_anchors": [
    "services/invariants/riskField.ts", "services/venture/ventureOutcomeAccrual.ts",
    "app/api/venture/qubes/[ventureId]/verify-outcome/route.ts", "services/factor/standingProposal.ts",
    "services/factor/authorityChain.ts", "services/horizen/evidence.ts", "services/horizen/pulseEndpoint.ts",
    "services/vela/velaTypes.ts", "services/crm/standingAccrualService.ts",
    "services/receipts/activityReceiptService.ts", "services/dvn/activityReceiptDvnPipeline.ts",
    "services/access/evaluateAccess.ts", "services/delegation/delegationGrantStore.ts",
    "services/invariants/taskScopedSelection.ts",
    "supabase/migrations/20260912195402_golden_cycle_evidence_records.sql",
    "supabase/migrations/20260930190000_factor_aegis_constitution_reconciled.sql"
  ],
  "experiment_records": {
    "EXP-001": {"row_count": 2, "approved_count": 0, "verdicts": [null, null]},
    "EXP-002": {"row_count": 1, "approved_count": 0, "verdicts": [null]},
    "EXP-003": {"row_count": 1, "approved_count": 0, "verdicts": [null]},
    "EXP-004": {"row_count": 4, "approved_count": 0, "verdicts": [null, null, null, null]},
    "EXP-005": {"row_count": 1, "approved_count": 0, "verdicts": ["constitutional_failure"]},
    "EXP-006": {"row_count": 2, "approved_count": 0, "verdicts": [null, null]}
  },
  "risk_value_price_lineage_status": "RISK_CALIBRATION_EXPERIMENTALLY_EXERCISED_VALUE_AND_PRICE_FORMULA_STAGE_NOT_VALIDATED_INTEGRATION_SPEC_EXISTS_UNBUILT",
  "ror_status": "IMPLEMENTED_NOT_CALIBRATED_NOT_VALIDATED",
  "pots_status": "IMPLEMENTED_INSTRUMENTED_THREE_FORMULATIONS_NOT_RECONCILED",
  "time_to_value_status": "IMPLEMENTED_VIA_POTS_PROXY",
  "golden_cycle_status": "SCHEMA_ONLY_NO_WRITER_NO_OBSERVED_DATA",
  "vela_horizon_status": "MIXED_TEE_PROTOCOL_OPERATIONAL_ACCELERATOR_DOCTRINE_PROPOSED_HORIZEN_PARTIALLY_OPERATIONAL",
  "factor_status": "IMPLEMENTED_SUBSTANTIALLY_OPERATIONAL",
  "venture_lab_consequence_status": "OPERATIONAL_PARTIAL",
  "irl_scientific_status": "UNCHANGED_FROM_PRIOR_PASSES",
  "longitudinal_telemetry_status": "TWO_DISCONNECTED_SEGMENTS_T0_T1_AND_T2_T5_T3_T4_TYPE_ONLY",
  "consequence_horizon_doctrine_status": "PRESENT",
  "consequence_horizon_environment_status": "PARTIALLY_PRESENT",
  "consequence_horizon_instrument_status": "ABSENT",
  "consequence_horizon_evidence_status": "ABSENT",
  "raw_effective_capability_status": "UNDERLYING_MECHANICS_IMPLEMENTED_DICHOTOMY_ITSELF_UNCODED_FALSE_FRIEND_FLAGGED",
  "tacit_observation_status": "TELEMETRY_CAPABLE_ONLY_NOTHING_OBSERVED_OR_INFERRED",
  "h1b_status": "UNMEASURED",
  "h3d_status": "UNMEASURED",
  "h4_status": "UNMEASURED",
  "claims_strengthened": [
    "Lehigh corpus provenance/authorship lineage",
    "PoTS implementation and instrumentation detail",
    "RoR-PoTS coded conditioning relationship",
    "Risk->Value and Value->Price existence (formula + execution, not validation)",
    "Factor consequential implementation",
    "constitutional-computing-action-layer doctrine cross-referenced against Alternative Explanation 4"
  ],
  "claims_unchanged": [
    "CFS-052 Proof of Risk Reduction non-implementation",
    "ProofOfRisk invariant-envelope narrow scope",
    "Consequence Horizon / H1b / H3d / H4 unmeasured status",
    "EXP-002 temporal-sequencing vs longitudinal distinction",
    "No Time-to-Value/Consequence Horizon/Golden Cycle/Risk of Repair terminology in the 8-document Lehigh corpus"
  ],
  "claims_weakened": [],
  "contradictions": [
    "three differing Investment Qube risk percentages (60.90/67.54%, 68.6%, 82%) across differently-scoped runs",
    "all six EXP-001-006 experiments, not only 004-006, have zero approvals -- broadened negative finding vs prior passes"
  ],
  "unresolved_gaps": [
    "whether real ProofOfOutcomeClaim rows exist in production",
    "journey_states/orchestration_events linkage to RoR/PoTS/Golden-Cycle apparatus",
    "relationship between platform and Lehigh PoTS formulations -- explicitly not adjudicated, formalization/ontology debt for future Vela/IRL experimentation",
    "whether the 8 dense PDFs contain content beyond this pass's extraction",
    "whether any experiment beyond EXP-001-006 tests the RoR-to-Consequence-Horizon substrate relationship",
    "the deception/constitutional-robustness research proposition remains open and unadjudicated"
  ],
  "constitutional_registration_status": "PENDING_INTEGRITY_AND_AVAILABILITY_ESTABLISHED",
  "primary_source_receipt": "read-only repository sweep + full read of all 8 previously-pending Lehigh dense artifacts + live re-query of experiment_results, 2026-09-13, file:line and sha256 citations recorded inline in the referenced documents",
  "handoff_status": "EVIDENCE_RESOLUTION_COMPLETE_LONGITUDINAL_ADVERSARY_READY"
}
```

---

## Freeze Statement

This bundle is frozen as of commit `cdcec90aa7e62550e44eda20802f873452f287eb` on branch `claude/cool-edison-5t0fc9`, 2026-09-13T20:51:15Z. The evidence record it references (`2026-09-13_threshold-007-evidence-resolution-v1.1-addendum.md`, SHA-256 `512489040cf6b7fd819222d0fd78e1659a0f8921b33038dd18622e9cfa167b8d`) and Threshold 007.2 itself (candidate SHA-256 `6648f21f308e7395cba0c8d85bf48978f94b27d6f014f11f2ffa5c96ff2f3895`) are both identified precisely and were not modified in the course of producing this bundle. **Any material change to the referenced evidence-resolution documents after this freeze requires a new evidence-bundle version (v1.1+), not a silent edit to this file.**
