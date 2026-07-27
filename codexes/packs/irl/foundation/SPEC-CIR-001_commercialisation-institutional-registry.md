# SPEC-CIR-001 — Commercialisation Institutional Registry

**metaMe IRL · Curated corpus registry · Status: PHASE 1 OUTPUT — PROPOSED, NOTHING HERE IS RATIFIED**
**Owner:** Invariant Research Lab (IRL) · **Origin:** operator direction, 2026-07-27
**Governs:** the curated, authoritative source registry that Commercialisation corpus acquisition (PRD-IDE-002 §7) begins from, and the **generalised registry template** every future horizontal domain uses.
**Composes (does not fork):** `PRD-ICA-001` + its ratified Constitutional Discovery amendment (2026-07-23) · `PRD-IDE-002` §4/§7/§11.2 · `CFS-053` (Constitutional Binding) · CLAUDE.md's *No Guessing or Hallucinating* rule.

> **The hard stop this document observes.** *"Do not perform acquisition yet. Produce the registry first."*
> Nothing was fetched. Outbound HTTPS is blocked from the build sandbox (verified: `403 CONNECT tunnel failed` for both `fatf-gafi.org` and `arxiv.org`), so any "acquired" content would be fabricated. Acquisition runs on the deployed app, in Phase 3.

> **Nothing here is ratified by being written.** Every row this document produces lands in the database as `proposed`. Ratification is a steward act (§8, Phase 2) and is deliberately not performed here.

---

## 1. The principle this registry exists to serve

> "Commercialisation should not begin with open-ended web search. It should begin with a curated, ratified corpus of authoritative commercialisation sources, exactly as Financial Services began with FATF, Basel, MiCA and related institutions. **The IDE derives invariants from the corpus. It does not define the corpus.**"

> "The Financial Services programme did **not** begin by asking the IDE to 'discover finance.' It began by giving it a **curated, authoritative corpus** and then asking it to derive invariants from that corpus. That disciplined the experiment and made every invariant traceable."

The canonical pipeline, now domain-independent:

```
Curated Institutional Registry → Corpus Acquisition → Corpus Validation
  → IDE Discovery → Invariant Library → Crystal Eligibility
```

## 2. Audit — how Financial Services actually did it, and what is reused

Per CCR-001 §25's standing instruction, recorded before any of this is treated as new. **The FS pattern is already fully mechanised; this document reuses all of it and builds exactly one new thing.**

| What this registry needs | Already exists as | Disposition |
|---|---|---|
| A "what is this domain" statement | `corpus_domain_definitions` + `upsertDomainDefinition` / `ratifyDomainDefinition` (§2.1) | **EXISTS.** Reused verbatim |
| A coverage model of required pillars | `corpus_coverage_pillars` + `upsertCoveragePillar`; saturation confirmed explicitly by a steward (`confirmPillarSaturation`), never inferred from a count (§6.1) | **EXISTS.** Reused verbatim |
| A place for adjacent disciplines | `corpus_dependency_registry` — external domains that CONSTRAIN the domain, each carrying its relationship edge (§2.3, Law I) | **EXISTS.** This is where the operator's third tier lands — §6 |
| The registry itself | `corpus_institutional_registry`, keyed `(domain, pillar_key, institution_name)`, `status ∈ proposed \| ratified`, `seed_url` from the steward or resolved from the curated homepage directory | **EXISTS.** Reused verbatim |
| A curated institution→homepage directory that never falls back to search | `services/corpusScout/canonicalInstitutionHomepages.ts` — already states the accepted posture ("curated by the operator/agent at build time, not verified against a live registry") and fails honestly (`null`) rather than searching | **EXISTS.** Extended with the operator's fifteen URLs |
| Ratification | `ratifyInstitutionEntry` | **EXISTS.** Phase 2, not this document |
| Institution-targeted navigation from a seed URL | Agent B/C — `institutionNavigator.ts`, `POST /api/corpus-scout/institution-discovery[/domain]` | **EXISTS.** Phase 3, not this document |
| The seven-column template, shared across domains | **Nothing.** The FS registry records three facts per authority: domain, pillar, institution name | **NEW — §3** |
| A rule forbidding single-institution reliance, and a check for it | **Nothing** | **NEW — §7** |

