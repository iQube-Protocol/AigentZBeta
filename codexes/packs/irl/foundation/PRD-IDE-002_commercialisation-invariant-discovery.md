# PRD-IDE-002 — Commercialisation Invariant Discovery Engine

**metaMe IRL · Product/engineering specification · Status: DESIGN (docs-first, ratify-before-build)**
**Owner:** Invariant Research Lab (IRL) · **Origin:** operator specification + Addendum A (Cross-Domain Commercialisation Discovery Campaign), 2026-07-27
**Governs:** Commercialisation as a **horizontal capability** discovery domain within the already-shipped Invariant Discovery Engine (CFS-048), and the **Cross-Domain Recurrence Score** that Addendum A introduces.
**Composes (does not fork):** `services/invariants/discoveryEngine.ts` (CFS-048) · `PRD-ICA-001` (Corpus Scout) · `CRP-003`/`CRP-003a` (the Financial Services vertical) · `CFS-052` + `CFS-009` Law XVI (Evidence Architecture & Dual Validation) · Horizen audit Amendments **D.4a**, **D.5**, **D.6** · CLAUDE.md's hypothesis-vs-canon rule.

> **No invariant produced by this programme becomes canonical directly.** Every discovery enters the existing seed-and-ratify process as a **proposed** candidate. Commercial success is constitutional evidence for a constitutional invariant's *use* (CFS-052 §2.1); it never promotes an empirical claim to `canonical`.

---

## 0. Audit first — what already exists, and what this PRD therefore does NOT build

The commission's standing instruction (CCR-001, carried into CFS-052 §0): *do not duplicate what is already law, or already code, under another name.* Recorded before any of this is treated as new.

| The PRD asks for | Already exists as | Disposition |
|---|---|---|
| A discovery pipeline for a new domain | `services/invariants/discoveryEngine.ts` — Stage 1 `addEvidence`/`listEvidence` → Stage 2/3 `runConstitutionalDiscovery` → Compare `compareSubDomains` → recursive `compressDomainInvariants` → Stage 5 `promoteCandidate` (lands `proposed`, never canonical) | **EXISTS. Untouched except additively.** No second pipeline is built |
| A discovery hierarchy (domain / sub-domain / capability) | `DiscoveryScopeLevel` | **EXISTS** — reused verbatim |
| Discovery levels L0–L4 | `AbstractionLevel`, with the mandate already forbidding L0/L1 emission and deferring L4 to cross-domain comparison | **EXISTS** — L2/L3 targeting is already the engine's default behaviour |
| A comparison framework (Supported · Equivalent · Specialised · Split · Novel) | `CompareClassification` | **EXISTS** — reused verbatim, all five values |
| Cross-framework support counting | `computeConvergence` / `ConvergenceInfo` — distinct SOURCE DOCUMENTS within one corpus | **EXISTS.** Distinct from recurrence (below) and NOT a substitute for it: five FATF documents are broad convergence but still one domain |
| A corpus acquisition mechanism | `PRD-ICA-001` (Corpus Scout), **ratified 2026-07-22 and built**: `services/corpusScout/*`, `app/api/corpus-scout/*`, Domain Definition / Coverage Model / Dependency Registry / Institutional Registry, human review workspace, `add-evidence` Ingestion Broker | **EXISTS.** §7 below is a **campaign brief for Corpus Scout**, not a second acquisition design |
| Evidence kinds for academic / failure / disclosure material | `EvidenceKind` already carries `academic-literature`, `incident-report`, `disclosure-report` (PRD-ICA-001 ratification record, commit `54bf6d4e`) | **EXISTS.** No type change needed for this domain's corpus |
| The structural/constitutional invariant split, and who may canonise what | **CFS-052** Parts I–IV + CFS-009 Law XVI | **EXISTS as ratified law.** This PRD is *governed by* it and does not restate it |
| Venture Lab consumes, Research Lab canonises | Horizen audit §D.6 (Lab mandates) + §D.5 (only Research Lab canonises) + CFS-052 §3 | **EXISTS** |
| "One sector ⇒ specialised, not universal" | Amendment **§D.4a** | **EXISTS as a rule.** §8's recurrence score makes it MECHANICAL rather than a matter of reviewer judgement |
| **A cross-domain recurrence score** | **Nothing.** `coverage` on a Compare candidate counts SUB-DOMAINS within one domain; there is no across-domain measure | **GENUINELY NEW — the one new mechanism in this PRD** |
| A domain registry for discovery | **Nothing, and worse: three hand-maintained copies** — `SUB_DOMAIN_PRESETS`/`DEFAULT_DOMAIN` in `app/api/invariants/discovery/route.ts`, `KNOWN_DOMAINS` in `CorpusScoutTab.tsx`, `useState("financial-services")` in `InvariantDiscoveryTab.tsx` | **NEW, and a pre-existing `inv.engineering.036` defect** fixed here: `services/invariants/discoveryDomains.ts` is now the single authoritative list; all three surfaces derive from it |

**Two things were found and deliberately NOT built.** (a) A `commercialisation` namespace in `canonical-invariants.seed.json` — amending canon is an operator act under Law XI; §10 supplies the exact block instead. (b) Any coupling between this registry and `services/resolution/domainProfileRegistry.ts` / the `domain_profiles` table (SPEC-CDR-001) — that registry answers a **runtime** question ("which domain is this operator acting in"), this one answers a **research** question ("which domain is this candidate discovered for"). They stay uncoupled; a canary enforces it.

---

## 1. Purpose and the constitutional definition

Establish **Commercialisation** as a first-class invariant discovery domain, using the same constitutional discovery methodology as Financial Services while recognising that commercialisation is a **cross-cutting capability, not an industry vertical**.

The domain's constitutional definition, operator-supplied and carried verbatim into code (`services/invariants/discoveryDomains.ts`, pinned by canary):

> Commercialisation is the discovery of recurring structural patterns governing the creation, delivery, adoption, exchange and sustainable capture of value across domains.

That definition is load-bearing in one specific way: it keeps the programme aligned with the invariant programme rather than drifting into conventional business methodology. **The objective is not to discover marketing tactics or fashionable frameworks.** It is to discover constitutional or structural regularities that persist across successful commercial systems.

The output is a governed library of **proposed** commercialisation invariant candidates suitable for: Venture Lab pilots; commercial experiment design; venture evaluation; consequential performance experiments; the Experiment P1 crystal freeze; and future commercial domains.

## 2. Constitutional position — vertical vs horizontal, and why it is a PARALLEL programme

Financial Services is a **vertical** domain: an industry, with a corpus of its own. Commercialisation is a **horizontal capability** domain: it must be discoverable and reusable across every vertical the platform eventually supports, with Financial Services as the first proving ground rather than the parent.

```
Financial Services  → applies →  Commercialisation  → applies →  Constitutional Governance
   (vertical)                    (horizontal)                     (substrate)
```

Three consequences that are architectural, not rhetorical:

1. **A horizontal domain has no corpus of its own.** Its evidence is *observed inside* the verticals. In the engine this is expressed as a qualified evidence-domain key, `commercialisation/<vertical>` — see §8.1. That single convention is what makes the recurrence score a **query over evidence** rather than a stored number.
2. **Recurrence, not frequency, is the confidence signal.** Fifty commercial artefacts inside the KNYT corpus are one domain. A candidate that emerges independently in Financial Services, Media, and Human Mobility Services is a materially stronger prospect, and Amendment §D.4a already makes the one-domain case `specialized` by rule.
3. **It does not replace Financial Services and is not gated on it.** Both programmes run in parallel; a Financial Services pilot may cite both an FS invariant and a commercialisation invariant while remaining constitutionally governed.

