# CFS-019 — The Invariant Research Laboratory (IRL)

**Chrysalis Foundation Specification · v1.0 · Phase A (charter + vocabulary) — authored 2026-07-06 per the IRL PRD (operator, 2026-07-06)**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`
Companion to: CRP-001 (the research programme this institutionalizes), CFS-015 (Operation Chrysalis 2.0), CFS-018 (Platform Sovereignty), the constitutional glossary.
Invariants: `inv.cybernetics.108`–`111`; `inv.epistemology.119`–`120` (Aletheon review amendment — Appendix A).
Operating stack (canonical): **metaProof** (operating entity) → **metaMe** (experience runtime) → **aigentMe** (sovereign delegate) → **AgentiQ** (constitutional computing engine) → **Aigent Z** (constitutional executive).

---

## 1. The institution

The IRL is the constitutional scientific institution of the platform — not a document repository, not an experiment manager. Its mission: establish **Constitutional Cybernetics** as an empirical engineering discipline by determining whether constitutional principles constitute measurable computational properties capable of governing autonomous systems while preserving sovereignty, accountability, explainability, composability, predictability, observability, and consequence.

**Central hypothesis (from the PRD, unchanged):** Invariant Fields constitute measurable structures through which computational behaviour, constitutional coherence and consequence can be predicted, governed and experimentally validated.

**The recursive mandate** (`inv.cybernetics.110`): the laboratory operates by the principles it investigates. Its construction runs through the Constitutional Capability Pipeline (Implementation Packs, consequence preflight, D1 deployment proposals, receipts) — the lab's birth is its first experiment, and its own operation is its permanent one.

## 2. The three constitutional layers

| Layer | Governs | Discipline state (honest, 2026-07-06) |
|---|---|---|
| **I — Invariant Intelligence** | Constitutional knowledge: canon, invariants, fields, ontology, provenance, amendment, publication | **Foundation complete.** 127-seed crystal (8+1 namespaces), Standing/Reach flywheel, resolver-wired glossary, hash-committed publication, Foundational Validation Series run (EXP-001–004) |
| **II — Constitutional Computing** | Constitutional execution: policy-bound computation, workflows, identity, bounded delegation, observability, consequence engineering, sovereignty | **Alpha.** Capability Pipeline, Improvement Loop, D1, coherence engine (brief-shaped), consequence forecaster, Chrysalis Test live — half-built by design |
| **III — Constitutional Cybernetics** | Constitutional evolution: feedback, adaptation, learning, multi-agent governance, resilience, optimisation | **Nascent.** The Improvement Loop exists as a ratified contract; feedback/adaptation experiments are the IRL's frontier |

## 3. Research architecture (composition, not hierarchy)

Experiments → experiment series → research programmes → canonical publications → disciplines → the living constitutional body of knowledge. Composition obeys the ratified laws (CFS-013): each level is a coherent trajectory through the invariant space beneath it; **alternative narratives are constructible by constitutional resequencing** (sequence is scored, not validated — `inv.reasoning.095`) while provenance and lineage are preserved.

**The existing corpus retro-fits exactly:**

| IRL object | Existing instances |
|---|---|
| Experiments | EXP-001 (Semantic Fidelity), EXP-002 (Temporal Fidelity), EXP-003 (Computational Efficiency), EXP-004 (Constitutional Sovereignty) — all built, canonically published |
| Experiment series | Foundational Validation Series; Platform Sovereignty Experiment series (PSE-1..5, CFS-018) |
| Programmes | CRP-001's twelve programmes |
| Publications | Report-tab partner drafts, canonical articles, the CFS corpus (001–019) |
| Living knowledge | The seed crystal + invariants DB (Standing/Reach), glossary, ontology resolver |
| Findings | Experiment aggregates + the constitutional records of each increment (CFS-015 Appendix B) |

## 4. Constitutional object model (contract-first; `types/research.ts` in Phase C)

- **Experiment**: id (`EXP-NNN`), layer, family, hypothesis, protocol ref, governing invariants (`invariantsUsed`), runs (hash-committed `experiment_results` rows), lifecycle.
- **ExperimentSeries**: id, member experiments, dimension/claim measured.
- **Programme**: CRP programme id, series, deliverable discipline.
- **Publication**: kind (working/technical/white/note/conference), source artifacts, lineage, exact-text hash commitment (the `publishResult` discipline generalized).
- **Finding**: claim + evidence refs + status (observed → replicated → canonized-as-invariant).
- **Invariant**: the existing substrate row — the IRL adds lifecycle visibility (proposed → validated → canonical) not a parallel store.

**Lifecycles** (each transition receipted, DVN-anchorable):
- Experiment: `designed → protocol-ratified → running → evaluated → published → replicated`
- Publication: `draft → internal → canonical (hash-committed) → superseded (lineage kept)`
- Invariant: the existing canonization path (proposed → validated → canonical), surfaced — never forked.

## 5. Cartridge information architecture (Phase B target)

Hand-curated `IRL_CARTRIDGE` (slug `ccrl-cartridge`, pack `codexes/packs/irl/`), per the dual-source rule. Tab groups mirror the PRD:

1. **Dashboard** — mission; programme status (live-computed, Chrysalis-Test pattern); active experiments + recent findings (from `experiment_results`); roadmap.
2. **Research** — one tab per layer (I/II/III), each listing its series, experiments, findings, publications, candidate + ratified invariants.
3. **Experiment Laboratory** — the existing runners (EXP-001–004), Results (+backfill), Report, protocols, historical runs. Reused components, not rebuilt.
4. **Living Knowledge** — Invariant Registry (existing tab), collections, fields, ontology/glossary, lineage + canon version history.
5. **Publications** — the publication registry + copy-based confidential drafts (Report-tab discipline).
6. **Consequence Engineering** — Invariant Field Explorer over the REAL `enables/constrains/contradicts` edges (consequence forecaster); counterfactuals + simulations are Phase E.
7. **Constitutional Observability** — provenance/audit/evidence explorer over receipts. **Anchoring, stated honestly:** DVN (ICP) operational — sufficient for alpha experiments; **Bitcoin testnet settlement built** (proof-of-state Merkle batching of DVN receipts + tECDSA signer canisters, K/T auto-anchor cron; explorer surfaces unified on blockstream and txid provenance hardened 2026-07-06) — live-broadcast verification is an ops check; Bitcoin is the final settlement layer for batched DVN receipts; mainnet/ordinals: named target.
8. **Programme Management** — roadmap, backlog, collaborators/funding/partnerships/replication (registry stubs first; honest about what's manual).

## 6. Aigent Z research orchestration (Phase C)

Reuse the proven ICE engine (Dev Command Center): Aigent Z proposes structured `stage_data` artifacts per research-lifecycle stage (design → protocol → execution plan → evaluation → publication draft); the researcher approves; approvals commit + receipt. Capsule-containment discipline applies (experiment capsules). No second orchestration mechanism is invented.

## 7. Migration (canonical surface first — ratified by operator 2026-07-06)

- **Phase B**: the IRL cartridge becomes the single canonical *surface* over all research assets in place — nothing fragmented from the operator's view; zero path breakage.
- **Phase D**: physical consolidation into `codexes/packs/irl/` in one atomic increment, updating every path coupling in the same commit. **Path-coupling inventory** (the migration's consequence preflight): `services/constitutional/ontologyResolver.ts` CANON_SOURCES (glossary path), `scripts/ingest-canonical-invariants.mjs` SEED_PATH, `codexes/packs/agentiq/collections.json`, canary tests importing the seed JSON, CFS cross-references, `packRegistry.ts` skip-list (prevent auto-duplicate cartridge).

## 8. Phase plan

| Phase | Content | Status |
|---|---|---|
| **A** | This charter + vocabulary (glossary terms, `cybernetics` invariants 108–111) | **DELIVERED (this document)** |
| **B** | Cartridge skeleton: pack + hand-curated definition + Dashboard (live) + layer/lab/knowledge/publications tabs over existing components | Next — awaiting go |
| **C** | `types/research.ts` + lifecycles + receipts per transition + Aigent Z research copilot (ICE reuse) | After B |
| **D** | Physical migration (atomic, path-inventory-driven) | **DELIVERED 2026-07-06** |
| **E** | Invariant Field Explorer, resequencing views, Layer-III experiment scaffolding (feedback/adaptation/multi-agent) | **STARTED 2026-07-07** — Invariant Field Explorer delivered as the first slice (read-only visualisation over the REAL `enables/constrains/contradicts` substrate + live consequence forecast, in a new "Consequence Engineering" tab group; Computational Epistemology made visible). **Counterfactual (what-if) projection delivered 2026-07-07** — the deferral footnoted in the first slice is closed: a researcher poses a hypothetical (a proposed finding canonizing with proposed edges, OR removing an existing edge) and SEES the projected consequence field — net enables/constrains/contradicts delta, coherence flip, forced-escalation change, plain-language readout — BEFORE anything is ratified (the propose→see-consequences→ratify loop, `inv.cybernetics.111`). PURE projection: the POST `/api/research/invariant-field` route is READ-ONLY (fetches the real neighbourhood via read functions only, reuses `forecastConsequences` for the live baseline context, does the delta in the isomorphic pure helper `services/consequence/counterfactual.ts` — no insert/update/delete/upsert anywhere in the new code). Multi-step constitutional **simulations** (projection over time) and Layer-III experiment scaffolding (feedback/adaptation/multi-agent) remain a later slice. |

## 9. Success criteria (from the PRD, measurably restated)

The IRL is the canonical scientific institution when: (1) every research asset is reachable through its surface (B); (2) every lifecycle transition is receipted (C); (3) nothing research-shaped lives outside its pack (D); (4) at least one Layer-III experiment has run under its own governance (E) — at which point the laboratory is simultaneously the institution and the reference implementation of the discipline it studies.

## The institute's standing — Aletheon review integrated (2026-07-06)

*(Framing review by Aletheon, the operator's co-agent, 2026-07-06 — integrated as a charter amendment. Substrate: `inv.epistemology.119`–`120`; resolver-wired glossary term "Computational Epistemology"; programme registry pinned in `types/research.ts`.)*

### The inversion

The institute does not exist to support the platform — the relationship is reversed: **we built a platform because we needed an instrument capable of conducting this research.** The platform is the experimental apparatus; the research programme is the enduring asset (`inv.epistemology.120`). The precedents are exact: Bell Labs built apparatus and the transistor research endured; Xerox PARC built machines and the GUI research endured; CERN builds accelerators and the particle physics endures. This is the institute's self-understanding, not a marketing posture — every capability the platform ships is, first, an improvement to the instrument.

### Computational Epistemology — the discipline the three questions define

The discipline the institute is actually pursuing is **Computational Epistemology**: how knowledge itself behaves as a computational object. The Foundational Validation Series' three questions are its founding questions:

- **Can knowledge be preserved?** (EXP-001 — semantic fidelity across renderings)
- **Can knowledge compose?** (EXP-002 — temporal composition across generations)
- **Can knowledge reduce reasoning?** (EXP-003 — reasoning compression, measured)

This is not AI benchmarking, not LLM evaluation, not prompt engineering. The object under study is knowledge; the models are apparatus. Substrate: `inv.epistemology.119` ("Knowledge is a computational object: its preservation, composition, and reasoning-compression are measurable properties."). Computational Epistemology names the discipline the foundational questions define; Constitutional Cybernetics (§1, Layer III) remains the study of the governed adaptive systems built on what it validates — the two are complementary, not competing.

### Nomenclature — Research Programmes → Validation Series → Experiments

Bare "experiments" undersells the structure. The hierarchy adopted (DeepMind / Microsoft Research style): **Research Programmes → Validation Series → Experiments.** Programme naming, pinned in `types/research.ts` (`RESEARCH_PROGRAMMES`, canary-guarded):

| Programme | Name | Experiments |
|---|---|---|
| **A** | Invariant Knowledge | EXP-001 |
| **B** | Temporal Composition | EXP-002 (EXP-002b already emerging within it) |
| **C** | Reasoning Compression | EXP-003 |

EXP-004 sits in the PSE series; its programme letter is pending. Future programmes named by the review: identity continuity, cross-model validation, cross-domain validation, knowledge evolution, invariant economics. This nomenclature composes with §3 (composition, not hierarchy) — CRP-001's twelve programmes are unchanged; A/B/C are the validation-work presentation of the foundational holdings.

### Formal research briefing packaging

The findings report's scientific tone is untouched. Around it, a formal briefing package (Report tab, copy-based confidential discipline preserved): **Cover** ("The Invariant Intelligence Research Institute / Foundational Validation Series / Executive Briefing / July 2026 / Confidential") → **Letter from the Director** (one page, human, non-technical, non-fundraising: why the institute exists, why the question matters, why they're receiving this — a template for the operator's own voice, never ghost-written as final) → **Executive Memorandum** (slot) → **Findings Report** (largely unchanged) → **Appendix** (protocols, raw data, experimental architecture, repository, DVN verification).

### NAMING NOTE — RESOLVED (operator ratification, 2026-07-09)

The pending naming decision is decided. The institution's **primary name is now metaMe IRL —
the metaMe Invariant Research Lab** (short: **metaMe IRL** / **IRL**), ratified by operator
direction. This supersedes the earlier proposed external banner "The Invariant Intelligence
Research Institute."

**Confirmed CLOSED (operator direction 2026-07-17):** "The Invariant Intelligence Research
Institute" is retired as a candidate — it is not the institution's name and is not a pending
option. The names now stand settled at two levels: the **institution** is **metaMe IRL**; its
**open, public-facing edition** (the AgentiQ → AgentiQ OS pattern) is **IRL OS** (the cartridge
shipped 2026-07-16, slug `irl-os`). Any lingering "pending external banner" language elsewhere
(e.g. an earlier CFS-033 §8 note) is superseded by this closure.

**The founding name "CCRL" / "Constitutional Cybernetics Research Laboratory" is SUPERSEDED
(operator direction 2026-07-13): the institution is the Invariant Research Laboratory (IRL).**
"Constitutional Cybernetics" is RETAINED as the *discipline name* for Layer III of its work
(governed adaptive systems) — a discipline the lab pursues, not the lab itself. Canonical
spellings and the usage rule are recorded in `docs/platform-ontology.md` (§ metaMe IRL). The
machine slugs migrated to `irl-*` the same day (operator direction: early enough that the
impact is small); legacy `ccrl-*` deep links resolve through permanent aliases
(`LEGACY_CODEX_SLUGS` / `LEGACY_TAB_SLUGS` in `data/codex-configs.ts`) and the tenant-slug
translator, with a defensive DB migration (20260713030000).

The lab's founding research programme under this name is **CRP-002 — Invariant Intelligence:
Intent-Driven Knowledge Compression** (the first programme formally chartered under CRP-001), the
first foundational research programme to emerge from the completed Chrysalis v2 foundation.

## Amendment — Research Roadmap Expansion (2026-07-07)

*(Operator amendment, 2026-07-07. A constitutional amendment to the laboratory charter — NOT a redesign of the laboratory. The architecture and experimentation framework are unchanged; Claude has already built the operating system for the lab. This amendment enriches the research agenda in light of what the Invariant Intelligence programme has discovered. These additions are incorporated into the EXISTING roadmap, backlog structure (`types/research.ts`), and Copilot planning system — never a parallel framework. Machine-readable substrate: `RESEARCH_PROGRAMMES` gains the Reasoning Systems programme; `APPLIED_RESEARCH_CHAIN`, `RESEARCH_THEMES`, `OPEN_CONSTITUTIONAL_QUESTIONS`, `ROADMAP_PRIORITIZATION_CRITERIA`, `RESEARCH_OUTPUT_KINDS`, `CONSTITUTIONAL_DISTINCTIONS` pinned in `types/research.ts`; the `irl-research` Copilot ground context plans against them.)*

### Guiding principle — Applied Constitutional Research

The laboratory prioritizes **applied** constitutional research. The objective of research is not the production of theory alone, but the discovery of constitutional capabilities that can be implemented, experimentally validated, and integrated into the platform. **Implementation is part of the research process, not a downstream activity.** Experimental evidence, measured consequence, and constitutional standing together form the empirical validation process for research outputs.

The preferred outcome of every research programme is therefore:

**Discovery → Compression → Implementation → Validation → Standing → Canonical Knowledge**

This complements the existing consequence-engineering methodology and informs programme prioritization — it replaces no existing process.

### New programme — Reasoning Systems (Programme D, exploratory)

A long-term, **exploratory** research programme focused on understanding reasoning across different classes of reasoning systems. Its purpose is to identify the invariant structures that remain stable across reasoning systems while identifying the properties unique to particular forms of reasoning. It explicitly avoids assuming answers where evidence does not yet exist; research questions are framed as hypotheses and experimental programmes.

**Initial research themes:**

1. **Reasoning Systems** — investigate biological, machine, collective, and institutional reasoning; determine shared invariant structures, unique properties, and constitutional implications.
2. **Representational Artifacts** — investigate the role of representational artifacts in reasoning. Working hypothesis (to experimentally refine or *falsify*, not to prove): *reasoning performed through shared representational artifacts provides the common substrate through which biological and machine reasoning contribute to constitutional invariant discovery.*
3. **Invariant Discovery** — how invariants emerge; how they evolve; reasoning compression; invariant stability; invariant provenance; invariant supersession.
4. **Constitutional Invariant Evolution** — natural invariants; constitutional invariants; relationships between discovered and ratified invariants; constitutional standing of invariants; mechanisms for constitutional evolution.
5. **Open Constitutional Questions** — maintained as explicit research questions, NOT conclusions; hypothesis-driven until supported by experimental evidence:
   - What differentiates biological and machine reasoning once representational artifacts are held constant?
   - What role does embodiment play in reasoning? Perception? Sentience? Intentionality? Consciousness?
   - Which of these properties are constitutionally relevant? Which are implementation-specific rather than constitutional?
   - How should constitutional systems evolve as additional classes of reasoning systems emerge?

### Research governance

Where practical, new research items are structured using the existing consequence-engineering lifecycle. Every research item should seek to produce one or more of: **validated invariants · constitutional refinements · engineering capabilities · experimental evidence · implementation guidance.** Research that cannot yet produce implementation outcomes remains explicitly marked **exploratory** until sufficient evidence exists.

### Roadmap guidance

Prioritize research that satisfies ALL THREE criteria: (1) advances foundational constitutional understanding; (2) can be experimentally validated using the current platform; (3) has a plausible pathway to improving constitutional capability. This preserves the laboratory's emphasis on applied constitutional science while letting exploratory programmes mature over time.

### Research method — the discipline of distinctions (guidance, NOT a ratified law)

A note on the laboratory's emerging scientific style, recorded to inform how research questions are structured — deliberately **not** formalized as a law. Over the founding week, progress came not from proposing grand theories but from discovering better **distinctions**: Information ≠ Knowledge · Knowledge ≠ Invariants · Standing ≠ Truth · Standing ≠ Reach · Human reasoning ≠ Machine reasoning · Artificial ≠ Machine · Natural invariants ≠ Constitutional invariants. Progress comes from finding the correct constitutional distinction and then validating it experimentally. When structuring a research question, prefer sharpening a distinction over asserting a theory. This has become a defining characteristic of the work; it should inform future research questions without yet being ratified as constitution.

## Ratification record

- [x] **Phase A (charter + vocabulary) — authored 2026-07-06** per operator direction ("Yes let's go"), with the migration approach (canonical-surface-first) and the Bitcoin observability statement explicitly operator-corrected and verified against the codebase.
- [x] **Phase B (cartridge skeleton) — DELIVERED 2026-07-06.** `IRL_CARTRIDGE` (slug `ccrl-cartridge`) registered hand-curated: live Dashboard (Chrysalis summary + canonical results + roadmap), Research by layer (I/II/III), Experiment Laboratory (the full runner suite, admin-gated), Living Knowledge (Invariant Registry + glossary), Publications (the constitutional record), Programme (CRP-001). One implementation amendment: the `irl` pack directory is DEFERRED to Phase D — Phase B consumes the agentiq pack in place (creating a content-less pack now would only invite a packRegistry auto-duplicate); the charter's §5 pack reference is the Phase-D target, not a Phase-B artifact.
- [x] **Phase C1 (object model + receipted lifecycles) — DELIVERED 2026-07-06.** `types/research.ts` (contracts, EXPERIMENT/SERIES registries with seed-crystal-verified governing invariants, lifecycle orders canary-pinned, transition legality: one step forward or re-enter running); `services/research/lifecycle.ts` (lifecycle DERIVED from the canonical record — published = a run exists, replicated = ≥2 distinct providers — plus operator transitions receipted as `research_lifecycle_transition`, DVN-anchorable, evidence required, governing invariants carried); `/api/research/overview` + `/api/research/lifecycle`; Dashboard lifecycle strips.
- [x] **Phase C2 (Aigent Z research copilot) — DELIVERED 2026-07-06, deliberately NARRATE-ONLY.** `IRLResearchCopilotTab` (institution group, order 0.5): aigentZ grounded on the live lab state — experiment lifecycles (derived via `/api/research/overview`), series claims, and the latest hash-committed canonical results — with honest degradation when either feed is unavailable. DCIR-conforming from birth (CFS-020): `irl-research` is the SECOND instrumented surface after the Dev Command Center D1 reference — generic surface helpers (`surfaceOpenedEvent`, `surfaceDataRefreshedEvent`, `surfacePromptSelectedEvent`) composed onto `services/dcir/eventStream.ts` (existing DCC vocabulary untouched), session ring buffer, `groundContext.recentEvents` observation seam, canary-pinned. The chat route's `irl-research` ground branch is narrate-only: NO stage instruction block, NO proposal contract on this surface. **C2.1 (research proposal kinds — experiment design, finding drafts) is its own increment AFTER usage observation**, per the dev-loop misroute precedent (CFS-015): new stage-proposal kinds never ship in the same increment as the surface that will carry them.
- [x] **Phase C2.1 (research proposal kinds — ICE reuse) — DELIVERED 2026-07-07.** `services/research/proposals.ts` mirrors the Dev Command Center ICE engine (`stageOrchestrator`) for the research object model. Four `ResearchProposalKind`s, each mapping to CREATING or ADVANCING a research object within its legal lifecycle (`RESEARCH_PROPOSAL_EFFECT`, canary-pinned): `experiment_proposal` → creates a `ResearchExperiment` at `designed`; `protocol_draft` → advances an experiment `designed → protocol-ratified` (via `isLegalExperimentTransition`, reusing `types/research.ts` — the lifecycle logic is NOT forked); `finding` → creates a `ResearchFinding` at `observed`; `publication_draft` → creates a `ResearchPublication` at `draft`. `ResearchFinding`/`ResearchPublication`/`PublicationKind` added to `types/research.ts` (the §4 object model, contract-first). aigentZ emits proposals as fenced ` ```research_data ` blocks; `extractResearchProposals` REUSES the exact `stageOrchestrator` lenient parser (`parseFenceBody` → `repairFenceJson`, now exported) — a nearly-valid fence still parses, an unrepairable/unknown-kind fence is dropped with a warn, never silently. `buildResearchInstructionBlock` carries the hard-won strict-JSON fence contract + never-promise rule. **SUGGEST-ONLY and operator-gated**: the chat route's `irl-research` branch (narration still primary) appends the instruction block and extracts proposals into the shared `stage_proposals` channel; `IRLResearchCopilotTab` renders each as a pending approval card (preview-then-approve, mirroring `PendingProposalCard`); `applyResearchProposal` is PURE (returns new state, never side-effects — no DB/receipt/DVN in this slice) and commits only on Approve. **LIFECYCLE-LEGAL**: an illegal transition (e.g. re-ratifying an already-ratified experiment) is REJECTED on apply with the state returned unchanged, never silently committed. **T2-safe**: proposal payloads carry only experiment ids, families, claims, hash-commitment evidence refs, and invariant seed ids — never T0 identifiers. Canary: `tests/irl-research-proposals.test.ts` (12 drills — kind→lifecycle mapping, resilient extraction, illegal-transition rejection, apply purity). **Persistence + `research_lifecycle_transition` receipting on approve is the NAMED follow-on** — `services/research/lifecycle.ts::recordExperimentTransition` already provides the DVN-anchorable path; this slice keeps commit in-memory, exactly as the dev loop deferred its own persistence.
- [x] **Phase C2.2 (persistence + receipted approvals) — DELIVERED 2026-07-07.** The C2.1 named follow-on, closed through the EXISTING receipt path — no parallel mechanism was built. `research_objects` table (`supabase/migrations/20260707100000_research_objects.sql` — additive, idempotent, RLS enabled with no policies: service-role via the spine-gated route only, mirroring `experiment_results`) is the durable lab record: `(object_kind, object_id)` unique upsert key, typed `payload` jsonb, `lifecycle_state`, `receipt_id`. `/api/research/objects` (admin-gated exactly like `/api/research/lifecycle`): GET lists the record; POST persists an APPROVED proposal by RE-RUNNING the pure `applyResearchProposal` server-side against the PERSISTED state (client-shaped objects are never trusted; an illegal lifecycle transition is rejected server-side too) and enforcing the T2-safety gate (`findForbiddenIdentifierKey` in `services/research/proposals.ts` — any payload carrying a personaId / authProfileId / rootDid / fioHandle / kybeAttestation key, any casing or nesting, is rejected before DB, receipt, or response). **ONE receipt path**: `protocol_draft` approvals (the `designed → protocol-ratified` TRANSITION) flow through `recordExperimentTransition` — the same path as operator-initiated transitions, minimally extended with a caller-supplied fallback experiment definition so session-designed experiments ratify too (the pinned registry stays authoritative for known ids); create-kind approvals (`experiment_proposal` / `finding` / `publication_draft`) flow through the new `recordResearchObjectCreated`, which COMPOSES the same extracted receipt constructor (`writeLifecycleReceipt` → `research_lifecycle_transition`, DVN-anchorable, governing invariants carried as invariants_used) — creation IS the entry transition of a lifecycle. Tab: Approve keeps the optimistic in-memory apply (instant UI), then POSTs via `personaFetch`; each working object shows `persisted ✓ receipt <prefix>` or an inline error with the object retained in session memory (honest state, no silent loss); on load, persisted objects hydrate the working panel (persisted wins on id collision) — refresh no longer loses state. Canary extended (`tests/irl-research-proposals.test.ts`): the T2 rejection predicate is pinned, and a structural drill pins that the route's receipt paths go through `services/research/lifecycle` and never import the receipt service directly. **Honest limits**: single-operator, admin-gated model for now — any admin persona reads and writes the one shared lab record (no per-persona ownership, no multi-operator review workflow yet); a receipt-write failure does not roll back persistence (it is surfaced inline as `receiptError`, exactly as the lifecycle route surfaces it); T0 discipline holds throughout — `personaId` is used server-side for the receipt call only, never echoed in responses, never stored in `research_objects` (the table has no identity columns).
- [x] **Aletheon institute-standing amendment — INTEGRATED 2026-07-06** (the inversion, Computational Epistemology, programme nomenclature A/B/C, briefing package; `inv.epistemology.119`–`120` seeded; external name adoption recorded as PENDING operator decision).
- [x] **Research Roadmap Expansion amendment — INTEGRATED 2026-07-07** (operator amendment; a charter amendment, not a redesign). Guiding principle **Applied Constitutional Research** (Discovery → Compression → Implementation → Validation → Standing → Canonical Knowledge — implementation is part of research). New **Programme D — Reasoning Systems** (exploratory, long-term) with four themes + Open Constitutional Questions kept as hypotheses. Research governance (every item produces validated invariants / constitutional refinements / engineering capabilities / experimental evidence / implementation guidance; exploratory items marked as such) and roadmap prioritization (advances understanding + validatable now + pathway to capability). Research **method of distinctions** recorded as guidance (NOT a law). Incorporated into the EXISTING registry + Copilot planning system: `RESEARCH_PROGRAMMES` gains Reasoning Systems; `APPLIED_RESEARCH_CHAIN` / `RESEARCH_THEMES` / `OPEN_CONSTITUTIONAL_QUESTIONS` / `ROADMAP_PRIORITIZATION_CRITERIA` / `RESEARCH_OUTPUT_KINDS` / `CONSTITUTIONAL_DISTINCTIONS` pinned in `types/research.ts` (canary `tests/irl-research-roadmap.test.ts`); the `irl-research` ground context plans against them; the IRL Dashboard renders the agenda. No parallel framework, no architecture change.
- [x] **Phase D (physical migration) — DELIVERED 2026-07-06, atomically.** `codexes/packs/agentiq/foundation/` (the full CFS corpus, glossary, seed crystal, Appendix A, experiments) moved to `codexes/packs/irl/foundation/` in one commit, every path coupling updated in the same commit. Couplings actually updated: `codexes/packs/irl/collections.json` created (col_foundation + col_experiments, pack-relative item paths preserved) and both collections removed from `codexes/packs/agentiq/collections.json`; every `data/codex-configs.ts` tab consuming those collections repointed `packId: 'agentiq'` → `'irl'` (the AGENTIQ_CARTRIDGE Foundation + Experiments tabs and all seven IRL_CARTRIDGE content tabs — collectionIds and defaultPaths unchanged); `services/constitutional/ontologyResolver.ts` CANON_SOURCES glossary path; `scripts/ingest-canonical-invariants.mjs` SEED_PATH (+ header comment); `tests/constitutional-contracts.test.ts` seed-crystal import; `types/research.ts` protocolRefs (EXP-001/002/003) + charterRefs (CFS-015, CFS-018); `services/experiments/exp001.ts` EXP-001 artifact dir; `app/api/experiments/results/backfill/route.ts` three result-JSON imports; `scripts/benchmark-rediscovery.mjs` OUT_DIR; `scripts/evaluate-exp001.mjs` EXP_DIR; `next.config.js` outputFileTracingIncludes for `/api/experiments/exp001`; `canonical-invariants.seed.json` source field; `packRegistry.ts` skip list gained `irl` (IRL_CARTRIDGE stays the single canonical registration — no auto-duplicate). Verified: zero `agentiq/foundation` references remain in ts/tsx/mjs/json; the 130-invariant seed crystal loads from its irl path; the ontology resolver resolves glossary terms (with governing invariants) from the moved glossary.
- [x] **Phase C2.3 (instruments ↔ institution — runs advance the lifecycle) — DELIVERED 2026-07-07.** The gap the lab still carried: the EXP runners (INSTRUMENTS) produced canonical results but never advanced their research object's lifecycle (INSTITUTION) — running an experiment left the receipted lifecycle untouched. Closed through the EXISTING single receipt path, no parallel mechanism: `services/research/lifecycle.ts::recordExperimentRunLifecycle({ experimentId, event, evidence })` composes `recordExperimentTransition` / `recordResearchObjectCreated` (both already route through the ONE `writeLifecycleReceipt` → `research_lifecycle_transition` constructor — the `createActivityReceipt` call-site count in the file stays exactly 1). Run-event → transition mapping: `run-started` → `running` (legal from `protocol-ratified` onward; re-entering `running` is first-class — the flywheel); `results-published` takes the SINGLE legal step within the evaluate→publish band (`running → evaluated`, then `evaluated → published`) and DELIBERATELY never drives `replicated` (replication stays deriveOverview's computed ≥2-provider signal, never a single-run assertion). **Honest refusal over silent forcing**: when the event maps to no legal step from the object's current state, NOTHING is recorded — the service returns `{ ok:false, reason }` and the runner surfaces it inline (`lifecycle: no advance — <reason>`), never forcing an illegal jump. **Auto-materialisation**: registry experiments predate C2.2 and carry no `research_objects` row — the first run materialises the object at the registry floor (`running`, the same floor deriveOverview computes for a shipping zero-run experiment), receipts the creation, then transitions, returning `created: true`. Route: `POST /api/research/run-lifecycle`, admin-gated identically to `/api/research/lifecycle`, returns 200 on any resolved outcome (an honest refusal is a valid result, not a transport error). Runner wiring (MINIMAL, additive): the four direct-publishing runners (EXP-001/003/004/005) fire `results-published` via `personaFetch` (never raw fetch) in their publish-success path, fire-and-forget, appending the outcome to the existing `publishState` line; EXP-002 (whose canonical record enters via the Results-tab backfill, not a per-run publish) advances through the backfill success path. Dashboard: `/api/research/overview` now returns `persistedLifecycle` per experiment (`overviewWithPersistedLifecycle` overlays the receipted research-object state onto the derived floor — two honest mechanisms surfaced side by side, never conflated); `IRLDashboardTab` highlights the receipted state when present, falling back to the derived floor. **T0 discipline holds**: evidence strings carry provider/arm labels + counts only (never payloads, never T0 ids); `personaId` is used server-side for the receipt call only, never echoed, never persisted. Canary: `tests/irl-run-lifecycle.test.ts` pins run-event→transition mapping, illegal-state refusal (no receipt), auto-create-then-transition, T2-safety of evidence, and the single-receipt-site structural invariant. **HARD CONSTRAINTS honoured**: `services/receipts/` + `services/dvn/` untouched (no new actionTypes — reuses `research_lifecycle_transition`); the route and runners never import `services/receipts` directly; exactly ONE `createActivityReceipt` call site remains in `services/research/lifecycle.ts`.
- [x] **Phase C3 (the research ICE loop — develop → run → validate → publish parity) — DELIVERED 2026-07-07.** Experiments now move through the same staged cadence the Dev Command Center gives software, reusing the machinery already built rather than forking it. `services/research/researchLoop.ts` is a PURE stage machine (the research analog of `services/devCommandCenter/devLoop.ts`, not a fork) scoped to an ACTIVE experiment: `ResearchLoopStage = design | protocol | run | analyze | publish | replicated`, the stage DERIVED from the experiment's lifecycle (`designed → protocol`, `protocol-ratified → run`, `running → run`, `evaluated → analyze`, `published → publish`, `replicated → replicated`; no experiment → `design`). `researchStageProposalKind` maps each stage to the proposal the copilot should produce (design → `experiment_proposal`, protocol → `protocol_draft`, analyze → `finding`, publish → `publication_draft`) — and CRUCIALLY the **`run` stage maps to null**: running is NOT a copilot action. `researchStageActionable` returns `run-in-lab` at protocol-ratified/running, `propose` at design/protocol/analyze/publish, `complete` at replicated; `nextResearchStage` advances forward-only (a re-run — `running` re-entered from a later state, the flywheel — never drags the strip backward). **The Run stage is a lab hand-off — the research analog of CFS-016 D1 ("execution stays human").** Running is EXECUTED in the Experiment Lab (`InvariantExperimentLab`, the EXP-001…005 runner tabs), never in the copilot; the run advances the lifecycle via the C2.3 wiring (`recordExperimentRunLifecycle`), and on the tab's next refresh the persisted state re-derives the loop to Analyze. There is NO clean intra-cartridge tab-switch a tab component can call (the codex panel owns active-tab state — verified: sibling tabs like `IRLDashboardTab` use honest text pointers, not programmatic switching), so `IRLResearchCopilotTab` surfaces an explicit, honest pointer ("Run EXP-00X in the Experiment Lab → the `irl-experiment-lab` tab") rather than a fake in-copilot run. Tab: an active-experiment concept (operator-selectable, default most-recently-touched working object) with a stage strip (design → protocol → run → analyze → publish) reusing the derived-lifecycle strip visual; **flow-through on approve** (mirrors DCC `handleApproveProposal`) — an approval that advances the active experiment's lifecycle advances the loop stage and surfaces the next action; the **Feedback Coordinator** mints ONE `[observed]` auto-turn (through `SmartTriadCopilotLayer`'s `autoPrompt` prop, the same seam the DCC uses) so the copilot proactively guides the next step — never from a dismissal, never from an auto-turn. The C2.1/C2.2 approve → `applyResearchProposal` → persist → receipt path is unchanged; the stage advance + auto-turn layer on top. Chat route: the `irl-research` ground context now carries `activeExperimentStage`; the branch passes that stage's expected proposal kind into `buildResearchInstructionBlock(kind)` (mirroring how the dev branch feeds the current stage) so at `protocol` it primarily expects a `protocol_draft`, at `analyze` a `finding`, etc. **The CONDITIONAL fence contract is intact**: at the `run` stage (kind null) NO kind is passed, the full four-schema block is offered, and the copilot narrates the lab hand-off without emitting a fence — the unconditional "must emit a fence" mandate (the regression fixed 2026-07-07) was NOT reintroduced; the existing `researchFenceRetry` (which only fires on a promised-but-missing fence, never on a run/narrate turn) stays as-is. Canary: `tests/irl-research-loop.test.ts` pins the full lifecycle→stage mapping (every `EXPERIMENT_LIFECYCLE` state maps), stage→proposal-kind (run → null), `nextResearchStage` advancing on each transition + forward-only, `researchStageActionable`, and the structural boundary that the Run stage carries no proposal kind. **HARD CONSTRAINTS honoured**: reuses `proposals.ts` + `lifecycle.ts` + `isLegalExperimentTransition` + the persistence + the C2.3 run-lifecycle wiring (extend, don't duplicate); no new actionTypes (still `research_lifecycle_transition`); the single receipt path in `lifecycle.ts` (one `createActivityReceipt` site) held; `services/dvn/` / `services/identity/` / `services/access/` / `services/receipts/` untouched; T0 identifiers never in the ground context (only stage + experiment id), proposals, or auto-turns; client fetches remain `personaFetch`; the route stays admin-gated.