**The hard prerequisite handled.** `upsertInstitutionEntry` refuses when the pillar does not exist — *"propose the pillar first"*. The sequence is therefore Domain Definition → Coverage Pillars → Institutions, and the migration in §8 follows it in that order. PRD-IDE-002 §7.2 already proposes the fourteen commercialisation sub-domains as coverage pillars; §4 below maps every institution onto one of those fourteen and invents no new pillar.

**Where the registry actually lives.** In the database, not in code. Phase 1's deliverable is therefore necessarily two-part: the code-side curated directory + template (`services/corpusScout/canonicalInstitutionHomepages.ts`, `services/corpusScout/institutionalRegistry.ts`), and a runnable path that populates the DB rows (§8).

## 3. The generalised registry template

> "The Financial Services registry can now be generalized into a reusable template. Instead of creating ad hoc registries, every horizontal domain should define the same metadata: **Institution · Category · Authority · URL · Evidence Type · Priority · Notes**… That becomes the standard input to the IDE, regardless of domain."

Declared once, in `services/corpusScout/institutionalRegistry.ts`, as `InstitutionalRegistryEntry`:

| Operator column | Field | Note |
|---|---|---|
| Institution | `institution` | The natural key half of the DB row |
| Category | `category` | The institutional **tradition** — and the axis Law II's diversity check counts (§7) |
| Authority | `authority` | *Why* this source is authoritative |
| URL | **derived** — `registryEntryUrl()` | Read from `canonicalInstitutionHomepages.ts`. Restating a URL in the template would duplicate a fact that directory already owns |
| Evidence Type | `evidenceType` | `research-papers \| standards \| policy \| practitioner-guidance \| datasets` |
| Priority | **derived** — `acquisitionPriority()` | The strongest PRD-IDE-002 §11.2 evidential-gap rank among the pillars the entry serves. A hand-typed number goes stale the moment either the gaps or the pillar mapping changes |
| Notes | `notes` | |

Plus two **structural** fields the operator's prose requires but a seven-column table cannot carry:

- **`tier`** — `institutional-authority` | `practitioner-pattern`. §5's reasoning.
- **`pillarKeys`** — the coverage pillars the entry is registered against. Empty means un-acquirable: `upsertInstitutionEntry` refuses an entry whose pillar does not exist.

### 3.1 Is the template genuinely shared with Financial Services?

**Structurally yes; by data, partly — and the gap is recorded rather than papered over.**

`FINANCIAL_SERVICES_REGISTRY` declares all nineteen ratified FS authorities in the *same* `InstitutionalRegistryEntry` type, consumed by the *same* `registryEntryUrl` / `acquisitionPriority` / `assessRegistryDiversity` functions, pinned set-for-set against the `20260817000000` seed SQL by canary. There is one template and one code path, not two.

**But `category`, `authority`, `evidenceType` and `notes` are `null` for every FS entry.** The FS registry was captured before the template existed and recorded only pillar + institution name. Populating those four fields would mean asserting facts about what BIS, FATF, ESMA et al. publish — facts this environment cannot verify and CLAUDE.md's zero-tolerance rule forbids inventing. A steward completes them; until then the honest value is `null`.

The visible consequence is intentional and is the point of §7: `assessRegistryDiversity` reports **every Financial Services pillar as `undeterminable`**, not `satisfied`. Law II cannot be verified for a registry that records no institutional traditions, and reporting that as compliance would be as dishonest as reporting it as violation.

## 4. Tier 1 — the operator-supplied institutional registry

**Provenance: these fifteen institutions, their categories, their purposes and their URLs were supplied verbatim by the operator on 2026-07-27.** None was searched for, inferred, or constructed. None has been verified from this environment — outbound HTTPS is blocked, so any claim of verification would be false. The first Agent B/C discovery run on the deployed app is what verifies them; a dead entry surfaces as an honest retrieval failure, never as a search fallback.