### 2.1 Relationship to CFS-052 (read this before reading §8)

CFS-052 §3 II.2 already states: *"Commercialisation is therefore a constitutional validation mechanism rather than merely a revenue mechanism."* This PRD is the **discovery** counterpart of that clause and adds nothing to it. The division of labour it fixes is honoured here without restatement:

- **Research Lab** — discovery, validation, falsification, replication, canonisation. **Commercialisation Discovery belongs organisationally to the Research Lab**, even though its outputs primarily serve Venture Lab.
- **Venture Lab** — resolves relevant invariants, applies them, generates receipts, records operational and commercial evidence, identifies failures, proposes new candidates. **It does not canonise.**
- **Registry / Commons** — untouched by this PRD; no proof type is created here.

The boundary CFS-052 §2.1 draws is the one that governs §10: operational success is sufficient for a *constitutional* invariant to be relied upon; it is never sufficient to canonise a *structural* claim. Most of §9's library is structural. It stays `proposed`.

### 2.2 Relationship to Experiment P1 — why now

Before freezing the next Seed Crystal, broaden the invariant substrate beyond constitutional and financial services, so the freeze carries three complementary classes: **Constitutional + Financial Services + Commercialisation**. The commercialisation entries enter as **proposed**. The crystal is not being expanded with a new canon; it is being expanded with a richer set of *candidate* invariants against which to test the reasoning and discovery process itself.

## 3. Discovery hierarchy and levels — unchanged, reused

| Concept | Where it lives | Change |
|---|---|---|
| `domain` / `sub-domain` / `capability` | `DiscoveryScopeLevel` | none |
| L0 verbatim → L4 domain-independent | `AbstractionLevel` + `GRAMMAR_MANDATE` | none. L0/L1 are already refused; **Commercialisation targets L2–L3 only**, which is already the mandate's instruction |
| supported / equivalent / specialised / split / novel | `CompareClassification` | none |
| Convergence (distinct source documents) | `computeConvergence` | none |
| **Recurrence (distinct domains)** | `computeRecurrence` | **new — §8** |

## 4. Sub-domain taxonomy (Deliverable 2)

Fourteen sub-domains. This is the operator's fifteen **after** corpus testing — §5 records every merge, split, addition and rejection with the evidence for it. The keys below are the executable `sub_domain` values; the registry and this table are pinned to each other by canary.

| Key | Label | What it is the study of |
|---|---|---|
| `value-proposition` | Value Proposition | What the offer asserts it preserves or creates, and how that assertion is structured |
| `customer-discovery` | Customer Discovery & Fit | How a commercial system identifies who it is for, and how it detects that it has found them |
| `trust-formation` | Trust Formation | How warranted confidence is established between parties before value moves |
| `pricing` | Pricing | How value is denominated, tiered, discounted and steered |
| `distribution` | Distribution & Go-to-Market | How the offer reaches an audience — channels, sequences, cohorts, segments |
| `adoption` | Adoption | How a party moves through the states of using the offer |
| `revenue-architecture` | Revenue Architecture | Where revenue originates and how offers compose without cannibalising each other |
| `settlement-exchange` | Settlement & Exchange | How value actually transfers — rails, adapters, attribution, integrity |
| `partnerships` | Partnerships & Ecosystem Development | How third parties are qualified, sequenced and grown into the system |
| `outcome-assurance` | Outcome Assurance & Retention | How delivered outcome is measured, sustained, and kept |
| `scaling` | Scaling | How delivery is repeated without linear cost, and what the repeatable unit is |
| `venture-operations` | Venture Operations | How the commercialising organisation itself is structured and progressed |
| `commercial-governance` | Commercial Governance | The authority, attribution and disclosure rules that govern commercial action |
| `commercial-failure-modes` | Commercial Failure Modes | The recurring shapes of commercial failure, and what they constrain afterwards |

## 5. Taxonomy verdict — what the corpus changed (and why an unchanged list would be a red flag)

The operator's instruction was explicit: *"Claude should challenge, merge or split these during corpus analysis rather than treating them as fixed."* A taxonomy returned unchanged is evidence it was never tested. Fifteen went in; fourteen came out, via three merges, one rejection-with-absorption, one split and two additions.

### Merged (3)

| Merge | Evidence for merging |
|---|---|
| **Customer Discovery** + **Product-Market Fit** → `customer-discovery` | No in-repo artefact separates them. `docs/alpha/agentiq-knyt/29-avl-customer-surface-addendum.md`'s candidate-scoring model and `docs/marketa/MARKETA_ACTIVATION_ENGINE_PRD_AMENDMENT_HUMAN_MOBILITY.md`'s two-dimensional market map each do both jobs in one mechanism — identify the segment *and* judge fit to it. Nothing in the corpus measures fit as a distinct structure |
| **Partnerships** + **Ecosystem Development** → `partnerships` | `docs/alpha/agentiq-knyt/25-avl-knyt-prd.md`'s seven-stage partner pipeline and `26-avl-continuity-addendum.md`'s partner-evolution chain (`co_activation_agreed → integration_scoped → integration_active → live_partner`) are the SAME state machine used for both concerns; HMS's `app/api/mobility/cases/[caseId]/ies/route.ts` uses one institution-scoring mechanism to serve both. Two labels, one structure |
| **Customer Success** + **Retention** → `outcome-assurance` | HMS `app/api/mobility/_lib/computeScores.ts` (Recovery Velocity class) and Media `26-avl-continuity-addendum.md` (the table forbidding reset of ladder stage, `$KNYT` balance, receipts and offer-fit signals) are the same concern from two ends: *does the customer keep getting the outcome*. Renamed to the operator's own HMS term, "outcome assurance", because that is the structural framing and "customer success" is the job-title framing |

### Rejected (1)

| Rejected | Why |
|---|---|
| **Go-to-Market** — absorbed into `distribution` | Rejected as a *sub-domain*, not merely merged, because it is a **programme concept (a plan) rather than a structure**. Every structural regularity in `KNYT_CAMPAIGN_ACTIVATION_BLUEPRINT.md` and `KNYT_CAMPAIGN_OPERATIONS.md` — the corpus's two most GTM-shaped documents — resolves to either a channel/sequence/cohort question (`distribution`) or an engagement-state question (`adoption`). Keeping it would have created a sub-domain whose only distinctive content is tactics, which the PRD's own scope forbids. The label survives in `distribution`'s display name so a steward looking for it finds it |

### Split (1)

| Split | Evidence for splitting |
|---|---|
| **Revenue Architecture** → `revenue-architecture` + `settlement-exchange` | The operator's own definition names **exchange** as one of the five governed verbs, and no proposed sub-domain covered it. The corpus separates them cleanly: `codexes/packs/knyt/meta.json` prices the *transfer* (`"knytDiscountPercent": 0.2`, `"fiatPremiumPercent": 0.07`) while `types/knyt-store.ts` structures the *offer*; `CRP-003` §6 makes the separation explicit — *"Settlement becomes an implementation detail; integrity … is the primitive."* Revenue Architecture answers "where does revenue come from"; Settlement & Exchange answers "how does value actually move" |

### Added (2)

