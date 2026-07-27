# Invariant Discovery Engine (IDE) — Constitutional Capability Brief (CCB v2)

**The first of three instrument briefs.** Discover → Resolve → Project: the IDE **discovers**, the
IRE (`2026-07-27_ccb-invariant-resolution-engine.md`) **resolves**, the IPE
(`2026-07-27_ccb-invariant-projection-engine.md`) **projects**. All three are shipping and none had
a capability brief until this pass, even though **EXP-P1 Stage 0 is chartered to validate the IRE
and IPE as instruments** (`types/research.ts:472-473`).

This is a Constitutional Capability Brief (CFS-049) carrying CCR-001's completion sections — not a
second artifact family (CFS-049 Amendment A). Schema `capability-completion-artifact/v1.0`.

**Read-only audit.** No engine behaviour was changed in the pass that produced this document. Two
findings below (IDE-6, and the note under Known hazards) record things that are **not true today**;
they are recorded at `proposed` with no canary rather than asserted as canon.

**Status discipline used throughout these three briefs, stated once so it can be checked:**
an invariant is recorded at `validated` only when it has BOTH a real enforcing canary AND an
observed defect, ruling or finding on record (with a file:line or a dated document). Everything
else — including designed-in disciplines that have a genuine canary but no defect history — is
recorded at `proposed`. CCR-001 §8's provenance vocabulary has no kind for "designed-in from
ratified canon, canary shipped, never observed to fail", and CAN-CCR-2 requires a defect for any
evidenced status, so `proposed` is the only honest slot available. See the closing note.

## Capability identity

| Field | Value |
|-------|-------|
| Capability ID | `invariant-discovery-engine` |
| Display label | Invariant Discovery Engine (IDE) |
| Artifact version | 1.0 |
| Schema | `capability-completion-artifact/v1.0` |
| Date | 2026-07-27 |
| Governing documents | `CFS-048`, `PRD-IDE-002`, `CCR-001`, `CFS-049`, `SPEC-CDR-001` |
| Artifact path | `codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-discovery-engine.md` |
| Canon caveat | **`CFS-048` has no document in `codexes/packs/irl/foundation/`.** The engine's header cites it (`services/invariants/discoveryEngine.ts:2`) and eleven other files reference it, but the charter actually lives at `codexes/packs/agentiq/updates/2026-07-20_cfs-048-invariant-discovery-engine-charter.md`, with three phase records beside it. `PRD-IDE-002_commercialisation-invariant-discovery.md` IS in the foundation. Recorded rather than resolved: filing the charter as a CFS is an operator decision. |
| Registry status | Registration prepared in `scripts/register-ccb-capabilities.ts` (this pass). **Not yet executed** — the script needs a live DB and an operator persona. |

## Behavioural capability statement

The Discovery Engine turns a cold domain's source material into a reviewable library of candidate
invariants, and stops short of admitting any of them to canon. A steward loads evidence documents
for a domain or one of its sub-domains, asks the engine to extract constitutional statements from
them, compares what different sub-domains independently produced, and proposes a derivation
structure over what survives. Everything the engine emits is a candidate carrying the evidence it
was compressed from, ranked by how many independent source documents and how many distinct domains
support it. Promotion is a separate, human act that lands the statement in the registry as merely
proposed, so that validation is always earned afterwards and never conferred by discovery itself.

## Purpose

A constitutional runtime can only reason from invariants that exist. For a domain the platform has
never worked in, the library is empty, and the failure mode is to have a model write plausible
invariants from its own priors — generation dressed as discovery. The IDE exists so that the
statements entering a cold domain's library are compressions of real source documents that a
reviewer can trace back, and so that the act of discovering something never doubles as the act of
believing it.

## Location

### Surfaces
- metaMe IRL cartridge → Laboratory → **Experiments** (`irl-experiment-lab`, admin-only) → **Discovery** tab
- AgentiQ OS cartridge → memory group → **Invariant Research Lab** (`data/codex-configs.ts:1750`, admin-only)
- IRL OS cartridge → Laboratory → **Experiments** (`irl-os-experiment-lab`, research-access gated)
- Admin shell → `/admin/studio/invariant-video` (mounts the same lab)

