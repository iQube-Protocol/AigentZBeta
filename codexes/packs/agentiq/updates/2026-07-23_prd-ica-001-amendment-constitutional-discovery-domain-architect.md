# PRD-ICA-001 Amendment — Constitutional Discovery (Coverage-Model-Driven Acquisition + Domain Architect Agent)

**Status: DESIGN — docs-first, ratify-before-build.** Amends `PRD-ICA-001_invariant-corpus-acquisition-agent.md` (RATIFIED 2026-07-22), specifically §5 (source-planning), §7 (discovery priority order), §10 (agent architecture), §12 (readiness metrics). Does not touch the already-built back half (retrieval, inspection, provenance, deduplication, review workspace, `add-evidence` handoff) at all — this is entirely a front-half amendment.

**Origin:** operator design note, 2026-07-23 — a direct answer to "where is the automation of Corpus Scout?" The proposal reframes discovery itself as constitutional (obligation-driven) rather than search-driven (popularity/relevance-driven), and inserts a new agent — the **Domain Architect** — ahead of the existing Agent A. A second round of operator refinement (same day) sharpened the terminology and named what this amendment actually is: not a document-discovery pipeline, but **constitutional epistemology** — knowledge acquired by satisfying constitutional obligations before exploring statistical possibility.

---

## §0 Read this first — reconciliation against what's already specified and built

PRD-ICA-001 already leans institution-first in spirit — §7's discovery priority order ranks "(1) official issuing institution... (6) secondary source only when the original is unavailable," and §5's source-planning stage already calls for "target source types, likely primary institutions" before searching. This amendment does not contradict PRD-ICA-001; it makes that spirit **structural and mandatory** instead of narrative guidance, and names the piece that was missing to make "coverage" a real, checkable thing rather than an aspiration.

**What already exists in the built code that this connects to directly:**

| Concept this amendment needs | Already exists as | Where |
|---|---|---|
| "Lane" | `campaignSubDomain` (free-text, e.g. `actuarial-science`, `failure-studies`) | `services/corpusScout/types.ts`, `CorpusScoutTab.tsx`'s submission form |
| Lane coverage display | `assessLaneCoverage()` — tallies `total/pending/approved/closed` **per lane already present in submitted candidates** | `services/corpusScout/intelligence.ts:86-104` |
| Acquisition-method provenance | `acquisitionMethod` field, already named in PRD-ICA-001 §8's per-artifact provenance record | PRD-ICA-001 §8 (not yet populated by any code — no automated acquisition exists yet to populate it) |
| Human review of anything the agent proposes | The entire reviewer-action model (approve/reject/mark-duplicate, provenance class required on approval) | `CorpusScoutTab.tsx`, `app/api/corpus-scout/candidates/[sourceId]/review/route.ts` |

**The one load-bearing gap `assessLaneCoverage()` has today:** it only knows what lanes exist because a candidate was already submitted into them. It has no concept of a *required* lane list, so it can describe the corpus but can't say what's *missing*. That's exactly Gap Detection's job (§6 below), and it's an additive parameter on an existing function, not a new subsystem.