| Added | Evidence for adding |
|---|---|
| **`trust-formation`** | The single strongest omission. Addendum A explicitly asks *"Which trust mechanisms appear consistently?"* — and trust recurs independently in **all three** domains: HMS's PDEP staged-disclosure ladder (*"Need-to-know is insufficient. The system also enforces need-to-know-now."*), Media's agent trust bands (*"Access should expand through trust, not assumption."*), FS's Standing + `F-103 Verification Before Standing`. With no home of its own it would have been split across `customer-discovery` / `adoption` / `commercial-governance` and its recurrence would have been **invisible** — the strongest cross-domain signal in the corpus, lost to taxonomy |
| **`commercial-failure-modes`** | The PRD's own scope names *"commercial failure modes"* and no sub-domain housed them. PRD-ICA-001 §14 already provides for a `failure-studies` acquisition lane and the `incident-report` `EvidenceKind` is already ratified — the machinery exists, the taxonomy slot did not. In-repo evidence is thin but real (§9 C-011); §11.2 records it as a priority acquisition gap |

### Kept unchanged (8)

`value-proposition`, `pricing`, `adoption`, `scaling`, `venture-operations`, `commercial-governance`, plus the surviving halves of the merges. **`commercial-governance` was reviewed for rejection** as a possible duplicate of the Constitutional substrate and kept — but with a warning that §9 acts on: most of its evidence *is* the constitutional substrate, so its candidates are likely to classify **`equivalent`** rather than `novel`. That is a correct and useful outcome (classification rather than duplication), not a defect — but a reviewer who reads `equivalent` as "new finding" would be double-counting canon as discovery.

## 6. Corpus — Addendum A's three domains, all with real in-repo material

Addendum A expands the initial pass across three **active platform domains** so recurrence can be detected before the crystal freeze. All three have genuine in-repo corpora; that is why they were chosen.

| Domain | Emphasis | Principal in-repo corpus |
|---|---|---|
| **Financial Services** | Consequential commercial operation under strong regulatory constraint | `CRP-003`, `CRP-003a`, `PRD-MPY-001`; `services/constitutional/constitutionalServicePipeline.ts`; `services/billing/planCheckout.ts`; `services/activations/activationPlanGate.ts`; `services/venture/partnerWorkspace.ts` |
| **Media** (metaKnyts franchise) | Audience formation, creator ecosystems, monetisation, licensing, network effects | `codexes/packs/knyt/items/*` (Experience Pack PRD, Matrix Sheet, Runtime Surface Spec, Campaign Activation Blueprint, Agent Charter/Missions/Discovery frameworks); `docs/alpha/agentiq-knyt/25/26/29/36`; `types/knyt-store.ts`; `services/campaign/*` |
| **Human Mobility Services** | High-touch professional service delivery, trust establishment, case progression | `codexes/packs/agentiq/updates/2026-06-17_hms-*`; `supabase/migrations/20260617000000_mobility_cases.sql`; `app/api/mobility/**`; `app/triad/components/codex/tabs/Mobility*Tab.tsx`; `docs/marketa/MARKETA_ACTIVATION_ENGINE_PRD_AMENDMENT_HUMAN_MOBILITY.md` |

**The in-repo corpus is platform-internal material.** Per `CRYSTAL-ENLARGEMENT_plan.md` §2a it carries provenance class `platform-derived` (or `platform-hypothesized` for a doc-only claim), never `external-established`, and per PRD-ICA-001 §5 it is **excluded from an EXP-P1-approved corpus without explicit authorisation**. §9's library is therefore a `platform-derived` candidate set: real, traceable, and correctly labelled as internal.

## 7. Corpus acquisition plan (Deliverable 3) — a Corpus Scout campaign brief, not a second pipeline

Corpus Scout (PRD-ICA-001) is **ratified and built**. This section supplies what it consumes: a Domain Definition, a Constitutional Coverage Model, a Dependency Registry, and per-lane source planning. Nothing here designs retrieval, verification, provenance or review — all of that already ships.

**7.1 Domain Definition** (`corpus_domain_definitions`, via `upsertDomainDefinition` → steward ratification): the §1 definition, verbatim.

**7.2 Constitutional Coverage Model** — propose the fourteen §4 sub-domains as coverage pillars (`upsertCoveragePillar`). A pillar's `completenessDefinition` should state what saturation means for it; saturation is confirmed explicitly by a steward (`confirmPillarSaturation`), never inferred from a count.

**7.3 Dependency Registry** — the tangential domains Commercialisation is *constrained by*, recorded with the relationship (the edge is the point): Financial Services · Economics · Operations · Product Management · Organisational Behaviour · Systems Engineering · Service Design · Innovation Management · Entrepreneurship · Platform Economics. **These are comparison references, not acquisition targets.** Their role is classification (§9.2), not corpus.

**7.4 Source lanes** — mapped onto the already-ratified `EvidenceKind` values; no type change required.

| Lane | `sourceKind` | Target material | Priority |
|---|---|---|---|
| Innovation diffusion, platform & network economics, industrial organisation, organisational theory, strategy research | `academic-literature` | Peer-reviewed and standards-body literature via original publisher/repository | **High** — the largest external gap |
| Entrepreneurship & customer development research | `academic-literature` | Primary research, not practitioner summaries | **High** — `customer-discovery` has almost no in-repo evidence (§11.2) |
| Pricing research, disclosed SaaS/marketplace operating metrics, venture scaling studies | `disclosure-report` / `academic-literature` | **Aggregated across multiple institutions only**, per Crystal Canon Collection H | Medium |
| Commercial, scaling, adoption, marketplace and ecosystem **post-mortems** | `incident-report` | Primary incident and failure reports | **High** — `commercial-failure-modes` is the thinnest sub-domain |
| Shareholder/annual reports, investor letters, earnings commentary, regulatory disclosures on commercial performance | `disclosure-report` | Original issuer only | Medium |
| Public operating playbooks | `policy` / `other` | Only where primary and substantive | Low |

**7.5 Inclusion discipline, inherited unchanged from PRD-ICA-001 §5:** primary/authoritative sources; Level-4 retrieved artefacts only (a search snippet or landing page is not a source); no invented citation, DOI, page number or finding; no third-party summary substituted for a primary document. **The emphasis is recurring evidence rather than opinion** — a business-press article asserting a pattern is opinion; a post-mortem describing what happened is evidence.

**7.6 Ingestion mapping.** Corpus Scout's Ingestion Broker calls the existing `add-evidence` action with `domain = commercialisation/<observed vertical>` and `subDomain = <§4 key>`. That is the only integration point, and it requires no change to Corpus Scout.

## 8. The one new mechanism — Cross-Domain Recurrence Score

### 8.1 Design decision: DERIVED, not stored

Addendum A asks that every candidate carry recurrence metadata: where it appears, with what confidence, classified as a Cross-Domain Candidate. The question *"in how many distinct domains does evidence for this candidate exist"* is **already answered by the candidate's evidence rows**. Persisting a score would create a second source of truth for a fact the evidence carries, and it would go stale silently the moment evidence is added, reclassified or removed — `inv.engineering.036` applied to a number instead of a list, and precisely the defect class `tests/source-of-truth-parity.test.ts` exists to fail the build on.

**Therefore: recurrence is a query, not a field.** `computeRecurrence(evidenceIds, evidence)` derives it at read time, exactly as `computeConvergence` already does for within-corpus support. Nothing is written. No migration is required. A canary asserts that no `recurrence_score` / `recurrence_count` / `recurrence_tier` / `observed_domains` column appears in the engine.

