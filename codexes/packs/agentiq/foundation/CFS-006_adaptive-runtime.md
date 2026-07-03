# CFS-006 — Adaptive Runtime

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

How the Runtime consumes invariant intelligence — how invariant intelligence becomes runtime intelligence.

---

## 1. Principle

Law IX: **Adaptive systems render. Canonical systems govern.** The runtime never owns knowledge; it *loads* it. Every runtime surface consumes validated invariants through the Invariant Service (CFS-003a) and returns observed consequences to it. The runtime is the adaptive half of a loop whose canonical half is the Registry.

## 2. Surface-by-surface integration

### aigentMe (sovereign guide)
- Context packets built for specialists (`services/agents/specialistRouter.ts` — already redacted, T1-safe) gain an **invariant slice**: the context-filtered, confidence-ranked invariants applicable to the citizen's active intent. Meta only; blakQube payloads never enter packets.
- The guardian veto path checks `constitutional`-namespace constraint invariants: a plan step that violates a canonical constraint is escalated before execution (semantic grounding for what `PolicyEnvelope.forbidden_actions` does lexically today).

### AigentZ (orchestrator)
- NBE selection (`nbeCatalog` + `specialistRecommender` + `nbeLlmRerank`) grounds on the graph: recommendations cite the invariants they rely on, making dispositions (`ask | act | wait | escalate | deny`) explainable via reasoning paths.
- `services/orchestration/groundingContract.ts` (the GROUNDING_MANDATE) extends from "ground on retrieved documents" to "ground on validated invariants, cite their ids" — the runtime's answers become auditable against constitutional memory.

### Studio
- ComposerStudio gains the composition workflow: select/curate invariants → composition manifest → publish InvariantQube (CFS-004 §3). Studio is where human architects perform Law IV (discover invariants before designing abstractions) as a first-class activity.
- StudioArtifacts (`state_changes[]` + rollback + `RuntimeImpactMap`) remain the change-application contract; artifacts that alter canonical objects must reference the invariants they strengthen (Law X check at review time).

### Remixer
- Remixing today is consumer content generation with lineage (`parent_publication_id`, depth-capped). Evolution: remixes of expertise-bearing experiences carry `derives_from` edges into the graph, so derivative works participate in provenance rather than merely lineage.

### Capability Engine
- Capability preflight (`services/capabilities/preflight.ts`) consults inference paths (CFS-003 §4): *is there a validated path from held capabilities to the intended consequence?* Missing dependencies surface before execution, not during.
- The skill catalog (`studioSkillCatalog.ts`) and ToolQube/AigentQube governance blocks are capability-ontology members; composition of agents/tools/workflows/models/data is CapabilityQube assembly (CFS-006a §Capability).

## 3. Knowledge initialization

At session/intent start, the runtime performs knowledge initialization (CFS-008 §5): load the dependency closure of context-relevant canonical invariants into the working context — compressed expertise in, rediscovery out. Initialization manifests are cacheable per (context, ontology-class-set, version) since canonical objects change only by supersession.

## 4. The consequence return path

Every execution emits receipts (`activity_receipts`, orchestration events) — this already exists. The evolution: the Knowledge Evolution stage (CFS-006a) consumes those receipts to update invariant confidence and edges. The runtime thereby *teaches* the canon what worked. This is the flywheel's return arc; without it the runtime only spends knowledge and never earns it.

## 5. Current substrate index

`services/orchestration/` (orchestrationService, narrativeEngine, nbeCatalog, groundingContract), `services/agents/specialistRouter.ts`, `app/api/assistant/*` (~40 routes), `types/orchestration.ts` (dispositions, handoffs, policy envelopes), `services/capabilities/`, `components/composer/ComposerStudio.tsx`, `types/studioArtifact.ts`.