### Source paths
- `services/invariants/discoveryEngine.ts` — the engine: evidence, extraction, compare, compression, promotion
- `services/invariants/discoveryDomains.ts` — the domain registry the engine resolves scope and namespace from
- `services/invariants/lifecycle.ts` — `discoverInvariant`, the single admission path into the registry, and the receipt
- `app/api/invariants/discovery/route.ts` — the admin-gated HTTP surface
- `components/composer/InvariantDiscoveryTab.tsx` — the steward workspace
- `components/composer/InvariantExperimentLab.tsx` — the lab that mounts it

## Invocation

- `GET /api/invariants/discovery?domain=…&subDomain=…` — lists evidence and candidates for a scope. Admin-gated (`route.ts:52-53`).
- `POST /api/invariants/discovery` with `action: 'add-evidence'` — a steward files a source document.
- `POST … action: 'extract'` — runs `runConstitutionalDiscovery`, an LLM pass over the scoped evidence that writes `discovery_candidates` rows.
- `POST … action: 'compare'` — cross-sub-domain compression into earned domain-level candidates.
- `POST … action: 'compress-domain'` — proposes a parent/child derivation structure; writes proposals only.
- `POST … action: 'materialize-edges'` — an operator confirms proposed edges into the invariant graph.
- `POST … action: 'suggest-parents' | 'promote' | 'link-parents' | 'reject'` — the review and admission actions.
- `services/corpusScout/ingestionBroker.ts:20` calls `addEvidence` directly — the acquisition agent files evidence through the same Stage-1 entry point rather than a parallel writer.

## Capability boundary

### Owns
- The candidate lifecycle `candidate → promoted | rejected` on `discovery_candidates`
- The compression of evidence into candidate statements, and the abstraction ladder L0–L4 those statements are placed on
- The derived support signals — cross-framework convergence and cross-domain recurrence — computed at read time from the evidence
- The proposal of a derivation structure (roots, derived nodes, typed parent edges) over a domain's earned invariants

### Does not own
- Whether a discovered statement is true. Promotion lands `proposed`; validation and canonisation are the lifecycle's, not the engine's.
- The namespace a promoted invariant belongs to — that is resolved from the discovery-domain registry (`discoveryNamespace`), not decided here.
- The evidence-provenance classification that decides experimental population membership — the engine cannot know it and deliberately leaves it unset.
- Materialisation of proposed graph edges. The engine proposes; an operator confirms.
- Any resolution or projection of the field. The IDE feeds the IRE and IPE and never calls either.

### Dependencies
- `services/constitutional/modelRouter.ts` `callSovereign` — the invariant-aware inference the extraction runs on
- `services/invariants/lifecycle.ts` `discoverInvariant` / `addEdge` — the only admission path into the registry
- `services/invariants/discoveryDomains.ts` — scope, evidence routing for horizontal domains, and namespace resolution
- `services/invariants/comparison.ts` `similarity` — parent suggestion ranking
- Supabase tables `discovery_evidence`, `discovery_candidates`, `invariants`, `invariant_contexts`, `invariant_edges`

### External authorities
- The identity and access spine — every route entry resolves through `getActivePersona` and requires `cartridgeFlags.isAdmin`
- The invariant substrate's own constraints — `invariants.status` and the confidence ladder are enforced by the database, not by this engine
- The experimental-population partition (`services/research/experimentalPopulations.ts`), which decides what a discovered invariant may be used as evidence for

## Implementation freedom

The model, the prompt, the chunking budget, the candidate cap, the tiering thresholds for
convergence and recurrence, the similarity metric behind parent suggestion, and the storage engine
may all differ in a reimplementation. What may not differ is the *arity of authority*: one
admission path into the registry, one status a promotion may write, one place the namespace is
resolved from, one axis of provenance the engine is entitled to assert, and no path from an
extraction to a graph edge that does not pass through a human. Every invariant below constrains who
may decide something, not how the deciding is computed.

## IDE-1 — Promotion never canonises

Promotion lands a candidate in the registry at status `proposed` with confidence basis
`agent_verified`, and the engine contains no path to `validated` or `canonical`. Canonisation is a
separate act earned through the validation harness.