---

## Amendment — Experiment Taxonomy (operator-ratified 2026-07-13)

The lab's experiments are classified into four series. Series-prefixed numbering removes
ambiguity with the legacy `EXP-nnn` numbers, which are retained on the founding experiments.

| Series | Name | Studies |
|---|---|---|
| **CCE** | Constitutional Computing Experiments | platform behaviour and architecture |
| **CIE** | Constitutional Intelligence Experiments | invariants, reasoning, ontology, context drift |
| **CAE** | Constitutional Agency Experiments | delegation, personas, standing, agent sovereignty |
| **COE** | Constitutional Operations Experiments | Founder Office, Passport, Operation Leap, governance |

**CCE-006 — Constitutional Capability Convergence** is the first flagship experiment of the CCE
series (canonized 2026-07-13; numbered SIXTH in the unified experimental lineage — EXP-005
Provider Choice, executed with published results, holds the fifth slot).
The founding experiments retain their legacy numbers with PROPOSED retro-classification
(operator confirms before any renumbering): EXP-001 Living KnowledgeQube → CIE · EXP-002
Invariant-Carried Video → CIE · EXP-003 Rediscovery Savings → CIE · EXP-004 Sovereignty → CCE ·
EXP-005 Provider Choice → CCE. The unified lineage therefore runs EXP-001…EXP-005 then CCE-006 —
no number is ever reused across series (operator direction 2026-07-13).

