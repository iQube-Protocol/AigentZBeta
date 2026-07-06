# CFS-019 — The Constitutional Cybernetics Research Laboratory (CCRL)

**Chrysalis Foundation Specification · v1.0 · Phase A (charter + vocabulary) — authored 2026-07-06 per the CCRL PRD (operator, 2026-07-06)**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`
Companion to: CRP-001 (the research programme this institutionalizes), CFS-015 (Operation Chrysalis 2.0), CFS-018 (Platform Sovereignty), the constitutional glossary.
Invariants: `inv.cybernetics.108`–`111` (Appendix A).
Operating stack (canonical): **metaProof** (operating entity) → **metaMe** (experience runtime) → **aigentMe** (sovereign delegate) → **AgentiQ** (constitutional computing engine) → **Aigent Z** (constitutional executive).

---

## 1. The institution

The CCRL is the constitutional scientific institution of the platform — not a document repository, not an experiment manager. Its mission: establish **Constitutional Cybernetics** as an empirical engineering discipline by determining whether constitutional principles constitute measurable computational properties capable of governing autonomous systems while preserving sovereignty, accountability, explainability, composability, predictability, observability, and consequence.

**Central hypothesis (from the PRD, unchanged):** Invariant Fields constitute measurable structures through which computational behaviour, constitutional coherence and consequence can be predicted, governed and experimentally validated.

**The recursive mandate** (`inv.cybernetics.110`): the laboratory operates by the principles it investigates. Its construction runs through the Constitutional Capability Pipeline (Implementation Packs, consequence preflight, D1 deployment proposals, receipts) — the lab's birth is its first experiment, and its own operation is its permanent one.

## 2. The three constitutional layers

| Layer | Governs | Discipline state (honest, 2026-07-06) |
|---|---|---|
| **I — Invariant Intelligence** | Constitutional knowledge: canon, invariants, fields, ontology, provenance, amendment, publication | **Foundation complete.** 127-seed crystal (8+1 namespaces), Standing/Reach flywheel, resolver-wired glossary, hash-committed publication, Foundational Validation Series run (EXP-001–004) |
| **II — Constitutional Computing** | Constitutional execution: policy-bound computation, workflows, identity, bounded delegation, observability, consequence engineering, sovereignty | **Alpha.** Capability Pipeline, Improvement Loop, D1, coherence engine (brief-shaped), consequence forecaster, Chrysalis Test live — half-built by design |
| **III — Constitutional Cybernetics** | Constitutional evolution: feedback, adaptation, learning, multi-agent governance, resilience, optimisation | **Nascent.** The Improvement Loop exists as a ratified contract; feedback/adaptation experiments are the CCRL's frontier |

## 3. Research architecture (composition, not hierarchy)

Experiments → experiment series → research programmes → canonical publications → disciplines → the living constitutional body of knowledge. Composition obeys the ratified laws (CFS-013): each level is a coherent trajectory through the invariant space beneath it; **alternative narratives are constructible by constitutional resequencing** (sequence is scored, not validated — `inv.reasoning.095`) while provenance and lineage are preserved.

**The existing corpus retro-fits exactly:**

| CCRL object | Existing instances |
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
- **Invariant**: the existing substrate row — the CCRL adds lifecycle visibility (proposed → validated → canonical) not a parallel store.

**Lifecycles** (each transition receipted, DVN-anchorable):
- Experiment: `designed → protocol-ratified → running → evaluated → published → replicated`
- Publication: `draft → internal → canonical (hash-committed) → superseded (lineage kept)`
- Invariant: the existing canonization path (proposed → validated → canonical), surfaced — never forked.

## 5. Cartridge information architecture (Phase B target)

Hand-curated `CCRL_CARTRIDGE` (slug `ccrl-cartridge`, pack `codexes/packs/ccrl/`), per the dual-source rule. Tab groups mirror the PRD:

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

- **Phase B**: the CCRL cartridge becomes the single canonical *surface* over all research assets in place — nothing fragmented from the operator's view; zero path breakage.
- **Phase D**: physical consolidation into `codexes/packs/ccrl/` in one atomic increment, updating every path coupling in the same commit. **Path-coupling inventory** (the migration's consequence preflight): `services/constitutional/ontologyResolver.ts` CANON_SOURCES (glossary path), `scripts/ingest-canonical-invariants.mjs` SEED_PATH, `codexes/packs/agentiq/collections.json`, canary tests importing the seed JSON, CFS cross-references, `packRegistry.ts` skip-list (prevent auto-duplicate cartridge).

## 8. Phase plan

| Phase | Content | Status |
|---|---|---|
| **A** | This charter + vocabulary (glossary terms, `cybernetics` invariants 108–111) | **DELIVERED (this document)** |
| **B** | Cartridge skeleton: pack + hand-curated definition + Dashboard (live) + layer/lab/knowledge/publications tabs over existing components | Next — awaiting go |
| **C** | `types/research.ts` + lifecycles + receipts per transition + Aigent Z research copilot (ICE reuse) | After B |
| **D** | Physical migration (atomic, path-inventory-driven) | After C |
| **E** | Invariant Field Explorer, resequencing views, Layer-III experiment scaffolding (feedback/adaptation/multi-agent) | Frontier |

## 9. Success criteria (from the PRD, measurably restated)

The CCRL is the canonical scientific institution when: (1) every research asset is reachable through its surface (B); (2) every lifecycle transition is receipted (C); (3) nothing research-shaped lives outside its pack (D); (4) at least one Layer-III experiment has run under its own governance (E) — at which point the laboratory is simultaneously the institution and the reference implementation of the discipline it studies.

## Ratification record

- [x] **Phase A (charter + vocabulary) — authored 2026-07-06** per operator direction ("Yes let's go"), with the migration approach (canonical-surface-first) and the Bitcoin observability statement explicitly operator-corrected and verified against the codebase.
- [x] **Phase B (cartridge skeleton) — DELIVERED 2026-07-06.** `CCRL_CARTRIDGE` (slug `ccrl-cartridge`) registered hand-curated: live Dashboard (Chrysalis summary + canonical results + roadmap), Research by layer (I/II/III), Experiment Laboratory (the full runner suite, admin-gated), Living Knowledge (Invariant Registry + glossary), Publications (the constitutional record), Programme (CRP-001). One implementation amendment: the `ccrl` pack directory is DEFERRED to Phase D — Phase B consumes the agentiq pack in place (creating a content-less pack now would only invite a packRegistry auto-duplicate); the charter's §5 pack reference is the Phase-D target, not a Phase-B artifact.
- [x] **Phase C1 (object model + receipted lifecycles) — DELIVERED 2026-07-06.** `types/research.ts` (contracts, EXPERIMENT/SERIES registries with seed-crystal-verified governing invariants, lifecycle orders canary-pinned, transition legality: one step forward or re-enter running); `services/research/lifecycle.ts` (lifecycle DERIVED from the canonical record — published = a run exists, replicated = ≥2 distinct providers — plus operator transitions receipted as `research_lifecycle_transition`, DVN-anchorable, evidence required, governing invariants carried); `/api/research/overview` + `/api/research/lifecycle`; Dashboard lifecycle strips.
- [ ] **Phase C2 (Aigent Z research orchestration — ICE reuse)** — split out deliberately: new stage-proposal kinds get their own careful pass (the dev-loop misroute regression is the precedent for not rushing stage instructions). Starts on operator go.
- [ ] Phase D (physical migration) — after C2.