**What's genuinely new here (updated after the second refinement pass):**
1. A **Domain Definition** — a plain, ratified statement of what the domain *is*, so "does this belong?" has an answer to appeal to.
2. A **Constitutional Coverage Model** — an explicit, ratified, per-domain list of required internal pillars (not a freeform string a submitter happens to type, and not just "coverage" in the generic search/dataset sense — see §2's naming rationale).
3. A **Constitutional Dependency Registry** — external domains that govern, measure, or constrain this one without being part of it (renamed from "Adjacent Domain Registry" — see §2.3's naming rationale).
4. **Law I of Constitutional Discovery** — the formalized discriminator between the two: everything either *constitutes* the domain or *constrains* it.
5. An **Institutional Registry** — a structured, per-pillar list of authoritative institutions, itself human-reviewed.
6. **Gap Detection** as a hard gate ("is every pillar satisfied?"), not just a descriptive metric — plus an explicit **steward saturation confirmation** step, distinct from the algorithmic gate (§6.1).
7. **Open (general-search) discovery demoted to a last-resort, per-pillar gap-filler**, gated behind BOTH algorithmic completeness and steward-confirmed saturation — never primary acquisition.
8. A new **Agent 0, Domain Architect**, ahead of PRD-ICA-001 §10's existing Agent A.

---

## §1 Constitutional epistemology, not document discovery

The Discovery Engine is trying to answer *"what is the canonical body of knowledge for this domain?"* — a completeness question. A search engine answers *"what's relevant/popular for this query?"* — a ranking question. Those produce different corpora even when they overlap heavily. A coverage-obligation-driven acquisition process is auditable and repeatable in a way a query-driven one structurally cannot be: two runs of the same coverage model against the same institutional registry converge on the same gaps; two runs of the same keyword search do not.

Most AI knowledge-acquisition systems, implicitly or explicitly, run:

```
Search → Knowledge
```

This architecture runs a different shape entirely:

```
Constitutional obligations → Canonical institutions → Evidence → Knowledge
```

That's not a stronger search algorithm — it's a different epistemology. **Knowledge is acquired by satisfying constitutional obligations before exploring statistical possibility.** This is the same discipline already governing this codebase's invariant-reasoning work — reasoning constrained by structure outperforms reasoning constrained by search recall — applied one layer earlier: not just constraining *how the system reasons*, but constraining *how it acquires the knowledge it will reason over*.

### §1.1 The architectural claim — a constitutional graph of domains, not just corpora

This is the single most important structural claim in this amendment, so it's stated on its own rather than buried under an illustrative example: **the Discovery Engine doesn't just build corpora — it builds a constitutional graph of domains.** Each domain is internally complete via its own Constitutional Coverage Model (§2.2); the Constitutional Dependency Registry (§2.3) captures the edges *between* domains. When invariant compression eventually runs across multiple domain crystals, those edges are what let the system ask *"does this invariant propagate, or is it owned by one domain?"* — a question a flat, ungoverned lane list has no way to represent.

This generalizes past financial services: every future domain — medicine, energy, aerospace, constitutional computing — gets a Domain Definition, an internal Constitutional Coverage Model, and an explicit graph of what constitutionally depends on or governs it from outside. The full pipeline, updated to reflect this:

```
Domain
  ↓
Domain Definition
  ↓
Constitutional Coverage Model
  ↓
Constitutional Dependency Registry
  ↓
Institution Registry
  ↓
Canonical Sources
  ↓
Evidence
  ↓
Invariant Discovery
```

Everything from "Evidence" onward is the already-built back half (retrieval → inspection → provenance → review → `add-evidence` → the existing Discovery Engine Stages 1–5). Everything above it is new, specified below.

## §2 Agent 0 — Domain Architect (new, precedes Agent A)

**Question it answers:** *what does completeness mean for this domain?* But that question is itself downstream of a prior one — *what is this domain?* — which is why Agent 0 now produces **three** outputs, not two.

### §2.0 Law I of Constitutional Discovery

Formalizing the distinguishing test from the first refinement pass, because it's this clean:

> **Law I of Constitutional Discovery** — Every lane, for every domain, either **constitutes** the domain or **constrains** it. There is no third case.

This is the discriminator Agent 0 applies when deciding whether a candidate lane belongs in the Constitutional Coverage Model (§2.2) or the Constitutional Dependency Registry (§2.3). Insurance has its own regulators (NAIC, PRA, EIOPA, state insurance commissioners), its own international standard-setter (IAIS), its own solvency frameworks and actuarial science — it **constitutes** financial services. Contract Law and Accounting do not constitute financial services; they **constrain** it — Accounting *measures* it, Identity *identifies through* it — and their invariants likely turn out to be shared across many domains, not owned by this one.

### §2.1 Domain Definition (new artifact)

Before asking "what does completeness mean," the system has to answer "what is this domain?" — otherwise stewards can argue indefinitely about whether a candidate lane belongs. The Domain Definition is a short, ratified, plain-language statement that the Constitutional Coverage Model is then constrained by. Illustrative first instance:

> **Domain:** Financial Services
> **Purpose:** The systems governing the creation, movement, management, measurement, transfer, protection, and regulation of financial value.

Everything in §2.2 has to trace back to this sentence; everything that doesn't trace back to it, but still bears on it, is a candidate for §2.3 under Law I.

### §2.2 Constitutional Coverage Model (renamed from "Domain Coverage Model")

**Naming note:** "Coverage Model" alone is ambiguous — it could mean search coverage, document coverage, or dataset coverage. "Constitutional Coverage Model" states plainly that this defines the *obligations that constitute a domain*, not a corpus-size target. Internal pillars, financial services (illustrative):

| Pillar | Completeness definition (illustrative) |
|---|---|
| Banking | Core prudential/banking-regulation text per named jurisdiction in scope |
| Payments | Governing payment-systems rules and settlement-finality frameworks |
| Capital Markets | Securities-issuance and trading-conduct regulation |
| Asset Management | Fund-governance and fiduciary-duty frameworks |
| Digital Assets | Named jurisdictions' digital-asset/crypto-asset regulatory frameworks |
| Financial Crime / AML | AML/CFT recommendations and enforcement frameworks |
| Insurance | Solvency frameworks, actuarial standards, IAIS recommendations |
| Financial Infrastructure | Market-infrastructure and systemic-risk oversight frameworks |

### §2.3 Constitutional Dependency Registry (renamed from "Adjacent Domain Registry")

**Naming note:** "Adjacent" implies a spatial relationship — neighboring domains that happen to sit nearby. The actual relationship is constitutional, not spatial: Accounting *measures* financial services; Identity *identifies through* it. Those are dependencies, not neighbors — a distinction that matters most once other domains exist and need to name their own dependencies on, say, Identity or Law, which aren't "adjacent" to medicine or aerospace in any spatial sense either. Each entry names the relationship, not just the domain — the edge is the point:

| Constitutional dependency | Relationship to Financial Services |
|---|---|
| Contract Law | governed by |
| Corporate Law | governed by |
| Accounting & Audit | measured by |
| Taxation | constrained by |
| Identity & Personhood | identifies through |
| Cybersecurity | secured by |
| Privacy & Data Protection | constrained by |
| Consumer Protection | supervised by |

**Scope discipline for this pass:** a Constitutional Dependency Registry entry is lightweight — a name and a relationship label, recording the *edge*, not triggering full acquisition of that dependency's own corpus. Each dependency gets its own full Constitutional Coverage Model only when/if its own domain-crystal build begins — at which point it reuses this exact same apparatus (Agent 0 → A → B → C → Gap Detection), per PRD-ICA-001 §16's "reusable acquisition front end for every future domain crystal" principle. This pass does not acquire Contract Law or Accounting source material; it only records that the dependency exists.

**Not auto-finalized.** Agent 0 *proposes* all three outputs (Domain Definition, Constitutional Coverage Model, Constitutional Dependency Registry); a steward reviews and ratifies them before Source Planning proceeds — mirroring PRD-ICA-001's existing human-approval ethos (§9/§11) rather than introducing a new "auto-decide" path.

## §3 Agent A — Source Planner, reframed (not replaced)

PRD-ICA-001 §5 already assigns this agent "target source types, likely primary institutions" — this amendment gives it a *required* input to work from (the ratified Constitutional Coverage Model) instead of a floating brief, and a concrete output: an **Institutional Registry** — the per-pillar authority list, keyed against §2.2's internal pillars (not a separate lane taxonomy). Illustrative first instance:

| Pillar (from §2.2) | Authorities |
|---|---|
| Banking | BIS, national/regional banking supervisors (e.g. FCA, ECB) |
| Payments | FATF, BIS Committee on Payments and Market Infrastructures |
| Capital Markets | SEC, ESMA |
| Digital Assets | MiCA (EU framework), FinCEN |
| Financial Crime / AML | FATF, FinCEN, CFTC |
| Insurance | IAIS, NAIC, PRA, EIOPA |
| Financial Infrastructure | IMF, World Bank, BIS |
| Cross-cutting standards | ISO, NIST, W3C (where a pillar's frameworks reference open technical standards) |

Like the Constitutional Coverage Model, the Institutional Registry is steward-editable — the agent proposes, a human curates which institutions count as authoritative for a given pillar. This is a judgment call the same way PRD-ICA-001 §11 already treats "MAY NOT... approve its own sources."

## §4 Agent B — Discovery Agent, reframed

**Primary mode changes from open keyword search to institution-targeted navigation**: given a known Institutional Registry entry (e.g. FATF), locate that institution's own publication/recommendations listing. This is a narrow, bounded, explainable task — closer to "find FATF's Recommendations page" than "search the web for AML rules" — and is exactly the kind of task PRD-ICA-001 §0.4 already flagged `services/aa-api/src/browser/*` for evaluation against, now with a much better-scoped job description than the original open-search framing gave it.

## §5 Agent C — Resolver Agent (unchanged in concept — already specified, §7)

Recursive traversal from an institution's page → publication page → download link → redirect → final artifact, exactly as PRD-ICA-001 §7 already describes. Resolved artifacts feed the **already-built back half** unchanged — the same retrieval → inspection → provenance → review → `add-evidence` pipeline `CorpusScoutTab.tsx` already runs today for a manually-submitted URL. No new ingestion mechanism.

## §6 Gap Detection — new hard gate, extends an existing function

Compares the Constitutional Coverage Model's required pillars against what's actually **resolved and approved** per pillar. Implemented as an additive extension to the already-built `assessLaneCoverage()` (`services/corpusScout/intelligence.ts`): add an optional `requiredLanes` parameter so the function can report not just "here's what exists" (today's behavior, unchanged for callers that don't pass it) but "here's what's still missing" against a ratified Constitutional Coverage Model. Surfaces in `CorpusScoutTab.tsx`'s existing "Source-lane coverage" table — an added "required, not yet satisfied" row/callout, not a new UI.

This is an **algorithmic** check — it can only ever confirm "at least one approved source exists per pillar." It cannot judge whether the *institutional* corpus for a pillar is actually exhausted. That's a distinct, human question — §6.1.

### §6.1 Steward saturation confirmation (new, second refinement pass) — the gate before the gate

"Complete" (§6, algorithmic — every pillar has at least one approved source) and "saturated" (has the Institutional Registry for this pillar actually been exhausted?) are different questions — the first is countable, the second is scientific judgment. Inserting an explicit step between them:

```
Gap Detection reports "complete"  (algorithmic)
        ↓
Steward explicitly confirms: "the institutional corpus for this pillar is saturated"  (scientific judgment)
        ↓
Open Discovery unlocks for that pillar
```

Concretely: a per-pillar "Confirm saturation" action in the review workspace (a boolean + steward id + timestamp, recorded alongside the existing lane-coverage data — no new subsystem), separate from `reviewWorkflowStatus`. **Open Discovery never unlocks from Gap Detection alone; it requires this explicit steward action too.** Never inferred from a threshold or a count.

## §7 Open Discovery — demoted to a last-resort, per-pillar gap-filler

Once a pillar clears BOTH Gap Detection (§6) and steward saturation confirmation (§6.1), general search (a search API, or a human pasting a found URL — either is fine here, this is explicitly the low-stakes path) becomes available **for that pillar specifically** — never as a global "search this domain" action. Every candidate acquired this way is tagged via PRD-ICA-001 §8's already-named `acquisitionMethod` field (e.g. `institutional-registry` vs. `open-discovery-gap-fill`), so the review workspace and any future audit can always see which acquisition path produced which evidence. Because this path is now explicitly scoped, clearly labeled, and only reachable after a human has confirmed the institutional corpus is exhausted, a general-purpose search API is an acceptable choice for it — the earlier open question ("what search backend?") is resolved by this reframing: don't build search-based *primary* acquisition at all; build institution-first; add search only as a small, clearly-tagged, doubly-gated last resort, later.

## §8 Non-goals for this pass

- No crawler/automation code ships in this pass — this is still design-only, ratify-before-build, matching PRD-ICA-001's own discipline.
- No change to the already-built back half (retrieval/inspection/provenance/dedup/review/ingestion) — it's reused as-is by Agent C's output.
- No decision yet on the exact browser-automation mechanism for Agent B/C (`services/aa-api/src/browser/*` reuse vs. something dedicated) — still flagged per PRD-ICA-001 §0.4, now with a narrower task to evaluate it against.
- No general search-API selection yet — deferred to §7's gap-filler phase, which is explicitly last, not first.
- No automatic saturation inference (§6.1) — always an explicit steward action, never a threshold or count triggering it silently.

## §9 Implementation phases (mirrors PRD-ICA-001 §14's own phasing style)

1. **Domain Definition + Constitutional Coverage Model + Constitutional Dependency Registry + Institutional Registry** — data model + steward review/ratify UI (reusing `CorpusScoutTab`'s existing review-panel pattern), no crawling yet. Financial services as the first ratified instance, per §2.1/§2.2/§2.3/§3's tables above.
2. **Gap Detection + steward saturation confirmation** — extend `assessLaneCoverage()` with the `requiredLanes` parameter; surface missing coverage in the existing lane-coverage table; add the per-pillar "Confirm saturation" steward action (§6.1).
3. **Agent B/C automation** — institution-targeted discovery + recursive resolution (the actual crawler), evaluating `services/aa-api/src/browser/*` reuse first, per §0.4.
4. **Open Discovery gap-filler** — gated behind BOTH Phase 2 signals (algorithmic completeness AND steward saturation confirmation), per-pillar scoped, tagged via `acquisitionMethod`.

Build proceeds phase by phase after ratification, same discipline as every other increment this session.

---

## Ratification record

**Status: RATIFIED 2026-07-23** — operator gave full go-ahead on all seven points plus explicit "Implementation Direction: Proceed to Phase 1" (see below).

- [x] Operator confirms Agent 0 (Domain Architect) producing THREE outputs — Domain Definition (§2.1), Constitutional Coverage Model (§2.2), Constitutional Dependency Registry (§2.3) — all steward-ratified, not auto-finalized.
- [x] Operator confirms Law I of Constitutional Discovery (§2.0) as the formal discriminator between the two, and the renamed terminology throughout (Constitutional Coverage Model, Constitutional Dependency Registry).
- [x] Operator confirms §1.1's architectural claim (constitutional graph of domains) as the central structural principle of this amendment.
- [x] Operator confirms the reframed Agent A (Institutional Registry keyed to §2.2's pillars, steward-editable) and Agent B (institution-targeted navigation as primary mode, not open search).
- [x] Operator confirms Gap Detection (§6, algorithmic) AND the separate steward saturation confirmation (§6.1, judgment) as the two-step gate before Open Discovery unlocks.
- [x] Operator confirms the illustrative financial-services tables (§2.1/§2.2/§2.3/§3) as the first instance, and the §9 phasing.

**Implementation direction (operator, 2026-07-23):** proceed to Phase 1. Objective is establishing the constitutional substrate, not crawling. Deliverables: Domain Definition data model, Constitutional Coverage Model data model, Constitutional Dependency Registry data model, steward ratification workflow, Gap Detection extensions, Institutional Registry generation from the Coverage Model. No acquisition or browser automation in this phase. Standing implementation principle: reasoning should never compensate for missing constitutional structure — constitutional structure precedes automation. Sequence: Define → Ratify → Discover → Verify → Reason.

**Phase 1 build:** `supabase/migrations/20260817000000_corpus_domain_constitution.sql` (4 tables + ratified financial-services seed), `services/corpusScout/types.ts` (+ratification row types), `services/corpusScout/domainConstitution.ts` (propose/ratify CRUD for all four artifacts), `services/corpusScout/intelligence.ts` (`assessLaneCoverage()` `requiredLanes` extension — Gap Detection), `app/api/corpus-scout/domain-constitution/route.ts` (admin-gated GET + 8-action POST), `components/corpusScout/DomainConstitutionPanel.tsx` (steward ratification UI), `CorpusScoutTab.tsx` wiring (panel mounted above the submission form; lane-coverage table now flags ratified pillars with zero sources as constitutional gaps).

**Phase 2 build — §6.1 steward saturation confirmation:** `supabase/migrations/20260817100000_corpus_coverage_pillar_saturation.sql` (adds `saturation_confirmed`/`saturation_confirmed_by`/`saturation_confirmed_at` to `corpus_coverage_pillars` — no new table, per the amendment's own "no new subsystem" instruction), `domainConstitution.ts::confirmPillarSaturation()` (refuses on an unratified pillar; records the steward's own persona id), `app/api/corpus-scout/domain-constitution/route.ts`'s `confirm-saturation` action, `DomainConstitutionPanel.tsx` (each ratified pillar now shows Gap Detection context — approved/submitted counts via the new `laneCoverageByPillar` prop — alongside a "Confirm saturation" action, distinct from and required in addition to Gap Detection).

**Phase 3 build (this pass) — Agent B (institution-targeted navigation) + bounded Agent C (recursive resolution):** evaluated `services/aa-api/src/browser/*` per §0.4 and concluded against reuse — that module is interactive session/mount/takeover machinery for user-facing live browsing, not a bounded backend HTML-link walk. Built a dedicated lightweight path instead:

- `supabase/migrations/20260817200000_corpus_institution_seed_url.sql` — adds `seed_url` to `corpus_institutional_registry` (steward-provided starting point; Agent B never falls back to search when it's missing, per Law I's institution-first philosophy)
- `retrieval.ts` refactored to extract a shared `followRedirects()` helper (Extend, Don't Duplicate — one redirect-following mechanic, two consumers)
- `institutionNavigator.ts` (new) — Agent B + a BOUNDED two-level Agent C walk: fetch the institution's seed URL, collect direct document links, follow up to 5 publication-listing-looking links one level deep, collect document links there too. Hard caps throughout (max pages fetched, max candidates, max links parsed per page) — narrow, bounded, explainable, never an open-ended crawler. Never throws.
- `provenance.ts`'s `createCandidateSource()` gains optional `acquisitionMethod`/`discoveryUrl` — Agent B/C candidates tag `institutional-registry` (vs. the existing `direct-url` default) and record the true discovery path on `resolutionChain.discoveryUrl`, through the SAME back half a manual submission uses (no second ingestion mechanism)
- `app/api/corpus-scout/institution-discovery/route.ts` (new) — admin-gated; refuses to run without a ratified institution + seed URL
- `DomainConstitutionPanel.tsx` — each ratified institution with a seed URL gets a "Run discovery" action; results (submitted count, pages fetched) show inline; `onDiscoveryComplete` refreshes the parent's candidate list

Every discovered candidate still lands as `pending_review` (or `needs_retrieval_fix`) — discovery finds candidates, it never auto-approves. The Open Discovery gap-filler (§9 phase 4, gated behind Gap Detection AND steward saturation confirmation) remains out of scope.

**Phase 3 refinement (same day) — zero manual URL entry for a chartered domain:** operator feedback was direct: a steward should never have to go find a URL for an already-ratified domain like financial-services — that's the agent's job, not theirs. `services/corpusScout/canonicalInstitutionHomepages.ts` (new) is a curated, static institution-name -> homepage lookup for the seeded financial-services institutions (BIS, FATF, SEC, ECB, IAIS, NAIC, PRA, EIOPA, IMF, World Bank, etc.) — a directory lookup, not a search step, consistent with Law I. `upsertInstitutionEntry` auto-resolves a missing `seedUrl` from it at propose time; `getDomainConstitution` opportunistically backfills any still-missing ratified institution's `seedUrl` on every load (persisting the result) so the panel shows fully populated the moment a steward opens it — no click required first. `services/corpusScout/discoveryOrchestrator.ts` (new) adds `runDiscoveryForDomain`, exposed via `POST /api/corpus-scout/institution-discovery/domain` and a "Run discovery — entire domain" button in `DomainConstitutionPanel.tsx`: one click runs Agent B/C across every ratified institution in the domain, sequentially, and submits every resolved candidate for review. `CorpusScoutTab.tsx`'s campaign-domain field is now a dropdown defaulting to `financial-services` (the one ratified domain today) with a "Custom…" escape hatch for a not-yet-chartered domain (medicine, media, etc.) where manual entry is still expected and appropriate.
