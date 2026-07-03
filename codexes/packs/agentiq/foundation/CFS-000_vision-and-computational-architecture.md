# CFS-000 — Chrysalis Foundation: Vision & Computational Architecture

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Programme: Chrysalis Foundation — the programme under which AgentiQ evolves.
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

This is the paper every engineer reads first.

---

## 1. The Compression Theory of Intelligence

Human civilization advances not through the accumulation of information, but through the discovery, preservation, and propagation of **invariants** — statements that remain true across contexts, time, and observers.

Intelligence, on this theory, is not primarily generation. It is **compression**:

- **Reasoning Compression** — the transformation of raw information, through reasoning, into invariants. Reasoning is expensive; its products should be reusable.
- **Experience Compression** — the transformation of lived operational experience (successes, failures, receipts, consequences) into invariants that future actors inherit rather than rediscover.
- **Capability Compression** — the packaging of validated invariants, tools, and workflows into composable units that execute without re-deriving their own foundations.

The progression is:

> Reasoning transforms information into invariants.
> Invariants constitute reusable knowledge.
> Knowledge enables capability.
> Capability produces consequence.

**Invariant Intelligence** is the computational model built on this progression: intelligence systems founded upon invariants, compressed reasoning, and adaptive composition.

## 2. Why invariants become the substrate of knowledge

An LLM inference is ephemeral. A validated invariant is durable. Systems that reason from scratch on every request pay the full cost of rediscovery, cannot explain their conclusions, and cannot accumulate. Systems that reason **over a graph of validated invariants** inherit the compressed expertise of every prior validated reasoning act — with provenance, confidence, and standing attached.

Knowledge precedes inference. Inference over knowledge is cheap, explainable, and composable. Inference without knowledge is expensive, opaque, and unrepeatable.

## 3. Why iQubes become the substrate of intelligence

The iQube is already the platform's core data primitive: a trinity of **metaQube** (public metadata), **blakQube** (confidential payload), and **tokenQube** (access/key control), with lifecycle, provenance, scoring, and chain anchoring. It is the only primitive on the platform that can carry compressed expertise with:

- provenance (who discovered/validated it)
- confidence (the score axes and derivation strategies)
- standing (the discoverer's constitutional capital)
- controlled disclosure (blakQube compartmentalisation)
- publication and versioning (registry lifecycle + supersession)

Therefore the iQube evolves (CFS-004) into the **canonical encapsulation of compressed expertise** — the publication mechanism for invariant intelligence.

## 4. Why the Registry becomes constitutional memory

The Registry already provides identity (`iqube_id_map`), ownership (`persona_token_qube_ownership`), lifecycle with supersession, validation, trust scoring, canonization (`iqube_canonization_requests`), and DVN-anchored receipts (`dvn_receipt_blocks`). Evolved per CFS-005, it becomes **constitutional memory**: the tamper-evident, provenance-bearing ledger of what the civilization of the platform has validated as true and useful.

## 5. The Invariant Computational Model

*(Formerly "The Chrysalis Computational Model"; renamed v0.1 — the model belongs to the architecture, not to the programme.)*

```
Constitutional Intelligence
        │
        ▼
Invariant Intelligence
        │
        ▼
Consequence Intelligence
        │
        ▼
Adaptive Experience
```

Three interacting computational layers, plus the rendered surface:

| Layer | Governs | Contents |
|---|---|---|
| **Constitutional Intelligence** | Legitimacy | Personhood, Standing, Identity, Delegation, Agency, Authority, Constitution |
| **Invariant Intelligence** | Understanding | Reasoning, Knowledge, Ontology, Graph, iQubes, Registry |
| **Consequence Intelligence** | Action | Intent, Planning, Capability, Execution, Observation, Standing, Evolution |
| **Adaptive Experience** | Rendering | Experience architecture rendered contextually per citizen |

These are not three products. They are three interacting computational layers. Consequence Engineering is no longer an application of the architecture — **it is the architecture in motion** (CFS-006a).

## 6. Foundational computational objects

Invariant Intelligence is founded upon these constitutional primitives:

1. **Invariant** — the atomic unit of validated knowledge (CFS-001)
2. **Invariant Context** — the domains in which an invariant applies; the invariant doesn't change, its context does (CFS-001 §4)
3. **Invariant Ontology** — the semantic classification system (CFS-002)
4. **Invariant Graph** — the relational structure over invariants (CFS-003)
5. **iQube** — the publication/encapsulation primitive (CFS-004)
6. **Registry** — constitutional memory (CFS-005)

And one foundational service: the **Invariant Service** (CFS-003a) — the runtime authority over the ontology and graph. Everything else consumes it.

## 7. Terminology bridge — spec vocabulary ↔ existing platform vocabulary

To honour Law II (Extend before Recreate), engineers MUST check this table before building. Most spec concepts have living ancestors in the codebase:

| Spec concept | Existing substrate | Where |
|---|---|---|
| Invariant confidence | 4-axis score model + derived trust/reliability | `iqube_scores`, `types/registry-canonical.ts` (`IQubeScoreBlock`), `services/registry/scoreBackfill/` |
| Confidence ladder | Standing verification weights (DOCUMENT 1.0 / PRINCIPAL 0.85 / AGENT 0.6 / UNKNOWN 0.3) | `services/standing/standingScore.ts` |
| Standing | Fully implemented, DVN-anchored | `services/standing/`, `crm_persona_reputation.standing_overall`, `vsp_profiles.standing_graph` |
| Graph edges (fragmented today) | standing graph edges, ClusterQube `dependency_graph`, fork lineage, lifecycle supersession, remix lineage, intent parent chains | `buildStandingGraph.ts`, `types/registry-canonical.ts`, `services/registry/lifecycle.ts` |
| Validation | Validation + trust scoring pipeline | `registry_validations`, `registry_trust_scores`, `services/registry/{validatorService,trustScorerService}.ts` |
| Canonization / constitutional memory | Canonization queue + DVN receipt blocks | `iqube_canonization_requests`, `dvn_receipt_blocks`, `services/dvn/activityReceiptDvnPipeline.ts` |
| Operating-model pipeline | Intent Chains (DAG-of-steps engine with `$chain`/`$prev` context) | `intent_chains`, `services/intentChains/`, `services/iqube/intentQube.ts` |
| Risk / Value analysis | Phase-2 registry economics | `services/registry/phase2/{risk,value}` |
| Capability composition | ClusterQube member/dependency model; skill catalog; capability preflight | `CanonicalClusterBlock`, `services/composer/studioSkillCatalog.ts`, `services/capabilities/` |
| Renderer adapters | CopilotKit 1.50 runtime + liquid template registry | `app/api/copilotkit/`, `docs/COPILOTKIT.md`, `liquidTemplateRegistry` |

Building a parallel implementation of anything in the right-hand column is a Law II violation.

## 8. Canonical spelling

Per `docs/platform-ontology.md`, this bundle uses **blakQube** (never "blackQube"), **aigentMe** (never "AgentMe"), **AigentZ** (never "AgentZ"), **iQube** (never "IQube"/"iqube" in display). Where earlier drafts of this bundle used non-canonical spellings, this bundle is the corrected canonical text.

## 9. Deliverables of the Chrysalis Foundation programme

1. The Compression Theory of Intelligence (this document)
2. The Invariant Trinity + Service (CFS-001, 002, 003, 003a)
3. The evolved iQube specification (CFS-004)
4. The evolved Registry specification (CFS-005)
5. The Consequence Engineering Operating Model (CFS-006a)
6. Runtime integration architecture (CFS-006)
7. Experience rendering architecture (CFS-007)
8. Reasoning Compression research spec (CFS-008)
9. The Development Constitution (CFS-009)
10. Migration strategy (CFS-010)
11. Appendix A — the Canonical Invariants (the seed crystal)

## Closing

> Civilization progresses by discovering invariants.
> Intelligence progresses by reasoning over them.
> Chrysalis preserves them.
> The Polity governs them.
