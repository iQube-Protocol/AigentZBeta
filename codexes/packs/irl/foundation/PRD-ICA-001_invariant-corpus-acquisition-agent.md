# PRD-ICA-001 — Invariant Corpus Acquisition Agent ("Corpus Scout")

**metaMe IRL · Product/engineering specification · Status: DESIGN (docs-first, ratify-before-build)**
**Owner:** Invariant Research Lab (IRL) · **Origin:** operator + Aletheon design session, consolidated against the existing Discovery Engine, 2026-07-22
**Working name:** Corpus Scout. **System name:** Corpus Acquisition Pipeline.
**Governs:** an agent that discovers, verifies, retrieves, and packages authoritative external source material for human review, then hands approved material to the already-built Invariant Discovery Engine. It never discovers invariants itself and never writes to the canonical registry.

> Companion documents: `experiments/exp-p1-representation-runtime-gauntlet/CRYSTAL-CANON_source-material-charter.md` (WHAT to source for EXP-P1's first campaign — read first for the concrete target), `PRD-EPI-001_exp-p1-experimental-infrastructure-programme.md` (Track 1 infrastructure — unrelated build, cross-referenced only), `experiments/exp-p1-representation-runtime-gauntlet/CRYSTAL-ENLARGEMENT_plan.md` (the accrual mechanics this agent's output feeds).

---

## 0. Read this first — reconciliation against what's already built

Aletheon's draft PRD is a thorough, well-structured acquisition-agent design, but it was written without visibility into an already-shipped discovery pipeline, an already-ratified provenance vocabulary, and existing retrieval infrastructure elsewhere in this codebase. Building it verbatim would fork a parallel ingestion system and introduce a second, competing taxonomy. This section is the correction; §§1–13 are the reconciled spec.

### 0.1 Corpus Scout is an ACQUISITION FRONT-END for the existing Discovery Engine — not a new discovery pipeline

`services/invariants/discoveryEngine.ts` (CFS-048) already implements Stage 1 (Evidence Collection via `addEvidence`/`listEvidence`) through Stage 5 (Canonical Publication). It already has an `EvidenceKind` type, `EvidenceRow`/`CandidateRow` interfaces, and a `proposed → validated` promotion lifecycle (`promoteCandidate`, never auto-canonical — `inv.reasoning.337`). **Corpus Scout's entire job is to produce the inputs to Stage 1** — verified, byte-checked, human-reviewed evidence — packaged as `addEvidence()` calls. It does not extract candidate invariants, cluster, detect relationships, validate, or canonize; all of that is Stages 2–5, already built, untouched by this PRD. Aletheon's draft correctly scopes this ("Corpus Scout does not independently add materials to a canonical corpus... it assembles candidate source packages and submits them for review... Invariant discovery determines what reusable reasoning can be derived from it" — a separate function), but its integration section under-specified HOW the handoff meets existing code; §6 below fixes that precisely.

### 0.2 The handoff API already exists — `POST /api/invariants/discovery` `add-evidence`, not a new ingestion route

`app/api/invariants/discovery/route.ts` is the admin-gated (`persona.cartridgeFlags.isAdmin`) surface over the engine, with actions `add-evidence | extract | compare | compress-domain | materialize-edges | suggest-parents | promote | link-parents | reject`. Corpus Scout's Ingestion Broker (agent J, §8) is a **client of `add-evidence`**, per approved source, per `subDomain` — never a new API surface. §6 gives the exact field mapping from Corpus Scout's review-approved package onto `addEvidence`'s input shape (`{ domain, subDomain?, title, sourceKind, content, sourceRef?, personaId }`).

### 0.3 The provenance vocabulary is already ratified — Corpus Scout adopts it, does not invent a second one

`CRYSTAL-ENLARGEMENT_plan.md` §2a (ratified this session, 2026-07-22) already fixes the provenance tag every invariant entering `Crystal vP1` must carry:

`external-established | external-empirical | platform-derived | platform-hypothesized`

