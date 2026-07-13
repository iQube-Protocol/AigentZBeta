# CFS-003 — The Invariant Graph

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

Defines the relational structure over invariants: graph model, edge taxonomy, dependency model, traversal, inference paths, reasoning paths, and the composition engine.

---

## 1. Graph model

Nodes are Level-1 invariants (CFS-001). Edges are typed, weighted, directional, and provenance-bearing. The graph is stored relationally (`invariant_edges`) and traversed through the Invariant Service (CFS-003a) — storage is an implementation detail behind the service boundary, so it can evolve (recursive CTEs first; a dedicated graph store only if scale demands it, per Law I).

Edge shape:

| Field | Notes |
|---|---|
| `from_invariant_id`, `to_invariant_id` | node refs |
| `edge_type` | CHECK-constrained taxonomy, §2 |
| `weight` | 0–1; strength of the relation |
| `context_id` | nullable → `invariant_contexts`; a context-scoped edge holds only in that domain |
| `rationale` | why this edge exists, human-readable |
| `provenance` / `reasoning_provenance` | who/what asserted it, from what evidence |
| `dvn_receipt_id` | set when the edge is canonized |

## 2. Edge taxonomy

Twelve canonical edge types:

| Edge | Semantics | Existing precedent in the platform |
|---|---|---|
| `derives_from` | B was reasoned from A | fork lineage (`forkOriginIqubeId` + provenance counter), remix `parent_publication_id` |
| `enables` | A makes B achievable | — (new; consequence forecasting) |
| `constrains` | A bounds B's applicability | PolicyEnvelope / guardian veto semantics |
| `contradicts` | A and B cannot both be canonical | — (new; drives conflict resolution, CFS-003a) |
| `supersedes` | A replaces B | lifecycle `mark_superseded_by`/`mark_supersedes` |
| `generalizes` / `specializes` | abstraction relations | primitive-type collapse precedent (SkillQube → ToolQube+subtype) |
| `depends_on` | A requires B | `registry_dependencies`, ClusterQube `dependency_graph` |
| `supports` | A is evidence for B | `vsp_facts` → standing claims |
| `validates` | A's observed consequences confirmed B | `registry_validations` |
| `explains` | A is the reasoning account of B | reasoning provenance chains |
| `composes` | A is a member of composite B | ClusterQube `member_iqubes[]` |

Extending the taxonomy is a constitutional change (canonization request), not a migration convenience.

## 3. Dependency model

`depends_on` closures define **load order** for knowledge initialization (CFS-008): to reason with invariant X, the runtime loads X plus its dependency closure, filtered by context. Cycles are forbidden for `depends_on`, `derives_from`, `supersedes` (enforced at write time by the Invariant Service); `supports`/`contradicts` may form cycles (evidence can be mutual, contradiction is symmetric in effect though stored directed).

## 4. Traversal, inference paths, reasoning paths

- **Traversal** — closure queries by edge-type set + context + minimum weight + minimum confidence. The primary API: `traverse(rootIds, edgeTypes, {context, maxDepth, minConfidence})`.
- **Inference path** — a chain of `enables`/`depends_on`/`composes` edges from held knowledge to a target capability: *what must be true/available for this to work?*
- **Reasoning path** — the `derives_from`/`explains`/`supports` chain behind a conclusion: *why do we believe this?* This is the explainability surface (CFS-008) — every runtime answer grounded in the graph can emit its reasoning path as provenance.

## 5. Composition engine

Composition assembles Level-2 collections and Level-3 InvariantQubes from the graph:

1. Select seed invariants (query or curation)
2. Expand: dependency closure + `composes`/`supports` neighbourhoods, context-filtered
3. Check coherence: no unresolved `contradicts` inside the selection
4. Emit a **composition manifest** (members, edges, contexts, aggregate confidence = weakest-link with weight decay)
5. Publish as InvariantQube via the Registry (CFS-004/005)

The aggregate-confidence and policy-aggregation semantics reuse the ClusterQube patterns (`policy_aggregation`, `receipt_aggregation`, `version_compatibility_strategy`) rather than inventing parallel ones.

## 6. Projecting the existing fragmented edges

The platform already holds graph structure in fragments: the standing graph (weighted edges in `vsp_profiles.standing_graph`), ClusterQube dependency graphs, fork/remix lineage, supersession pointers, intent parent chains. CFS-005's graph traversal surface projects these **read-only** into the unified edge model (namespaced edge sources), so the graph is born connected to the platform's real history rather than empty. Migration of write paths is progressive (CFS-010) — no existing structure is rewritten.
