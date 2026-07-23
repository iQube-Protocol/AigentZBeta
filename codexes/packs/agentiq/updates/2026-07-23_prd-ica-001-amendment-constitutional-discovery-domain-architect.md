# PRD-ICA-001 Amendment — Constitutional Discovery (Coverage-Model-Driven Acquisition + Domain Architect Agent)

**Status: DESIGN — docs-first, ratify-before-build.** Amends `PRD-ICA-001_invariant-corpus-acquisition-agent.md` (RATIFIED 2026-07-22), specifically §5 (source-planning), §7 (discovery priority order), §10 (agent architecture), §12 (readiness metrics). Does not touch the already-built back half (retrieval, inspection, provenance, deduplication, review workspace, `add-evidence` handoff) at all — this is entirely a front-half amendment.

**Origin:** operator design note, 2026-07-23 — a direct answer to "where is the automation of Corpus Scout?" The proposal reframes discovery itself as constitutional (coverage-obligation-driven) rather than search-driven (popularity/relevance-driven), and inserts a new agent — the **Domain Architect** — ahead of the existing Agent A.

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

**What's genuinely new here:**
1. A **Domain Coverage Model** — an explicit, ratified, per-domain list of required coverage lanes (not a freeform string a submitter happens to type).
2. An **Institutional Registry** — a structured, per-lane list of authoritative institutions, itself human-reviewed.
3. **Gap Detection** as a hard gate ("is every lane satisfied?"), not just a descriptive metric.
4. **Open (general-search) discovery demoted to a last-resort, per-lane gap-filler**, explicitly gated behind coverage saturation — never primary acquisition.
5. A new **Agent 0, Domain Architect**, ahead of PRD-ICA-001 §10's existing Agent A.

---

## §1 Why coverage-first, not search-first

Restated precisely because it's the load-bearing idea: the Discovery Engine is trying to answer *"what is the canonical body of knowledge for this domain?"* — a completeness question. A search engine answers *"what's relevant/popular for this query?"* — a ranking question. Those produce different corpora even when they overlap heavily. A coverage-obligation-driven acquisition process is auditable and repeatable in a way a query-driven one structurally cannot be: two runs of the same coverage model against the same institutional registry converge on the same gaps; two runs of the same keyword search do not.

This is the same discipline already governing this codebase's invariant work — reasoning constrained by structure outperforms reasoning constrained by search recall — applied one layer downstream, to what gets *fed into* that reasoning in the first place.

## §2 Agent 0 — Domain Architect (new, precedes Agent A)

**Question it answers:** *what does completeness mean for this domain?* Nothing downstream can define "gap" until this exists.