Aletheon's draft independently proposed a `sourceClass` field with different values (e.g. `external-authoritative`) for the same concept. **This charter renames Corpus Scout's field to `provenanceClass` and constrains it to exactly the four already-ratified values** — one vocabulary, not two. Aletheon's separate **disposition classes** (`approved_exp_p1`, `approved_general_finance`, `approved_reference_only`, `pending_review`, `needs_retrieval_fix`, `duplicate`, `superseded`, `rejected_out_of_domain`, `rejected_low_substance`, `rejected_provenance`, `rejected_access_or_license`) are kept, renamed `reviewWorkflowStatus`, and explicitly documented as a **separate, composable axis** — `provenanceClass` answers "what kind of source is this" (an evidence-integrity question), `reviewWorkflowStatus` answers "what did the human reviewer decide to do with it" (a pipeline-state question). Conflating them was the closest thing to a real defect in the source draft: a source can be `provenanceClass: external-established` and still sit at `reviewWorkflowStatus: rejected_out_of_domain` (e.g., a Basel document that is authoritative but out of scope for THIS domain boundary).

### 0.4 Existing retrieval/parsing infrastructure to reuse — do not stand up a parallel stack

Verified in this codebase, none of it built for this purpose but all of it directly relevant:

| Existing infra | What it does | Reuse implication for Corpus Scout |
|---|---|---|
| `services/content/pdfExtractionService.ts` (`pdf-parse`, already a `package.json` dependency alongside `pdfjs-dist`) | Text extraction with page-level granularity, chunking for RAG, metadata (page count, word count) | The Inspection Agent (§8, agent E) reuses this for PDF byte-level content verification and normalized-text extraction — do not add a second PDF library or reimplement page/word counting |
| `services/aa-api/src/browser/*` (`gatewayService.ts`, `exec/playwright.ts`, a Browserbase provider adapter) | An existing browser-automation gateway (session-based, used for agent browsing surfaces elsewhere in the platform) | A candidate for the Resolver Agent's (§8, agent C) link-traversal/redirect-following needs — **flagged for evaluation, not mandated**: it is built for interactive agent browsing sessions, not confirmed here to fit batch link-resolution/retrieval at Corpus Scout's scale. Whoever builds Phase 1 (§11) must evaluate fit before adding a new headless-browser dependency (Puppeteer, a second Playwright wrapper, etc.) |
| `services/marketa/activation/discovery.ts` (discovery automation for agent-card/MCP-registry sources) | Not directly reusable (different domain: agent cards, not documents) but establishes an **architectural precedent** already in this codebase: pure, unit-testable parsing functions separated from the network/DB-touching route (`/api/marketa/activation/discover`) | Corpus Scout's Discovery/Resolver/Inspection agents should mirror this separation — parsing and classification as pure functions, fetching/persistence isolated to the orchestrator layer — rather than inventing a different architecture |

### 0.5 No new governance charter, no lifecycle collision

Corpus Scout is not itself an experiment and does not need `IRL-016`'s six-stage lifecycle (`proposal → design → FREEZE → execution → interpretation → successor experiment`) applied to it directly. Its campaigns run entirely within the **pre-freeze "enlarge (receipted)" phase** of `CRYSTAL-ENLARGEMENT_plan.md` §4's sequence gate:

```
enlarge (receipted) → FREEZE Crystal vP1 → construct Arm C slice → hash → reviewer builds tasks
```

Once `Crystal vP1` freezes for EXP-P1, Corpus Scout's EXP-P1-directed campaigns stop — running one after freeze would itself violate the freeze (per the README §12/`CRYSTAL-ENLARGEMENT_plan.md` §4 discipline this PRD does not alter). Corpus Scout's *other* campaigns (general-finance acquisition, future domain crystals — §13) are unaffected by any one experiment's freeze state.

### 0.6 Numbering — this PRD does not collide

Confirmed by repo-wide grep before assignment: `PRD-CCR-001`, `PRD-CFO-001`, `PRD-IPE-001`, `PRD-IRE-001`, `PRD-KRE-001` (all `CFS-037`–`041`/`CHRYSALIS_WORKSTREAM_TRACKER.md`), `PRD-THR-001`, `PRD-MPY-001`, `PRD-EPI-001` are taken. `PRD-ICA-001` (Invariant Corpus Acquisition) is unused.