**The pillar column is AGENT-PROPOSED.** The operator supplied Category and Purpose, not coverage pillars. Every mapping below is derived from the operator's own words against PRD-IDE-002 §4's pillar definitions, and the basis is stated for each. A steward ratifies or corrects them in Phase 2.

| # | Institution | Category | Authority (operator's Purpose) | URL (operator-supplied) | Evidence Type | Pillars (agent-proposed) | Basis for the pillar mapping | Priority |
|---|---|---|---|---|---|---|---|---|
| 1 | NBER | Entrepreneurship Research | Entrepreneurship, innovation, venture research | https://www.nber.org | research-papers | `venture-operations`, `adoption` | "venture research" → §4 venture-operations; "innovation" → §4 adoption | 2 |
| 2 | Kauffman Foundation | Entrepreneurship Research | Entrepreneurship and startup ecosystems | https://www.kauffman.org | research-papers | `venture-operations`, `partnerships` | "startup ecosystems" is a direct word match for §4 *Partnerships & Ecosystem Development* | 2 |
| 3 | SSRN | Research Repository | Entrepreneurship, strategy, innovation papers | https://www.ssrn.com | research-papers | `venture-operations`, `adoption` | A repository, cross-pillar by nature; registered only against the pillars its Purpose names. "strategy" has no §4 pillar and is deliberately not mapped | 2 |
| 4 | OECD | Economics | Innovation, productivity, digital economy | https://www.oecd.org | policy | `adoption`, `scaling` | "innovation" → adoption; "productivity" → §4 scaling (*repeated without linear cost*) | 3 |
| 5 | World Bank | Economics | Private sector development, entrepreneurship | https://www.worldbank.org | policy | `venture-operations`, `commercial-governance` | "entrepreneurship" → venture-operations; a multilateral policy issuer → §4 commercial-governance (*authority, attribution and disclosure rules*) | 2 |
| 6 | MIT Sloan | Innovation | Innovation management research | https://mitsloan.mit.edu | research-papers | `adoption`, `venture-operations` | "innovation" → adoption; "management" → venture-operations | 2 |
| 7 | Stanford Graduate School of Business | Innovation | Entrepreneurship and scaling | https://www.gsb.stanford.edu | research-papers | `scaling`, `venture-operations` | Both are verbatim word matches — the least inferential mapping in the tier | 2 |
| 8 | Harvard Business School | Innovation | Strategy, innovation, commercialisation | https://www.hbs.edu | research-papers | `revenue-architecture`, `adoption` | "commercialisation"/"strategy" → §4 revenue-architecture (*where revenue originates, how offers compose*); "innovation" → adoption | 3 |
| 9 | Strategic Management Society | Strategy | Strategy research | https://www.strategicmanagement.net | research-papers | `revenue-architecture`, `commercial-governance` | **Weakest mapping in the tier** — §4 has no "strategy" pillar. Most likely to be re-pillared by a steward | 6 |
| 10 | Santa Fe Institute | Systems | Complex adaptive systems, emergence | https://www.santafe.edu | research-papers | `scaling` | Emergence/repeatability at scale. **Deliberately NOT mapped to `commercial-failure-modes`** — the Purpose does not say failure studies, and the widest evidential gap must not be closed by inference | 6 |
| 11 | INCOSE | Systems | Systems engineering and organisational systems | https://www.incose.org | standards | `outcome-assurance`, `commercial-governance` | Systems engineering → §4 outcome-assurance (*how delivered outcome is measured and sustained*); a professional standards body → commercial-governance. **The tier's only standards issuer** | 5 |
| 12 | Silicon Valley Product Group | Product | Product management and product-market fit | https://www.svpg.com | practitioner-guidance | `customer-discovery`, `value-proposition` | "product-market fit" is a verbatim match for §4 *Customer Discovery & Fit* | 2 |
| 13 | Product School | Product | Product management practice | https://productschool.com | practitioner-guidance | `customer-discovery`, `value-proposition` | Same tradition and evidence type as #12 — adds no Law II diversity to the pillars it shares with it | 2 |
| 14 | Strategyzer | Customer Development | Business models, value propositions | https://www.strategyzer.com | practitioner-guidance | `value-proposition`, `revenue-architecture` | "value propositions" verbatim; "business models" → revenue-architecture | 5 |
| 15 | Lean Startup | Customer Development | Customer discovery methodology | https://theleanstartup.com | practitioner-guidance | `customer-discovery` | Verbatim pillar match. Not mapped to value-proposition — the Purpose names a discovery *method*, not an offer structure | 2 |