The enabling convention is the **qualified evidence-domain key**, `<discoveryDomain>/<observedDomain>` — e.g. `commercialisation/media`. It buys three properties with no schema change:

1. The observed domain is read straight off the evidence row. Nothing is inferred from a path, a title, or a heuristic.
2. **No cross-contamination.** A `financial-services` run reads `domain = 'financial-services'` and therefore never sweeps up commercialisation observations made inside the FS vertical, which live under `commercialisation/financial-services`.
3. The `sub_domain` axis stays free for the §4 taxonomy, because the observed vertical rides on the `domain` axis. Two orthogonal questions, two orthogonal columns.

An **unqualified** key parses to itself, so a Financial Services candidate scores recurrence 1 — which is correct, and is exactly what §D.4a wants it to mean.

### 8.2 The score, and §D.4a made mechanical

| Distinct domains | Tier | Classification floor | Max abstraction |
|---|---|---|---|
| 0–1 | `single-domain` | `specialized` | **L3** |
| 2 | `cross-domain` | `supported` | L4 permitted |
| ≥3 | `broad-cross-domain` | `supported` | L4 permitted |

Amendment §D.4a already rules that a finding present in only one sector is `specialized`, not universal, and that an L4 claim requires a second sector. Encoding it in `computeRecurrence` moves it from *a rule a reviewer must remember* to *a property of the data*. As Healthcare, Manufacturing, Energy or Education are added, a candidate's score strengthens or weakens automatically — no re-scoring pass, because there was never a score to re-run.

**Recurrence is a PRIORITISATION signal, not validity** (Law XII: support is evidence, not truth). A broad-cross-domain candidate earns investigative priority. It does not earn promotion.

### 8.3 Code surface

| File | Change |
|---|---|
| `services/invariants/discoveryDomains.ts` | **NEW.** The Discovery Domain Registry: kind, constitutional definition, sub-domain ladder, observed-in verticals, tangential domains; `evidenceDomainsFor`, `observationDomainKey`, `parseObservationDomain` |
| `services/invariants/discoveryEngine.ts` | **Additive.** `RecurrenceInfo`, `computeRecurrence`, `enrichRecurrence`, `listEvidenceForDomains`; the three read paths route their corpus through `evidenceDomainsFor` (a vertical resolves to `[itself]` — byte-for-byte the previous behaviour) |
| `app/api/invariants/discovery/route.ts` | Derives default domain, sub-domain presets and the domain list from the registry; the hand-maintained `SUB_DOMAIN_PRESETS` literal is gone |
| `components/composer/InvariantDiscoveryTab.tsx` | Domain picker fed by the registry; recurrence badge; the hardcoded `useState("financial-services")` is gone |
| `app/triad/components/codex/tabs/CorpusScoutTab.tsx` | `KNOWN_DOMAINS` derived from the registry |

## 9. Initial candidate library (Deliverable 4) — sixteen L2/L3 candidates, every one traceable

**Read this paragraph before reading the table.** These are candidates discovered from the **in-repo corpus only**, by structured reading of the artefacts in §6. Each cites the real files it was compressed from; every quotation below was verified against the file at the path given. They are `platform-derived` (§6), which is a real provenance class and a limited one — they are the *starting* library the external corpus (§7) is meant to test, extend and in places falsify. **Nothing here is validated. Nothing here is canonical.** Recurrence is stated as the count of distinct domains with supporting evidence, per §8.

Evidence keys: `E-F*` Financial Services · `E-M*` Media · `E-H*` Human Mobility Services. Full paths in §9.3.

### 9.1 The library

| # | Sub-domain | Candidate (L2/L3) | Evidence | Recurrence | Classification |
|---|---|---|---|---|---|
| **C-001** | `commercial-governance` | **Delegated execution requires a prior, attributable record of the authority granted for it.** | E-F01, E-F02, E-H11, E-H05, E-M08 | **3** | supported · L3 |
| **C-002** | `trust-formation` | **Value-bearing information is released in graded packages against demonstrated counterparty capability, not wholesale on request.** | E-H01, E-H08, E-F10, E-M18 | **3** | supported · L3 |
| **C-003** | `trust-formation` | **Status conferred by payment is separable from status earned by verified contribution; the apex state cannot be purchased.** | E-M04, E-F07, E-H10 | **3** | supported · L3 |
| **C-004** | `adoption` | **A commercial relationship is a state machine, and its transitions — not its stock — are the actionable unit.** | E-M13, E-M12, E-H03, E-F01 | **3** | supported · L3 |
| **C-005** | `scaling` | **The reusable template, not the delivered instance, is the unit of commercial scale.** | E-H02, E-H09, E-M07, E-F09 | **3** | supported · L3 |
| **C-006** | `commercial-governance` | **A commercial claim must remain regenerable from its evidence trail.** | E-F04, E-H10, E-M16 | **3** | **equivalent** · L3 |
| **C-013** | `partnerships` | **A partner is qualified by referral authority, not by execution capacity.** | E-H05, E-M13, E-F07 | **3** | supported · L3 |
| **C-014** | `outcome-assurance` | **Outcome is assured against a derived composite of verified state, never against activity volume.** | E-H10, E-M08, E-F07 | **3** | supported · L3 |
| **C-016** | `venture-operations` | **A commercial vertical is a stage of one shared progression spine, not a peer rail.** | E-H15, E-M05, E-F-PW | **3** | supported · L3 |
| **C-007** | `pricing` | **Price differentials steer demand between settlement rails; price is an instrument, not only a signal.** | E-M14, E-F05 | 2 | supported · L2 |
| **C-008** | `distribution` | **An entitlement record doubles as an audience segment; access state and targeting state are one structure.** | E-M15, E-F06 | 2 | supported · L2 |
| **C-011** | `commercial-failure-modes` | **A commercial failure is preserved as a standing structural constraint rather than erased.** | E-F03, E-M16 | 2 | supported · L2 |
| **C-012** | `customer-discovery` | **A two-sided commercial system requires two distinct entry grammars over one shared governance layer.** | E-M07, E-H06 | 2 | supported · L2 |
| **C-015** | `settlement-exchange` | **Settlement is an adapter beneath an invariant integrity layer; the rail is replaceable, the integrity is not.** | E-F02, E-M03 | 2 | supported · L2 |
| **C-009** | `revenue-architecture` | **Campaign-exclusive value must be ring-fenced from the standing offer, or the standing offer cannibalises the campaign.** | E-M06 | **1** | **specialized** · L2 |
| **C-010** | `value-proposition` | **A capability-preserving service inverts its own logistics: execution is the lowest tier of its value ladder, not its product.** | E-H07 | **1** | **specialized** · L2 |

**Totals: 16 candidates — 9 at recurrence 3, 5 at recurrence 2, 2 at recurrence 1.** Fourteen `supported`, one `equivalent`, two `specialized` (C-009, C-010 are the single-domain cases; recurrence-1 forces the floor by rule, §8.2). No candidate is emitted at L4: §8.2 permits it at recurrence ≥2, but L4 asserts domain-independence *with the domain removed*, and the current corpus is three platform-internal domains under one architecture — a shared architecture is a plausible common cause, so L4 is deferred to the external corpus. **That deferral is itself a finding, recorded in §10.3.**

### 9.2 Cross-domain comparison (Deliverable 5) — classification rather than duplication

