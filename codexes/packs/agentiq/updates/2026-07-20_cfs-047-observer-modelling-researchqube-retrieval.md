# CFS-047 — Observer Modelling & ResearchQube/CapabilityQube Retrieval

**Status: `draft` (ratification candidate, authored 2026-07-20). This charter governs
two SmartTriad Phase 3 slices that sit at the two ends of the Invariant Reasoning Cycle
(CFS-046): the **Observer Evolution** stage (how the operator's invariant model is
maturing) and a deeper **Pre-Inference Compression** stage (retrieving domain
ResearchQube/CapabilityQube content into ground truth). One half (observer modelling as
a pure read/derive VIEW) is a safe extension of already-ratified substrate and is built
alongside this charter; the other half (qube retrieval) is design-only pending the
concrete existence of the qube types it would retrieve, and is charter-gated.**

Source: operator synthesis continuing the SmartTriad Phase 3 sequence (CFS-045 memory
compilation + A1 partnership memory + A2 reasoning trajectories + CFS-046 the invariant
reasoning cycle). CFS-046 names "Observer Evolution (partnership metrics, invariant-model
modelling)" as a stage of the cycle; this charter is that stage's charter.

---

## Epistemic discipline (applies throughout — CLAUDE.md "Hypothesis vs Canon")

This charter separates two claim classes and keeps them apart in both design and prose:

- **`canonical` (methods / doctrine / how-the-runtime-works)** — the definition of the
  observer model as a read-only view, its T-tier discipline, the "observed, never
  asserted" production/awareness rule (AR/CPS), and the extension-not-parallel-path rule.
  These are ratifiable now because they describe how the machinery is built, not claims
  about the world.
- **`proposed` (empirical claims about the world)** — every claim that observer modelling
  will *improve* the partnership, that longitudinal signals *predict* better pre-inference
  compression, or that the partnership metrics measure a real property of the hybrid
  system rather than an artefact of the substrate. These stay `proposed` until the
  experiments that test them (EXP-014 and successors on the trajectory corpus) produce
  supporting evidence. Reports must never state them as established.

Doctrine may be canon; the belief that the doctrine makes things better is a hypothesis.

---

## §1 Observer modelling — a VIEW over ratified substrate, not a new store

### The conceptual claim (doctrine — ratifiable)

The observer model is **a read/derive layer, it writes nothing new.** It answers one
question — *"how is the operator's invariant model evolving?"* — by composing signals that
already exist in ratified substrate:

- `memory_invariants` (CFS-045 substrate + CFS-045-A1 `human_validated` tier)
- `partnershipMetrics()` (CFS-045-A1 — properties of the hybrid system, no new writes)
- `reasoning_trajectories` + `trajectoryRecurrence()` (CFS-045-A2 study material)

It introduces **no new table, no new persisted state, and no new write path.** This is
the load-bearing constitutional property: because it only reads and derives from tables
and services already ratified, it is a *non-constitutional extension* — it can ship
alongside this charter without waiting on ratification, and it degrades to an empty model
when the underlying tables are absent (the CFS-045 pre-migration try/catch → empty-state
pattern).

The snapshot posture already carried in `SmartTriadObserverContext`
(`authenticated` / `passportState` / `delegationActive` / `participation` / `isAdmin`)
is the operator's *current* state. The observer model adds the **longitudinal** dimension:
not "who is the operator right now" but "how is the operator's compiled understanding
changing over time." CFS-046 places this at the "Observer Evolution" stage of the cycle —
the feedback that should, in time, improve pre-inference compression.

### The `ObserverModel` shape

T1-safe only (labels, counts, rates, seed-id signatures — NEVER a personaId or any T0
identifier). Persona-keyed server-side; owner self-view only. Best-effort: any failure
yields `available: false` with zeroed signals.