**28 registry rows** (one per pillar × institution pair).

**Tier and evidence type are orthogonal, and the operator's own table proves it.** Four of the fifteen first-tier entries (#12–#15) publish practitioner guidance. The tier axis answers *which acquisition wave*; the evidence-type axis answers *what kind of artefact*. Neither substitutes for the other, and the concern the tier boundary exists to prevent — treating an insight piece as equivalent to a working paper — is therefore already live *inside* tier 1. Both axes are carried structurally so a later analysis can filter on either.

## 5. What the registry does NOT cover — five pillars with no institution

| Pillar | Tier-1 institutions | PRD-IDE-002 §11.2 gap rank |
|---|---|---|
| `trust-formation` | **none** | not ranked |
| `pricing` | **none** | **#4** |
| `distribution` | **none** | #3 (platform & network economics) |
| `settlement-exchange` | **none** | not ranked |
| `commercial-failure-modes` | **none** | **#1 — the widest gap** |

This is a **finding, not an omission.** The operator's list supplies no basis for mapping any of the fifteen onto these five, and inventing one would be fabrication. Two of the five corroborate PRD-IDE-002 §11.2's own ordering from an independent direction: commercial failure post-mortems are ranked the highest-value acquisition gap there, and the first-tier registry contains no institution for them. `trust-formation` is the more striking absence — PRD-IDE-002 §5 calls it *"the single strongest omission"* in the taxonomy and the strongest cross-domain signal in the initial library, and the curated registry has no authority for it at all.

**Recommended to the operator:** supply, or authorise the agent to propose, institutions for these five before Phase 3 discovery runs — otherwise the first acquisition wave structurally cannot produce evidence for the pillars the programme most needs it for.

## 6. Tier 2 — practitioner sources, and why they are not seeded yet

> "Once the institutional corpus has been exhausted, the IDE should expand to curated practitioner sources: Andreessen Horowitz (a16z) · First Round Review · Y Combinator Library · McKinsey Insights · Bain Insights · BCG Insights · Deloitte Insights · PwC Strategy · Accenture Research. **These are not primary scientific authorities**, but they provide a rich source of operational patterns that can be compared against the academic corpus."

All nine are declared in `COMMERCIALISATION_REGISTRY` at `tier: 'practitioner-pattern'`. **None is seeded into the database, and neither a URL nor a pillar is invented for any of them,** because the operator supplied neither. That produces three independent structural brakes, all of which follow from the data rather than from a reviewer remembering the rule:

1. **`source_tier` is a column** (migration `20260827000000`), so a SQL-level analysis can separate the tiers without reading prose. It is nullable with **no default**: an undeclared row is never counted as an authority.
2. **No URL** → `resolveCanonicalHomepage` returns `null` → Agent B/C cannot start from the entry at all.
3. **No pillar** → `upsertInstitutionEntry` refuses the row outright.

Which is precisely the operator's gate — *"once the institutional corpus has been exhausted"* — expressed as the shape of the data. The existing `confirmPillarSaturation` step (amendment §6.1) is the steward act that opens it.

### 6.1 The third tier — DISCIPLINES, which are not institutions

> "To avoid commercialisation becoming synonymous with 'startup advice', deliberately include adjacent disciplines: Organisation design · Behavioural economics · Network science · Platform economics · Complexity science · Diffusion of innovation · Service science · Operations management. Those perspectives often reveal structural invariants that are invisible within entrepreneurship literature alone."