Compared against the tangential domains named in §7.3, using the existing five-value framework:

- **`equivalent` — C-006.** Regenerability of a claim from its evidence trail is already ratified as `CFS-052` III.4 (*"a receipt regenerates a transaction, and a proof regenerates an evidence suite"*) and as CRP-003 §7.3's Transaction Reconstitution. C-006 is the **same invariant at a commercial abstraction level**, not a new one. It is recorded so the correspondence is explicit, and **must not be counted as a discovery**. This is the §5 warning about `commercial-governance` coming true, exactly as predicted.
- **`specialized` — C-009, C-010.** Single-domain by evidence. C-009 is plausibly a specialisation of a general scarcity/anchoring result in pricing research; C-010 is plausibly a specialisation of service-design's service-vs-outcome distinction. **Both hypotheses are untested** — the literature that would settle them is exactly what §7.4's academic lane must acquire. Recorded as open, not as findings.
- **`supported`, likely with external equivalents — C-004, C-007, C-008.** Relationship state machines, price-based rail steering and entitlement-as-segment are all likely to have established equivalents in platform economics, pricing research and product management. Expect several to be reclassified `equivalent` or `specialized` once the external corpus lands. **That is the point of the comparison**, and a downgrade is a successful outcome, not a loss.
- **Candidates for `novel` — C-002, C-003, C-013.** Graded disclosure metered on demonstrated counterparty capability; the strict separability of purchased status from earned standing; and qualification by referral authority rather than execution capacity each recur across all three domains and have **no obvious equivalent** in the tangential domains as read here. They are the highest-priority items for external comparison — and the claim of novelty is a **hypothesis to be attacked**, not a result. C-003 in particular is close to canon's own Standing model, so its apparent novelty may be an artefact of a corpus that shares a Standing implementation.
- **`split` — none proposed.** No baseline hypothesis in the corpus resolved into two distinct invariants during this pass.

### 9.3 Evidence trail (so the operator can spot-check that nothing was invented)

Every quotation was read at the path and line given.

| Key | Path | Verified quotation / structure |
|---|---|---|
| E-F01 | `services/constitutional/constitutionalServicePipeline.ts` | The twelve-step model; *"Step 3 is the N1 gate: the delegated call (step 7) is REFUSED without an authorized agreement."* |
| E-F02 | `codexes/packs/irl/foundation/CRP-003_...md` §5, §6 | CFI-001/CFI-002; *"Settlement becomes an implementation detail; integrity … is the primitive."* |
| E-F03 | `codexes/packs/irl/foundation/CRP-003_...md` §6 | The Blocksee outcome — a failed vendor-consortium pilot recorded as *"the historical reason the vendor-neutral commitment exists"* |
| E-F04 | `codexes/packs/irl/foundation/CRP-003_...md` §7.3 | Transaction Reconstitution — from the receipt trail alone, reconstruct intent, agreement, authority, agent, outputs, verification, settlement, standing |
| E-F05 | `services/billing/planCheckout.ts` | `TIER_CONFIG`; *"Accepted rails: Q¢ · USDC (stub) · PayPal. KNYT is excluded from plan payments"* |
| E-F06 | `services/activations/activationPlanGate.ts` | *"`entitled(plan)` answers 'does this plan already grant the surface?'. `requiredTier` is the lowest tier whose checkout unlocks it"* |
| E-F07 | `codexes/packs/irl/foundation/CRP-003_...md` §3 | F-101 Separation of Advice and Execution · F-102 Standing-Weighted Agent Selection · F-103 Verification Before Standing |
| E-F09 | `codexes/packs/irl/foundation/PRD-MPY-001_...md` §0 | *"Specialize the agent, not the engine — MoneyPenny is the FS lens on rails that already exist."* |
| E-F10 | `codexes/packs/irl/foundation/CRP-003_...md` §7.1 | *"KYC is positioned as a verification SERVICE, not part of identity — invoked only when a specific agreement's policy requires it"* |
| E-F-PW | `services/venture/partnerWorkspace.ts` | `'financial-services'` registered as a partner-programme vertical with a lead agent binding |
| E-M03 | `docs/alpha/agentiq-knyt/36-polity-alpha-pricing-framework.md` | Two independent ladders; *"KNYT is explicitly excluded from metaMe plan payments"*; `\| HMS discovery \| — \| — \| ✅ \|` (l.138) |
| E-M04 | `codexes/packs/knyt/items/KNYT_MATRIX_SHEET.md:247` | *"distinguish patronage from stewardship, require visible responsibility and contribution markers, keep apex states earned not purchased alone"* |
| E-M06 | `codexes/packs/knyt/items/KNYT_CAMPAIGN_ACTIVATION_BLUEPRINT.md:81` | *"These investor shelf perks are Kickstarter-exclusive and do not carry forward into post-campaign purchase paths."* |
| E-M07 | `codexes/packs/knyt/items/KNYT_AGENT_ONBOARDING_CONSTITUTIONAL_PILOT_FRAMEWORK.md:38, :346` | *"Humans enter through mythos. Agents enter through logos. Both stay and scale through ethos."* · *"It should become a reusable launch pattern across future studio entities."* |
| E-M08 | `codexes/packs/knyt/items/KNYT_WHEEL_AGENT_MISSIONS_FRAMEWORK.md:285` | *"Reward and trust should be tied to useful, bounded, policy-compliant contribution rather than activity alone."* Five trust-graded mission classes |
| E-M12 | `services/campaign/signalSteering.ts` | Each engagement event re-derives `offer_fit` + `message_angle` and recomputes an urgency score; terminal events exit the loop |
| E-M13 | `docs/alpha/agentiq-knyt/25-avl-knyt-prd.md:109` | *"Show customers within 1 action of a stage transition prominently. These are the highest-value next-best-experience targets."* Seven-stage partner pipeline |
| E-M14 | `codexes/packs/knyt/meta.json:23-24` | `"fiatPremiumPercent": 0.07`, `"knytDiscountPercent": 0.2` — a structural price differential steering demand onto the native rail |
| E-M15 | `services/campaign/cohortResolver.ts:85` | `.eq('asset_id', 'zero-knyt-investor')` — the entitlement record IS the cohort query |
| E-M16 | `codexes/packs/agentiq/updates/2026-05-27_21sats-franchises-store-skus-backlog.md` | Franchise SKUs shipped to UI while the entitlement/fulfilment pipeline is recorded as pending, with the open decisions named rather than closed |
| E-M18 | `codexes/packs/knyt/items/KNYT_RUNTIME_SURFACE_SPEC.md` | Nine signal action types gated by patronage state; rewards tied to a world-legible cause |
| E-M05 | `docs/alpha/agentiq-knyt/29-avl-customer-surface-addendum.md` | Ladder-ascension monitoring; weighted Venture Lab / franchise candidate scoring; `candidate_identified → … → franchise_active` |
| E-H01 | `codexes/packs/agentiq/updates/2026-06-17_hms-pdep-adtf-...md:32` | *"**Need-to-know is insufficient. The system also enforces need-to-know-now.**"* Four-stage ladder, five disclosure packages, three tempos |
| E-H02 | `codexes/packs/agentiq/updates/2026-06-17_human-mobility-services-psc001-cartridge.md:25` | *"The reusable operational template. Registered as `human-mobility-services` in `CODEX_DEFINITIONS`."* |
| E-H03 | `supabase/migrations/20260617000000_mobility_cases.sql` | `case_status … CHECK (case_status IN ('intake','active','paused','complete','closed'))`; seven lettered workstreams with their own status machine |
| E-H05 | `app/api/mobility/cases/[caseId]/ies/route.ts:106, :213` | *"SRB must be approved before generating IES"* · *"Prioritize institutions with referral authority over those with only execution capability"* |
| E-H06 | `docs/marketa/MARKETA_ACTIVATION_ENGINE_PRD_AMENDMENT_HUMAN_MOBILITY.md` | Two-dimensional market (top/bottom × horizon) over one shared 13-stage process spine |
| E-H07 | `app/triad/components/codex/tabs/MobilityDoctrineTab.tsx:25-29, :106` | Intervention hierarchy L1 `Capability Preservation` → L5 `Logistical Execution`; *"Human mobility services are not transportation services. They are capability-preservation systems…"* |
| E-H08 | `app/api/mobility/cases/[caseId]/ies/draft-outreach/route.ts` | Per-institution disclosure-package builder keyed off `recommended_package` (A/B/AB/C/D) |
| E-H09 | `app/api/mobility/_lib/seedWorkstreams.ts` | The same seven-stream package instantiated identically for every new case, each with a delivery priority |
| E-H10 | `app/api/mobility/_lib/computeScores.ts:75-80` | `const rvScore = capScore * 0.6 + conScore * 0.4;` → RV-1/RV-2/RV-3 bands |
| E-H11 | `app/api/mobility/cases/[caseId]/professional-profile/route.ts:14` | *"Facts become operational only when principalApproved = true."* |
| E-H15 | `services/journey/commercialSpine.ts:7, :10` | *"Passport → aigentMe Delegation → Standing → Founder Office → Venture Lab → [verticals: Mobility (HMS), metaKnyt / metaMedia / metaLegal]"*; verticals explicitly *"not [peer rails]"* |