**Constitutional Validation Runs (CVR-nnn)** are the lab's execution instrument for CCE-series
experiments: a full pipeline run (Evidence → Decision → Execution → Validation → Receipt) whose
subject is the platform itself. What a CVR validates is constitutional behaviour, not just
software. CVR-001 executed CCE-006.

## Amendment — The Lab↔Platform feedback loop, made explicit (2026-07-15)

§1's recursive mandate already states the lab "operates by the principles it investigates." This amendment names the RETURN path CCE-006/007 make concrete for the first time — the direction from Platform back to Lab, which the charter had not previously diagrammed. Per Alethean's review (2026-07-15):

```
Invariant Research Laboratory  — asks: what constitutional principles are true?
        ↓  (validated principles: ratified CFS specs, canonical invariants)
Constitutional Capability Pipeline  — asks: how do we operationalize those principles?
        ↓  (a capability decision, an implementation pack)
Platform (Agency / AgentiQ)  — asks: does this capability satisfy its consequence canvas?
        ↓  (receipts, validation reports, deployed artifacts — operational evidence)
Invariant Research Laboratory  — the operational evidence becomes the next experiment's subject
```

CCE-006 and CCE-007 are the loop's first two closures: each is a CCE-series experiment (Lab-owned: research question, hypothesis, method, ratified findings) whose SUBJECT is a Platform event (a capability shipped through the Constitutional Capability Pipeline, CFS-029/030). The loop does not require a human to manually decide "this platform event is worth studying" every time — the CVR/CCE naming convention (above) exists precisely so a Dev Command Center cycle can BE a Constitutional Validation Run by construction, not by a separate observation step bolted on after the fact.