**These cannot be Institutional Registry rows.** That table is keyed `(domain, pillar_key, institution_name)` and its `seed_url` drives Agent B's institution-targeted navigation. "Behavioural economics" has no homepage, issues nothing, and cannot be navigated to — registering it as an institution would break seed-URL resolution for a row that could never resolve, and would put a discipline in a list whose every other member is an issuer.

**Nor are they coverage pillars.** A pillar is what *constitutes* the domain (Law I, amendment §2.0). Behavioural economics does not constitute commercialisation; the fourteen §4 sub-domains do.

**They belong in the Constitutional Dependency Registry** — `corpus_dependency_registry`, the existing home for external domains that *constrain* the domain, each carrying its relationship edge because "the edge is the point". Law I leaves exactly two cases, and a discipline that *explains* commercialisation is the second one. This also means no new concept is invented for them: the model already had the right slot.

Sixteen entries: PRD-IDE-002 §7.3's ten, plus six of the operator's eight. **"Platform economics" is already `platform-economics` and "Operations management" is already `operations`** — reused, not duplicated.

| Dependency | Relationship | Source | Note |
|---|---|---|---|
| `financial-services` | compared against | PRD-IDE-002 §7.3 | Also an observed-in vertical; a comparison reference here, not a corpus |
| `economics` | explained by | PRD-IDE-002 §7.3 | |
| `operations` | explained by | PRD-IDE-002 §7.3 | Covers the direction's "Operations management" |
| `product-management` | compared against | PRD-IDE-002 §7.3 | |
| `organisational-behaviour` | explained by | PRD-IDE-002 §7.3 | Neighbours `organisation-design` |
| `systems-engineering` | explained by | PRD-IDE-002 §7.3 | |
| `service-design` | compared against | PRD-IDE-002 §7.3 | Neighbours `service-science` |
| `innovation-management` | compared against | PRD-IDE-002 §7.3 | Neighbours `diffusion-of-innovation` |
| `entrepreneurship` | compared against | PRD-IDE-002 §7.3 | |
| `platform-economics` | explained by | PRD-IDE-002 §7.3 | The direction's "Platform economics" — already registered |
| `organisation-design` | explained by | operator direction 2026-07-27 | Design vs behaviour — registered distinctly for a steward to rule on |
| `behavioural-economics` | explained by | operator direction 2026-07-27 | |
| `network-science` | explained by | operator direction 2026-07-27 | |
| `complexity-science` | explained by | operator direction 2026-07-27 | |
| `diffusion-of-innovation` | explained by | operator direction 2026-07-27 | Neighbours `innovation-management` |
| `service-science` | explained by | operator direction 2026-07-27 | Discipline vs practice — neighbours `service-design` |

**Three neighbouring-but-distinct pairs are registered separately, not merged.** Proposing both and letting a steward decide is the ratification model working correctly; silently merging them would be an agent settling a taxonomy question that is not its to settle.

**Scope discipline, inherited from amendment §2.3:** a dependency entry is a name and a relationship label. It records the edge. It does **not** trigger acquisition of that discipline's own corpus. The operator's stated purpose — keeping commercialisation from collapsing into startup advice — is served in Phase 3 by the tier-1 institutions whose Purpose spans these disciplines (Santa Fe Institute is operator-designated "complex adaptive systems, emergence"; INCOSE "systems engineering and organisational systems"), and by the `equivalent`/`specialized` classification pass PRD-IDE-002 §9.2 runs against them. **No claim is made here about what any of these institutions publishes** beyond the operator's own Purpose column.

**Recorded for ratification:** `services/invariants/discoveryDomains.ts`'s `COMMERCIALISATION.tangentialDomains` currently holds PRD-IDE-002 §7.3's ten, and is pinned to §7.3 as a docs mirror. It was **deliberately not edited** — extending it without PRD-IDE-002 saying so would create exactly the code/doc divergence the parity rule forbids. A canary instead asserts it is a subset of the sixteen above, so the two can never contradict each other. On ratification of these six additions, §7.3 and `tangentialDomains` should be extended together.