```ts
interface ObserverModel {
  /** false when the substrate tables are absent (pre-migration) or a read failed —
   *  the model still returns, zeroed, so consumers render a clean empty state. */
  available: boolean;
  generatedAt: string;               // ISO — when this view was derived

  /** Memory maturity — the invariant model's growth by tier (CFS-045 + A1).
   *  candidate = tentative machine inference; active = confirmed machine inference;
   *  validated = human-ratified partnership memory. */
  memoryMaturity: {
    candidate: number;
    active: number;
    validated: number;
    total: number;                   // non-retired rows
  };

  /** Partnership signals — properties of the HYBRID system (CFS-045-A1).
   *  Straight pass-through of partnershipMetrics — no re-derivation. */
  partnership: {
    reviewed: number;                // rows the human has ruled on (validated_at set)
    acceptanceRate: number | null;   // validated ÷ reviewed — how often the human ratifies
    revisionRate: number | null;     // rows with refute evidence ÷ total — how often revised
  };

  /** Reasoning dynamics — dominant activation sequences (CFS-045-A2).
   *  Observational view only; EXP-014 studies this corpus properly. */
  reasoning: {
    trajectoryCount: number;         // trajectories sampled
    dominantTrajectories: {
      signature: string;             // activated seed ids joined ' > ' (T2-safe)
      count: number;
      productiveShare: number;       // share that produced/affected an invariant (vs 'none')
    }[];
  };

  /** Per-cartridge share of validated among live invariants — domain stability. */
  stabilityByCartridge: Record<string, number>;

  /** Optional snapshot posture, folded in by the caller when it already has the
   *  T1-safe SmartTriadObserverContext (the ground block / self-view route). The
   *  service does NOT resolve passport/participation itself — that stays the
   *  client observer's job (useSmartTriadContext); this keeps buildObserverModel a
   *  pure derivation over the memory substrate. */
  posture?: {
    authenticated?: boolean;
    passportState?: string;
    delegationActive?: boolean;
    participation?: { domain: string; role: string }[];
    isAdmin?: boolean;
  };
}
```

### Composition

`buildObserverModel(personaId, cartridgeId?)` composes:

- `listMemoryInvariants(personaId)` → tier counts (`candidate` / `active` / `validated`
  by `humanValidated`), and `total` non-retired rows. When `cartridgeId` is provided,
  memory maturity is computed for that cartridge; otherwise across all cartridges.
- `partnershipMetrics(personaId)` → `partnership` block + `stabilityByCartridge`
  (straight pass-through — the metric is already a no-write derivation).
- `trajectoryRecurrence(personaId, 5)` + trajectory count via `listTrajectories` →
  `reasoning.dominantTrajectories` + `trajectoryCount`.

`posture` is left unset by the service; the ground block / self-view route attaches the
already-resolved `SmartTriadObserverContext` when it has one.

### What consumes it

1. **`GET /api/memory/observer`** — spine-gated owner self-view. Mirrors
   `/api/memory/invariants` exactly: `getActivePersona` gate, `no-store`, empty (`available:
   false`) on pre-migration. Returns the caller's own `ObserverModel`. This is the surface
   an operator-facing "how is my partnership evolving" panel would read (panel is out of
   scope here — charter-gated UI, not built).

2. **Chat ground block** (`app/api/codex/chat/route.ts`, smart-triad surface) — a COMPACT
   one-line posture summary folded into the existing memory-retrieval block, e.g.:

   > operator memory posture: 3 validated / 5 active / 2 candidate invariants; acceptance
   > 75%; dominant trajectory inv.a > inv.b (4×)

   so the copilot models the *evolution* of the partnership, not merely the current
   snapshot. Additive, spine-persona only, degrades silently when the model is
   unavailable. No new persisted state; no change to memory table semantics.

### Observed, never asserted (AR/CPS — doctrine)

Per the "Artifact Production — AR/CPS + Observer Awareness" rule, the observer model is
**observed** from live substrate on each read — never asserted from static config, never
cached into a parallel store. A copilot narrating the partnership's evolution must read the
current state of that evolution, not a stale handoff. Deriving the summary from anything
other than the live `memory_invariants` / `reasoning_trajectories` reads is the
stale-handoff (CS-001) defect class.

---

## §2 ResearchQube / CapabilityQube retrieval — design-only, charter-gated

### Investigation finding (honest scoping)

**Neither `ResearchQube` nor `CapabilityQube` exists as a concrete, implemented iQube type
in the codebase today.** The investigation found:

- **`ResearchQube`** — appears in exactly one place: the SmartTriad PRD
  (`2026-07-19_prd-smarttriad-context-aware-copilot.md`), which names
  "ResearchQube/CapabilityQube retrieval" as *remaining Phase 3 scope (unbuilt)*. There is
  no type, no table, no service, and no storage/retrieval path for a ResearchQube. There is
  a rich `services/research/*` surface (the CFS-034 research ladder, research loop,
  proposals, report composition) and IRL research surfaces — but these are research
  *progression / workflow* constructs, not a retrievable content qube.
