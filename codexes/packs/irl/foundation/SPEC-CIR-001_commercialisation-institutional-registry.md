# SPEC-CIR-001 — Commercialisation Institutional Registry

**metaMe IRL · Curated corpus registry · Status: PHASE 1 OUTPUT — PROPOSED, NOTHING HERE IS RATIFIED**
**Owner:** Invariant Research Lab (IRL) · **Origin:** operator direction, 2026-07-27, extended by the operator ruling of the same day
**Governs:** the curated, authoritative source registry that Commercialisation corpus acquisition (PRD-IDE-002 §7) begins from, the **generalised registry template** every future horizontal domain uses, and the **registry-level verification protocol** that must pass before any of it is ratified.
**Composes (does not fork):** `PRD-ICA-001` + its ratified Constitutional Discovery amendment (2026-07-23) · `PRD-IDE-002` §4/§7/§11.2 · `CFS-053` (Constitutional Binding) · CLAUDE.md's *No Guessing or Hallucinating* rule.

> **The hard stop this document observes.** *"Do not perform acquisition yet. Produce the registry first."*
> Nothing was fetched. Outbound HTTPS is blocked from the build sandbox (verified: `403 CONNECT tunnel failed` for both `fatf-gafi.org` and `arxiv.org`), so any "acquired" content would be fabricated. Acquisition — and verification — run on the deployed app.

> **Nothing here is ratified, and nothing here is verified.** Every row lands `status = proposed`. Every URL lands `verification_status = pending_verification`. The operator's ruling is explicit: *"Do not treat the URLs as verified merely because they are operator-supplied or resolve in an ordinary browser."*

> **The ratification bar (operator ruling).** *"Do not ratify the Commercialisation domain until all fourteen pillars are served AND the diversity verdict is satisfied or explicitly ruled upon by the operator."* **Both halves are now met: all fourteen pillars are served, and all fourteen satisfy Law II** (§5, §8.2). What remains before ratification is the verification run (§9, §11 step 2) and the operator's ruling on the wave-1 pillar mapping (§4.1).

---

## 1. The principle this registry exists to serve

> "Commercialisation should not begin with open-ended web search. It should begin with a curated, ratified corpus of authoritative commercialisation sources, exactly as Financial Services began with FATF, Basel, MiCA and related institutions. **The IDE derives invariants from the corpus. It does not define the corpus.**"

> "The Financial Services programme did **not** begin by asking the IDE to 'discover finance.' It began by giving it a **curated, authoritative corpus** and then asking it to derive invariants from that corpus. That disciplined the experiment and made every invariant traceable."

The canonical pipeline, now domain-independent:

```
Curated Institutional Registry → Registry Verification → Corpus Acquisition
  → Corpus Validation → IDE Discovery → Invariant Library → Crystal Eligibility
```

## 2. Audit — how Financial Services actually did it, and what is reused

Per CCR-001 §25's standing instruction, recorded before any of this is treated as new. **Almost everything already existed; what was missing was binding, not capability.**

| What this registry needs | Already exists as | Disposition |
|---|---|---|
| A "what is this domain" statement | `corpus_domain_definitions` + `upsertDomainDefinition` / `ratifyDomainDefinition` (§2.1) | **EXISTS.** Reused verbatim |
| A coverage model of required pillars | `corpus_coverage_pillars`; saturation confirmed explicitly by a steward (`confirmPillarSaturation`), never inferred | **EXISTS.** Reused verbatim |
| A place for adjacent disciplines | `corpus_dependency_registry` — external domains that CONSTRAIN the domain, each carrying its relationship edge (§2.3, Law I) | **EXISTS.** This is where the operator's third tier lands — §6.1 |
| The registry itself | `corpus_institutional_registry`, keyed `(domain, pillar_key, institution_name)` | **EXISTS.** Reused verbatim |
| A curated institution→homepage directory that never falls back to search | `canonicalInstitutionHomepages.ts` — already fails honestly (`null`) rather than searching | **EXISTS.** Extended with the operator's URLs |
| Redirect resolution | `followRedirects()` in `retrieval.ts` | **EXISTS.** Invoked by verification, not reimplemented |
| Institution-targeted navigation | `runInstitutionDiscovery(seedUrl)` in `institutionNavigator.ts` (Agent B + bounded Agent C) | **EXISTS.** Invoked by verification |
| Byte retrieval + hashing | `retrieveArtifact()` | **EXISTS.** Invoked by verification |
| Content-presence inspection | `inspectArtifact()` — *"never infers validity from a URL or declared MIME type alone"* | **EXISTS.** Invoked by verification |
| Inspection thresholds | PRD-ICA-001 §7's ratified `pageCount ≥ 5 AND substantiveTextCharacters ≥ 5,000 AND blankPageRatio < 0.25`, living as private constants in `inspection.ts` | **EXISTS.** **PROMOTED** into the named Corpus Qualification Standard (§9.1) — not re-invented |
| Ratification | `ratifyInstitutionEntry` | **EXISTS.** Phase 2, not this document |
| The seven-column template, shared across domains | **Nothing.** The FS registry records three facts per authority | **NEW — §3** |
| A document-level acquisition plan | **Nothing** — PRD-ICA-001 §5 specifies one; only its institution half was ever persisted | **NEW — §7** |
| Verification STATE on a registry entry, and a gate that refuses without it | **Nothing** | **NEW — §9.** The gap was the binding, not the capability |
| A rule forbidding single-institution reliance, and a check for it | **Nothing** | **NEW — §8** |

**The hard prerequisite handled.** `upsertInstitutionEntry` refuses when the pillar does not exist — *"propose the pillar first"*. The sequence is Domain Definition → Coverage Pillars → Institutions, and the migrations follow it in that order.

**Where the registry actually lives.** In the database, not in code. Phase 1's deliverable is two-part: the code-side curated directory + template, and runnable SQL that populates the DB rows (§11).

## 3. The generalised registry template

> "The Financial Services registry can now be generalized into a reusable template. Instead of creating ad hoc registries, every horizontal domain should define the same metadata: **Institution · Category · Authority · URL · Evidence Type · Priority · Notes**… That becomes the standard input to the IDE, regardless of domain."

Declared once, in `services/corpusScout/institutionalRegistry.ts`, as `InstitutionalRegistryEntry`:

| Operator column | Field | Note |
|---|---|---|
| Institution | `institution` | |
| Category | `category` | The institutional **tradition** — and the axis Law II's diversity check counts (§8) |
| Authority | `authority` | *Why* this source is authoritative **for this pillar** |
| URL | **derived** — `registryEntryUrl()` | Read from `canonicalInstitutionHomepages.ts` |
| Evidence Type | `evidenceType` | `research-papers \| standards \| policy \| practitioner-guidance \| datasets` |
| Priority | **derived** — `acquisitionPriority()` | The PRD-IDE-002 §11.2 evidential-gap rank of the pillar the entry serves |
| Notes | `notes` | |

Plus two **structural** fields the operator's prose requires but a seven-column table cannot carry:

- **`tier`** — `institutional-authority` | `practitioner-pattern` (§6).
- **`pillarKey`** — the single coverage pillar this entry is registered against. `null` means un-acquirable: `upsertInstitutionEntry` refuses an entry whose pillar does not exist.