**What this amendment does NOT claim**: the loop is not yet automatic (an operator still decides when a platform event becomes a canonized CCE — as this session's own triage of Alethean's proposed CCE-005/CFS-028/029 demonstrated, correct numbering still requires a human or an agent acting as witness with codebase visibility, per operator direction 2026-07-15: *"You remain the observer and witness… I expect you to keep a handle on numberings, names and titles."*). The loop is a real structural fact about how CCE-006/007 came to exist; it is not (yet) a self-driving pipeline that mines platform events for experiments unprompted.

**Ratified 2026-07-15 by operator direction** — descriptive amendment, no new mechanism.

## Amendment — Constitutional Capability Domain, a new IRL category (2026-07-15)

A third organizing unit joins CRP (Constitutional Research Programme — charters a research QUESTION) and CFS (Chrysalis Foundation Specification — ratifies an ANSWER): a **Constitutional Capability Domain** is an IRL-catalogued area of work with three simultaneous outputs — **Scientific** (candidate invariants + experimental evidence), **Platform** (reusable constitutional primitives implemented in code), and **Commercial** (a Founder Office capability or service). A Domain is neither a CRP nor a CFS; it is the unit that PRODUCES candidates for both, giving a research programme a direct path into product and a product a direct path back into research — the structural expression of CFS-031's macro cybernetic loop, scoped to one area.

