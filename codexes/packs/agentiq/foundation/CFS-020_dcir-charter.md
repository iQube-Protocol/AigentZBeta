# CFS-020 — The Dynamic Constitutional Interaction Runtime (DCIR)

**Chrysalis Foundation Specification · v1.0 · D0 (contract) — authored 2026-07-06 per the operator's DCIR spec (2026-07-06)**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`
Companion to: CFS-015 (Operation Chrysalis 2.0), CFS-017 (the observe-first seam precedent), CFS-019 (the CCRL — behavioural-invariant ratification lives under its governance).
Invariants: `inv.interaction.112`–`118` (Appendix A). Contract: `types/dcir.ts`.
DCIR stands alongside **Constitutional Reasoning**, **Constitutional Order**, and **Constitutional Action** as a canonical runtime capability.

---

## 1. Purpose

DCIR is the **interaction substrate** of Constitutional Computing: a closed bidirectional cognitive-action loop that continuously synchronizes human intent, inference, application state, generated artefacts, recommendations, and next actions into **one evolving constitutional state**. Its founding refusal: **generation is never terminal — it is a state transition.** Today an artefact is produced and forgotten by the system that produced it; under DCIR, generate a PDF and the PDF **is** state — "make page three shorter" already knows which document, which version, which section (`inv.interaction.114`).

## 2. The closed loop

```
Conversation → Inference → Action → Observation → Updated Context → Inference → …
```

…continuously, until the constitutional objective is satisfied (`inv.interaction.118`). No single generation closes the loop; every pass updates the constitutional state, and the updated state grounds the next inference. Pinned as `DCIR_LOOP` in `types/dcir.ts` (order is constitutional data — sequencing corollary of Law XV; canary-guarded).

## 3. The three runtime domains and the twelve components

| Domain (`DCIR_RUNTIMES`) | Produces | State (honest, 2026-07-06) |
|---|---|---|
| **Conversational Runtime** | intent/reasoning → Intent Objects, Context Objects, Recommendations, Policies, Confidence | Partial — the copilot surfaces + ICE proposals exist (§8) |
| **Action Runtime** | deterministic execution → artefacts | Partial — receipted actions exist; artefacts don't re-enter context |
| **Observation Runtime** | everything becomes observable: conversation, tool outputs, documents, selection, editing, approval/rejection, undo, navigation, workflow progress, system events | **Partial (D1, 2026-07-06)** — event stream + observation seam live on the Dev Command Center (`services/dcir/eventStream.ts`); every other surface still unobserved |