## 7. Law II of Constitutional Discovery — the constitutional acquisition rule

> **"Every IDE corpus shall contain multiple independent schools of thought and institutional traditions. No invariant family may rely upon a single institution, publisher, methodology, or ideological perspective."**

> "That is stronger than the Financial Services approach because it guards against **institutional bias as well as platform bias.**"

### 7.1 Where it belongs — the audit

| Candidate home | Verdict |
|---|---|
| **PRD-ICA-001 + its ratified Constitutional Discovery amendment** — the corpus-acquisition PRD, whose §2.0 already holds **Law I of Constitutional Discovery**, and whose §5 already holds the inclusion/exclusion policy this rule constrains | **RECOMMENDED.** The rule is a sibling of Law I in scope, in form, and in the artefact it governs. Its natural insertion points are amendment §2.0 (as Law II, immediately after Law I) and PRD-ICA-001 §5 (as an inclusion-policy clause) |
| A new CFS | **REJECTED.** Founding a specification for one clause that extends an existing law in an existing ratified document is the parallel-structure defect CCR-001 §25 forbids and CS-001 names as constitutional drift |
| CFS-052 (Evidence Architecture) | **REJECTED.** CFS-052 governs what kind of *evidence* an invariant rests on and who may canonise it. Law II governs the *composition of the corpus* upstream of that. Adjacent, not the same question |
| CFS-009 (the Laws) | **REJECTED for now.** CFS-009's Laws are platform-development constitution; Constitutional Discovery's Laws are corpus-acquisition constitution. Law I is not in CFS-009 either. Promotion is available later if the operator wants it |

**Recommendation: adopt as Law II of Constitutional Discovery, by amendment to PRD-ICA-001's ratified Constitutional Discovery amendment §2.0, with a companion clause in PRD-ICA-001 §5.** Both documents are ratified, so **the amendment is an operator act under Law XI** and is not performed here. The exact proposed text:

> **Law II of Constitutional Discovery** — Every IDE corpus shall contain multiple independent schools of thought and institutional traditions. No invariant family may rely upon a single institution, publisher, methodology, or ideological perspective.
>
> A pillar's institutional corpus is not saturated (§6.1) while its registry draws on fewer than two institutional authorities, or on authorities from a single institutional tradition.

### 7.2 How it is enforced — because a rule nothing can check is CFS-053's defect class

Three checks. **One is built and bound today**; two are specified and explicitly not built.

| # | Check | Where | Status |
|---|---|---|---|
| **1** | **Registry-time.** Per pillar: ≥2 `institutional-authority` sources drawn from ≥2 distinct `category` traditions. Three verdicts — `satisfied` / `unsatisfied` / `undeterminable` (the last when a registered authority declares no tradition, so the rule cannot be *verified*, only assumed) | `assessRegistryDiversity()` in `services/corpusScout/institutionalRegistry.ts`, **called by `getDomainConstitution()`** and returned on `GET /api/corpus-scout/domain-constitution` as `constitution.diversity` | **BUILT AND BOUND.** Fires on every steward load of the domain constitution |
| **2** | **Ratification-time.** `confirmPillarSaturation` refuses while a pillar's verdict is not `satisfied` — the gate before the gate, made mechanical | `confirmPillarSaturation` in `domainConstitution.ts` | **PROPOSED, NOT BUILT.** It changes the behaviour of a ratified Phase-2 function; an operator decision, not an agent's |
| **3** | **Corpus-time.** Per pillar, over approved candidates: no single `corpus_candidate_sources.issuer` may supply the whole of a pillar's approved corpus, and no invariant candidate may cite evidence from a single issuer. `issuer` already exists on `CandidateSourceRow`; the natural home is `assessLaneCoverage()`, which already takes `requiredLanes` | `services/corpusScout/intelligence.ts` | **PROPOSED, NOT BUILT.** Cannot run until a corpus exists (Phase 3+) |