- **Provenance:** proposed
- **Status:** proposed
- **Stage:** candidate
- **Broke it:** No defect on record. The discipline was designed in at Phase 0 from `inv.reasoning.337` and has never been observed to fail. Recorded at `proposed` rather than claiming evidence that does not exist.
- **Enforced by:** `tests/invariant-discovery.test.ts` — asserts the source contains `status: 'proposed'` and `confidenceBasis: 'agent_verified'`, and contains neither `status: 'canonical'`/`'validated'` nor a call to `canonizeInvariant`/`validateInvariant`. **This is a source-text canary, not a behavioural one** — see Known hazards.

## IDE-2 — The namespace is resolved from the registry, never hardcoded

A promoted candidate's namespace comes from the discovery-domain registry
(`discoveryNamespace(domain)`), so Financial Services discoveries land in `finance.*` and
Commercialisation in `commercialisation.*`. An unregistered domain falls back to `constitutional`.

- **Provenance:** pre-release-intercepted
- **Status:** validated
- **Stage:** validated
- **Broke it:** Hardcoding `'constitutional'` for every promotion would have put Financial Services discoveries into the constitutional namespace and destroyed the experimental-population separation at the point of entry — the population partition reads namespace, so a mis-namespaced record is unrecoverable downstream. Intercepted by operator ruling 2026-07-27 and recorded in the code at `services/invariants/discoveryEngine.ts:956-964`.
- **Enforced by:** `tests/evidence-provenance-populations.test.ts` — asserts Financial Services resolves to `finance` and not `constitutional`, Commercialisation to `commercialisation`, an unregistered domain to the `constitutional` fallback, and that every registered domain declares a namespace that exists and has a composition law.

## IDE-3 — Discovery provenance and evidence provenance are orthogonal, and the engine asserts only the one it can know

Promotion records `discoveryProvenance: 'ide'` — who discovered it — and deliberately leaves the
evidence-provenance axis unset, because `discovery_evidence` carries no provenance class and the
engine cannot know whether the rows it compressed were external standards or this repo's own
artefacts. Unset means unclassified, and an unclassified record is admitted to no experimental
population.

- **Provenance:** pre-release-intercepted
- **Status:** validated
- **Stage:** validated
- **Broke it:** Writing a guessed evidence-provenance value alongside `discoveryProvenance: 'ide'` would have laundered platform-derived material into the primary experimental population — "discovered by the IDE" is not evidence of source independence. Intercepted by operator ruling 2026-07-27 and recorded at `services/invariants/discoveryEngine.ts:980-991`.
- **Enforced by:** `tests/evidence-provenance-populations.test.ts` — asserts every evidence-provenance value maps to exactly one population, that changing discovery provenance changes nothing about the population, that IDE discovery from the platform corpus does NOT reach the primary population, and that an untagged record is unclassified rather than defaulted.

## IDE-4 — Proposed graph edges are never auto-materialised

Recursive compression writes its parent/child proposals with `materialized: false` and inserts
nothing into the invariant graph. Materialisation is an explicit, separately invoked operator
action, and promotion auto-creates only the `specializes` edges an operator passed in.

- **Provenance:** pre-release-intercepted
- **Status:** validated
- **Stage:** validated
- **Broke it:** Auto-inserting model-proposed parent edges at compression time would have written an unreviewed ontology into the invariant graph, where an edge is far harder to retract than a candidate row — the "confirm before graph insertion" discipline recorded at `services/invariants/discoveryEngine.ts:1020-1026`.
- **Enforced by:** `tests/discovery-scope-convergence.test.ts` — asserts proposals persist with `materialized:false`, that promotion does not auto-insert recursive edges, that `materializeCompressionEdges` is operator-confirmed and skips un-promoted parents, and that the proposal graph is acyclic and drops self-references.

## IDE-5 — Support signals are derived at read time, never stored

Cross-framework convergence and cross-domain recurrence are computed from a candidate's evidence
rows on every read and are never written to a column. They are queries over the evidence, not
fields on the candidate.

- **Provenance:** cross-capability-recurrence
- **Status:** validated
- **Stage:** validated
- **Broke it:** This is `inv.engineering.036` recurring inside the IDE: a persisted support score is a second source of truth for a fact the evidence already carries, and it goes stale silently the moment evidence is added or reclassified. Recorded in the type contract at `services/invariants/discoveryEngine.ts:91-94`.
- **Enforced by:** `tests/discovery-scope-convergence.test.ts` — asserts convergence counts distinct source documents, dedups one document ingested twice, ignores stale evidence references, and tiers on the derived count; and `tests/instrument-engine-briefs.test.ts` re-derives the recurrence classification floor from evidence rather than a stored value.

