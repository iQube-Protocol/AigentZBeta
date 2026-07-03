# CFS-003a — The Invariant Service

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

The runtime service over the ontology and the graph. Not just storage. **Everything else consumes it.**

---

## 1. Position

The Invariant Service is to invariants what the Identity & Access Spine is to identity: the single canonical resolver and decision surface. No other service reads `invariants`/`invariant_edges`/`ontology_classes` tables directly; no surface builds a parallel extractor, validator, or merger. This is the same anti-parallel-implementation discipline the spine enforces (`getActivePersona`, `evaluateAccess`) applied to knowledge.

Proposed home: `services/invariants/` — `extraction.ts`, `validation.ts`, `comparison.ts`, `canonicalization.ts`, `evolution.ts`, `conflicts.ts`, `merging.ts`, `graph.ts`, `provenance.ts`, with `index.ts` exporting the canonical surface.

## 2. Responsibilities

### 2.1 Invariant extraction
Transform sources — documents, reasoning transcripts, receipts, operational history — into candidate (`draft`) invariants with reasoning provenance attached. Extraction is LLM-assisted but never auto-canonical: extraction proposes, validation disposes. Precedents: `services/standing/extractFacts.ts` and `buildStandingGraph.ts` (LLM-derived claims + weighted edges) are the working prototypes of this exact motion.

### 2.2 Invariant validation
The lifecycle gate `draft → proposed → validated` (CFS-001 §7): consistency against canonical invariants, groundedness of provenance, canonical-form checks. Emits `invariant_validated` receipts.

### 2.3 Invariant comparison
Semantic comparison of statements: duplicate detection, near-duplicate ranking, equivalence-under-context. Comparison powers merging, retrieval dedup, and the extraction pipeline's "does this already exist?" check. Precedent: `/api/registry/similarity`.

### 2.4 Invariant canonicalization
Reduction of a statement to its simplest canonical form (vocabulary from the terminology canon, one sentence, no compound claims — compound claims are split into invariants + `composes` edges). Also the `validated → canonical` promotion path: prepares the canonization request for human ratification, then DVN-anchors on approval.

### 2.5 Invariant evolution
Confidence and status updates driven by observed consequence (the Knowledge Evolution stage, CFS-006a): validated predictions strengthen confidence; contradicted predictions weaken it and can trigger supersession proposals. Evolution never mutates statements — it adjusts confidence, adds edges, or proposes successors.

### 2.6 Conflict resolution
When a `contradicts` edge is asserted involving a canonical invariant: quarantine the challenger at `proposed`, assemble the reasoning paths of both sides, and escalate to human ratification. Constitutional-namespace conflicts additionally defer to the Polity (the ontology never overrules ratified charters). Conflicts are first-class records, not silent overwrites.

### 2.7 Invariant merging
When comparison finds duplicates/near-duplicates: merge into the stronger canonical form, redirect edges, mark the merged rows `superseded` pointing at the survivor, and union their contexts. Merging preserves all provenance trails.

### 2.8 Reasoning provenance
The service is the sole writer and reader of reasoning provenance: every extraction, validation, evolution, and merge appends to the provenance chain, and `reasoningPath(invariantId)` reconstructs the full explainability trail (CFS-008).

## 3. Consumers

| Consumer | Uses |
|---|---|
| Registry (CFS-005) | ontology navigation, graph traversal, composition manifests |
| Operating model (CFS-006a) | Knowledge Compression stage (extraction+validation), Consequence Forecasting (graph queries), Knowledge Evolution (evolution) |
| Runtime (CFS-006) | grounding slices for aigentMe/AigentZ/specialists; guardian constraint checks |
| Renderer (CFS-007) | context-scoped retrieval for experience assembly |
| Studio | compose/publish InvariantQubes |

## 4. Contract rules

- All HTTP surfaces spine-gated (`getActivePersona`); clients use `personaFetch`. Write paths admin-gated until the delegation model for agent-proposed invariants is ratified.
- T0 identifiers never leave the service; receipts carry alias commitments only.
- Canonical promotion always requires human ratification (Law XI).
- The service is extended by composition, never forked — the same protection class as the spine files, once landed.