Check 1 fires today, and its first output is informative rather than decorative: **7 of the 14 commercialisation pillars are `unsatisfied`** (the five with no institution, plus `partnerships` and `outcome-assurance`, which have exactly one authority each), and **every Financial Services pillar is `undeterminable`** because that registry records no traditions. A rule whose first run reports compliance everywhere would be the CFS-053 defect — a mechanism that cannot fail is indistinguishable from one that does not exist.

## 8. The operator's runnable path

### Phase 2 — ratification (the next act, and it is a steward's)

**Step 1 — seed the registry.** Paste the whole of `supabase/migrations/20260827000000_commercialisation_institutional_registry.sql` into the Supabase SQL editor. It is additive and idempotent (`ADD COLUMN IF NOT EXISTS` / `ON CONFLICT DO NOTHING`); re-running changes nothing and un-ratifies nothing. To print it for pasting:

```bash
git fetch iqp dev && git checkout iqp/dev -- supabase/migrations/20260827000000_commercialisation_institutional_registry.sql && cat supabase/migrations/20260827000000_commercialisation_institutional_registry.sql
```

It creates, all as `proposed`: the `source_tier` column (+ CHECK, + backfill of the existing FS rows), 1 Domain Definition, 14 Coverage Pillars, 16 Dependency entries, 28 Institutional Registry rows.