**Amended 2026-07-23 (operator refinement): Agent 0 produces TWO outputs, not one** — a **Domain Coverage Model** (what's internal to the domain) and an **Adjacent Domain Registry** (what constitutionally governs, measures, or constrains the domain without being part of it). Collapsing these into one flat lane list — the original draft of this section — was the defect: it would have made the Financial Services corpus permanently incomplete-by-construction for its own internal pillars, while conflating genuinely external governing bodies (Contract Law, Accounting) with the domain itself.

**The distinguishing test:** is this lane *constituted by* the domain, or does it *govern/support* the domain from outside? Insurance has its own regulators (NAIC, PRA, EIOPA, state insurance commissioners), its own international standard-setter (IAIS), its own solvency frameworks and actuarial science — it **is** financial services, not adjacent to it. Contract Law and Accounting do not constitute financial services; they govern and measure it, and their invariants likely turn out to be shared across many domains, not owned by this one.

### §2.1 Domain Coverage Model — internal pillars (financial services, illustrative)

| Lane | Completeness definition (illustrative) |
|---|---|
| Banking | Core prudential/banking-regulation text per named jurisdiction in scope |
| Payments | Governing payment-systems rules and settlement-finality frameworks |
| Capital Markets | Securities-issuance and trading-conduct regulation |
| Asset Management | Fund-governance and fiduciary-duty frameworks |
| Digital Assets | Named jurisdictions' digital-asset/crypto-asset regulatory frameworks |
| Financial Crime / AML | AML/CFT recommendations and enforcement frameworks |
| Insurance | Solvency frameworks, actuarial standards, IAIS recommendations |
| Financial Infrastructure | Market-infrastructure and systemic-risk oversight frameworks |

### §2.2 Adjacent Domain Registry — external constitutional dependencies (illustrative)

Each entry names the relationship, not just the domain — the edge is the point:

| Adjacent domain | Relationship to Financial Services |
|---|---|
| Contract Law | governed by |
| Corporate Law | governed by |
| Accounting & Audit | measured by |
| Taxation | constrained by |
| Identity & Personhood | identifies through |
| Cybersecurity | secured by |
| Privacy & Data Protection | constrained by |
| Consumer Protection | supervised by |

**Scope discipline for this pass:** an Adjacent Domain Registry entry is lightweight — a name and a relationship label, recording the *edge*, not triggering full acquisition of that adjacent domain's own corpus. Each adjacent domain gets its own full Domain Coverage Model only when/if its own domain-crystal build begins — at which point it reuses this exact same apparatus (Agent 0 → A → B → C → Gap Detection), per PRD-ICA-001 §16's "reusable acquisition front end for every future domain crystal" principle. This pass does not acquire Contract Law or Accounting source material; it only records that the relationship exists.

### §2.3 The bigger structural principle

The Discovery Engine doesn't just build corpora — it builds a **constitutional graph of domains**. Each domain is internally complete via its own Coverage Model; the Adjacent Domain Registry captures the edges between domains. When invariant compression eventually runs across multiple domain crystals, those edges are what let the system ask "does this invariant propagate, or is it owned by one domain?" — a question a flat, ungoverned lane list has no way to represent. This generalizes past financial services: every future domain (medicine, energy, aerospace, constitutional computing) gets both an internal Coverage Model and an explicit graph of what governs it from outside.

**Not auto-finalized.** Agent 0 *proposes* both outputs; a steward reviews and ratifies them before Source Planning proceeds — mirroring PRD-ICA-001's existing human-approval ethos (§9/§11) rather than introducing a new "auto-decide" path.

## §3 Agent A — Source Planner, reframed (not replaced)

PRD-ICA-001 §5 already assigns this agent "target source types, likely primary institutions" — this amendment gives it a *required* input to work from (the ratified Coverage Model) instead of a floating brief, and a concrete output: an **Institutional Registry** — the per-lane authority list, keyed against §2.1's internal pillars (not a separate lane taxonomy). Illustrative first instance:

| Lane (from §2.1) | Authorities |
|---|---|
| Banking | BIS, national/regional banking supervisors (e.g. FCA, ECB) |
| Payments | FATF, BIS Committee on Payments and Market Infrastructures |
| Capital Markets | SEC, ESMA |
| Digital Assets | MiCA (EU framework), FinCEN |
| Financial Crime / AML | FATF, FinCEN, CFTC |
| Insurance | IAIS, NAIC, PRA, EIOPA |
| Financial Infrastructure | IMF, World Bank, BIS |
| Cross-cutting standards | ISO, NIST, W3C (where a lane's frameworks reference open technical standards) |

Like the Coverage Model, the Institutional Registry is steward-editable — the agent proposes, a human curates which institutions count as authoritative for a given lane. This is a judgment call the same way PRD-ICA-001 §11 already treats "MAY NOT... approve its own sources."

## §4 Agent B — Discovery Agent, reframed

**Primary mode changes from open keyword search to institution-targeted navigation**: given a known Institutional Registry entry (e.g. FATF), locate that institution's own publication/recommendations listing. This is a narrow, bounded, explainable task — closer to "find FATF's Recommendations page" than "search the web for AML rules" — and is exactly the kind of task PRD-ICA-001 §0.4 already flagged `services/aa-api/src/browser/*` for evaluation against, now with a much better-scoped job description than the original open-search framing gave it.

## §5 Agent C — Resolver Agent (unchanged in concept — already specified, §7)

Recursive traversal from an institution's page → publication page → download link → redirect → final artifact, exactly as PRD-ICA-001 §7 already describes. Resolved artifacts feed the **already-built back half** unchanged — the same retrieval → inspection → provenance → review → `add-evidence` pipeline `CorpusScoutTab.tsx` already runs today for a manually-submitted URL. No new ingestion mechanism.

## §6 Gap Detection — new hard gate, extends an existing function

Compares the Coverage Model's required lanes against what's actually **resolved and approved** per lane. Implemented as an additive extension to the already-built `assessLaneCoverage()` (`services/corpusScout/intelligence.ts`): add an optional `requiredLanes` parameter so the function can report not just "here's what exists" (today's behavior, unchanged for callers that don't pass it) but "here's what's still missing" against a ratified Coverage Model. Surfaces in `CorpusScoutTab.tsx`'s existing "Source-lane coverage" table — an added "required, not yet satisfied" row/callout, not a new UI.

**Only once every lane clears this gate does Open Discovery become available.**

## §7 Open Discovery — demoted to a last-resort, per-lane gap-filler

Once Gap Detection reports a lane saturated from the Institutional Registry alone, general search (a search API, or a human pasting a found URL — either is fine here, this is explicitly the low-stakes path) becomes available **for that lane specifically** — never as a global "search this domain" action. Every candidate acquired this way is tagged via PRD-ICA-001 §8's already-named `acquisitionMethod` field (e.g. `institutional-registry` vs. `open-discovery-gap-fill`), so the review workspace and any future audit can always see which acquisition path produced which evidence. Because this path is now explicitly scoped, clearly labeled, and only reachable after coverage saturation, a general-purpose search API is an acceptable choice for it — the earlier open question ("what search backend?") is resolved by this reframing: don't build search-based *primary* acquisition at all; build institution-first; add search only as a small, clearly-tagged, gated last resort, later.

## §8 Non-goals for this pass

- No crawler/automation code ships in this pass — this is still design-only, ratify-before-build, matching PRD-ICA-001's own discipline.
- No change to the already-built back half (retrieval/inspection/provenance/dedup/review/ingestion) — it's reused as-is by Agent C's output.
- No decision yet on the exact browser-automation mechanism for Agent B/C (`services/aa-api/src/browser/*` reuse vs. something dedicated) — still flagged per PRD-ICA-001 §0.4, now with a narrower task to evaluate it against.
- No general search-API selection yet — deferred to §7's gap-filler phase, which is explicitly last, not first.

## §9 Implementation phases (mirrors PRD-ICA-001 §14's own phasing style)

1. **Coverage Model + Adjacent Domain Registry + Institutional Registry** — data model + steward review/ratify UI (reusing `CorpusScoutTab`'s existing review-panel pattern), no crawling yet. Financial services as the first ratified instance, per §2.1/§2.2/§3's tables above.
2. **Gap Detection** — extend `assessLaneCoverage()` with the `requiredLanes` parameter; surface missing coverage in the existing lane-coverage table.
3. **Agent B/C automation** — institution-targeted discovery + recursive resolution (the actual crawler), evaluating `services/aa-api/src/browser/*` reuse first, per §0.4.
4. **Open Discovery gap-filler** — gated behind Phase 2's saturation signal, per-lane scoped, tagged via `acquisitionMethod`.

Build proceeds phase by phase after ratification, same discipline as every other increment this session.

---

## Ratification record

- [ ] Operator confirms Agent 0 (Domain Architect) producing BOTH the Domain Coverage Model (§2.1, internal pillars) and the Adjacent Domain Registry (§2.2, external constitutional dependencies), steward-ratified, not auto-finalized.
- [ ] Operator confirms the is-a vs. governs/supports distinguishing test (§2), and that Adjacent Domain Registry entries stay lightweight (name + relationship label) rather than triggering full acquisition of the adjacent domain's own corpus.
- [ ] Operator confirms the reframed Agent A (Institutional Registry keyed to §2.1's pillars, steward-editable) and Agent B (institution-targeted navigation as primary mode, not open search).
- [ ] Operator confirms Gap Detection as a hard gate (extends `assessLaneCoverage()`) and that Open Discovery only unlocks after coverage saturation, per lane.
- [ ] Operator confirms the illustrative financial-services tables (§2.1/§2.2/§3) as the first instance, and the §9 phasing.
