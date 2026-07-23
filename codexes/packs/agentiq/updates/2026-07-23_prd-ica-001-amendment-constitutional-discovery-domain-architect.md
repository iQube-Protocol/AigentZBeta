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

**Output:** a **Domain Coverage Model** — a named, versioned list of required lanes for a domain, each with a plain-language completeness definition. Illustrative first instance (financial services, matching PRD-ICA-001's own first domain):

| Lane | Completeness definition (illustrative) |
|---|---|
| Regulation | At least one binding regulatory text per named jurisdiction in scope |
| Standards | The current version of each named standards body's relevant standard |
| Academic literature | Peer-reviewed coverage of each named structural mechanism |
| Industry guidance | Current guidance from each named industry body |
| International bodies | Current recommendations from each named international body |
| Protocol specifications | The canonical spec text for each named open protocol |
| Case law | Landmark rulings where the lane is legally load-bearing |
| Open standards | The current published version |
| Reference implementations | At least one maintained, publicly inspectable implementation |

**Not auto-finalized.** Agent 0 *proposes* the coverage model; a steward reviews and ratifies it before Source Planning proceeds — mirroring PRD-ICA-001's existing human-approval ethos (§9/§11) rather than introducing a new "auto-decide" path.

## §3 Agent A — Source Planner, reframed (not replaced)

PRD-ICA-001 §5 already assigns this agent "target source types, likely primary institutions" — this amendment gives it a *required* input to work from (the ratified Coverage Model) instead of a floating brief, and a concrete output: an **Institutional Registry** — the per-lane authority list. Illustrative first instance:

| Lane | Authorities |
|---|---|
| International regulation | FATF, BIS, IMF, World Bank |
| Financial regulation | SEC, CFTC, FinCEN, FCA, MiCA, ESMA |
| Standards | ISO, NIST, W3C |
| Academic | MIT, Stanford, Oxford (illustrative — expand per domain) |

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

1. **Coverage Model + Institutional Registry** — data model + steward review/ratify UI (reusing `CorpusScoutTab`'s existing review-panel pattern), no crawling yet. Financial services as the first ratified instance, per §2/§3's tables above.
2. **Gap Detection** — extend `assessLaneCoverage()` with the `requiredLanes` parameter; surface missing coverage in the existing lane-coverage table.
3. **Agent B/C automation** — institution-targeted discovery + recursive resolution (the actual crawler), evaluating `services/aa-api/src/browser/*` reuse first, per §0.4.
4. **Open Discovery gap-filler** — gated behind Phase 2's saturation signal, per-lane scoped, tagged via `acquisitionMethod`.

Build proceeds phase by phase after ratification, same discipline as every other increment this session.

---

## Ratification record

- [ ] Operator confirms Agent 0 (Domain Architect) and the Coverage Model concept, including that it is steward-ratified, not auto-finalized.
- [ ] Operator confirms the reframed Agent A (Institutional Registry, steward-editable) and Agent B (institution-targeted navigation as primary mode, not open search).
- [ ] Operator confirms Gap Detection as a hard gate (extends `assessLaneCoverage()`) and that Open Discovery only unlocks after coverage saturation, per lane.
- [ ] Operator confirms the illustrative financial-services Coverage Model + Institutional Registry tables (§2/§3) as the first instance, and the §9 phasing.
