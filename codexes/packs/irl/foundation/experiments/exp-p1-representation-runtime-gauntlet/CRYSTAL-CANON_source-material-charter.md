# EXP-P1 Crystal Canon — Source-Material Charter

**metaMe IRL · EXP-P1 Track 2 (crystal enlargement) content plan · Status: DESIGN (docs-first, ratify-before-build)**
**Owner:** Invariant Research Lab (IRL) · **Origin:** operator + Aletheon design session, consolidated against the existing Discovery Engine + `CRYSTAL-ENLARGEMENT_plan.md`, 2026-07-22
**Governs:** WHICH external source material feeds `Crystal vP1`'s enlargement, at what priority, in what balance. It does not touch the enlargement MECHANICS (method, sequence gate, exclusion rule) — those stay exactly as `CRYSTAL-ENLARGEMENT_plan.md` already fixes them.

> Companion documents: `CRYSTAL-ENLARGEMENT_plan.md` (Track 2 mechanics — read first), `PRD-EPI-001_exp-p1-experimental-infrastructure-programme.md` (Track 1 infrastructure), `PRD-ICA-001_invariant-corpus-acquisition-agent.md` (the agent that turns this charter's collections into verified, human-reviewed `addEvidence()` calls).

---

## 0. Read this first — reconciliation against what's already ratified

The source dialogue (Aletheon's Crystal Canon proposal) is strong content curation, but it was drafted without full visibility into three things already built or ratified in this codebase. Filing it verbatim would either silently fork the discovery pipeline or misfile candidates into the wrong collection. This section is the correction; §§1–6 are the reconciled charter.

### 0.1 The discovery pipeline already exists — do not re-derive it

`services/invariants/discoveryEngine.ts` (CFS-048) is a five-stage pipeline, named in its own header comment:

```
Stage 1 Evidence Collection  → discovery_evidence   (addEvidence / listEvidence)
Stage 2 Candidate Extraction → callSovereign          (runConstitutionalDiscovery)
Stage 3 Synthesis            → compression            (compareSubDomains, compressDomainInvariants)
Stage 4 Validation            → the existing experiment harness (unchanged)
Stage 5 Canonical Publication → discoverInvariant → validate → canonize
```

Aletheon's proposal states a generic diagram — *Document → Candidate Invariants → Deduplicate → Cluster → Relationship Detection → Structural Mapping → Validation → Standing → Crystal*. Mapped onto the real pipeline, function-by-function, so nothing here is re-implemented:

| Proposal step | Actual mechanism (cite by name) |
|---|---|
| Document → Candidate Invariants | Stage 1 `addEvidence`/`listEvidence` (evidence rows, tagged by `EvidenceKind`, scoped to `domain`/`subDomain`) → Stage 2 `runConstitutionalDiscovery` (L2/L3-only abstraction — L0/L1 are rejected by the grammar mandate; `discoveryClass: 'constitutional'`) |
| Deduplicate | `computeConvergence` / `enrichConvergence` — cross-document convergence tiers (`single`/`strong`/`broad`), a **prioritisation signal**, never a validity filter (Law XII: support is evidence, not truth) |
| Cluster | `compareSubDomains` (Stage 3, "Phase 2 — earned domain invariants") — clusters same-invariant manifestations across sub-domains into one compressed candidate, classified `supported`/`specialized`/`split`/`novel`/`equivalent` against the provisional baseline |
| Relationship Detection + Structural Mapping | `compressDomainInvariants` — proposes root/derived roles with **typed** parent edges (`entails`/`specializes`/`depends_on`/`supports`); persisted into `discovery_provenance.compression` but **never auto-materialized** — `materializeCompressionEdges` requires explicit operator confirmation |
| Validation | Stage 4, unchanged — a promoted candidate lands at `status: 'proposed'` via `promoteCandidate` → `discoverInvariant`, **never canonical** (`inv.reasoning.337`); it then earns `validated` the normal way, per `CRYSTAL-ENLARGEMENT_plan.md` §2's receipted `proposed → validated` accrual discipline — real `times_validated` counts, no zero-validation filler |
| Standing | Derived post-validation by the existing standing/reach mechanism (EXP-009 fields: `times_validated`, `times_contradicted`, `standing`, `reach`) — untouched by this charter |
| Crystal | Stage 5, `discoverInvariant` → validate → canonize — landing in `Crystal vP1` gated by BOTH the provenance tag (only `external-established` / `external-empirical` eligible, `CRYSTAL-ENLARGEMENT_plan.md` §2a) AND the EXP-009 freeze-snapshot mechanism |

Every collection below (§2) is source material that feeds **Stage 1 only** — `addEvidence` calls, `EvidenceKind`-tagged. Nothing in this charter invents a parallel ingestion path; §4 of `PRD-ICA-001` names the exact API surface.

### 0.2 The critical fix — this is source material for the *constitutional-reasoning* collection, not a new "financial risk" crystal

Aletheon's proposal headers itself **"Domain: Financial Risk & Value Systems"** and frames the collections as if EXP-P1's crystal *is* a financial-risk domain. Verified against the codebase, this is not accurate and needed correcting before it could ship:

- `CRYSTAL-ENLARGEMENT_plan.md` §1 names the target explicitly: *"Grow the EXP-P1 **constitutional-reasoning domain collection** from its current 18 invariants..."*
- `experiments/exp-p1-representation-runtime-gauntlet/README.md` §12 is equally explicit: *"`Crystal vP1` = **the platform's own doctrine collection**"* — governance, delegation, sovereignty, standing, accountability — deliberately the *"maximally-friendly, self-referential domain"* for the Representation & Runtime Gauntlet comparative experiment. It is not, and was never, a financial-risk subject-matter crystal.
- Separately, `services/invariants/discoveryEngine.ts` already runs an ACTIVE, unrelated pipeline for `domain: 'financial-services'` (default in `app/api/invariants/discovery/route.ts`), with its own `SUB_DOMAIN_PRESETS` (investment-operations, market-operations, financial-intelligence, financial-integrity, constitutional-commerce, payments, trading, banking, custody, cross-border, qriptocent — CRP-003's D1–D6). That pipeline feeds Agent MoneyPenny's `inv.finance.*` library (`PRD-MPY-001`) — a **separate, already-running effort**, not EXP-P1's crystal.

**The reconciliation:** Collections A–L below are proposed **source-material subject matter** (financial regulation, actuarial science, risk science, etc.) chosen because it is (a) genuinely external to IRL — fixing the self-affinity problem `CRYSTAL-ENLARGEMENT_plan.md` §2a already committed to fixing — and (b) unusually dense in constitutional-class structure (obligation, permission, prohibition, right, governance rule, accountability constraint — exactly the grammar `runConstitutionalDiscovery`'s mandate extracts). The resulting **candidates must still pass the constitutional-class / L2-L3 filter** and land in the constitutional-reasoning collection that `Crystal vP1` already is — they are not a new financial-services sub-domain, and they must not be filed under `domain: 'financial-services'` where they would silently mix into MoneyPenny's separate FS candidate pool.

**Flagged engineering decision (not resolved here — needs one line of config, not a design call):** the Discovery Engine's `domain` parameter is a free string with per-domain `SUB_DOMAIN_PRESETS`. Running Corpus Canon extraction under the *existing* `financial-services` domain string would cross-pollinate two unrelated candidate pools (EXP-P1's crystal vs. MoneyPenny's `inv.finance.*` library) that happen to share a subject-matter vocabulary. **Recommendation:** extraction runs for this charter's collections use a distinct domain value — e.g. `constitutional-reasoning` — with its own `SUB_DOMAIN_PRESETS` entry mirroring §2's collection names below (`prudential-regulation`, `risk-science`, `actuarial-science`, `valuation`, `financial-economics`, `market-infrastructure`, `failure-studies`, `financial-reporting`, `quantitative-risk`, `information-economics`, `data-governance`). This is additive to the existing `Record<string, ...>` shape in `app/api/invariants/discovery/route.ts` — not a new endpoint, not a schema change. Left as a flagged decision for whoever runs the first campaign, not decided unilaterally here.

### 0.3 The exclusion rule and provenance tag are not restated here — they are inherited

`CRYSTAL-ENLARGEMENT_plan.md` §2a already rules that internal/platform risk materials are excluded from `Crystal vP1`, and that every invariant entering the crystal carries the tag `external-established | external-empirical | platform-derived | platform-hypothesized`, with only the first two eligible. Every collection below is chosen specifically to be `external-established` (regulatory/standards-body text) or `external-empirical` (failure studies, academic literature, cross-institution report patterns) under that same tag — **this charter does not introduce a second vocabulary.** Aletheon's proposal's own "sources to avoid" list (metaMe internal models, QriptoCENT economics, internal pricing/valuation models, IRL-authored constitutional papers) is exactly the `platform-derived`/`platform-hypothesized` exclusion already ratified — restated in §3 below only as a corpus-avoid list, not as a new rule.

### 0.4 Illustrative numbers stay illustrative

Per `inv.reasoning.350` and `PRD-EPI-001` §0.5, the "60–90 invariants" figure in Aletheon's proposal is a sensible planning anchor, never a requirement. It is not restated as a target anywhere below; the actual size is an implementation parameter that falls out of the finalized task set and the ⊆40% guard, exactly as `CRYSTAL-ENLARGEMENT_plan.md` §1 already states.

### 0.5 Status — this fills a gap `CRYSTAL-ENLARGEMENT_plan.md` deliberately left open, it does not unpause Track 2's mechanics

`CRYSTAL-ENLARGEMENT_plan.md` §2a explicitly deferred "which external corpora, what domain boundary, target composition" to a follow-up. This document IS that follow-up's content plan. It does **not** change `CRYSTAL-ENLARGEMENT_plan.md`'s method (§2), sequence gate (§4), or definition of done (§5) — those still govern how any of this material actually gets promoted. Ratifying this charter authorizes WHAT to source; it does not authorize skipping the receipted `proposed → validated` accrual discipline, and it does not itself trigger any acquisition work — see `PRD-ICA-001` for the agent that would execute against it, itself DESIGN-status pending separate ratification.

---

## 1. Domain boundary

**Target collection:** `Crystal vP1` — the constitutional-reasoning collection `CRYSTAL-ENLARGEMENT_plan.md` already governs (governance, delegation, sovereignty, standing, accountability-class invariants).
**Source-material subject matter for this enlargement pass:** financial risk, valuation, and value-systems literature — chosen for external-sourcing + structural density, per §0.2.
**In-domain constraint (condition c, inherited):** enlargement stays within the constitutional-reasoning collection boundary. Cross-domain widening (medicine, law, etc. — §6) is a *successor* question, never a Phase-1 choice.

## 2. Collections (priority-ordered, expected invariant classes)

Each collection is Stage-1 evidence material only (§0.1) — `EvidenceKind`-tagged `addEvidence` rows. `EvidenceKind` today is `legislation | regulation | compliance | standard | contract | policy | other` (`services/invariants/discoveryEngine.ts`). Several collections below (C, E, G, H, I, J) don't map cleanly onto any existing value — flagged per-collection rather than silently forced into `other`; see the note after the table for the recommended additive extension (not applied in this session — no code changes ship with this charter).

| # | Collection | Priority | Purpose | Expected invariant classes | `EvidenceKind` fit |
|---|---|---|---|---|---|
| A | Prudential Banking & Financial Regulation | ★★★★★ | Constitutional/governance invariants (foundational, largely already represented) | proportionality, capital adequacy, liquidity, independence, control, governance, resilience | `regulation`/`standard` — fits as-is (Basel, FATF, IOSCO) |
| B | Risk Science | ★★★★★ | Structural risk mechanics | uncertainty, appetite, exposure, mitigation, feedback loops, monitoring, continual improvement | `standard` — fits as-is (COSO, ISO 31000/31010, NIST) |
| C | Actuarial Science | ★★★★★ | Largest identified gap in the current corpus | expected loss, aggregation, tail behaviour, credibility, information value, pricing under uncertainty | no clean fit — recommend additive `academic-literature` |
| D | Valuation | ★★★★★ | Future value / discounting / uncertainty invariants | future value, discounting, expected outcomes, market information, valuation uncertainty | `standard` — fits as-is (IFRS Foundation) |
| E | Financial Economics | ★★★★☆ | Introduces causal reasoning | diversification, market efficiency, capital allocation, agency theory, information asymmetry | recommend additive `academic-literature` (Markowitz/Sharpe/Coase/Akerlof/Kahneman-Tversky class sources — used for foundational structure, never for authorial prominence) |
| F | Market Infrastructure | ★★★★☆ | Settlement/counterparty mechanics | settlement, finality, counterparty risk, collateral, liquidity | `standard` — fits as-is (CPMI) |
| G | Failure Studies | ★★★★★ | May become the richest source | feedback, fragility, contagion, thresholds, confidence, liquidity spirals | no clean fit — recommend additive `incident-report` (crisis reports, bank-failure post-mortems, regulatory enforcement actions, stress-test findings) |
| H | Financial Reporting | ★★★☆☆ | Pattern-mining only — never single-institution fact | traceability, disclosure consistency (only where a pattern **recurs across ≥2 institutions** — a single 10-K fact is not an invariant; the evidence unit is a cross-document cluster, not one report) | no clean fit — recommend additive `disclosure-report` |
| I | Quantitative Risk | ★★★★☆ | Distributional/tail reasoning | distribution, uncertainty, tail dependence, simulation | recommend additive `academic-literature` |
| J | Information Economics | ★★★★★ | Particularly valuable for metaMe's own information-value doctrine | information reduces uncertainty, better information changes decisions, perfect information is bounded by decision value | recommend additive `academic-literature` |
| K | Data Governance | ★★★★☆ | Traceability/provenance invariants | traceability, integrity, quality, provenance | `standard` — fits as-is (data-quality/lineage frameworks) |
| L | Constitutional Layer (existing) | — | The current 18-invariant baseline (Basel, FATF, MiCA, AML, Travel Rule, governance, standing, delegation) | — | **keep; do not expand further** — this collection is what `CRYSTAL-ENLARGEMENT_plan.md` is already growing FROM, not a new acquisition target |

**Recommended `EvidenceKind` extension (flagged, not applied):** three additive values — `academic-literature` (Collections C, E, I, J), `incident-report` (Collection G), `disclosure-report` (Collection H). This is a type-union extension in `services/invariants/discoveryEngine.ts` only (`EvidenceKind` + the `source_kind` column's check, if any) — additive, non-breaking, matches the "small additive extension" pattern the Discovery Engine already uses for `CompressionRelationship`/`CompareClassification`. Left for the engineering pass that ratifies this charter; no code changes ship with this document.

**Sources to avoid (inherited from `CRYSTAL-ENLARGEMENT_plan.md` §2a, restated only as a corpus-avoid list — not a new rule):** metaMe-authored internal financial models, QriptoCENT economics, internal pricing/valuation models, constitutional papers authored by IRL. Not because they lack value — because they are exactly the `platform-derived`/`platform-hypothesized` tag the exclusion rule already screens out for this experiment's corpus. They remain available for platform operations (Agent MoneyPenny, the FS application) and for later, explicitly-scoped secondary experiments.

## 3. Corpus balance target

| Lane | Target share |
|---|---|
| Regulation (Collection A) | 20% |
| Risk Science (B) | 15% |
| Actuarial (C) | 15% |
| Valuation (D) | 10% |
| Financial Economics (E) | 10% |
| Market Infrastructure (F) | 10% |
| Failure Studies (G) | 10% |
| Information Economics (J) | 10% |

This is a **composition target for the enlargement pass**, reported alongside document count (per `PRD-ICA-001` §readiness metrics — coverage must be reported by lane, not just by total). It corrects the corpus's current governance-heavy skew (today's collection is estimated 70–80% governance/regulation-class material; the target caps that lane at 20% for the *added* material) — an intent, not a hard gate; `CRYSTAL-ENLARGEMENT_plan.md` §2's "no invariant authored to hit a number" rule governs actual accrual regardless of how far the balance target is met.

## 4. Discovery pipeline — see §0.1

The full function-by-function mapping is in §0.1 above; it is not repeated here. The one operational note specific to this charter: because Collections A–L span 11 distinct sub-domains, the recommended `constitutional-reasoning` domain (§0.2) should mirror the `financial-services` domain's existing sub-domain-preset pattern — one preset per collection letter, `runConstitutionalDiscovery` invoked per sub-domain, `compareSubDomains` run once enough sub-domains have candidates (≥2, per the existing gate), then `compressDomainInvariants` for the cross-collection derivation structure.

## 5. Definition of done for this charter

- [ ] Operator ratifies the collection list, priorities, and balance target (§§2–3), or amends them.
- [ ] Engineering resolves the flagged domain-value decision (§0.2) before any extraction run.
- [ ] `PRD-ICA-001` (Corpus Scout) is separately ratified before any acquisition work begins against these collections — this charter names WHAT to source, not who sources it or how.
- [ ] Actual accrual still follows `CRYSTAL-ENLARGEMENT_plan.md` §§2, 4, 5 in full — receipted `proposed → validated`, sequence gate, definition of done. This charter does not shortcut any of it.

## 6. Forward-looking note (context only — not a build requirement)

The discipline this charter follows — define domain boundary → source an independent corpus → discover candidates → cluster/dedupe → validate → freeze → derive — is, by construction, domain-agnostic. Should the Institute charter future domain crystals (medicine, law, supply chains, cybersecurity, climate, biology, aerospace), this charter and `CRYSTAL-ENLARGEMENT_plan.md` together are the reusable template, and `PRD-ICA-001`'s Corpus Scout is designed as the reusable acquisition front end for exactly that. This is noted for context; it authorizes nothing beyond EXP-P1's own enlargement.

---

## Ratification record

- [ ] Operator ratification of this charter (status: DESIGN, awaiting sign-off)
- [ ] Companion: `PRD-ICA-001_invariant-corpus-acquisition-agent.md` ratified separately before acquisition work begins
- [ ] Engineering resolves §0.2's flagged domain-value decision before the first extraction run