### 3.1 One entry per (institution, pillar) — the ruling requires it

> "The existing institutions may serve **more than one pillar** where their published corpus genuinely supports it. **Reuse is preferable to inventing a new institution** merely to make the matrix look complete. The provenance must attach to the specific pillar and acquired document."

So the template entry is keyed by (institution, pillar), exactly like the DB row it seeds — **not** by institution with a list of pillars.

#### …but the TRADITION is a property of the INSTITUTION (ruling of 2026-07-28)

> "Yes — keep the split, but be precise about what is splitting. The institutional tradition of NBER remains stable: `academic economics / empirical economic research`. What differs per pillar is: evidentiary role; topic; acquisition seed; pillar relationship. **Do not make NBER appear to become three different institutional traditions merely because it serves pricing, partnerships and commercial failure modes. Diversity checks should not count one institution three times as independent traditions.**"

This **narrows** §3.1 as first written, which held that per-pillar keying licensed per-pillar *traditions*. It does not. `category` varies by institution only; `authority`, `evidenceType`, `notes`, `pillarKey` and the document-level acquisition seeds carry the per-pillar difference.

Two mechanisms hold it, because a data fix alone would not survive the next entry:

- `institutionTraditionConflicts()` reports every institution declaring two traditions in a registry. A canary asserts the result equals an **exact** pending set, so a new multi-tradition institution fails the build.
- `assessRegistryDiversity()` deduplicates by institution before counting authorities **or** traditions. Two rows for one institution on one pillar previously read as "2 authorities across 2 traditions" — `satisfied`, produced entirely by the single institutional perspective Law II forbids relying on. That inflation path is closed.

**One conflict is open and is NOT resolved here.** OECD declares three traditions (`Economics` on adoption/scaling, `International Policy Research` on trust-formation, `Competition Policy` on pricing). The ruling names NBER's single tradition and NBER's only; choosing OECD's would mean asserting a fact about what the OECD's corpus *is*. It is recorded in `TRADITION_CONFLICTS_PENDING_OPERATOR_RULING` and reported, awaiting a steward. Note that resolving it changes no Law II verdict — every pillar OECD serves has a second tradition from another institution.

### 3.2 Is the template genuinely shared with Financial Services?

**Structurally yes; by data, partly — and the gap is recorded rather than papered over.**

`FINANCIAL_SERVICES_REGISTRY` declares all nineteen ratified FS authorities in the *same* type, consumed by the *same* functions, pinned set-for-set against the `20260817000000` seed SQL by canary. One template, one code path.

**But `category`, `authority`, `evidenceType` and `notes` are `null` for every FS entry.** The FS registry was captured before the template existed. Populating those fields would mean asserting facts about what BIS, FATF, ESMA et al. publish — facts this environment cannot verify and CLAUDE.md's zero-tolerance rule forbids inventing. The visible consequence is intentional: `assessRegistryDiversity` reports every FS pillar as `undeterminable`, never `satisfied`. Backfilling is tracked as **separate remediation work** in §10, per the operator's ruling.

## 4. Tier 1 — the institutional registry

**Provenance: every institution, category, purpose and URL below was supplied verbatim by the operator.** None was searched for, inferred, or constructed. None has been verified from this environment. Verification runs on the deployed app (§9) and is a precondition of both acquisition and ratification.

### 4.1 Wave 1 — the first-tier direction (pillar mapping AGENT-PROPOSED)

The operator supplied Category and Purpose, not coverage pillars. Every mapping below is derived from the operator's own words against PRD-IDE-002 §4's pillar definitions; the basis is stated for each. A steward ratifies or corrects them.

| # | Institution | Category | Authority (operator's Purpose) | URL | Evidence Type | Pillar | Basis | Priority |
|---|---|---|---|---|---|---|---|---|
| 1 | NBER | Academic Economics / Empirical Economic Research | Entrepreneurship, innovation, venture research | https://www.nber.org | research-papers | `venture-operations` | "venture research" | 2 |
| 2 | NBER | ″ | ″ | ″ | research-papers | `adoption` | "innovation" | 3 |
| 3 | Kauffman Foundation | Entrepreneurship Research | Entrepreneurship and startup ecosystems | https://www.kauffman.org | research-papers | `venture-operations` | "entrepreneurship" | 2 |
| 4 | Kauffman Foundation | Entrepreneurship Research | ″ | ″ | research-papers | `partnerships` | "startup ecosystems" is a direct word match for §4 *Partnerships & Ecosystem Development* | 3 |
| 5 | SSRN | Research Repository | Entrepreneurship, strategy, innovation papers | https://www.ssrn.com | research-papers | `venture-operations` | A repository, cross-pillar by nature; only the pillars its Purpose names. "strategy" has no §4 pillar and is deliberately not mapped | 2 |
| 6 | SSRN | Research Repository | ″ | ″ | research-papers | `adoption` | "innovation" | 3 |
| 7 | OECD | Economics | Innovation, productivity, digital economy | https://www.oecd.org | policy | `adoption` | "innovation" | 3 |
| 8 | OECD | Economics | ″ | ″ | policy | `scaling` | "productivity" → §4 scaling (*repeated without linear cost*) | 6 |
| 9 | World Bank | Economics | Private sector development, entrepreneurship | https://www.worldbank.org | policy | `venture-operations` | "entrepreneurship" | 2 |
| 10 | World Bank | Economics | ″ | ″ | policy | `commercial-governance` | A multilateral policy issuer → §4 commercial-governance | 6 |
| 11 | MIT Sloan | Innovation | Innovation management research | https://mitsloan.mit.edu | research-papers | `adoption` | "innovation" | 3 |
| 12 | MIT Sloan | Innovation | ″ | ″ | research-papers | `venture-operations` | "management" | 2 |
| 13 | Stanford Graduate School of Business | Innovation | Entrepreneurship and scaling | https://www.gsb.stanford.edu | research-papers | `scaling` | Verbatim word match | 6 |
| 14 | Stanford Graduate School of Business | Innovation | ″ | ″ | research-papers | `venture-operations` | Verbatim word match | 2 |
| 15 | Harvard Business School | Innovation | Strategy, innovation, commercialisation | https://www.hbs.edu | research-papers | `revenue-architecture` | "commercialisation"/"strategy" → §4 revenue-architecture | 6 |
| 16 | Harvard Business School | Innovation | ″ | ″ | research-papers | `adoption` | "innovation" | 3 |
| 17 | Strategic Management Society | Strategy | Strategy research | https://www.strategicmanagement.net | research-papers | `revenue-architecture` | **Weakest mapping** — §4 has no "strategy" pillar | 6 |
| 18 | Strategic Management Society | Strategy | ″ | ″ | research-papers | `commercial-governance` | Weak; see above | 6 |
| 19 | Santa Fe Institute | Systems | Complex adaptive systems, emergence | https://www.santafe.edu | research-papers | `scaling` | Emergence/repeatability at scale. **Deliberately NOT mapped to `commercial-failure-modes`** | 6 |
| 20 | INCOSE | Systems | Systems engineering and organisational systems | https://www.incose.org | standards | `outcome-assurance` | Systems engineering → §4 outcome-assurance | 5 |
| 21 | INCOSE | Systems | ″ | ″ | standards | `commercial-governance` | A professional standards body | 6 |
| 22 | Silicon Valley Product Group | Product | Product management and product-market fit | https://www.svpg.com | practitioner-guidance | `customer-discovery` | "product-market fit" verbatim | 2 |
| 23 | Silicon Valley Product Group | Product | ″ | ″ | practitioner-guidance | `value-proposition` | | 5 |
| 24 | Product School | Product | Product management practice | https://productschool.com | practitioner-guidance | `customer-discovery` | | 2 |
| 25 | Product School | Product | ″ | ″ | practitioner-guidance | `value-proposition` | | 5 |
| 26 | Strategyzer | Customer Development | Business models, value propositions | https://www.strategyzer.com | practitioner-guidance | `value-proposition` | "value propositions" verbatim | 5 |
| 27 | Strategyzer | Customer Development | ″ | ″ | practitioner-guidance | `revenue-architecture` | "business models" | 6 |
| 28 | Lean Startup | Customer Development | Customer discovery methodology | https://theleanstartup.com | practitioner-guidance | `customer-discovery` | Verbatim. Not mapped to value-proposition — the Purpose names a discovery *method* | 2 |

