# CFS-006a — Consequence Engineering Operating Model

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

This is not a PRD. It is an operating specification. It answers one question: **how does constitutional intelligence actually execute?**

Consequence Engineering is no longer an application of the architecture — it is the architecture in motion. This document is the bridge between the infrastructure (Invariant, Ontology, Graph, iQube, Registry) and the runtime (aigentMe, AigentZ, Studio, Remixer).

---

## 1. The canonical pipeline

Stages are named by the **products that flow between them**, not the processes inside them. (Hence the rename: the stage formerly called *Reasoning Compression* is **Knowledge Compression** — internally it is Curation → Reasoning → Invariant Discovery → Knowledge; reasoning is the process, knowledge is the product.)

```
Intent
  ↓  IntentQube
Knowledge Curation
  ↓  KnowledgeQube
Knowledge Compression
  ↓  InvariantQube
Risk Analysis
  ↓  Risk profile
Value Analysis
  ↓  Value profile
Capability Composition
  ↓  CapabilityQube
Consequence Forecasting
  ↓  Consequence graph
Planning
  ↓  Plan (disposition)
Execution
  ↓  Receipts
Observation
  ↓  Observed consequence
Standing
  ↓  Constitutional capital
Registry Update
  ↓  Persisted validated knowledge
Knowledge Evolution
  ↓  Updated invariant graph  ──►  feeds the next Intent
```

## 2. The pipeline is recursive, not linear

Standing does not terminate the workflow. **Standing produces new knowledge.** Observed consequences update the invariant graph; the updated graph curates better knowledge for the next intent. That is the flywheel:

```
Intent → Knowledge → Capability → Consequence → Standing → Knowledge → …
```

This recursion is structural in the implementation: the pipeline runs on the Intent Chain engine, whose steps read and write the same canonical tables the next chain instance reads.

## 3. Stage definitions

| Stage | Purpose | Inputs | Output | Implementation |
|---|---|---|---|---|
| **Intent** | Establish desired consequence | Citizen, agent, organization | **IntentQube** | exists — `services/iqube/intentQube.ts` (`createIntentQube`), `POST /api/assistant/intent` |
| **Knowledge Curation** | Identify the minimum coherent knowledge necessary | IntentQube + registry discovery | **KnowledgeQube** (curated refs: invariants, iQubes, documents, contexts) | new thin service; starts on the lean IntentQube storage pattern; queries CFS-005 discovery |
| **Knowledge Compression** | Transform curated information into reusable invariants (Curation → Reasoning → Invariant Discovery → Knowledge) | KnowledgeQube | **InvariantQube** (or additions to the graph at `proposed`) | new chain step calling Invariant Service extraction + validation (CFS-003a §2.1–2.2) |
| **Risk Analysis** | Estimate repair cost, uncertainty, reversibility | plan candidates + graph | **Risk profile** | wire `services/registry/phase2/risk` + `iqube_scores.risk`; reversibility semantics per PSC-001 recovery-velocity classes |
| **Value Analysis** | Estimate benefit, leverage, acceleration, societal contribution | plan candidates | **Value profile** | wire `services/registry/phase2/value` + new `value` score axis (CFS-004 §2.2) |
| **Capability Composition** | Compose agents, tools, workflows, models, data | intent + inference paths | **CapabilityQube** | ClusterQube specialization (VentureQube precedent): `member_iqubes[]` + `dependency_graph` over ToolQubes/AigentQubes/skills |
| **Consequence Forecasting** | Forecast outcomes | capability + graph (`enables`/`constrains`/`contradicts` closures) | **Consequence graph** | new: forecast recorded as `analysis_cards` rows + candidate edges; emits `consequence_forecast_recorded` receipt |
| **Planning** | Choose disposition | forecasts + risk/value profiles + policy envelope | **Plan** | exists — `nbe_plans` disposition seam (`ask\|act\|wait\|escalate\|deny`); forecasting finally makes the disposition *derived* rather than defaulted |
| **Execution** | Delegate. Observe. Complete. | approved plan | **Receipts** | exists — `intent-advance`, `approve-action`, activity receipts, DVN anchoring |
| **Observation** | Capture what actually happened | receipts, orchestration events | **Observed consequence** | exists (receipt/event spine); new correlation step matching outcomes to forecasts |
| **Standing** | Convert consequence into constitutional capital | observed vs forecast | **Standing accrual** | exists — `standingSignalService.accrueStanding` (DVN-anchored `standing_accrued`); new consequence-derived signal kinds |
| **Registry Update** | Persist validated knowledge | validated outcomes | **Registry entries** | exists — registry persistence + receipts |
| **Knowledge Evolution** | Update the invariant graph | outcome↔forecast deltas | **Updated graph** | new — Invariant Service evolution (CFS-003a §2.5): confidence updates, `validates`/`contradicts` edges, supersession proposals. **This closes the loop.** |

## 4. Implementation shape: a canonical Intent Chain template

The Intent Chain engine (`intent_chains`, `services/intentChains/` — steps of kind `compose | rpc | approve | scheduled | wait`, accumulated `$chain`/`$prev` context, per-step orchestration events, registered as `code:chainTemplate` synthetic primitives) already executes exactly this shape. The operating model ships as the **canonical chain template** `consequence-operating-model.v1`:

- Each stage = a chain step; stage products land in chain context and in their canonical stores
- `Planning → Execution` crosses the existing approval gate (`approve` step kind; `PolicyEnvelope.requires_guardian_approval`; guardian veto per CFS-006)
- Every step emits its existing orchestration event; new receipt action types are additive: `invariant_discovered`, `consequence_forecast_recorded`, `knowledge_evolved` (+ `invariant_validated`/`invariant_canonized` from CFS-001)
- Simple intents may run a degenerate template (skip stages) — but the skipped stages are *recorded as skipped*, never silently absent: consequence accounting requires knowing what wasn't analysed

## 5. Escalation & containment

Stages inherit the platform's containment rules: derivative products of a capsule-scoped intent render inside that capsule (Content Capsule Containment); child intents fold to parents (`parentIntentId` enrichment). A forecast that predicts an irreversible, high-repair-cost consequence forces `disposition='escalate'` — consequence intelligence is what makes the guardian's veto informed rather than lexical.

## 6. Current substrate index

`services/iqube/intentQube.ts`, `services/intentChains/`, `app/api/assistant/{intent,intent-advance,intent-queue-next,ask-agent,approve-action}/`, `services/receipts/activityReceiptService.ts`, `services/dvn/activityReceiptDvnPipeline.ts`, `services/standing/standingSignalService.ts`, `services/registry/phase2/{risk,value}`, `nbe_plans` + `analysis_cards` + `orchestration_events` tables.
