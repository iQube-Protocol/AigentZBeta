# CFS-028 — Capability Graph & Production Routing ("Context Calibration")

**Chrysalis Foundation Specification · v0.1 · Status: DRAFT — awaiting operator ratification.**
Origin: operator direction 2026-07-12 — *"certain agents may be better for certain types of work. This really needs to be at the root CPS level and applied to any production artefact… routing where the best agents for the task are surfaced for the operator to select… should also accommodate agents and harnesses… needs intelligence and a graph around capabilities and tasks as well as, in the future, costs — which can be stubbed for now."*

Companions: CFS-025 (Artifact Runtime — tiers + profiles), CFS-016 (deployment ladder), CFS-023 (delegate standing), the ModelQube registry (provider sovereignty), the Model Router (per-stage routing).

---

## 1. The unification this spec makes explicit

The operator asked whether operator-authorized execution with a variety of execution agents is "in effect one and the same process" as the Claude-Code-session D2 path. **Yes — and this spec names the shared abstraction.**

Everything that can produce or execute on this platform is a **Producer**:

| Producer kind | Examples (grounded in what exists) | Today's role |
|---|---|---|
| `harness` | Claude Code (session), future server-side executor | implements packs; D2 execution candidate |
| `model` | entries in the ModelQube registry (provider-agnostic via `callSovereign`) | drafts documents, research, compositions |
| `delegate` | `HOMECOMING_DELEGATES` (Aletheon, MoneyPenny, Nakamoto, …) | constitutional production with earned standing |

The D2 executor is not a special case — it is a Producer whose capability is `deployment-execution`, gated by the same standing dimension every other capability uses, plus CFS-016's per-deploy human approval. Swapping "Claude Code session" for "server-side executor" or any future execution agent changes a Producer row, never the process. **The sovereignty ladder IS the standing axis of this graph.**

## 2. The graph

Three primitives, contract-first (the CFS-024/025 pattern):

1. **Producer** — `{ id, kind: 'harness' | 'model' | 'delegate', label, ref }` where `ref` points at the real registry entry (ModelQube id, delegate slug, harness id). Producers are never invented: the seed enumerates only what the ModelQube registry, the delegate roster, and operator-declared harnesses actually contain (No-Guessing applied to the graph itself).

2. **CapabilityEdge** — `{ producerId, capability, fitness, cost, evidence }` where:
   - `capability` = an `ArtifactProfileId` (software, documentation, research, multimedia, studio-composition, …) **plus** the execution capabilities (`deployment-execution` at D2+). The AR profile taxonomy is the task vocabulary — this is what puts routing "at the root CPS/AR level, applied to any production artefact".
   - `fitness` = 0–1, **seeded by hand, learned from receipts later**. The learning source already exists: every production writes an artifact record and (at constitutional tier) an `artifact_published` receipt attributable to a producer — success/promotion counts per (producer, capability) become evidence-based fitness. Asserted fitness decays; receipt-backed fitness accrues.
   - `cost` = **stubbed ordinal** (`low | medium | high | unknown`) in v1, per operator direction. Real per-token/per-run costs are a later increment with their own data source — never guessed.
   - `evidence` = receipt-backed counters `{ productions, promotions, failures }`, all zero at seed.

3. **RoutingRecommendation** — `recommendProducers(capability, tier)` returns a **ranked list with reasons**, filtering on:
   - the seed/learned fitness for that capability,
   - **standing gate**: constitutional-tier work requires the producer's earned trust-band ceiling to clear the tier's bar (delegates use `trustBandCeilingFor` — the CFS-023 loop; harnesses/models inherit the operator's own standing until they have their own),
   - availability (provider configured in ModelQube / delegate stood up / harness reachable).

## 3. Law XI boundary — routing recommends, the operator selects

The graph never auto-routes consequence-bearing production. The surface is a **"recommended producers" strip** at every produce affordance (Homecoming workshop, Capability Pipeline, Studio publish): ranked producers with their fitness, standing ceiling, cost stub, and the *reason* ("3 promoted productions in `documentation`", "seeded: harness of record for `software`"). The operator picks; the pick is recorded on the production's record (`sovereignty.producerId`) so the learning loop attributes outcomes correctly. Disposable-tier work MAY auto-route (no consequence — same rationale as CFS-025's compose-only fast path); operational and above always surface the choice.

## 4. v1 increments (ratifiable as a set)

1. `types/capabilityGraph.ts` — the three contracts + canary (T0-inexpressibility mirrored from the AR canary).
2. `services/capability/capabilityGraph.seed.ts` — hand-curated seed edges over what exists today: Claude Code (harness) → `software`; ModelQube document-capable entries → `documentation`/`research`; the video pipeline → `multimedia`; delegates → their charter profiles. Costs all `unknown` or coarse ordinals.
3. `services/capability/routeProducers.ts` — the resolver (pure ranking over seed + standing reads; no LLM call).
4. Surface strip on the Homecoming produce panel first (the delegate picker becomes a producer picker), then Capability Pipeline + Studio.
5. **Later, separately ratified:** receipt-learned fitness updates; real cost ingestion; `deployment-execution` edges go live only when D2 is ratified (the graph carries them as `dormant` until then).

## 5. What this spec does NOT do

- No auto-selection of producers for consequential work (Law XI).
- No execution authority of any kind — D2 remains fully governed by CFS-016; this graph only *describes* who could execute, gated and dormant until D2 ratification.
- No invented model names, prices, or capabilities — every node traces to a registry entry or an operator declaration.

## Ratification record

- [ ] CFS-028 v0.1 — drafted 2026-07-12, awaiting operator ratification of the v1 increment set (§4.1–4.4).