**Tier and evidence type are orthogonal, and the operator's own table proves it.** Entries 22–28 publish practitioner guidance and are tier 1. Tier answers *which acquisition wave*; evidence type answers *what kind of artefact*. Both are carried structurally so a later analysis can filter on either.

### 4.2 Wave 2 — the ruling (pillar mapping OPERATOR-SUPPLIED)

The ruling closed the five pillars §5 reported as empty. Unlike wave 1, the pillar is the operator's too.

| # | Pillar | Institution | Category (tradition) | Authority | URL | Evidence Type | Priority |
|---|---|---|---|---|---|---|---|
| 29 | `trust-formation` | OECD | International Policy Research | International policy research; empirical consumer survey | https://www.oecd.org | research-papers | 6 |
| 30 | `trust-formation` | UK Competition and Markets Authority | Competition & Consumer Enforcement | Competition/consumer enforcement; market evidence | https://www.gov.uk/government/organisations/competition-and-markets-authority | policy | 6 |
| 31 | `pricing` | NBER | Academic Economics / Empirical Economic Research | Academic economics; empirical + formal modelling | https://www.nber.org | research-papers | 4 |
| 32 | `pricing` | OECD | Competition Policy | Competition policy; digital-market pricing | https://www.oecd.org | policy | 4 |
| 33 | `distribution` | World Trade Organization | International Trade Doctrine | International trade and market-access doctrine | https://www.wto.org | policy | 3 |
| 34 | `distribution` | UN Trade and Development (UNCTAD) | Development Economics | Development economics; digital commerce and trade measurement | https://unctad.org | datasets | 3 |
| 35 | `settlement-exchange` | BIS Committee on Payments and Market Infrastructures | Payment & Settlement Infrastructure | Payment, clearing and settlement infrastructure | https://www.bis.org/cpmi/about/overview.htm (see §4.3) | standards | 6 |
| 36 | `settlement-exchange` | UNCITRAL | International Commercial Law | International commercial law; electronic contracting and transferable records | https://uncitral.un.org | standards | 6 |
| 37 | `commercial-failure-modes` | NBER | Academic Economics / Empirical Economic Research | Academic entrepreneurship and market-failure research | https://www.nber.org | research-papers | 1 |
| 38 | `commercial-failure-modes` | U.S. Bureau of Labor Statistics | Official Statistics | Official longitudinal business-demography evidence | https://www.bls.gov | datasets | 1 |

**Reuse over invention, as the ruling prefers.** Four of the ten wave-2 entries reuse an institution already in the registry (OECD ×2, NBER ×2). What the reuse adds is a different evidentiary role, topic and acquisition seed — **not** a different tradition (§3.1, ruling of 2026-07-28); OECD's remaining three-way split is the open conflict recorded there. Six are new institutions, added only where no existing entry could genuinely serve the pillar. Two new evidence types enter the registry for the first time: `datasets` (UNCTAD, BLS).

### 4.3 BIS CPMI — the reconciled entry

The operator's institutional seed for CPMI is `https://www.bis.org`. The curated directory already holds **`https://www.bis.org/cpmi/`** for the same named institution (a Financial Services authority since the `20260817000000` seed). These are not in conflict — the operator's value is the *parent* of the existing one.

**Re-seeded 2026-07-28 (operator ruling).** The canonical landing page is now **`https://www.bis.org/cpmi/about/overview.htm`** — the CPMI overview, carrying the committee charter, work programme and links to the current publication collections. Same principle one rung finer than the reconciliation below: the most specific page that still enumerates the committee's output is the better navigation start. Exactly one CPMI key remains, and it is never the same page as plain `bis`.

**The existing, more specific value is kept, and no second key is added.** Three reasons: this file's own header already anticipates a steward needing *"a more specific starting page than its bare homepage"*; `bis.org/cpmi/` is strictly better for Agent B, whose job is to find the institution's publication listing (bis.org surfaces all of BIS's output, bis.org/cpmi/ the committee's); and a bare `bis.org` key would **collide with the existing plain `bis` entry**, giving two distinct institutions one starting page. A canary asserts exactly one CPMI key, at the committee page.

### 4.4 Wave 3 — the Law II ruling

> "**Do not waive Law II. Add a second authority from a different tradition for each pillar.**"

`partnerships` and `outcome-assurance` each carried exactly one institutional authority (§5.2 as originally written). Neither is closed by lowering a threshold — `LAW_II_MIN_AUTHORITIES` and `LAW_II_MIN_TRADITIONS` are unchanged at 2, and both attempts to move them are mutation-tested.

| # | Pillar | Institution | Category (tradition) | Authority | URL | Evidence Type | Priority |
|---|---|---|---|---|---|---|---|
| 39 | `partnerships` | NBER | Academic Economics / Empirical Economic Research | Academic economics / empirical entrepreneurship research; working papers and peer-reviewed economic research | https://www.nber.org | research-papers | 3 |
| 40 | `outcome-assurance` | National Infrastructure and Service Transformation Authority | Public Project-Delivery Assurance / Independent Stage-Gate Review | Public project-delivery assurance / independent stage-gate review; assurance standards, review guidance, templates and benefits-realisation guidance | https://www.gov.uk/government/organisations/national-infrastructure-and-service-transformation-authority | standards | 5 |

**The tradition strings are load-bearing, not decoration.** Law II counts *distinct* `category` values per pillar, so NBER's `partnerships` mapping must differ from Kauffman's `Entrepreneurship Research` or the pillar still reads `unsatisfied` with two authorities registered.

It does — but **not** by minting a partnerships-only NBER tradition, which is what this row carried when wave 3 first shipped (`Academic Economics / Empirical Entrepreneurship Research`, a string NBER bore on this pillar alone). The ruling of 2026-07-28 rejected that (§3.1). NBER carries its **one** tradition here, which is already distinct from Kauffman's — the pillar is satisfied by a real difference of school rather than by a label produced to clear the check. What is pillar-specific is the operator's acquisition seed, which is targeted research rather than generic partnership commentary.