- **`CapabilityQube`** — exists only as a **proposed construct in IRL foundation docs**:
  CFS-004 (iQube evolution) and CFS-006a (consequence operating model) describe it as a
  future ClusterQube specialization reusing `member_iqubes[]` / `dependency_graph` over
  ToolQubes/AigentQubes/skills. In code there is `services/capability/capabilityGraph.ts`
  (CFS-028 producer-recommendation resolver), `capabilityRegistry`, `capabilityDiscovery`,
  and `capabilityEvidence` — these resolve *which producer can make an artifact*, not a
  retrievable "CapabilityQube" content corpus. No concrete CapabilityQube iQube type is
  implemented.

**Conclusion:** the retrieval half cannot be built now, because the objects it would
retrieve do not concretely exist. This charter scopes it as **design-only**, to be built
only once (a) a concrete ResearchQube and/or CapabilityQube type with a content surface and
storage exists, and (b) this charter (or its successor) is ratified.

### The design (extension of L2 corpusRefs + IRE — not a parallel retriever)

When the qube types exist, retrieval MUST be built as an **extension of the two mechanisms
already shipped**, never a parallel retriever:

1. **L2 `corpusRefs`** — the SmartTriad contract already carries
   `cartridge.corpusRefs: string[]` (L2 domain-corpus surface names, rendered into the
   ground block as "answer FROM these surfaces; name them when citing"). ResearchQube /
   CapabilityQube retrieval extends this: a resolved qube contributes named corpus surfaces
   (and, when available, retrieved snippets) into the SAME ground-block corpus section —
   the copilot's existing "ground your answer in THIS" framing carries them with no new
   prompt scaffold.

2. **IRE resolution** (`services/invariants/resolution.ts` `resolveConstitutionalField`) —
   the chat route already resolves a constitutional field from the message and folds the
   resolved invariants into `platformInvariants`. Qube retrieval is the DOMAIN analogue: the
   L2-deepening slice resolves *which ResearchQube/CapabilityQube surfaces the current
   intent requires* and retrieves their content into ground truth. It must reuse the IRE's
   resolve→project seam (RESOLUTION PRECEDES REASONING; the IPE consumes, never resolves) —
   the qube retriever produces resolved refs the ground block consumes, exactly as the
   memory + platform-invariant blocks do today.

**Anti-pattern (forbidden):** a standalone qube-retrieval service that assembles its own
prompt block, bypasses `corpusRefs`, or resolves independently of the IRE. That is the
parallel-production-path infraction (Artifact Production rule) applied to retrieval.

### Design sketch (to bind when the types exist)

```
resolveQubeCorpus(intentText, cartridgeId)  // DOMAIN analogue of resolveConstitutionalField
   → { qubeRefs: { qubeId; kind: 'research'|'capability'; surfaceName; snippet? }[] }
// folded into gc.cartridge.corpusRefs (names) + an optional retrieved-snippet section,
// consumed by the EXISTING smart-triad ground block — no new scaffold.
```

This section is **not built** under this charter. It is recorded so the next agent extends
the shipped seams rather than inventing a retriever, and so the operator ratifies the
extension-not-parallel design before any code lands.

---

## §3 Deferred decisions — explicitly parked (do NOT build, do NOT decide here)

These two remain parked from the CFS-045 line and are NOT reopened by this charter:

1. **DVN receipts for memory.** CFS-045 v1 writes no DVN receipts (memory is private
   working knowledge). Observer modelling changes nothing here — it writes nothing at all,
   so there is nothing to anchor. Whether *any* memory event ever earns a DVN receipt is a
   separate future ratification. Not decided here.

2. **Trajectory-primed retrieval** (trajectories *steering* pre-inference compression
   rather than merely *recording* it). CFS-045-A2 records trajectories; using them to prime
   or reorder retrieval is its own future ratification (EXP-014 studies the corpus first).
   The observer model *reads* trajectory recurrence as a signal; it does NOT feed that
   signal back into retrieval. That feedback loop stays parked.

---

## §4 Phased build scope