## IDE-6 — Every consequential discovery act leaves an attributable record

An act that spends provider credits, writes rows, or mutates the invariant graph must leave a
receipt attributable to the persona that performed it.

- **Provenance:** adversarially-derived
- **Status:** proposed
- **Stage:** observed
- **Broke it:** **This invariant does not hold today.** Only promotion emits a receipt — `services/invariants/lifecycle.ts:110-116` writes an `invariant_discovered` activity receipt, and swallows its own failure with `.catch`. `runConstitutionalDiscovery` (an LLM call plus a bulk insert of candidate rows), `rejectCandidate`, `materializeCompressionEdges` (a mutation of the invariant graph) and `compressDomainInvariants` emit no receipt and no structured log. Under CFS-053 §5.3, edge materialisation is squarely a state transition of record, so CB-3 and CB-4 bind and are unmet. The `committer()` commitment helper (`services/invariants/discoveryEngine.ts:148-150`) computes a T2-safe attributable reference and is available for this.
- **Enforced by:** Nothing. Recording a canary would pin the current absence; the fix is an engine-behaviour change outside this pass's ratified scope and is escalated in the report instead.

## Reproduction procedure

1. Provision the substrate: apply `supabase/migrations/20260703200000_invariant_substrate.sql`, `20260703230000_law_xii_truth_standing_reach.sql`, `20260803000000_invariant_discovery.sql`, `20260804000000_discovery_scope_abstraction.sql` and the namespace migrations for every domain you intend to discover in.
2. Register the domain in the discovery-domain registry with its kind (vertical or horizontal), its namespace, its composition law, and — for a horizontal capability — the verticals its evidence is observed in.
3. File evidence: one row per source document, carrying the document's kind, its content, and a stable source reference so two ingests of one document dedup to one framework.
4. Extract: compose a bounded prompt from the scoped evidence (cap total characters, cite evidence by index) and run it through the invariant-aware inference router. Parse tolerantly — models fence and wrap. Drop anything the model placed at L0 or L1; verbatim and summary are not invariants.
5. Persist each surviving statement as a candidate carrying the evidence ids it cited and a provenance bag naming the stage, scope and governing invariants of the run.
6. Derive support at read time from the evidence rows: distinct source documents within the corpus, distinct domains across corpora. Do not store either.
7. Compare across sub-domains to earn domain-level candidates, and compress a domain's earned invariants into proposed roots and derived nodes with typed edges. Persist proposals unmaterialised.
8. Review and promote: resolve the namespace from the registry, admit the statement through the single registry-admission path at status `proposed` with an agent-verified confidence basis, record the discovery axis of provenance and leave the evidence axis unset, thread the scope ladder through the invariant's context conditions, and create only operator-confirmed parent edges.
9. Gate every entry point on an authenticated steward, and emit an attributable receipt for each act that writes (see IDE-6 — this step is currently incomplete in this implementation).

## Modification rules

- Adding a domain, an evidence kind, a compare classification or an abstraction level is additive and safe, provided the registry stays the single place a namespace is resolved from (IDE-2).
- Any change that lets promotion write a status other than `proposed`, or that adds a second admission path into the registry, violates IDE-1 and is a constitutional change, not an implementation one.
- Any change that writes a support score to a column violates IDE-5 — recompute at read time or add a parity canary in the same change.
- Any change that inserts a graph edge without an explicit operator confirmation violates IDE-4.
- Adding a receipt to an unreceipted action closes IDE-6 and does not need a ratification; removing one does.
- Never widen the evidence-provenance axis from inside this engine (IDE-3). Reclassification has its own recorded, evidence-bearing path.

## Known hazards