**First named instance: Financial Services** (`CRP-003`, chartered 2026-07-15) — five domains (Investment Operations, Market Operations, Financial Intelligence, Constitutional Financial Integrity, Constitutional Commerce), each mapped to a core constitutional primitive (Bounded Delegation, Standing, Evidence) rather than a generic financial-workflow category. **Ratified 2026-07-15 by operator direction.**

## Amendment — Invariant Field Theory, the Layer I research phase (2026-07-15)

**This is not new vocabulary.** §1's central hypothesis has named "Invariant Fields" since the charter's founding ("Invariant Fields constitute measurable structures through which computational behaviour, constitutional coherence and consequence can be predicted, governed and experimentally validated"), and Phase E already shipped an **Invariant Field Explorer** (2026-07-07) — a read-only visualisation over the real `enables/constrains/contradicts` graph with live counterfactual projection. Checked against both before drafting this amendment: neither is superseded or duplicated here. The Explorer is an INSTRUMENT (a way to look at the field); this amendment names the empirical RESEARCH PROGRAMME the founding hypothesis has always implied but Layer I has not yet run — the next phase of **Computational Epistemology** (§ the Aletheon amendment above), which studies how knowledge behaves as a computational object.

**Correction, 2026-07-16 — the actual prior grounding, missed on first drafting.** This amendment originally cited only §1's hypothesis and the Explorer. CFS-002 §2a (ratified 2026-07-06, ten days before this amendment) already carries a full formal definition: *"An Invariant Field is a coherent domain of interacting invariants that governs the behaviour of a system... independently verifiable, composable, and give rise to emergent phenomena through their interaction"* (inv.81), *"a field is a role, not a container"* (inv.84), and *"Invariant fields may be natural (discovered) or constitutional (ratified); both obey the same compositional mathematics, differing only in origin"* (inv.85). CFS-002 §2a's own systems table even carries the exact biology row this session's later DNA dialogue re-derives independently: *"DNA does not create an organism; it defines the fields whose composition IS the organism."* This amendment's four-part programme is grounded in inv.81/84/85, not merely in §1's hypothesis — the correction is recorded here rather than silently fixed, per the discover→reconcile→extend discipline (below).