**Step 2 — review and ratify, in this order** (the service refuses out-of-order work: an institution cannot attach to a pillar that does not exist, and a pillar's saturation cannot be confirmed before it is ratified). All calls are `POST /api/corpus-scout/domain-constitution`, admin-gated, `domain: "commercialisation"`, from the Corpus Scout tab's Domain Constitution panel or directly:

```
GET  /api/corpus-scout/domain-constitution?domain=commercialisation     ← read it all, incl. `diversity`
POST { action: "ratify-definition",  domain: "commercialisation" }
POST { action: "ratify-pillar",      domain: "commercialisation", pillarKey: "<each of the 14>" }
POST { action: "ratify-dependency",  domain: "commercialisation", dependencyName: "<each of the 16>" }
POST { action: "ratify-institution", domain: "commercialisation", pillarKey: "<pillar>", institutionName: "<institution>" }
```

Before ratifying the institutions, **rule on the two open questions §4 and §5 raise**: the agent-proposed pillar mapping (correct any of the 28), and the five pillars with no institution (supply institutions, or accept the gap and record it).

### Phase 3 — acquisition (only after Phase 2, and only on the deployed app)

```
POST /api/corpus-scout/institution-discovery/domain   { domain: "commercialisation" }
   → runs Agent B/C for EVERY ratified institution in the domain
POST /api/corpus-scout/institution-discovery          { domain, pillarKey, institutionName }
   → one institution at a time
```

Every candidate lands `pending_review` (or `needs_retrieval_fix`). Discovery finds candidates; it never approves them. A steward reviews each through `POST /api/corpus-scout/candidates/[sourceId]/review`, exactly as for a manually submitted URL. **This is where the operator-supplied URLs are first verified** — a dead entry surfaces as an honest retrieval failure.

### Phase 4 — IDE discovery

Approved sources hand off through the Ingestion Broker to `POST /api/invariants/discovery` `add-evidence`, with `domain = commercialisation/<observed vertical>` and `subDomain = <§4 pillar key>` (PRD-IDE-002 §7.6). Then `extract` → `compare` → `compress-domain` → `promote`. Promotion lands `proposed`, never canonical.

### Phase 5 — comparison

`compareSubDomains` against the §6.1 dependency registry, per PRD-IDE-002 §9.2. Recurrence is derived, never stored.

**Gate between 3 and 4:** `confirmPillarSaturation` per pillar, plus Gap Detection. Open Discovery (general search) unlocks only after **both**, per pillar — never globally.

## 9. What this document deliberately did NOT do

- **No acquisition.** Nothing was fetched. No URL was verified, no institution's publications were inspected, no claim is made anywhere about what any source contains.
- **No ratification.** Every row lands `proposed`. Not one `ratify-*` call was made.
- **No invented URL, institution, or fact.** The operator's second tier has no URLs because none was supplied. Five pillars have no institution because no basis was supplied. `commercial-failure-modes` was left empty even though the Santa Fe Institute could plausibly have been mapped to it — plausibly is not a basis.
- **No amendment to a ratified document.** Law II is recommended for PRD-ICA-001's amendment §2.0 (§7.1) with the exact text supplied. Amending is an operator act under Law XI.
- **No edit to `services/invariants/discoveryDomains.ts`.** Its `tangentialDomains` is a docs mirror of PRD-IDE-002 §7.3; a canary pins the relationship instead (§6.1).
- **No new pillar.** Every institution maps to one of PRD-IDE-002 §7.2's fourteen, or to none.
- **Checks 2 and 3 of §7.2 are not built** — one changes a ratified function's behaviour, one cannot run before a corpus exists. Both are specified precisely enough to build without re-deriving them.

## 10. Enforcement

`tests/commercialisation-institutional-registry.test.ts` — indexed in `tests/source-of-truth-parity.test.ts`.

| Canary | Guards |
|---|---|
| Every registered institution maps to a real PRD-IDE-002 §4 coverage pillar | The `upsertInstitutionEntry` prerequisite — an institution on a nonexistent pillar is un-insertable |
| Tier 1 and tier 2 cannot be conflated: no practitioner entry carries a pillar or resolves to a URL, and `assessRegistryDiversity` never counts one as an authority | §6 — the structural tier boundary |
| The disciplines are in the Dependency Registry, and none of them is an institution or a pillar | §6.1 |
| `tangentialDomains` ⊆ the dependency registry | §6.1 — code and doc can never contradict |
| The template is shared, not forked: FS and Commercialisation are the same type through the same functions; the FS entries match the `20260817000000` seed SQL set-for-set | §3.1, `inv.engineering.036/037` |
| No FS entry carries an invented category/authority/evidence type | §3.1 — nulls are the honest value |
| The fifteen tier-1 URLs are exactly the operator's, and resolution never falls back | §4, CLAUDE.md zero-tolerance |
| `assessRegistryDiversity` actually fails: one authority ⇒ `unsatisfied`; two from one tradition ⇒ `unsatisfied`; an unclassified authority ⇒ `undeterminable`; an undeclared tier is never counted | §7.2 check 1 — CFS-053 CB-5 |
| The check is BOUND: `getDomainConstitution` calls it and returns it | §7.2 — CFS-053 CB-1/CB-6 |
| Law II's text is verbatim in code and in this document | §7 |
| Acquisition priority is derived from PRD-IDE-002 §11.2, and §11.2's order is unchanged | §3 |
| The migration seeds `proposed`, never `ratified` | §8 — Phase 1 does not ratify |
| This document is registered in `codexes/packs/irl/collections.json` | reachability |

---

## Ratification record

- [ ] **Operator ratification of this registry as a whole.** Nothing here is ratified by being written.
- [ ] **Operator ruling on the agent-proposed pillar mapping** (§4) — 28 rows, correctable individually.
- [ ] **Operator ruling on the five uncovered pillars** (§5) — supply institutions, or accept and record the gap. `commercial-failure-modes` and `trust-formation` are the consequential ones.
- [ ] **Operator ruling on Law II** (§7.1) — adopt as Law II of Constitutional Discovery by amendment to PRD-ICA-001's Constitutional Discovery amendment §2.0 + PRD-ICA-001 §5.
- [ ] **Operator ruling on §7.2 checks 2 and 3** — whether `confirmPillarSaturation` should refuse on an unsatisfied verdict, and whether issuer-concentration lands in `assessLaneCoverage`.
- [ ] **Operator ruling on the three neighbouring dependency pairs** (§6.1) — merge or keep.
- [ ] **Run the migration** `supabase/migrations/20260827000000_commercialisation_institutional_registry.sql` (§8 step 1).
- [ ] **Phase 2 ratification pass** (§8 step 2) — a steward act.
- [ ] **Phase 3 acquisition** — only after Phase 2, only on the deployed app.