NISTA's evidence type is `standards`, the same as INCOSE's on the same pillar. That is fine: **Law II counts traditions, not evidence types**, and `Public Project-Delivery Assurance / Independent Stage-Gate Review` is a genuinely independent tradition beside `Systems`.

#### The NISTA institutional lineage — recorded so it is not "corrected"

The acquisition seed is `https://www.gov.uk/government/collections/infrastructure-and-projects-authority-assurance-review-toolkit` — an **Infrastructure and Projects Authority** collection, registered under the **NISTA** institution.

**This is deliberate and correct.** NISTA is the current body formed from the Infrastructure and Projects Authority and the National Infrastructure Commission, and it inherits IPA's assurance material. But the seed URL's path does not match its institution's name, and a naive audit — human or automated — would read that as an error and "fix" a URL that is right. The lineage is therefore recorded in three places that travel with the data: the registry entry's `notes`, the acquisition seed's `claim` text (so it survives into the database row), and this section.

## 5. Pillar coverage — all fourteen served, all fourteen satisfied

### 5.1 What the ruling closed

> "**Do not waive the five empty pillars**… Populate them with authoritative sources."

| Pillar | Wave-1 authorities | Wave-2 authorities | PRD-IDE-002 §11.2 gap rank |
|---|---|---|---|
| `trust-formation` | none | OECD · CMA | not ranked (but PRD-IDE-002 §5 calls it *"the single strongest omission"*) |
| `pricing` | none | NBER · OECD | **#4** |
| `distribution` | none | WTO · UNCTAD | #3 |
| `settlement-exchange` | none | BIS CPMI · UNCITRAL | not ranked |
| `commercial-failure-modes` | none | NBER · BLS | **#1 — the widest gap** |

**All fourteen pillars are now served.** A canary asserts it, and asserts that each of the five carries at least two authorities.

### 5.2 What the Law II ruling closed

Two pillars carried exactly **one** institutional authority each and therefore failed Law II. The operator declined to waive it and supplied a second authority from a different tradition for each (§4.4):

| Pillar | Was | Now | Verdict |
|---|---|---|---|
| `partnerships` | Kauffman Foundation (Entrepreneurship Research) — **unsatisfied** | + NBER (Academic Economics / Empirical Economic Research) | **satisfied** |
| `outcome-assurance` | INCOSE (Systems) — **unsatisfied** | + NISTA (Public Project-Delivery Assurance / Independent Stage-Gate Review) | **satisfied** |

**No threshold was moved.** Both stayed at 2 authorities from 2 traditions throughout; the pillars were closed with sources, which is what the ruling asked for.

## 6. Tier 2 — practitioner sources, and why they are not seeded

> "Once the institutional corpus has been exhausted, the IDE should expand to curated practitioner sources: Andreessen Horowitz (a16z) · First Round Review · Y Combinator Library · McKinsey Insights · Bain Insights · BCG Insights · Deloitte Insights · PwC Strategy · Accenture Research. **These are not primary scientific authorities**, but they provide a rich source of operational patterns that can be compared against the academic corpus."

All nine are declared at `tier: 'practitioner-pattern'`. **None is seeded, and neither a URL nor a pillar is invented for any of them,** because the operator supplied neither. Three structural brakes follow from the data rather than from a reviewer remembering the rule:

1. **`source_tier` is a column** (migration `20260827000000`), nullable with **no default**, so a SQL-level analysis can separate the tiers and an undeclared row is never counted as an authority.
2. **No URL** → `resolveCanonicalHomepage` returns `null` → Agent B/C cannot start from the entry.
3. **No pillar** → `upsertInstitutionEntry` refuses the row outright.

Which is precisely the operator's gate — *"once the institutional corpus has been exhausted"* — expressed as the shape of the data. `confirmPillarSaturation` (amendment §6.1) is the steward act that opens it.

### 6.1 The third tier — DISCIPLINES, which are not institutions

> "To avoid commercialisation becoming synonymous with 'startup advice', deliberately include adjacent disciplines: Organisation design · Behavioural economics · Network science · Platform economics · Complexity science · Diffusion of innovation · Service science · Operations management."

**These cannot be Institutional Registry rows.** That table is keyed `(domain, pillar_key, institution_name)` and its `seed_url` drives Agent B's institution-targeted navigation. "Behavioural economics" has no homepage, issues nothing, and cannot be navigated to.

**Nor are they coverage pillars.** A pillar is what *constitutes* the domain (Law I). Behavioural economics does not constitute commercialisation; the fourteen §4 sub-domains do.

**They belong in the Constitutional Dependency Registry** — the existing home for external domains that *constrain* the domain, each carrying its relationship edge. Law I leaves exactly two cases, and a discipline that *explains* commercialisation is the second one. No new concept is invented: the model already had the right slot.

Sixteen entries: PRD-IDE-002 §7.3's ten, plus six of the operator's eight. **"Platform economics" is already `platform-economics` and "Operations management" is already `operations`** — reused, not duplicated.

| Dependency | Relationship | Source | Note |
|---|---|---|---|
| `financial-services` | compared against | PRD-IDE-002 §7.3 | Also an observed-in vertical |
| `economics` | explained by | PRD-IDE-002 §7.3 | |
| `operations` | explained by | PRD-IDE-002 §7.3 | Covers the direction's "Operations management" |
| `product-management` | compared against | PRD-IDE-002 §7.3 | |
| `organisational-behaviour` | explained by | PRD-IDE-002 §7.3 | Neighbours `organisation-design` |
| `systems-engineering` | explained by | PRD-IDE-002 §7.3 | |
| `service-design` | compared against | PRD-IDE-002 §7.3 | Neighbours `service-science` |
| `innovation-management` | compared against | PRD-IDE-002 §7.3 | Neighbours `diffusion-of-innovation` |
| `entrepreneurship` | compared against | PRD-IDE-002 §7.3 | |
| `platform-economics` | explained by | PRD-IDE-002 §7.3 | The direction's "Platform economics" |
| `organisation-design` | explained by | ruling 2026-07-27 | Design vs behaviour |
| `behavioural-economics` | explained by | ruling 2026-07-27 | |
| `network-science` | explained by | ruling 2026-07-27 | |
| `complexity-science` | explained by | ruling 2026-07-27 | |
| `diffusion-of-innovation` | explained by | ruling 2026-07-27 | Neighbours `innovation-management` |
| `service-science` | explained by | ruling 2026-07-27 | Discipline vs practice |

Three neighbouring-but-distinct pairs are registered **separately, not merged** — proposing both and letting a steward decide is the ratification model working. A dependency entry records the edge; it does **not** trigger acquisition of that discipline's own corpus (amendment §2.3).

**Recorded for ratification:** `discoveryDomains.ts`'s `tangentialDomains` holds §7.3's ten and is a docs mirror of the PRD. It was deliberately **not** edited; a canary asserts it is a subset of the sixteen instead. On ratification of the six additions, §7.3 and `tangentialDomains` should be extended together.

## 7. Acquisition seeds — where document-level targets actually belong

The ruling supplies **substantive acquisition seeds**: specific publications, one or more per (pillar, institution). These are a different kind of thing from an institutional seed, and the model had no slot for them.