**The four-part programme (proposed, unscheduled):**

1. **Domain invariants** — discover the invariants specific to one capability domain (the CRP-003 pattern: Bounded Delegation, Standing, Evidence expressed within Financial Services).
2. **Cross-domain / shared invariants** — discover which invariants recur across domains rather than belonging to one (candidates already exist informally: `inv.cybernetics.110`'s recursive mandate, Standing itself, applies to every domain studied so far — this phase would test that formally rather than assume it).
3. **Field strength** — measure which invariants are foundational (load-bearing across many domains, high explanatory power, stable under added complexity) versus local (domain-specific, low transfer).
4. **Interference** — measure which invariant combinations reinforce each other, which conflict, and which produce diminishing or negative returns when composed — the field-theoretic analogue of how physical fields superpose, attributed to Alethean's framing in dialogue with the operator, 2026-07-15.

**Central research question:** How do invariant fields emerge, interact, and organize intelligent systems across domains?

**Clarification (operator, 2026-07-16), stated once here and canonical henceforth: this programme studies fields IN ADDITION TO invariants, never instead of them.** Nothing in this four-part programme demotes an individual invariant to raw material for a field — a field has no existence apart from the invariants occupying it (CFS-002 §2a, amended same date). "Domain invariants" and "shared invariants" (parts 1–2, above) are still invariants first; field strength and interference (parts 3–4) describe how those same invariants behave together, not a different, higher-priority object replacing them.

**Founding evidence for part 4 (interference), already published — not a new finding, a reinterpretation of an existing one:** EXP-003's breadth-arm result (`foundation/experiments/exp-003-rediscovery-savings/breadth-arm.md`) measured a **−14.7% breadth delta** (the broad-context arm used MORE output tokens than the narrow arm, not fewer) with grounded share moving 96.2% → 96.9% — i.e., adding more context did not just fail to help, it cost more reasoning to reach comparably-grounded output. The experiment's own conclusion — "curation dominates accumulation... RAG asks what documents are relevant; an iQube asks what validated invariants should this reasoning begin from" — is read here, for the first time, as a field-strength/interference observation: undifferentiated context does not simply add value linearly; it can collapse the field's effective strength. This is a REINTERPRETATION of a result EXP-003 was not originally designed to test as "interference" — flagged honestly, not claimed as confirmed field-theoretic evidence.

**Relation to CRP-003:** the Financial Services domain (CRP-003, chartered 2026-07-15) is reframed, in that charter's own amendment, as the first domain laboratory for this programme — its Horizen pilot's measurements are restated in field-theory terms (domain invariants, shared invariants, field strength, interference) rather than the three simpler per-domain questions the charter originally proposed.

**Honest limits:** this amendment names a research phase and reinterprets one existing result; it does not schedule an experiment, run one, or seed a new invariant. No `inv.<namespace>` entry is created by this amendment. "Field strength" and "interference" are proposed measurement CONCEPTS, not yet operationalized metrics — defining how either is actually computed is deferred to the first experiment run under this programme.

**Ratified 2026-07-15 by operator direction, in dialogue with Alethean** — a naming and research-scoping amendment; no new mechanism, no new invariant seeded.

## Amendment — Discover→reconcile→extend as a constitutional method; the three-layer research discipline (2026-07-16)

**A method the lab has now demonstrated five times is worth naming.** Across this week's doctrinal rounds (the Alethean triage that caught the CFS-028/029 and CCE-005 collisions; the Field Theory and CRP-003 domain work; the Constitutional Agreement primitive; and this amendment's own correction of its own missing CFS-002 citation, above), the same three-step pattern recurs: **discover** what the codebase already says before drafting anything, **reconcile** new proposals against it (correcting collisions, citing prior art, never silently duplicating), **then extend** with what is genuinely new. Aletheon's framing (2026-07-16): *"it demonstrates exactly the discipline the programme is trying to establish."* Named here as a constitutional METHOD, not a law — the IRL's existing "Research method — the discipline of distinctions" section (§ above) is a sibling of this, not a duplicate: distinctions is about HOW a research question should be framed; discover→reconcile→extend is about HOW a proposed amendment should be integrated into standing doctrine. Both are guidance, neither is enforced by a gate.