### 9.4 Confidence analysis (Deliverable 6)

Confidence has **three independent axes** here, and collapsing them into one number would destroy the information:

| Axis | What it measures | Where it comes from |
|---|---|---|
| **Recurrence** | Distinct domains with supporting evidence | `computeRecurrence` — derived (§8) |
| **Convergence** | Distinct source documents within the corpus | `computeConvergence` — already shipped |
| **Provenance** | What kind of evidence supports it | `provenanceClass` — `platform-derived` for this entire library |

**The honest headline: every candidate in §9.1 sits at `platform-derived`, and provenance caps them all.** High recurrence across three domains of *one platform* is a weaker signal than the number suggests, because the three domains share an architecture, a Standing implementation, a receipt model and — in several cases — the same author. A shared common cause is the most parsimonious explanation available for C-001, C-003, C-006 and C-014, and it cannot be ruled out from inside the corpus. **This is the single largest limitation of the initial library**, and the reason §7's external acquisition is a prerequisite for the L4 question rather than a nice-to-have.

Consequences applied, not merely stated:
- No candidate is emitted at **L4** (§9.1), even where §8.2 permits it.
- **C-006 is classified `equivalent`**, not novel, so canon is not re-counted as discovery.
- The three `novel` candidates (C-002, C-003, C-013) are recorded as **hypotheses for attack**, with the specific reason each might be an artefact.
- The two single-domain candidates keep the `specialized` floor by rule, not by judgement.

## 10. Crystal additions — RATIFIED AND APPLIED (operator ruling, 2026-07-27)

Both decisions this section previously left open have been ruled on, and the seed is executed. The ruling, verbatim:

> **Commercialisation Crystal:** Create the first-class `commercialisation` invariant namespace. Seed the eight recurrence-3 proposed candidates, excluding the candidate classified equivalent to CFS-052 III.4. Preserve their proposed status and record that inclusion is experimental, not canonical. Retain specialised and lower-recurrence candidates in the discovered library but outside the initial frozen crystal.

### 10.1 Decision 1 — namespace: FIRST-CLASS, not nested

> "Commercialisation should remain a first-class horizontal discovery domain, not be nested beneath Financial Services. Financial Services, Media and Human Mobility are evidence domains and **application contexts** for discovering commercialisation invariants. They are not the parent ontology of commercialisation itself."
>
> "The latter would incorrectly subordinate a cross-domain invariant class to its first application domain and make later portability awkward."

```
commercialisation.*                     ✅
    applied across: financial-services · media · human-mobility-services

financial-services.commercialisation.*  ❌
```

**Applied as:** namespace `commercialisation`, ids `inv.commercialisation.001`–`008`. This follows the seed file's own convention, verified before acting: all thirteen pre-existing namespaces are **flat single segments** with ids `inv.<namespace>.<n>` and no dotted namespace anywhere in the file. The sub-domain therefore rides in the existing `contexts` array rather than being forced into the id — which satisfies both halves of the instruction (constitutional parent is `commercialisation`; the slug follows existing convention).

Declared ahead of its members, per CFS-013 §3 and the identical `finance` precedent (PRD-MPY-001 §9 D5):

| Artefact | Change |
|---|---|
| `types/invariants.ts` | `InvariantNamespace` union + `INVARIANT_NAMESPACES` + `COMPOSITION_LAWS.commercialisation` |
| `supabase/migrations/20260801000000_commercialisation_invariant_namespace.sql` | Widens the three namespace CHECK constraints |
| `canonical-invariants.seed.json` | `namespaces` array + the eight records |

**Composition law: `contextual`** — a horizontal capability invariant *resolves per application context*, which is the operator's own framing of the three evidence domains. "Authority precedes execution" resolves as an x409 agreement gate in financial services, a principal-approval flag in human mobility, and a trust-graded mission class in media: one invariant, three resolutions. Deliberately **not** `normative` (the finance/engineering no-partial-compliance family) — asserting that a partially-satisfied commercialisation invariant is *unlawful* would claim law-like force for `proposed` hypotheses that carry a known common-cause limitation (§9.4). Provisional; the operator amends if validation later earns it.

### 10.2 Decision 2 — the eight, and why not more

> "broad enough to represent the new invariant class; grounded across all three initial domains; small enough not to overwhelm the crystal; free of the known equivalent candidate; honest about the shared-platform common-cause limitation; still entirely noncanonical."
>
> "I would **not** seed the two single-domain specialised candidates into the initial frozen crystal. Keep them in the discovered library and available for domain-specific experiments… I would **also not** seed all remaining recurrence-2 candidates merely to increase quantity. **The first freeze should optimise for clear class representation, not library completeness.**"

| Seed id | PRD candidate | Sub-domain | Statement |
|---|---|---|---|
| `inv.commercialisation.001` | C-001 | `commercial-governance` | Delegated execution requires a prior, attributable record of the authority granted for it. |
| `inv.commercialisation.002` | C-002 | `trust-formation` | Value-bearing information is released in graded packages against demonstrated counterparty capability, not wholesale on request. |
| `inv.commercialisation.003` | C-003 | `trust-formation` | Status conferred by payment is separable from status earned by verified contribution; the apex state cannot be purchased. |
| `inv.commercialisation.004` | C-004 | `adoption` | A commercial relationship is a state machine, and its transitions rather than its stock are the actionable unit. |
| `inv.commercialisation.005` | C-005 | `scaling` | The reusable template, not the delivered instance, is the unit of commercial scale. |
| `inv.commercialisation.006` | C-013 | `partnerships` | A partner is qualified by referral authority, not by execution capacity. |
| `inv.commercialisation.007` | C-014 | `outcome-assurance` | Outcome is assured against a derived composite of verified state, never against activity volume. |
| `inv.commercialisation.008` | C-016 | `venture-operations` | A commercial vertical is a stage of one shared progression spine, not a peer rail. |