### 0.7 CRP-003 / CRP-003a checked — no overlap

`CRP-003_financial-services-constitutional-capability-domain.md` and `CRP-003a_constitutional-financial-services-programme.md` were checked for existing source-material-acquisition content for the FS domain; neither mentions acquisition, retrieval, crawling, or corpus sourcing. No duplication to reconcile.

---

## 1. Purpose

Corpus Scout discovers, verifies, retrieves, and prepares authoritative source material for building domain-specific invariant crystals — operating at the level of **actual retrieved content**, never search results, landing pages, or document directories. Governing principle, unchanged from Aletheon's draft: *"A source is not acquired until its substantive content has been retrieved, inspected, verified, and presented for human approval."* Corpus Scout assembles candidate source packages and submits them for review; it never independently adds material to a canonical corpus (§0.1).

## 2. Four levels of discovery — only Level 4 qualifies for human review

| Level | What it is | Qualifies for review? |
|---|---|---|
| 1 | Search result / snippet | No — not a source |
| 2 | Landing/directory page | No — not yet acquired |
| 3 | Document reference (a page linking to a titled PDF) | No — candidate, unverified |
| 4 | Retrieved substantive artifact — actual bytes retrieved, parsed, inspected; title, page count, text coverage, content hash recorded | **Yes — the only qualifying level** |

## 3. Non-goals