| Slice | Scope | Status under this charter |
|---|---|---|
| **4.1 Observer model read layer** | `buildObserverModel(personaId, cartridgeId?)` composing the three ratified sources into `ObserverModel`; T1-safe, empty on failure. | **BUILD NOW** (safe extension — reads/derives ratified substrate, no new state). |
| **4.2 Self-view route** | `GET /api/memory/observer` — spine-gated owner self-view, mirrors `/api/memory/invariants`. | **BUILD NOW** (self-view over 4.1). |
| **4.3 Ground-block summary** | One-line observer-posture summary folded into the existing smart-triad memory block in the chat route; additive, spine-persona only, silent degrade. | **BUILD NOW** (additive read). |
| **4.4 Observer panel UI** | An operator-facing panel rendering the `ObserverModel` (maturity, partnership rates, dominant trajectories). | **CHARTER-GATED** — not built; needs UI ratification. |
| **4.5 ResearchQube/CapabilityQube retrieval** | Domain-corpus retrieval into ground truth via the corpusRefs + IRE extension (§2). | **DESIGN-ONLY** — the qube types do not concretely exist; gated on their existence + ratification. |
| **4.6 Trajectory-primed retrieval** | Trajectories steering retrieval. | **DEFERRED** (§3) — own future ratification. |
| **4.7 DVN receipts for memory** | Anchoring memory/observer events. | **DEFERRED** (§3). |

---

## §5 T-discipline

- `personaId` is a **T0** key — it enters `buildObserverModel` server-side and never leaves.
  The `ObserverModel` serialises no identifier of any tier: only counts, rates, cartridge
  slugs, and seed-id activation signatures (T2-safe refs, the same class already carried on
  trajectories and platform invariants).
- The self-view route is the **owner self-view exception** (CLAUDE.md Identity & Access
  Spine): Bearer-scoped, `getActivePersona`-resolved, returns only the caller's own derived
  model — never another persona's. It follows the exact contract of `/api/memory/invariants`.
- Reasoning-trajectory `signature` values are activation sequences of **platform-invariant
  seed ids** (T2-safe), never memory row contents and never personaIds.
- The ground-block summary is spine-persona only (the body's `personaId` fallback is never
  trusted for durable per-persona state — identical rule to the memory-retrieval block).
- No modification to identity-spine files, the DVN pipeline, or the memory tables'
  semantics. The observer model is strictly additive and read-only.

---

## §6 Ratification checklist (operator to decide)

1. **Observer model as a VIEW, not a store** — confirm the constitutional framing: observer
   modelling reads/derives from ratified substrate and writes nothing new, so its read layer
   (§4.1–4.3) is a non-constitutional extension safe to ship alongside this `draft` charter.
   (Built alongside authoring; confirm it should stand.)
2. **`ObserverModel` shape** — confirm the four longitudinal signal groups (memory maturity
   tiers, partnership acceptance/revision, dominant trajectories, stability-by-cartridge)
   plus the optional caller-attached posture. Add/remove any signal before the shape sets.
3. **Ground-block summary** — confirm the copilot SHOULD carry a compact longitudinal
   posture line (partnership evolution), not just the current memory snapshot; confirm the
   summary wording class.
4. **ResearchQube/CapabilityQube retrieval scoping** — ratify the honest finding that these
   qube types do not concretely exist, and that retrieval is therefore **design-only**,
   gated on their existence AND on the extension-not-parallel-retriever design (corpusRefs +
   IRE). Confirm no retriever is built until then.
5. **Deferred decisions stay parked** — confirm DVN-receipts-for-memory and
   trajectory-primed retrieval remain unbuilt and undecided (§3).
6. **Epistemic placement** — confirm the doctrine claims (observer model as read-only view;
   observed-never-asserted; T-discipline; extension-not-parallel) enter as `canonical`,
   while every claim that observer modelling *improves* the partnership or *predicts* better
   compression stays `proposed` pending EXP-014+ evidence.

---

## §7 Where this sits in the cycle (CFS-046)

```
… → Post-Inference Compression → Constitutional Memory → Observer Evolution → Better Pre-Inference Compression → …
                                                            ▲ THIS CHARTER (read/derive VIEW)
                                                                                 ▲ §2 (design-only) deepens this rung
```

CFS-047 builds the *read* at the Observer Evolution rung and *designs* (does not build) the
domain-corpus deepening at the Pre-Inference Compression rung. It closes no new write path;
it makes the cycle's existing state legible to the copilot and to the operator.