- **The IDE-1 canary is a source-text regex, not a behavioural assertion.** `tests/invariant-discovery.test.ts` greps `services/invariants/discoveryEngine.ts` for `status: 'proposed'` and the absence of `status: 'canonical'`. It catches the direct literal mutation, because `status: 'proposed'` occurs exactly once in the file, but it would not catch a status supplied through a variable, a second admission path added under a different helper name, or a double-quoted literal combined with an unrelated single-quoted `'proposed'` elsewhere in the file. This is the CB-5 shape: an assertion about a symbol rather than about behaviour.
- **The engine cannot know evidence provenance and must not infer it.** Every future contributor's first instinct is to fill the unset axis. It is unset because the data to fill it does not exist in `discovery_evidence` (IDE-3).
- **A horizontal-capability domain reads evidence from the verticals it is observed in.** Its recurrence score is therefore about the verticals, not about the capability, and reads differently from a vertical's. The legend is returned by the route (`observedIn`) precisely so a reader does not misread it.
- **Extraction spends provider credits on every run and is not idempotent** — a re-run adds a fresh discovery pass. Deduplication happens at promotion, through the registry's duplicate check, not at extraction.
- **`materializeCompressionEdges` mutates the invariant graph with no receipt** (IDE-6). It is the highest-consequence unreceipted action in the engine.

## Operational evidence

- The eight commercialisation invariants in the canonical seed crystal are IDE-derived and are asserted by id as Population B — `tests/evidence-provenance-populations.test.ts` (`'exactly the eight commercialisation records are Population B, by id'`), 2026-07-27 suite run.
- The recursive-compression phase is recorded as shipped in `codexes/packs/agentiq/updates/2026-07-21_cfs-048-recursive-compression.md`; parent-linking in `codexes/packs/agentiq/updates/2026-07-20_cfs-048-parent-linking.md`; the sub-domain ladder in `codexes/packs/agentiq/updates/2026-07-20_cfs-048-phase1a-domain-ladder.md`.
- Corpus Scout's ingestion broker files evidence through this engine's Stage-1 entry point rather than a parallel writer — `services/corpusScout/ingestionBroker.ts:20`, asserted by `tests/corpus-scout-ingestion-broker.test.ts`.
- Full suite at the time of writing: 157 files / 2199 tests passing, exit 0 (2026-07-27).

## Commons publication record

| Field | Value |
|-------|-------|
| Proof class | constitutional |
| Claim scope | These six invariants, as governing the Invariant Discovery Engine on this platform, at the state of the code audited on 2026-07-27. IDE-6 is recorded as UNMET. This is not a claim that the discovery method yields true invariants — that is what the validation harness and EXP-P1 exist to test — only a claim about who is permitted to decide what, inside this engine. |
| Evidence references | `tests/invariant-discovery.test.ts`, `tests/discovery-scope-convergence.test.ts`, `tests/evidence-provenance-populations.test.ts`, `tests/instrument-engine-briefs.test.ts`, `tests/capability-completion.test.ts` |
| Approval record | None — not yet submitted |
| Published | no |
| Lineage — capability | `invariant-discovery-engine` |
| Lineage — artifact | `codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-discovery-engine.md` |
| Lineage — sources | `services/invariants/discoveryEngine.ts`, `services/invariants/discoveryDomains.ts`, `services/invariants/lifecycle.ts`, `app/api/invariants/discovery/route.ts`, `components/composer/InvariantDiscoveryTab.tsx` |

## Where the operator's thirteen fields landed

The operator specified thirteen fields. Twelve map onto CCR-001 headings without strain:
capability → identity; constitutional purpose → Purpose; governing canon → identity's *Governing
documents*; implementation locations → Location; invocation surfaces → Invocation; inputs and
outputs → Capability boundary plus Operational evidence; invariants → the per-invariant sections;
preconditions → boundary *Dependencies* and *External authorities*; consequences → boundary *Owns*;
evidence → Operational evidence; canaries → each invariant's *Enforced by*; known limitations →
Known hazards; reproduction → Reproduction procedure.

**The one that does not fit is "receipts".** The operator asked for inputs and outputs *including
provenance and receipts*, and CCR-001 v1.0 has no machine-read field for what a capability emits
when it acts. Receipts currently have to be smuggled into prose under Operational evidence or an
invariant. Given CFS-053's CB-3 (*observable consequences must emit receipts*), the smallest honest
addition is a `### Emits` sub-section under `## Capability boundary`, parsed alongside `Owns` /
`Does not own` / `Dependencies` / `External authorities`, listing each durable record the capability
writes and the action that writes it. That would have made IDE-6's gap visible as a missing list
entry rather than as an audit finding. **Recommended, not implemented** — it changes the v1.0 schema
and belongs to an operator decision.