Must not: treat search snippets or landing pages as source material; ingest unreviewed documents directly into `Crystal vP1` or any canonical registry; invent missing content when a source cannot be retrieved; silently substitute third-party summaries for primary documents; infer PDF validity from a `.pdf`-looking URL alone; convert retrieved statements directly into invariants (Stages 2–5 remain the Discovery Engine's job, §0.1); rank sources solely by search-engine prominence; use internal metaMe/platform materials for an EXP-P1 campaign without explicit authorization (per `CRYSTAL-ENLARGEMENT_plan.md` §2a).

## 4. Operating model — stage pipeline, each stage leaves an inspectable receipt

```
Domain Brief → Source Planning → Discovery → Link Resolution → Byte Retrieval →
Content Verification → Relevance/Quality Assessment → Deduplication →
Candidate Source Package → Human Review → Approved Corpus → [handoff, §6] → Discovery Engine Stage 1
```

## 5. Inputs and policy

**Inputs:** domain definition + domain boundary (for a Crystal Canon campaign, the boundary is the collection named in `CRYSTAL-CANON_source-material-charter.md` §1); source lanes (for EXP-P1's first campaign, the collections in that charter's §2); inclusion policy (primary/authoritative preferred, independent-external only, substantive extractable/inspectable content, English for EXP-P1, within the frozen domain boundary); exclusion policy (metaMe/IRL-authored material for an EXP-P1 campaign, marketing pages, unsupported opinion pieces, duplicates, news summaries where primary reports exist, directory pages without a retrieved underlying document, paywalled material without lawful access, uninspectable documents).

**Source-planning stage:** before searching, produce a Corpus Acquisition Plan per source lane — target source types, likely primary institutions, target reasoning structures, gaps in the existing corpus, indicative document count, priority, expected invariant contribution. Reviewed before broad acquisition begins. For an EXP-P1 campaign, this plan is seeded directly from `CRYSTAL-CANON_source-material-charter.md` §2's table (collection, priority, expected invariant classes already given) — Corpus Scout does not re-derive that plan, it operationalizes it.

## 6. Integration with the Discovery Engine — the handoff, precisely

**No new ingestion API.** The Ingestion Broker (agent J, §8) calls the existing `POST /api/invariants/discovery` route with `action: 'add-evidence'`, once per approved source, mapping fields as follows:

| Corpus Scout package field | `addEvidence` input field | Note |
|---|---|---|
| domain boundary (campaign-level) | `domain` | See `CRYSTAL-CANON_source-material-charter.md` §0.2's flagged domain-value decision — resolved at the engineering/campaign-config level, not invented here |
| source lane / collection | `subDomain` | e.g. `actuarial-science`, `failure-studies` |
| source title | `title` | — |
| document type (recommended additive `EvidenceKind` values, per Crystal Canon §2: `academic-literature`, `incident-report`, `disclosure-report`; existing values `legislation`/`regulation`/`compliance`/`standard`/`contract`/`policy`/`other` otherwise) | `sourceKind` | Extension is flagged, not applied, by this PRD — see Crystal Canon §2 |
| normalized-text extract (from the Inspection Agent, §8 agent E — reusing `pdfExtractionService.ts`, §0.4) | `content` | `addEvidence` caps content at 200,000 chars server-side; Corpus Scout must chunk any single artifact exceeding that into multiple evidence rows rather than truncating silently |
| canonical URL | `sourceRef` | The retrieval-chain / byte-hash detail (§7) stays in Corpus Scout's own provenance store — `addEvidence`'s `EvidenceRow` schema is not extended to carry it; no schema change required |
| reviewer identity | `personaId` (server-resolved, T0 — see `committer()` in `discoveryEngine.ts`) | Unchanged — Corpus Scout does not introduce a new identity path |

Everything else in Corpus Scout's package (`originalArtifactRef`, `sectionMapRef`, `contentHash`, `reviewReceipt`, `provenanceClass`, `reviewWorkflowStatus`, `allowedUses[]`) lives in **Corpus Scout's own provenance store**, referenced by the evidence row's `sourceRef` (the canonical URL) — not duplicated into `EvidenceRow`. The Discovery Engine refuses experimental ingestion where human approval is absent, artifact content is unavailable, the hash is missing, the source isn't approved for the target campaign, extraction failed materially, or provenance is incomplete — enforced at the Ingestion Broker, before the `add-evidence` call is made (Stage 1 itself has no such gate today, and this PRD does not add one to the shared engine; the gate belongs to Corpus Scout, the caller).

## 7. Retrieval, verification, and parsing

**Recursive link resolution:** traverse search result → institutional landing page → publication page → download link → redirect → final file, recording the full resolution chain (`discoveryUrl`, `landingUrl`, `publicationPageUrl`, `downloadUrl`, `resolvedArtifactUrl`, `redirectCount`). Never stop at a plausible title.

**Byte-level verification (per artifact):** HTTP response success, MIME type, file signature/magic bytes, file size, content length, cryptographic hash (sha256), page count where applicable, text-extractability, presence of visual pages, truncation/corruption, actual-report-vs-error-page, title/content match. A `.pdf`-looking URL is not sufficient proof of a valid PDF.

**Content-presence inspection (minimum checks):** title present, issuing institution/authorship present, substantive body content present, no blank-page majority, no error-message body, no navigation-only or table-of-contents-only content, sufficient length for the claimed document type. Illustrative threshold (configurable by source type, not fixed by this PRD): `pageCount ≥ 5 AND substantiveTextCharacters ≥ 5,000 AND blankPageRatio < 0.25`.

**Document parsing:** HTML, PDF (reuse `pdfExtractionService.ts`, §0.4 — do not add a second PDF stack), DOCX, plain text, structured XML, CSV, JSON, EPUB; scanned PDFs via OCR as an exception, never default, OCR-derived artifacts marked and requiring stronger review. Produces per document: normalized text, original artifact reference, page/section map, headings, tables inventory, figures inventory, references, metadata, extraction warnings.

**Discovery priority order:** (1) official issuing institution, (2) recognized standards body, (3) original academic publisher/repository, (4) government/regulatory archive, (5) credible institutional mirror, (6) secondary source only when the original is unavailable.

## 8. Source provenance record (per artifact) and duplicate/version handling

Fields per artifact: `sourceId`, `title`, `issuer`, `authors`, `publicationDate`, `retrievedAt`, `canonicalUrl`, `artifactHash` (sha256), `mimeType`, `fileSizeBytes`, `pageCount`, `licenseStatus`, **`provenanceClass`** (§0.3 — the four ratified values, not a new vocabulary), `acquisitionMethod`, `resolutionChain`, `extractionStatus`, `humanReviewStatus`. Original artifact and normalized derivative get separate hashes.

**Duplicate/version handling:** detect exact duplicates, mirrors, revised editions, drafts vs. finals, translations, superseded standards, consolidated vs. component documents, extracts within larger reports. Canonicalization preference: final > draft; current > superseded (unless historical evolution is required); original issuer > mirror; complete publication > excerpt; machine-readable original > degraded copy. Never delete duplicates silently — link to canonical, retain provenance.

**Structural-value classification (tags, assist review, never replace human judgment):** causal, conditional, relational, mathematical, probabilistic, temporal, threshold-based, feedback, trade-off, constraint, failure-derived, governance, definitional, empirical association. Purpose: avoid a corpus that is large but structurally homogeneous — a source of only duties/recommendations may be authoritative while contributing little derivation headroom (`CRYSTAL-ENLARGEMENT_plan.md` §3 condition d).

## 9. Human review workspace

No source enters an approved corpus without this. Per candidate: source summary (title/issuer/date/lane/authority/relevance/reason), artifact verification (retrieved/type/size/hash/page count/extraction coverage/warnings), content preview (summary/heading outline/representative passages/detected tables/structural themes), agent assessment (likely invariant families/structural tags/novelty/overlap/limitations).

**Reviewer actions:** Approve / Reject / Request replacement / Request deeper inspection / Mark duplicate / Restrict to platform use / Approve for EXP-P1 / Approve outside EXP-P1 — the last two matter because a document can be useful for general financial-services platform application while excluded from a specific experiment's corpus.

**`reviewWorkflowStatus` values** (renamed from Aletheon's "disposition classes", §0.3): `approved_exp_p1`, `approved_general_finance`, `approved_reference_only`, `pending_review`, `needs_retrieval_fix`, `duplicate`, `superseded`, `rejected_out_of_domain`, `rejected_low_substance`, `rejected_provenance`, `rejected_access_or_license`. This axis composes with, and never replaces, `provenanceClass`.

## 10. Agent architecture

Orchestrator + bounded specialists, each with a narrow, named responsibility (mirroring the pure-function/orchestrator separation already used in `services/marketa/activation/discovery.ts`, §0.4):

| Agent | Responsibility |
|---|---|
| A. Source Planner | Domain plan + coverage gaps |
| B. Discovery Agent | Candidate sources/repositories |
| C. Resolver Agent | Traverses landing pages/redirects/nested links to the actual artifact (evaluate `services/aa-api/src/browser/*` reuse, §0.4, before adding a new dependency) |
| D. Retrieval Agent | Downloads + byte-level verification |
| E. Inspection Agent | Parses content, confirms substantive material (reuses `pdfExtractionService.ts` for PDFs, §0.4) |
| F. Provenance Agent | Metadata/versions/resolution chains |
| G. Relevance Agent | Domain fit + expected invariant contribution |
| H. Deduplication Agent | Mirrors/duplicates/superseded/overlap |
| I. Review Packager | Assembles the human-review package (§9) |
| J. Ingestion Broker | Calls `add-evidence` on approved packages (§6) — the only agent that talks to the Discovery Engine |

## 11. Agent permissions and safeguards

**MAY:** browse public sites, retrieve publicly accessible documents, inspect metadata/content, store candidate artifacts, create review packages, recommend inclusion.
**MAY NOT:** bypass access controls, evade paywalls, accept terms on behalf of the user, ingest copyrighted material outside permitted platform policy, approve its own sources, write directly to `Crystal vP1` or any canonical registry, replace a failed retrieval with an inferred summary, silently use a secondary source where a primary source was requested.

## 12. Failure handling and readiness metrics

**Failure classes:** access denied, empty artifact, corrupted file, MIME mismatch, redirect loop, login required, paywall, missing linked artifact, JavaScript-only viewer, scanned-but-unreadable, title/content mismatch, superseded document, out of domain. Every failed acquisition generates a structured result (`status`, `reason`, `attemptedUrls`, `observedContent`, `nextAction`, `confidence`) — distinguishing "not found" from "not actually present."

**Readiness metrics:** artifact-resolution rate, valid-byte retrieval rate, substantive-content pass rate, primary-source ratio, human approval rate, duplicate rate, extraction completeness, average provenance completeness, structural-source diversity, source-lane coverage (per `CRYSTAL-CANON_source-material-charter.md` §3's balance target, not just raw count), % links terminating in verified artifacts vs. landing pages, % approved sources handed to the Discovery Engine. Critical metric: **Verified Artifact Yield** = approved substantive artifacts / candidate search results.

## 13. Acceptance criteria

Production-ready when Corpus Scout can: receive a domain + source plan; discover candidates from multiple authoritative institutions; recursively traverse directories/landing pages; retrieve actual artifact bytes; detect empty/broken/deceptive download targets; inspect/summarize content; generate hashes + provenance; detect duplicates/versions; classify structural reasoning value; present complete packages for human review; separate general-platform approval from campaign-specific (e.g. EXP-P1) approval; hand off only approved artifacts via `add-evidence` (§6); provide a complete audit trail per candidate.

## 14. Initial implementation programme (5 phases — build only after ratification)

1. **Retrieval foundation** — search connector, recursive link resolver (evaluate `services/aa-api/src/browser/*` reuse first, §0.4), downloader, MIME/byte validator, PDF/HTML inspector (reuse `pdfExtractionService.ts`), artifact store, provenance record — tested against known institutional documents.
2. **Review packaging** — normalized extraction, heading/section mapping, source summary, content preview, review queue, `reviewWorkflowStatus` transitions.
3. **Corpus intelligence** — relevance assessment, structural classification, deduplication, version resolution, lane-coverage analysis.
4. **Discovery Engine integration** — the `add-evidence` handoff (§6), ingestion-gate checks at the Ingestion Broker, rejection of unauthorized sources.
5. **Domain campaigns** — first campaign against `CRYSTAL-CANON_source-material-charter.md`'s collections (actuarial science, financial risk mechanics, valuation, market infrastructure, failure studies, information economics).

## 15. First operational objective (EXP-P1 campaign)

Verified candidate artifacts sufficient to give the human reviewer real choice across all of `CRYSTAL-CANON_source-material-charter.md`'s collections; a meaningfully smaller human-approved subset with balanced lane representation (§3's balance target); zero internal metaMe material in the EXP-P1-approved set; complete byte-level verification + hashes; enough structural diversity (§8) to support the crystal's eventual invariant set. No specific count is stated as a requirement here — per `inv.reasoning.350` and `CRYSTAL-CANON_source-material-charter.md` §0.4, any number is illustrative, never binding.

## 16. Canonical design principle

*Discovery identifies where material may exist. Acquisition proves that the material exists. Review determines whether it belongs in the corpus. Invariant discovery determines what reusable reasoning can be derived from it.* Four separate functions, never collapsed into one agent's judgment. Corpus Scout is designed as the reusable acquisition front end for every future domain crystal (§6 of `CRYSTAL-CANON_source-material-charter.md`) — the domain brief changes, the retrieval/verification/provenance/human-approval machinery stays the same.

## 17. Explicitly out of scope for this PRD

- Building or modifying `services/invariants/discoveryEngine.ts`, `app/api/invariants/discovery/route.ts`, or any Stage 2–5 logic.
- Any specific artifact/document count as a hard requirement (§15).
- A new IRL governance charter — none is needed (§0.5).
- The `EvidenceKind` extension named in §6/Crystal Canon §2 — flagged, not applied; a future ratifying pass makes that one-line type change.
- Deciding the Discovery Engine `domain` value for EXP-P1 campaigns — flagged in `CRYSTAL-CANON_source-material-charter.md` §0.2, resolved at engineering time, not here.

---

## Ratification record

- [ ] Operator ratification of this PRD (status: DESIGN, awaiting sign-off)
- [ ] Ratification of `CRYSTAL-CANON_source-material-charter.md` (companion — names what the first campaign targets)
- [ ] Engineering resolves the flagged `EvidenceKind` extension and domain-value decision before Phase 1 build begins
- [ ] Build tracked against §14's phased programme once ratified