### 7.1 Why not `corpus_institutional_registry.seed_url`

That column is **one URL per institution row**, and it means *"the institution's own publication entry point"* — `runInstitutionDiscovery(seedUrl)` fetches it and walks its links. A publication URL **terminates** navigation rather than starting it; there are several per institution; and each carries its own claim and its own verification state. Overloading `seed_url` would break Agent B's contract and reduce several documents to one.

### 7.2 Why not a candidate source either

`createCandidateSource` **retrieves and hashes bytes**. A candidate row without them would assert a Level-4 acquisition that never happened (PRD-ICA-001 §2). A seed is a *plan*, not an acquisition.

### 7.3 The smallest addition: `corpus_acquisition_seeds`

PRD-ICA-001 §5 already specifies a *"Corpus Acquisition Plan per source lane — target source types, likely primary institutions… indicative document count, priority"*, reviewed before broad acquisition begins. That is Agent A's output, and **only its institution half was ever persisted**. The document half has always been specified and never had a table.

`corpus_acquisition_seeds` is that missing half: one row per planned document, keyed `(domain, pillar_key, institution_name, document_url)`, carrying its own `claim`, its own `verification_status`, and a `candidate_source_id` that links to the candidate it eventually produces through the normal retrieval pipeline.

**`claim` records the operator's description AS A CLAIM.** "76-page survey, 10,000 consumers, ten countries" is what the operator recorded, not something this system measured. Every claim is stored prefixed `Operator claim:` so no reader mistakes it for a measurement — and so the first verification run can be *compared* against it. A page count that comes back at 4 is a finding, and it can only be a finding because the claim was written down first.

### 7.4 The seventeen seeds

| Pillar | Institution | Document URL | Operator's claim |
|---|---|---|---|
| `trust-formation` | OECD | https://www.oecd.org/en/publications/trust-in-peer-platform-markets_1a893b58-en.html | 76-page survey, 10,000 consumers, ten countries |
| `trust-formation` | OECD | https://www.oecd.org/en/publications/oecd-business-and-finance-outlook-2019_af784794-en.html | 140 pages, trust in business and online markets |
| `trust-formation` | UK Competition and Markets Authority | https://www.gov.uk/government/consultations/online-reviews-and-endorsements | 71-page findings report on reviews, endorsements, consumer reliance |
| `pricing` | NBER | https://www.nber.org/papers/w21679 | *Pricing with Limited Knowledge of Demand* |
| `pricing` | OECD | https://www.oecd.org/en/publications/personalised-pricing-in-the-digital-era_db4d9c9c-en.html | 49 pages |
| `pricing` | OECD | https://www.oecd.org/en/publications/algorithmic-pricing-and-competition-in-g7-jurisdictions_f36dacf8-en.html | 26 pages |
| `distribution` | World Trade Organization | https://www.wto.org/english/tratop_e/serv_e/distribution_e/distribution_e.htm | Distribution-services gateway — wholesale, retail, franchising, commission agents, e-commerce |
| `distribution` | UN Trade and Development (UNCTAD) | https://unctad.org/topic/ecommerce-and-digital-economy/measuring-ecommerce-digital-economy | Measuring e-commerce and the digital economy |
| `distribution` | UN Trade and Development (UNCTAD) | https://tft.unctad.org/en/publications/statistics-on-the-digital-economy-e-commerce-and-digital-trade-report-2025/ | Statistics on the digital economy, e-commerce and digital trade, 2025 report |
| `settlement-exchange` | BIS CPMI | https://www.bis.org/list/cpmi/tid_10/index.htm | the canonical CPMI publications listing (primary seed) |
| `settlement-exchange` | BIS CPMI | https://www.bis.org/cpmi/cross_border/publications.htm | CPMI cross-border payments publications — interoperability, ISO 20022 harmonisation, standards |
| `settlement-exchange` | BIS CPMI | https://www.bis.org/publ/cmtpubl.htm | BIS committee publications index, linking the major CPMI collections |

> **Re-seeded 2026-07-28 (operator ruling).** The two prior seeds pinned INDIVIDUAL documents (`cpmi/publ/d216.htm`, `cpmi/publ/d202.htm`) and both 404'd. The operator's correction is a rule, not a URL swap: *"The canonical BIS seed should point to the official CPMI publications, not a guessed document URL… This avoids hard-coding an individual report, so new CPMI papers become discoverable automatically while keeping the seed anchored to the official BIS publication index."* A pinned document seed is brittle twice — it dies when the document moves, and it can never surface anything published after the day it was written. **Prefer publication INDEX pages for every institutional acquisition seed.** URLs are recorded without the `?utm_source=` tracking parameters they arrived with.
| `settlement-exchange` | UNCITRAL | https://uncitral.un.org/en/texts/ecommerce | Electronic commerce texts |
| `settlement-exchange` | UNCITRAL | https://uncitral.un.org/en/texts/ecommerce/modellaw/electronic_commerce | Model Law on Electronic Commerce |
| `settlement-exchange` | UNCITRAL | https://uncitral.un.org/en/texts/ecommerce/modellaw/electronic_transferable_records | Model Law on Electronic Transferable Records |
| `commercial-failure-modes` | NBER | https://www.nber.org/papers/w19679 | *Deals Not Done: Sources of Failure in the Market for Ideas* |
| `commercial-failure-modes` | NBER | https://www.nber.org/papers/w34755 | Randomized evidence on venture shutdown, survival, "rational quitting" |
| `commercial-failure-modes` | U.S. Bureau of Labor Statistics | https://www.bls.gov/osmr/research-papers/2004/st040060.htm | Establishment survival, Business Employment Dynamics |

A canary asserts every seed hangs off a really-registered (pillar, institution), that no seed URL equals its institution's homepage (which would mean `seed_url` had been overloaded after all), and that every claim is recorded as a claim.

## 8. Law II of Constitutional Discovery — the constitutional acquisition rule

> **"Every IDE corpus shall contain multiple independent schools of thought and institutional traditions. No invariant family may rely upon a single institution, publisher, methodology, or ideological perspective."**

> "That is stronger than the Financial Services approach because it guards against **institutional bias as well as platform bias.**"

### 8.1 Where it belongs — the audit

| Candidate home | Verdict |
|---|---|
| **PRD-ICA-001 + its ratified Constitutional Discovery amendment** — whose §2.0 already holds **Law I of Constitutional Discovery**, and whose §5 holds the inclusion/exclusion policy this rule constrains | **RECOMMENDED.** A sibling of Law I in scope, form and governed artefact |
| A new CFS | **REJECTED.** Founding a specification for one clause that extends an existing law in an existing ratified document is the parallel-structure defect CCR-001 §25 forbids |
| CFS-052 (Evidence Architecture) | **REJECTED.** CFS-052 governs what evidence an invariant rests on; Law II governs corpus composition upstream of that |
| CFS-009 (the Laws) | **REJECTED for now.** Law I is not in CFS-009 either |

**Recommendation: adopt as Law II of Constitutional Discovery, by amendment to PRD-ICA-001's ratified Constitutional Discovery amendment §2.0, with a companion clause in PRD-ICA-001 §5.** Both documents are ratified, so **the amendment is an operator act under Law XI** and is not performed here. The exact proposed text:

> **Law II of Constitutional Discovery** — Every IDE corpus shall contain multiple independent schools of thought and institutional traditions. No invariant family may rely upon a single institution, publisher, methodology, or ideological perspective.
>
> A pillar's institutional corpus is not saturated (§6.1) while its registry draws on fewer than two institutional authorities, or on authorities from a single institutional tradition.

### 8.2 How it is enforced

Three checks. **One is built and bound today**; two are specified and explicitly not built.

| # | Check | Where | Status |
|---|---|---|---|
| **1** | **Registry-time.** Per pillar: ≥2 `institutional-authority` sources from ≥2 distinct `category` traditions. Three verdicts — `satisfied` / `unsatisfied` / `undeterminable` (the last when a registered authority declares no tradition, so the rule cannot be *verified*, only assumed) | `assessRegistryDiversity()`, **called by `getDomainConstitution()`** and returned on `GET /api/corpus-scout/domain-constitution` as `constitution.diversity` | **BUILT AND BOUND** |
| **2** | **Ratification-time.** `confirmPillarSaturation` refuses while a pillar's verdict is not `satisfied` | `confirmPillarSaturation` | **PROPOSED, NOT BUILT** — it changes a ratified Phase-2 function's behaviour |
| **3** | **Corpus-time.** Per pillar, no single `corpus_candidate_sources.issuer` may supply a pillar's whole approved corpus. `issuer` already exists on the row; the natural home is `assessLaneCoverage()` | `services/corpusScout/intelligence.ts` | **PROPOSED, NOT BUILT** — cannot run before a corpus exists |

### 8.3 The current verdict — all fourteen pillars

Computed by `assessRegistryDiversity` over the registry as it now stands, and pinned by canary:

| Pillar | Authorities | Distinct traditions | Verdict |
|---|---|---|---|
| `value-proposition` | 3 | Customer Development · Product | satisfied |
| `customer-discovery` | 3 | Customer Development · Product | satisfied |
| `trust-formation` | 2 | Competition & Consumer Enforcement · International Policy Research | satisfied |
| `pricing` | 2 | Academic Economics / Empirical Economic Research · Competition Policy | satisfied |
| `distribution` | 2 | Development Economics · International Trade Doctrine | satisfied |
| `adoption` | 5 | Academic Economics / Empirical Economic Research · Economics · Innovation · Research Repository | satisfied |
| `revenue-architecture` | 3 | Customer Development · Innovation · Strategy | satisfied |
| `settlement-exchange` | 2 | International Commercial Law · Payment & Settlement Infrastructure | satisfied |
| `partnerships` | 2 | Academic Economics / Empirical Economic Research · Entrepreneurship Research | satisfied |
| `outcome-assurance` | 2 | Public Project-Delivery Assurance / Independent Stage-Gate Review · Systems | satisfied |
| `scaling` | 3 | Economics · Innovation · Systems | satisfied |
| `venture-operations` | 6 | Academic Economics / Empirical Economic Research · Economics · Entrepreneurship Research · Innovation · Research Repository | satisfied |
| `commercial-governance` | 3 | Economics · Strategy · Systems | satisfied |
| `commercial-failure-modes` | 2 | Academic Economics / Empirical Economic Research · Official Statistics | satisfied |

**Fourteen of fourteen satisfied. Zero unsatisfied. Zero undeterminable.** Reached by adding sources, never by moving a threshold.

**The check has not become vacuous.** Every Financial Services pillar still reports `undeterminable` (§3.2), because that registry records no traditions — the same function, the same run, a different and honest answer. And the check still fails on demand: a canary drives one authority, two-from-one-tradition, and an unclassified authority through it and asserts each is refused.

## 9. Registry verification — the binding, and the gate

> 1. Promote the ratified inspection thresholds into the named **Corpus Qualification Standard**.
> 2. At registry verification time, invoke the existing redirect resolver, institution navigator and Inspection Agent.
> 3. Record the resolved URL, verification timestamp, representative qualifying documents, inspection results and content hashes.
> 4. Introduce the explicit verification-status vocabulary.
> 5. Refuse institutional discovery unless the entry is both steward-ratified **and** verified.
> 6. Mutation-test the refusal gate and the status transitions.

**The gap was the binding, not the capability.** Verification already ran at *document* level, after acquisition had begun. A registry entry carried no verification state, and nothing refused to acquire from an unverified institution — a registry of URLs with no binding to the real-world property it depends on, whose absence is undetectable because nothing errors. That is exactly CFS-053's shape.

### 9.1 The Corpus Qualification Standard — promoted, not invented

PRD-ICA-001 §7 already ratifies the numbers: *"Illustrative threshold (configurable by source type, not fixed by this PRD): `pageCount ≥ 5 AND substantiveTextCharacters ≥ 5,000 AND blankPageRatio < 0.25`"*. They lived as private constants in `inspection.ts`; registry verification needs the same numbers, and two copies of a threshold is `inv.engineering.036` applied to a number.

Sited in `services/corpusScout/corpusQualificationStandard.ts`. `inspection.ts` now **imports** them; a canary asserts it re-declares none.

| Constant | Value | Applies to |
|---|---|---|
| `CQS_PDF_MIN_PAGE_COUNT` | 5 | paginated |
| `CQS_PDF_MIN_SUBSTANTIVE_CHARACTERS` | 5,000 | paginated |
| `CQS_PDF_MAX_BLANK_PAGE_RATIO` | 0.25 | paginated |
| `CQS_BLANK_PAGE_WORD_THRESHOLD` | 10 | paginated |
| `CQS_TEXT_ONLY_MIN_SUBSTANTIVE_CHARACTERS` | 2,000 | non-paginated (HTML/text) — a deliberate adaptation, since a web page has no page count |

**THE UNIT IS CHARACTERS, not words.** Stated in capitals because the ambiguity is live: the operator's own recollection was "5,000 words", and PRD-ICA-001 §7's field name is `substantiveTextCharacters`. 5,000 words is roughly 30,000 characters — a six-fold difference that would silently reject most qualifying documents. The unit is in the constant name, in the module comment, and in the standard's human-readable statement, which a canary pins.

### 9.2 The status vocabulary

Orthogonal to `status` (`proposed | ratified`), exactly as `provenanceClass` is orthogonal to `reviewWorkflowStatus`. Ratification answers *"does a steward accept this authority"*; verification answers *"does this URL still lead to a qualifying corpus"*. An entry can be ratified and `verification_failed`. Collapsing them would make a dead link indistinguishable from an unapproved one.

| Status | Meaning | Set by |
|---|---|---|
| `proposed` | Never submitted for verification. The seeding default | seed / steward |
| `pending_verification` | A run is in flight. **The only state `verified` may follow** | the run |
| `verified` | All four conjuncts satisfied, with the evidence recorded | the run |
| `verification_failed` | The seed URL could not be resolved, or the run errored | the run |
| `insufficient_corpus` | Reachable, but no document passed the Corpus Qualification Standard | the run |
| `temporarily_unavailable` | A transient failure (timeout). Re-runnable; not a judgment on the source | the run |
| `redirect_changed` | The seed now redirects to a **different host** — a steward must re-confirm | the run |
| `deprecated` | No longer an authority for this pillar | steward |