**The three-layer research discipline**, proposed in the same dialogue (operator + Aletheon, 2026-07-16), kept as guidance for the same reason: a claim's LAYER should be stated, not left ambiguous.

1. **Empirical** — what the programme can currently test (e.g. does invariant-initialised reasoning outperform retrieval? WP2/WP3/WP4's existing questions).
2. **Computational theory** — what explains the empirical results, generalized beyond the platform's own implementation (e.g. "complex reasoning systems achieve greater fidelity when initialised from compact, coherent invariant structures than from large retrieved collections" — a claim that would apply to medicine, law, or education, not only this codebase).
3. **Philosophical implication** — what the theory might ultimately mean (e.g. that DNA and KnowledgeQubes may be two manifestations of one deeper principle: complexity scales through compressed generative invariants). Explicitly NOT required to be testable to be worth stating — but it must be labelled as this layer, never presented as layer 1 or 2's finding.

Collapsing these three into one register is the specific failure mode this amendment guards against: a philosophical intuition stated with empirical confidence, or an empirical result over-read as a metaphysical claim. Keeping the layers separate, per Aletheon, is what makes the programme stronger, not weaker.

**Convergence as evidence, recorded going forward.** A companion practice, proposed the same day: when the same structure is independently rediscovered from more than one direction (constitutional field theory, KnowledgeQube architecture, invariant intelligence, or a fresh dialogue), that convergence is itself evidence the structure may be a genuine invariant — not proof, but a signal worth recording rather than losing. `CONVERGENCE_LOG.md` (new, this amendment) is where these are kept; its first two entries are this same reconciliation: the Invariant Field definition (CFS-002 §2a, inv.81/84/85) and the DNA/biology row in the same section's systems table, both independently re-derived in the 2026-07-16 dialogue before being traced back to their 2026-07-06 ratification.

**Honest limits:** naming a method does not mechanize it — an operator or an agent acting as witness still performs the discover step manually (grep + read before draft); nothing here builds automated collision detection. The three-layer discipline is guidance an author can still fail to follow; it is not enforced by any gate.

**Ratified 2026-07-16 by operator direction, in dialogue with Aletheon.**

## Amendment — Structural before Constitutional: the layer separation, reconciled (2026-07-17)

The Phase 1 alignment round with the external reviewer (EXP-010 §7A/§7B) surfaced what the operator named as the heart of the divergence:

> "The first principle science here is structural invariants, not constitutional ones... structured invariance as first-principle invariance and constitutional invariance as second-order governance of first-principle structured invariance... The runtime is more of a convenience to structural invariance than a first-principle participant. Of course it's essential with constitutional ones, but that is secondary." — operator, 2026-07-17

And the claim that sharpens the whole programme past the "context engineering" category:

> "The information that is curated for the LLM is not intuitive. It's not based on the knowledge, it's based on the invariant substrate." — operator, 2026-07-17

Aletheon's one-sentence synthesis, adopted as the charter's framing sentence for external audiences:

> "Invariant Intelligence is not the study of how to curate better knowledge for AI. It is the study of whether intelligence depends upon a deeper substrate of structural invariants that is distinct from knowledge itself. Constitutional Computing begins only after that substrate has been discovered, providing the mechanisms by which invariant structures can be governed, evolved, trusted, and shared." — Aletheon, 2026-07-17

**Reconciled against the canon — this separation is not new doctrine.** It is the ratified corpus stating itself: `inv.reasoning.085` (2026-07-06 — invariant fields are natural/discovered or constitutional/ratified, "differing only in origin"), CFS-021's three invariant families (natural · constitutional · representation), and this charter's own §2 three-layer architecture — Layer I (Invariant Intelligence: the substrate science) versus Layers II/III (Constitutional Computing/Cybernetics: the governance engineering). What the exchange corrected was not the ontology but the EXPERIMENTS and the prose, which had conflated the layers: the reviewer's Phase 1 gauntlet tests a Layer II delivery question (does the runtime add within-call value?); the Institute's primary hypothesis is the Layer I claim (does invariant organization change the computational properties of reasoning?). EXP-010 §7B records the disentanglement and the parked structural experiment.

**Axis precision (the witness's caveat, binding on future drafting):** the operator's structural/constitutional distinction is a FUNCTION axis — governance-independent substrate versus second-order governance of it. `inv.085`'s natural/constitutional is an ORIGIN axis — discovered versus ratified. A ratified-origin invariant can still be structural in function. The two axes map through this charter's layers; they must never be silently equated.

**Source-independence corollary, restated:** whether an invariant is human- or machine-derived is immaterial to its structural standing — what matters is that it is empirically stable under repeated validation (IRL Principle 005, `inv.epistemology.133`; the "provably invariant" language rule, EXP-010 §5). Provenance matters for trust, not for truth.

**What this amendment does NOT do:** it does not restructure the research programmes (Aletheon's "Programme A / Programme B" redraw is recorded as a framing lens, not adopted — CRP-001/002/003 numbering and structure unchanged); it does not argue the future-architectures point (structured-memory models where objects need not serialize) into Phase 1 — the experiments evaluate the implementation that exists; and it does not seed any invariant.

**Ratified 2026-07-17 by operator direction**, from the operator + external reviewer + Aletheon alignment round.