The twelve architectural components: **Conversation Runtime**, **Inference Runtime**, **Observation Runtime**, **Action Runtime**, **Constitutional State Engine**, **Artefact Registry**, **Event Stream**, **Recommendation Engine**, **Affordance Generator**, **Invariant Intelligence Engine**, **Experience Graph**, **Feedback Coordinator**. None is greenfield-by-default: each is first inventoried against the existing organs (§8) and enters by composition (Extend, Don't Duplicate).

## 4. Constitutional State replaces conversation history

The reasoning substrate is a single evolving snapshot, not a transcript: **intent, goals, policies, constraints, active + previous artefacts, operator decisions, persona (T1 surface only), standing, preferences, confidence, task graph, experience graph, workflow** (`ConstitutionalStateSnapshot`, `types/dcir.ts`). D0 types the fields honestly loose — each hardens in the increment that implements its engine (D2), never before. Every conversational turn updates this state (`inv.interaction.112`); every recommendation is contextual to it, never to raw history (`inv.interaction.116`).

## 5. The event stream — the language of observation, tier-disciplined from birth

Everything emits events: `DocumentCreated`, `DocumentEdited`, `SelectionChanged`, `RecommendationAccepted`, `RecommendationRejected`, `ArtifactApproved`, `ArtifactRejected`, `UndoPerformed`, `NavigationOccurred`, `WorkflowAdvanced`, `ToolOutputProduced`, `ConversationTurn`, `PersonaChanged`, `SystemEvent` (`DcirEventKind`). An action without an event is invisible to the loop (`inv.interaction.113`).

**Identifier-tier discipline (Identity & Access Spine — non-negotiable):** T0 identifiers (`personaId`, `authProfileId`, `rootDid`) NEVER appear in an event payload. Every event carries a **T2-safe summary** (category labels + commitment refs, the activity-receipt `context_shared` discipline generalized) and a **tier marker** (`t1-browser-safe` | `t2-network-safe`); only T2 events are eligible for DVN anchoring. There is deliberately no T0 tier in the type — the contract makes the leak inexpressible, not merely forbidden.

## 6. Behavioural invariants — observed, never auto-canonical

Observation discovers **behavioural** invariants: observed constitutional patterns (e.g. "operator always edits before approving") — **NOT rules** (`inv.interaction.115`). They form a distinct class:

- Enter the substrate as status **`proposed`** — never `canonical` on entry.
- The `BehaviouralInvariant` type cannot express `canonical` at all: its status union is `'observed' | 'proposed'` by design.
- **Ratification stays with the operator** (`inv.cybernetics.111`: constitutional adaptation never bypasses ratification). The system may propose its own patterns; the operator canonizes them — through the existing invariant-substrate path under CCRL governance (CFS-019), never a parallel one.

## 7. Dynamic affordances — generated from intent, contained in capsules

UI affordances are generated dynamically from inferred intent — **recommendation engine, not toolbar** (`inv.interaction.117`). Every `Affordance` carries its constitutional basis (intent, artefact refs, workflow stage, T1 persona flags) and a **required capsule scope**: affordances emerge WITHIN the operator's active context, never as orphan output (Content Capsule Containment — the CLAUDE.md GOLDEN RULE applies to generated affordances exactly as to derivative content). An affordance with no scope must not render. DCIR is the universal primitive beneath aigentMe, Aigent Z, Studio Composer, Marketa, and every cartridge — only the visible actions change per surface.

## 8. Honest inventory — partial DCIR already exists; DCIR unifies, it does not fork

| Existing organ | What it already is | DCIR relationship |
|---|---|---|
| `services/devCommandCenter/stageOrchestrator.ts` (ICE proposal engine) | Conversational-Runtime partial: structured stage artifacts proposed by inference, committed only on operator approval | The Intent-Object + approval-disposition pattern; D3's Recommendation Engine composes over it |
| Capsule ground contexts (`app/api/codex/chat/route.ts` `groundContext` → aigentMe right-pane ground truth) | Constitutional-state partial: the copilot already reasons over structured pane state, not just history | Seed of the Constitutional State Engine (D2) |
| `services/receipts/activityReceiptService.ts` + `orchestration_events` | Event-stream partial: consequential actions already receipted, T0-disciplined, DVN-anchorable | The Event Stream (D1) generalizes this discipline to ALL observations — receipts remain the consequential subset |
| Reach citation (`services/constitutional/ontologyResolver.ts` `citeResolvedConcepts` + `services/invariants/grounding.ts`) | Feedback partial: usage already flows back to the substrate as Reach | Seed of the Feedback Coordinator + Invariant Intelligence Engine |

Anything DCIR-shaped built parallel to these is a constitutional infraction of Extend, Don't Duplicate.

## 9. Observe-mode-first rollout

DCIR ships observe-mode-first (the CFS-017 precedent, ratified): **observation instrumentation never blocks or mutates the surfaces it watches** until gating is separately ratified. D1's observation seam emits events and changes nothing else; renders are never blocked, actions never intercepted. Any future gate (an observation-informed deny, a generated affordance replacing a static one) is its own ratification, never a rider on the seam.

## 10. Phase plan

| Phase | Content | Status |
|---|---|---|
| **D0** | This charter + `types/dcir.ts` contract + invariants 112–118 + glossary + canaries | **DELIVERED (this increment)** |
| **D1** | Event stream + observation seam on ONE surface (observe-mode, CFS-017 pattern) | **DELIVERED (2026-07-06, Dev Command Center)** |
| **D2** | Constitutional State Engine (snapshot fields harden against their organs) | After D1 |
| **D3** | Recommendation + Affordance engines (generated affordances, capsule-contained) | After D2 |
| **D4** | Universal substrate adoption (aigentMe, Aigent Z, Studio Composer, Marketa, every cartridge) | Frontier |

## Ratification record

- [x] **D0 (contract) — AUTHORED 2026-07-06** from the operator's DCIR spec: charter, `types/dcir.ts` (loop + runtimes order-pinned, tier-disciplined events, ratification-bounded behavioural invariants, capsule-scoped affordances), `inv.interaction.112`–`118` (status `proposed`), glossary terms resolver-wired, canaries.
- [x] **D1 (event stream + observation seam) — RATIFIED + DELIVERED 2026-07-06 on the Dev Command Center.** The operator chose the seam surface at ratification: *"the Dev Command Center is the most developed feedback loop and the most vertically integrated surface, from the Bitcoin substrate to the metaMe runtime."* Delivered: `services/dcir/eventStream.ts` (isomorphic; session-scoped ring buffer capped at 50; `emitDcirEvent` + typed `dev*Event` helpers; summaries hard-bounded at 140 chars — labels, never bodies; T0 identifiers never travel), emission wired to the DCC's EXISTING seams with zero behavior change (stage proposal received / approved / dismissed, stage advanced — observed from state, catching every transition path —, capsule opened/closed, implementation pack generated, deployment proposed), and the observation seam: `copilotGroundContext.recentEvents` (last 12, compacted) rendered by the chat route's dev-command-center ground branch as a narrate-only "Recent session events (observation)" list — the loop's Observation → Updated Context → Inference edge closes for the first time. Canaries in `tests/dev-command-center.test.ts` pin the cap, the contract shape (no forbidden identifier keys), the helper vocabulary, and the bounded rendering. **What D1 deliberately does NOT do:** no behavioural-invariant mining (that's D2+ — events are observed, patterns are not yet proposed); no receipts for UI events (session-scoped observation only — receipts remain the consequential subset, CFS-020 §8); no dynamic affordances (D3); no gating of any kind (observe-mode, §9 — any future gate is its own ratification).
- [ ] D2–D4 — each ratified before build.

## Honest limits

- Invariants 112–118 are `proposed` in the seed crystal until the operator runs the ingest; this document is canon meanwhile (the CFS-018 discipline).
- The twelve components are named, not designed — each component's design is part of the increment that builds it.
- `ConstitutionalStateSnapshot`'s loose fields (`unknown`) are honest deferrals to D2, not extension points for ad-hoc payloads.