### 9.3 The transition table

```
proposed                 → pending_verification | deprecated
pending_verification     → verified | verification_failed | insufficient_corpus
                           | temporarily_unavailable | redirect_changed | deprecated
verified                 → pending_verification | deprecated      (re-verification; entries go stale)
verification_failed      → pending_verification | deprecated
insufficient_corpus      → pending_verification | deprecated
temporarily_unavailable  → pending_verification | deprecated
redirect_changed         → pending_verification | deprecated
deprecated               → proposed                              (re-opened, unverified)
```

**The load-bearing rule is one line: `verified` is reachable only from `pending_verification`.** Without it, anything that can write the column can declare an entry verified and the gate below becomes decoration. `applyVerificationOutcome` refuses any other transition and writes nothing; a canary drives all eight statuses through it.

### 9.4 Verification is more than reachability

All four conjuncts, in order — and the order matters, because each status names a different remediation:

```
institution URL resolves
  + document candidates discovered
  + at least one document passes the Corpus Qualification Standard
  + retrieved bytes and inspection result are recorded
```

A 200 response is not verification. An institution whose homepage loads but whose publication listing yields nothing acquirable is `insufficient_corpus`, and `insufficient_corpus` does not open the gate. `runVerification` invokes `followRedirects` → `runInstitutionDiscovery` → `retrieveArtifact` → `inspectArtifact` — the existing, ratified machinery, none of it reimplemented — and records `resolvedUrl`, `checkedAt`, `candidatesFound`, `documentsInspected`, and each qualifying document's `contentHash`, `mimeType`, `fileSizeBytes`, `pageCount`, `substantiveTextCharacters` and `blankPageRatio`, plus the standard applied.

An **off-host** redirect returns `redirect_changed` rather than being auto-accepted; a same-host hop (a locale or trailing-slash redirect) is routine and passes.

### 9.5 The refusal gate

`canRunInstitutionDiscovery` requires **both** `status === 'ratified'` **and** `verification_status === 'verified'`. Neither alone suffices: ratification without verification acquires from a URL nobody has resolved; verification without ratification acquires from an authority nobody accepted. It fails closed on every unknown value. Both `runDiscoveryForInstitution` and `runDiscoveryForDomain` route through the same function, so a domain-wide run cannot become a way around the per-institution refusal.

> **⚠ Operational consequence the operator must know.** The gate applies to **every** domain. The nineteen Financial Services entries have never been verified, so **FS institutional discovery will refuse until an FS verification run completes.** That is the gate working, not a regression. One call clears it: `POST /api/corpus-scout/institution-verification/domain { "domain": "financial-services" }`.

## 10. Financial Services metadata — separate remediation work

> "Should be captured as **separate remediation work**: backfill its authority, category, evidence type and tradition metadata using the same shared template. **It should not be used to weaken Law II or block completion of the properly constituted Commercialisation registry.**"

**Work item FS-META-001 — backfill the Financial Services registry's template metadata.**

- **Scope:** `category` (institutional tradition), `authority`, `evidenceType` and `notes` for all nineteen entries in `FINANCIAL_SERVICES_REGISTRY`, using the shared template unchanged.
- **Current state:** all four are `null` for all nineteen. Consequence: every FS pillar reports `undeterminable`, never `satisfied`.
- **Constraint (unchanged):** **do not backfill by inference.** Assigning BIS a tradition or FATF an evidence type from an agent's background knowledge is the same fabrication bar this whole registry was built to respect. The metadata must come from the operator, or from a verified FS corpus.
- **Not a blocker:** per the ruling, this does not weaken Law II and does not gate Commercialisation ratification. `undeterminable` is the honest verdict for an unclassified registry and is designed to be visible without being fatal.
- **Natural sequencing:** after the FS verification run (§9.5), whose retrieved documents supply real evidence of what each institution issues.

## 11. The operator's runnable path

### Step 1 — seed (safe to run now; every row stays `proposed`)