**Excluded, and retained in the discovered library above:** C-006 (`equivalent` to CFS-052 III.4 — seeding it enters the same invariant twice under two ids), C-009 and C-010 (single-domain, `specialized` by §D.4a). Excluded is not discarded: all three remain in §9.1 and stay available for domain-specific experiments. Canaries assert both halves — the eight present, the three absent.

### 10.3 Status — proposed, and inclusion is experimental

> "The seed should preserve their native status as **proposed** candidates. **Inclusion in the experimental crystal must not imply ratification.**"

The ruling's four experimental-metadata fields are mapped onto the seed file's **actual** record shape (verified first: 365/365 pre-existing records carry exactly `{id, namespace, semantic_type, statement, status, contexts, provenance:{source}}`), not bolted on as a foreign block:

| Ruling field | Where it lands | Why |
|---|---|---|
| `canonicalStatus: "proposed"` | the record's own **`status`** field | It is the file's native status field. A second status field would be two sources of truth for one fact |
| `observedDomains` | **`contexts`** — `financial-services`, `media`, `human-mobility-services` | `contexts` is already a flat tag array used for exactly this classification. Structural, so the population is machine-partitionable without parsing prose. **Derived from the registry's `observedIn`, not hand-typed** — a canary compares them, which is what catches `human-mobility` vs `human-mobility-services` |
| `inclusionBasis: "cross-domain-recurrence"`, `recurrence: 3`, `experimentalStatus: "seeded-for-evaluation"` | **`provenance.source`**, in deterministic `key=value` form | `{source}` is the only provenance slot the uniform record shape has. Written greppably so a canary and a reader parse the same string |

Each record additionally carries `NOT ratification`, `UNVALIDATED`, its PRD candidate id, and the shared-platform common-cause limitation **on the record itself**, so a reader who encounters the invariant without the PRD still sees its epistemic standing. A canary fails the build if any commercialisation record is ever `canonical` or `validated`.

### 10.4 Freeze composition — and a conflict the operator must resolve

> "The next P1 crystal can now be described as containing three distinct invariant populations: Constitutional invariants…; Financial-services invariants…; Commercialisation invariants… **The experiment record must preserve the population boundaries so results can be analysed by class rather than treating the crystal as one undifferentiated set.**"

**Can the crystal be partitioned by population today? Partly — and one population cannot.**

| Population | Partitionable? | By what |
|---|---|---|
| Commercialisation | **Yes** | `namespace === 'commercialisation'`, plus `contexts[0]` as an explicit population marker |
| Constitutional | **Yes, approximately** | `namespace` — though "constitutional invariants" spans `constitutional`, `polity`, `epistemology` and others; the boundary is a family of namespaces, not one |
| **Financial services** | **No** | The seed crystal contains **zero `finance` records**, and `promoteCandidate` hardcodes `namespace: 'constitutional'` for every discovered invariant regardless of domain (`discoveryEngine.ts`). A promoted FS invariant is therefore indistinguishable from a constitutional one by namespace; its domain survives only inside `contexts[].domain` and the provenance blob |

