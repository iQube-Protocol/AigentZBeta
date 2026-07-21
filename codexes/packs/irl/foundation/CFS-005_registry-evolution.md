# CFS-005 — Registry Evolution

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

Transform the Registry into the canonical ledger of validated expertise — constitutional memory.

---

## 1. Responsibility map

Each responsibility, with its current state and its evolution:

| Responsibility | Today | Evolution |
|---|---|---|
| **Provenance** | fork lineage + provenance counter, `registry_receipts`, DVN blocks | + invariant/edge provenance chains surfaced through the Invariant Service |
| **Ownership** | `persona_token_qube_ownership` transition ledger | unchanged; InvariantQubes ride the same ledger when minted |
| **Ontology navigation** | none (filters by primitive/source/cartridge) | **new**: facet listing and drill-down by ontology namespace/class on the existing list routes (`GET /api/registry/iqube?ontology=...`), backed by the Invariant Service |
| **Graph traversal** | fragmented (ClusterQube jsonb, lineage FKs) | **new**: `GET /api/registry/graph` — unified traversal projecting invariant edges plus existing lineage (fork, supersession, cluster membership, remix) read-only into one edge model |
| **Standing** | `standing_overall`, standing graph, DVN-anchored signals | invariant discovery/validation become standing-bearing signal kinds |
| **Validation** | `registry_validations` + `validatorService` + trust scorer | + invariant validation verdicts recorded against InvariantQubes |
| **Composition** | ClusterQube blocks, similarity route | + composition manifests (CFS-003 §5) as first-class registry objects |
| **Discovery** | list/filter + `/api/registry/similarity` | similarity upgraded to context-aware (Invariant Context retrieval tags) and graph-aware (neighbourhood expansion) |
| **Versioning** | 9-state lifecycle + supersession + version ledgers | unchanged grammar, applied to InvariantQubes |
| **Constitutional memory** | canonization queue + `dvn_receipt_blocks` + Autodrive publication | **framing made explicit**: the canonical subset of the registry, DVN-anchored and operator-ratified, IS the constitutional memory of the platform |

The pattern is deliberate: **two genuinely new surfaces** (ontology navigation, graph traversal), everything else an extension of a live capability.

## 2. Constitutional memory, precisely

Constitutional memory = the set of registry objects with `canonical` status whose receipts are DVN-anchored and whose ratification passed the canonization queue. Properties:

1. **Tamper-evident** — DVN receipt blocks (`batch_hash` over item hashes) + optional Autodrive CIDs (the polity-core publication rail already does this for charters)
2. **Ratified** — no object becomes canonical without human approval (`iqube_canonization_requests`; Law XI)
3. **Append-only in effect** — supersession, never deletion; superseded versions remain readable for audit
4. **Attributable without re-identification** — T2 alias commitments only, per the identifier spine

## 3. Registry as the ledger of validated expertise

What the registry ledgers today is largely *assets*. The evolution adds *expertise*: an InvariantQube's registry entry records what is known, how confidently, on whose reasoning, validated by whom, applied in which contexts, and with what observed consequences (via `validates` edges flowing back from CFS-006a execution). Discovery then means: *find me validated expertise applicable to this intent in this context* — the query the Consequence Operating Model's Knowledge Curation stage issues.

## 4. API surface (additive)

- `GET /api/registry/iqube?ontology=<class>&context=<domain>` — ontology navigation
- `GET /api/registry/graph?root=<id>&edges=<types>&context=<domain>` — traversal
- `GET /api/registry/similarity` — upgraded, context/graph-aware
- `POST /api/registry/invariant-qube` — publish a composition manifest as an InvariantQube (admin-gated; drives the existing create + mint saga)
- Canonization requests for invariant objects ride the existing queue and admin tabs (`IQubeRegistryCanonizationTab`)

All spine-gated; writes admin-gated in Phase 1.

## 5. Current substrate index

`services/registry/` (resolver, persistence, lifecycle, mintSaga, adapters, projections, scoreBackfill, trustScorerService, validatorService), `app/api/registry/*`, `iqube_id_map` + ownership + saga + canonization + DVN-block tables (`20260530000000` migration), ingestion factory tables (`20260402010000`), `app/triad/components/codex/tabs/IQubeRegistry*Tab.tsx`.