Paste **both** migrations, in order, into the Supabase SQL editor. Both are additive and idempotent (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` / `ON CONFLICT DO NOTHING`); re-running changes nothing and un-ratifies nothing. To print them for pasting:

```bash
git fetch iqp dev && \
git checkout iqp/dev -- supabase/migrations/20260829000000_commercialisation_law_ii_closure.sql && \
cat supabase/migrations/20260829000000_commercialisation_law_ii_closure.sql
```

`20260827000000` and `20260828000000` **have been run** and are not to be edited. `20260829000000` is the only outstanding one: it adds the two Law II closing authorities and their two acquisition seeds, all `proposed` / `pending_verification`.

For the record, what the three migrations do in total: `20260827000000` creates the `source_tier` column, 1 Domain Definition, 14 Coverage Pillars, 16 Dependency entries and 28 wave-1 institutions; `20260828000000` adds the verification columns, creates `corpus_acquisition_seeds`, seeds 10 wave-2 institutions and 17 acquisition seeds, and moves the Commercialisation registry to `pending_verification`; `20260829000000` seeds the 2 wave-3 institutions and 2 seeds — **40 institution rows and 19 acquisition seeds in all.**

### Step 2 — VERIFY, before ratifying (deployed app only)

```
POST /api/corpus-scout/institution-verification/domain   { "domain": "commercialisation" }
POST /api/corpus-scout/institution-verification/domain   { "domain": "financial-services" }
POST /api/corpus-scout/institution-verification          { "domain", "pillarKey", "institutionName" }   ← one entry
GET  /api/corpus-scout/domain-constitution?domain=commercialisation   ← read the outcomes + `diversity`
```

Expect failures, and read them: `verification_failed` means the URL is wrong; `insufficient_corpus` means reachable but nothing acquirable; `redirect_changed` means the institution moved and a steward must re-confirm; `temporarily_unavailable` means re-run. **This is where the operator-supplied URLs and the seventeen document claims are first tested against reality.**

### Step 3 — rule on the pillar mapping, then ratify

Law II is now satisfied on all fourteen pillars (§8.3), so the remaining pre-ratification judgment is the **wave-1 pillar mapping** (§4.1, 28 agent-proposed rows, correctable individually — wave 2 and wave 3 were operator-supplied and need no such ruling). Then:

```
POST /api/corpus-scout/domain-constitution { action: "ratify-definition",  domain: "commercialisation" }
POST … { action: "ratify-pillar",      domain: "commercialisation", pillarKey: "<each of the 14>" }
POST … { action: "ratify-dependency",  domain: "commercialisation", dependencyName: "<each of the 16>" }
POST … { action: "ratify-institution", domain: "commercialisation", pillarKey, institutionName }
```

### Step 4 — acquisition (only after ratification AND verification)

```
POST /api/corpus-scout/institution-discovery/domain   { "domain": "commercialisation" }
POST /api/corpus-scout/institution-discovery          { domain, pillarKey, institutionName }
```

Every candidate lands `pending_review`. A steward reviews each through `POST /api/corpus-scout/candidates/[sourceId]/review`.

### Step 5 — IDE discovery, then comparison

`add-evidence` with `domain = commercialisation/<observed vertical>` and `subDomain = <§4 pillar key>` (PRD-IDE-002 §7.6), then `extract` → `compare` → `compress-domain` → `promote`. Promotion lands `proposed`, never canonical. Comparison runs against the §6.1 dependency registry.

**Gate between 4 and 5:** `confirmPillarSaturation` per pillar, plus Gap Detection. Open Discovery unlocks only after both, per pillar — never globally.

## 12. What this document deliberately did NOT do

- **No acquisition and no verification run.** Nothing was fetched. No URL was resolved, no document inspected, no claim measured. Nothing anywhere is marked `verified`.
- **No ratification.** Every row lands `proposed`. Not one `ratify-*` call was made.
- **No invented URL, institution, claim or fact.** Tier 2 has no URLs because none was supplied. No pillar was closed by inference; `commercial-failure-modes` was left empty in wave 1 even though Santa Fe Institute could plausibly have been mapped to it — plausibly is not a basis.
- **No threshold tuned to produce a nicer verdict.** `LAW_II_MIN_AUTHORITIES` and `LAW_II_MIN_TRADITIONS` are unchanged at 2 across all three waves; the two failing pillars were closed with sources.
- **The operator's browser check is not treated as verification.** Both wave-3 URLs were live-checked by the operator and both still enter at `pending_verification`, because only the four-conjunct run may award `verified`.
- **No edit to an applied migration.** `20260827000000` and `20260828000000` have been run; wave 3 is a new file.
- **No amendment to a ratified document.** Law II is recommended for PRD-ICA-001's amendment §2.0 (§8.1) with the exact text supplied. Amending is an operator act under Law XI.
- **No new inspection numbers.** The Corpus Qualification Standard is PRD-ICA-001 §7's, promoted.
- **No edit to `services/invariants/discoveryDomains.ts`.** A canary pins the relationship instead (§6.1).
- **Law II checks 2 and 3 are not built** (§8.2), and the FS metadata backfill is recorded, not performed (§10).

## 13. Enforcement

`tests/commercialisation-institutional-registry.test.ts` — indexed in `tests/source-of-truth-parity.test.ts`.

| Canary | Guards |
|---|---|
| Every registered institution maps to a real PRD-IDE-002 §4 pillar; all fourteen are served; each of the five closed pillars carries ≥2 authorities | §5.1 |
| Both seed migrations and the curated template are the same 38 rows | §4, `inv.engineering.036` |
| Provenance attaches PER PILLAR — evidence type, authority basis and acquisition seed vary by pillar | §3.1 |
| The TRADITION does not: NBER declares one tradition on all five of its pillars, and the superseded strings survive nowhere | §3.1 |
| No institution declares two traditions — asserted as an EXACT set, so a new one fails the build and OECD's resolution must be declared | §3.1 |
| `assessRegistryDiversity` deduplicates by institution — one institution cannot satisfy Law II by itself | §3.1, §8.2 |
| Wave 2 REUSED institutions where it could (OECD ×2, NBER ×2) | §4.2 |
| Tier 1 and tier 2 cannot be conflated; no practitioner entry carries a pillar or a URL; diversity never counts one as an authority | §6 |
| The disciplines are dependencies, never institutions or pillars; `tangentialDomains` ⊆ the dependency registry | §6.1 |
| The template is shared, not forked; FS matches its seed SQL; no FS entry carries invented metadata | §3.2 |
| All 21 tier-1 URLs are exactly the operator's; resolution never falls back; BIS CPMI has exactly ONE key, at the committee page | §4, §4.3 |
| Acquisition seeds are documents, hang off real registry entries, never equal an institution's homepage, and record claims AS claims | §7 |
| `assessRegistryDiversity` fails: 1 authority ⇒ unsatisfied; 2 from one tradition ⇒ unsatisfied; unclassified ⇒ undeterminable; undeclared tier never counted | §8.2 |
| The diversity check is BOUND: `getDomainConstitution` calls it and returns it | §8.2 |
| The real registry produces the REPORTED verdict — 14 of 14 satisfied, none unsatisfied, none undeterminable | §8.3 |
| NBER's `partnerships` tradition differs from Kauffman's on the same pillar | §4.4 — an identical label would leave the pillar unsatisfied with two authorities registered |
| The NISTA lineage is recorded on the entry AND in the seed's claim text | §4.4 — so a reviewer cannot "correct" a correct URL |
| The Corpus Qualification Standard is PRD-ICA-001 §7's numbers; states CHARACTERS; `inspection.ts` re-declares none | §9.1 |
| Exactly the operator's eight verification statuses, all present in the CHECK | §9.2 |
| `verified` is reachable ONLY from `pending_verification`, for all eight statuses | §9.3 |
| The refusal gate needs both ratification and verification, and refuses on every other value | §9.5 |
| The gate is BOUND: `runDiscoveryForInstitution` refuses and acquires nothing; a domain run is not a way around it | §9.5 |
| Reachability alone ⇒ `insufficient_corpus`; below-standard documents ⇒ `insufficient_corpus`; four conjuncts ⇒ `verified` with hash + inspection recorded | §9.4 |
| Timeout ⇒ `temporarily_unavailable`; off-host redirect ⇒ `redirect_changed`; same-host hop still verifies | §9.4 |
| `applyVerificationOutcome` refuses an illegal transition and writes nothing | §9.3 |
| Nothing is seeded `ratified` or `verified`; both migrations are additive and idempotent | §12 |
| This document is registered in `codexes/packs/irl/collections.json` and states its status | reachability |

---

## Ratification record

- [ ] **Operator ratification of this registry as a whole.** Nothing here is ratified by being written.
- [x] **Run `20260827000000` and `20260828000000`** — DONE. Seeded rows are `proposed` / `pending_verification`; running them verified and ratified nothing.
- [ ] **Run `20260829000000`** (§11 step 1) — the wave-3 Law II closure. Safe now; both rows stay `proposed` / `pending_verification`.
- [ ] **Run verification** on `commercialisation` AND `financial-services` (§11 step 2) — the deployed app. **Precondition for both acquisition and ratification.**
- [ ] **Operator ruling on the wave-1 pillar mapping** (§4.1) — 28 rows, correctable individually.
- [x] **Operator ruling on the two pillars that failed Law II — RULED 2026-07-27.** *"Do not waive Law II. Add a second authority from a different tradition for each pillar."* NBER → `partnerships`, NISTA → `outcome-assurance` (§4.4). **Applied; all fourteen pillars now satisfy Law II (§8.3).**
- [ ] **Operator ruling on Law II** (§8.1) — adopt as Law II of Constitutional Discovery by amendment to PRD-ICA-001's amendment §2.0 + PRD-ICA-001 §5.
- [ ] **Operator ruling on §8.2 checks 2 and 3** — whether `confirmPillarSaturation` should refuse on an unsatisfied verdict, and whether issuer-concentration lands in `assessLaneCoverage`.
- [ ] **Operator ruling on the three neighbouring dependency pairs** (§6.1) — merge or keep.
- [ ] **FS-META-001** (§10) — backfill the Financial Services template metadata, from the operator or a verified corpus, never by inference.
- [ ] **Phase 2 ratification pass** (§11 step 3) — a steward act, after verification.
- [ ] **Phase 3 acquisition** (§11 step 4) — only after ratification AND verification.