**Smallest change that would make it possible — proposed, not made** (it alters promotion behaviour for the FS programme, which is outside this ruling's scope): resolve the promotion namespace from the Discovery Domain Registry instead of hardcoding `'constitutional'`, falling back to `'constitutional'` for an unregistered domain. The machinery is already fully in place and unused — `finance` is in the `InvariantNamespace` union, has its `normative` composition law, and has its CHECK constraint widened (migration `20260721000000`), all declared by PRD-MPY-001 §9 D5 as *"the class of the FS Invariant Library (`inv.finance.*`)"*. Nothing needs building; one line needs unhardcoding.

**⚠ Conflict requiring an operator decision — do not treat the seed as settling it.** `CRYSTAL-ENLARGEMENT_plan.md` §2a (operator instruction, 2026-07-22, *"binding now"*) rules that **only `external-established` and `external-empirical` invariants are eligible for `Crystal vP1`**, and that `platform-derived` and `platform-hypothesized` invariants *"may inform platform operation but are never promoted into this experiment's collection."* **All eight commercialisation invariants are `platform-derived`** (§6, §9.4).

Two artefacts are involved and they are not the same thing: this seed lands the eight in **`canonical-invariants.seed.json`** — the platform's invariant ontology, which §2a does not govern. Whether they may also enter **`Crystal vP1`** — the EXP-P1 experimental collection §2a does govern — is a question this PRD cannot answer and has not assumed. Three routes, for the operator:

1. **Keep them out of `Crystal vP1`.** They inform platform operation and Venture Lab pilots; EXP-P1's collection stays externally-sourced. Requires no amendment.
2. **Invoke §2a's own ablation clause** — *"EXP-P1 results should be reportable both with and without any platform-originated invariant"* — which is *already* the population-boundary requirement the ruling states, arriving from the other direction. The commercialisation population enters as an explicitly ablatable arm.
3. **Amend §2a.** An amendment to a ratified experiment plan, and an operator act under IRL-016.

This PRD takes route 0: it records the conflict and changes nothing in EXP-P1. `CRYSTAL-ENLARGEMENT_plan.md` is untouched.

> **RESOLVED — operator ruling, 2026-07-27.** §2a is refined (not amended away) to turn on
> **evidentiary basis** rather than on where discovery occurred, and the conflict is settled along
> **routes 1 + 2 together**: the eight are **Population B** — excluded from the primary EXP-P1
> evaluation population, admitted to the ablation arm, which §2a now makes a **permanent** feature
> of every crystal report rather than a *"where feasible"*. §9.4's own finding is what decides it —
> the entire §9.1 library is `platform-derived`, and "discovered by the IDE" is not evidence of
> independence. When §7's external corpus lands and re-derives a candidate from an independently
> authored source, its evidence provenance changes through a **recorded reclassification carrying
> its own evidence refs**, and it becomes eligible then. See `CRYSTAL-ENLARGEMENT_plan.md` §2a.1–2a.7;
> the partition is computed by `services/research/experimentalPopulations.ts` and pinned by
> `tests/evidence-provenance-populations.test.ts`.
>
> **The namespace change above is also made** (it was the ruling's second half): `promoteCandidate`
> now resolves the namespace from the Discovery Domain Registry — Financial Services promotes into
> `finance.*`, Commercialisation into `commercialisation.*`, an unregistered domain still falls back
> to `constitutional`. *"That preserves experimental traceability."*

## 11. Experiment recommendations (Deliverable 8)

### 11.1 The experiment the library is actually FOR

The most valuable near-term experiment is not "is C-003 true". It is **whether recurrence predicts survival**. Every candidate carries a recurrence score derived *before* any external corpus exists. Acquire the §7 external corpus, re-run discovery, and measure: **do recurrence-3 candidates survive external comparison at a higher rate than recurrence-1 candidates?** That is a falsifiable test of Addendum A's central claim — *"a candidate that emerges independently in [three domains] is a much stronger prospect"* — and it is cheap, because both the score and the comparison already run. A null result would be a genuine finding about the method, which is exactly the kind of result the Research Lab exists to produce.

### 11.2 Acquisition priorities, ordered by evidential gap

1. **Commercial failure post-mortems** (`incident-report`). `commercial-failure-modes` rests on two in-repo anecdotes. Highest ratio of gap to acquisition cost.
2. **Entrepreneurship / customer-development primary research.** `customer-discovery` has essentially no in-repo structural evidence — the corpus contains market *maps*, not discovery *processes*.
3. **Platform & network economics.** Directly tests C-004, C-008, C-013 and is the likeliest source of `equivalent` reclassifications.
4. **Pricing research.** Directly tests C-007 and C-009.
5. **Service design / service operations.** Directly tests C-010 and C-002.

### 11.3 A fourth domain, and what it should be

The three Addendum A domains share a platform architecture (§9.4). **The highest-value fourth domain is one that does NOT** — a domain whose commercial corpus is external and independently authored. Until then, recurrence 3 within this platform should be read as "recurs across three products", not "recurs across three commercial environments". Recording that distinction is more useful than inflating the score.

### 11.4 What Venture Lab should do with this library

Resolve the relevant candidates into a pilot, apply them, generate receipts, and record where they held and where they failed. Per CFS-052 §3 II.3 the Venture Lab is not blocked on scientific consensus — it may rely on these operationally today. Per §D.5 and §2.1, **no amount of commercial success promotes any of them to `canonical`**; it produces constitutional evidence, which is a different and equally real thing.

## 12. What this PRD does NOT do (recorded, because a spec that reads as a shipped system is the CS-001 drift defect)

- **No second discovery pipeline, and no change to Stages 2–5.** The engine change is additive: one new derivation, one new multi-domain lister, and three read paths routed through the registry.
- **No second acquisition pipeline.** §7 is a campaign brief for the built Corpus Scout.
- **No external corpus has been acquired, and no external source is cited.** Every citation in §9 is a repo path that was read. No DOI, page number, author or finding from any paper is asserted anywhere in this document.
- **No invariant status is changed.** The eight seeded records enter at `proposed` by the operator's explicit ruling (§10.3); nothing is canonised, and no pre-existing record is altered. `canonical-invariants.seed.json` was amended ONLY under that ruling — Law XI is satisfied because the operator made the call, which is not a licence to widen scope.
- **No `MetaCommonsResource`, no proof type, no Commons submission flow** — CFS-052 §8 stands unaltered.
- **No change to `CRYSTAL-ENLARGEMENT_plan.md`, EXP-P1, or any experiment protocol.** The §2a conflict in §10.4 is recorded for the operator, not resolved here (IRL-016).
- **No change to `promoteCandidate`'s namespace resolution.** §10.4 proposes it; this PRD does not make it.
- **No coupling to `domain_profiles` / SPEC-CDR-001.**
- **No L4 claim** is made from this corpus (§9.4).
- **The eight sub-domains with thin in-repo evidence are recorded as gaps, not filled.** `customer-discovery`, `commercial-failure-modes`, `value-proposition` and `revenue-architecture` each rest on one or two artefacts; `settlement-exchange` has **no HMS evidence at all** (HMS has no settlement path in code). An honest empty cell is a finding; a filled one would be fabrication.

## 13. Enforcement

`tests/commercialisation-discovery.test.ts` — indexed in `tests/source-of-truth-parity.test.ts`.

| Canary | Guards |
|---|---|
| Commercialisation is registered `horizontal-capability`; FS stays `vertical` and stays the default | §2 — registering it as a vertical destroys the recurrence signal |
| `observedIn` is exactly Addendum A's three domains | §6 |
| The registry does not import the runtime domain-profile registry | §0 — research artefact vs runtime artefact stay uncoupled |
| Qualified-key round-trip; unqualified parses to itself | §8.1 |
| A vertical resolves to `[itself]`; an unregistered domain likewise | §8.1 — no behaviour change to the FS path |
| A FS run never reads `commercialisation/financial-services` | §8.1 — no cross-contamination |
| Recurrence counts distinct DOMAINS, not documents; dedupes; ignores stale ids | §8.2 |
| §D.4a: 1 domain ⇒ `specialized` + L3 cap; ≥2 ⇒ `supported` + L4 permitted | §8.2 made mechanical |
| No `recurrence_*` / `observed_domains` column exists in the engine | §8.1 — derived, never stored |
| Route, Corpus Scout tab and discovery tab all DERIVE the domain list | §0 — the three-hand-copies defect cannot return |
| Promotion still lands `proposed`/`agent_verified`; no path writes `canonical` | §2.1, Law XI |
| The seed carries EXACTLY the eight the operator named | §10.2 — not seven, not nine |
| Every commercialisation record is `proposed`, never `canonical`/`validated` | §10.3 — inclusion is not ratification |
| C-006, C-009, C-010 are ABSENT from the seed but PRESENT in §9.1 | §10.2 — excluded is not discarded |
| The namespace is flat and first-class; ids are `inv.commercialisation.NNN` | §10.1 — never nested under an application domain |
| Observed-domain contexts equal the registry's `observedIn` | §10.3 — derived, so `human-mobility` can never drift from `human-mobility-services` |
| Each record names a registered §4 sub-domain | §10.3 — taxonomy and crystal cannot drift |
| Provenance carries inclusionBasis / recurrence / experimentalStatus / observedDomains | §10.3 |
| `COMPOSITION_LAWS.commercialisation` is declared and is `contextual` | §10.1 — CFS-013 §3, algebra before members |
| The SQL namespace CHECK admits exactly `INVARIANT_NAMESPACES` | §10.1 — the constraint-drift bug class |
| The registry's definition is verbatim in this PRD | §1 |
| The §4 taxonomy table and the registry sub-domains are the same set | §4 |
| §5 records Merged / Split / Added / Rejected | §5 — an untested taxonomy is a red flag |
| This PRD is registered in `codexes/packs/irl/collections.json` | reachability |

---

## Ratification record

- [x] **Operator decision 1 — RULED 2026-07-27.** First-class `commercialisation` namespace, not nested beneath Financial Services (§10.1). **Applied.**
- [x] **Operator decision 2 — RULED 2026-07-27.** The eight recurrence-3 candidates, excluding the `equivalent` one; specialised and lower-recurrence candidates retained in the discovered library but outside the initial frozen crystal (§10.2). **Applied.**
- [x] **Status — RULED 2026-07-27.** All eight preserve `proposed`; inclusion in the experimental crystal does not imply ratification (§10.3). **Applied, canary-enforced.**
- [ ] **Operator ratification of the PRD as a whole** — nothing in §9 is validated by the seed ruling; the candidate library, taxonomy and acquisition plan still await the docs-first gate.
- [x] **Operator decision 3 — the §2a conflict (§10.4). RESOLVED 2026-07-27.** §2a refined to turn on evidentiary basis, not discovery locus. The eight are **Population B**: out of the primary EXP-P1 population, into the now-permanent ablation arm (routes 1 + 2). The FS namespace hardcode is unhardcoded in the same ruling.
- [ ] **Operator decision 4 — FS population boundary (§10.4).** Financial-services invariants are not partitionable from constitutional ones today. The one-line unhardcoding is proposed, not made.
- [ ] **Run the migration** `supabase/migrations/20260801000000_commercialisation_invariant_namespace.sql` before any commercialisation invariant is ingested into Supabase.
- [ ] **Corpus Scout campaign** for the §7.4 lanes, run in the pre-freeze "enlarge (receipted)" phase.
- [ ] **Recurrence-predicts-survival experiment** (§11.1) registered once the external corpus lands.
