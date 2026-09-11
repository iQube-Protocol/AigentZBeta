# Invariant Projection Engine (IPE) — Constitutional Capability Brief (CCB v2)

**The third of three instrument briefs.** Discover → Resolve → Project. The IDE
(`2026-07-27_ccb-invariant-discovery-engine.md`) discovers, the IRE
(`2026-07-27_ccb-invariant-resolution-engine.md`) resolves, the IPE **projects**. CFS-039 §0 states
the separation: *"the IPE **never resolves** invariants; it always consumes a field the IRE
produced."*

Schema `capability-completion-artifact/v2.0`. CFS-049 Brief carrying CCR-001's completion sections.
The status discipline used here is stated in the IDE brief and applies unchanged: `validated`
requires both a canary and an observed defect on record; everything else is `proposed`.

**This is the engine with the weakest completion state of the three, and that is the finding.**
Not one of its invariants qualifies for `validated` — none has both a canary and a defect on record
— and two of them (IPE-1, IPE-4) are recorded as not holding today. EXP-P1 Stage 0 is chartered to
validate this engine as an instrument (`types/research.ts:239-243`, `472-473`); it currently has
neither a capability record nor a canary for its central contract.

**Read-only audit.** No engine behaviour was changed.

## Capability identity

| Field | Value |
|-------|-------|
| Capability ID | `invariant-projection-engine` |
| Display label | Invariant Projection Engine (IPE) |
| Artifact version | 1.0 |
| Schema | `capability-completion-artifact/v2.0` |
| Date | 2026-07-27 |
| Governing documents | `CFS-039`, `CFS-035`, `CFS-037`, `CFS-017`, `CCR-001`, `CFS-049` |
| Artifact path | `codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-projection-engine.md` |
| Canon caveat | `codexes/packs/irl/foundation/CFS-039_invariant-projection-engine.md` carries the PRD-IPE-001 designation and exists; its header reads **"DRAFT, awaiting operator ratification (2026-07-17)"**. It renames and re-scopes `CFS-035_the-invariant-engine.md`, which is separately marked **Ratified (charter), 2026-07-18** — so the projector's content is ratified under its old identity while the rename that gives it the IPE name is not. There is no separate `PRD-IPE-001*.md` file. The rename is incomplete in code: the module is still `services/invariants/engine.ts` and the exported symbols still read `computeFieldSnapshot` / `groundReasoning`, deliberately (CFS-039 §1). |
| Registry status | Registration prepared in `scripts/register-ccb-capabilities.ts` (this pass). **Not yet executed** — the script needs a live DB and an operator persona. |

## Behavioural capability statement

The Projection Engine turns a governing invariant field into the platform's actual decisions. It
exposes one shared snapshot of the field that every consumer reads, derives per-dimension weights
for a decision node from what the governing invariants of each dimension have earned, and lets a
node compute a transparent, dimension-by-dimension projection instead of an opaque score. Every
node runs beside the heuristic it would replace rather than in place of it, and the comparison
between the two is emitted and stored as a time series, so an operator can watch the projection
agree or disagree with the incumbent over real traffic before deciding anything. Making a node's
projection the served answer is a separate, deliberate, receipted act, and the default in every
absent or failed condition is to serve the incumbent unchanged.

## Purpose

Most consequential decisions on a platform are made by numbers nobody can justify — a `+10` here, a
branch on a literal there, a `.sort()` at the end. The projection engine exists so those decisions
become projections of the validated invariant field instead of isolated heuristics, and so the
transition from one to the other is observable rather than a leap of faith: the projection runs in
shadow, the disagreement is recorded, and the flip is an explicit ratification with a receipt behind
it.

## Location

### Surfaces
- iQube Registry → Browse → **Field** view — the Constitutional Observatory: registered nodes, their last observation, the projection-accuracy history, and the flip control
- Runtime capsules ranking — the discovery node's shadow runs on the live capsules path
- NBE ranking — the second registered decision node
- Every grounded reasoning surface, which reads the engine's Reasoning face for its invariant slice

### Source paths
- `services/invariants/engine.ts` — the projector: the Field Snapshot, the four faces, the weight derivations, the shadow instruments, the node registry
- `services/invariants/projectionBridge.ts` — the IRE→IPE bridge: both weight derivations over one resolved field, and their agreement
- `services/invariants/nodes/discoveryRanking.ts` — the Phase-0 pilot decision node
- `services/invariants/nodes/nbeRanking.ts` — the second decision node
- `services/invariants/observationStore.ts` — durable shadow-observation history
- `services/invariants/flipStore.ts` — the shadow/authoritative flip state
- `app/api/invariants/observatory/route.ts` and `app/api/invariants/flip/route.ts` — the Observatory read and the ratification act
- `components/registry/FieldView.tsx` — the Observatory surface

### Source paths (consumers of the Reasoning face)
- `app/api/assistant/ask-agent/route.ts`, `services/artifact/runArtifact.ts`, `services/orchestration/nbeLlmRerank.ts`, `services/constitutional/renderInstrumentation.ts`, `services/constitutional/ontologyResolver.ts`, `services/composition/composeArtifact.ts`, `services/constitutional/constitutionalServicePipeline.ts`

## Invocation

- A decision node calls `getCachedFieldSnapshot` and `deriveWeightsFromStanding`, then runs its projection in shadow against the incumbent ordering — `services/invariants/nodes/discoveryRanking.ts:61`, `services/invariants/nodes/nbeRanking.ts:70`.
- `runShadow` / `runValueShadow` compute the comparison, log it, and persist it — `services/invariants/engine.ts:289-305`, `:387-409`.
- `GET /api/invariants/observatory` reads the node registry, the last observations and the persisted history. Never re-instruments.
- `POST /api/invariants/flip` — operator-gated ratification of a node to authoritative, which writes an `invariant_node_flipped` activity receipt carrying a sha256 commitment of the flip act.
- `compareProjection` is invoked from exactly two places: `app/api/invariants/resolve/route.ts:44` and `app/api/public/irl/resolve/route.ts:43`. Both are read-only observation surfaces; **no decision node consumes the coordinate path.**
- Seven reasoning surfaces call `groundReasoning` directly for their invariant slice (listed under Location). None of them passes through the IRE.

## Capability boundary

### Owns
- The Field Snapshot — the one projection of the substrate every face reads
- The derivation of a node's dimension weights from what its governing invariants have earned
- The shadow instruments: the comparison between projection and incumbent, its emission, and its durable history
- The node registry, which is the single source for the Observatory's node view
- The flip state that decides whether a node's projection is served, and its default

### Does not own
- The construction of a resolved field. The bridge consumes one the IRE produced — but see IPE-1: the Reasoning face and the node snapshot path do build their own.
- Which invariants are in the substrate, or what they are worth. Standing and reach are earned through the lifecycle, not assigned here.
- The served answer, until an operator flips a node. In shadow the caller always serves the incumbent.
- Discovery. The IPE never creates an invariant.
- The decision of any individual node — the engine supplies the seam and the weights; the projector belongs to the node.

### Dependencies
- `services/invariants/grounding.ts` `buildInvariantSlice` — the Level-1 read the snapshot composes
- A resolved field, for the coordinate path (`ResolvedConstitutionalField` from the IRE, consumed structurally, never imported as a value)
- Supabase tables `invariant_shadow_observations` (migration `20260718000000`) and `invariant_node_flips` (migration `20260718010000`)
- `services/receipts/activityReceiptService.ts` — the flip receipt, and through it the DVN anchoring pipeline

### External authorities
- The identity and access spine — the Observatory and flip routes resolve through `getActivePersona`
- The DVN pipeline's `hashPersonaRef` — no raw persona identifier reaches a flip receipt payload
- The T0/T1 boundary — `flipped_by_persona` is stored and never returned to the browser
- CFS-017's shadow-first seam, which forbids a node changing behaviour without an explicit ratification

### Emits

<!-- Recorded from what the code DOES on 2026-07-27. Of the three engines this
     is the only one whose single consequential act — the flip — is receipted,
     and the only one that emits at all on its hot path. -->

- **log** `[INVARIANT-SHADOW]` — one structured line per shadow run, from `emitShadowObservation` (rank nodes) and `runValueShadow` (scalar nodes), carrying node id, agreement or delta, item count and cited count. The observe-mode floor, explicitly modelled on `[DVN ESCALATION]`; it never throws.
- **durable-record** `invariant_shadow_observations` — one row per shadow run, written fire-and-forget by `persistObservation` from `recordObservation`. Guarded: an absent table or unreachable client degrades to in-memory-only, and in a serverless container a post-response write may not flush, so this is a statistical history and not a ledger.
- **durable-record** `invariant_node_flips` — the shadow/authoritative state, written by `setNodeFlip` on an authenticated operator flip. Absent row means not authoritative (IPE-5).
- **receipt** `invariant_node_flipped` — written by `POST /api/invariants/flip` after the flip state has persisted, carrying the node id, the new state and a sha256 commitment of the flip act; the persona is hashed by the DVN pipeline, so no raw identifier reaches the payload. DVN-anchorable. Best-effort by design: the flip already succeeded, so a receipt failure must not fail the request — which means a flip row can exist with no receipt behind it.

## Implementation freedom

The weight formula, the normalisation, the rank-agreement metric, the cache TTL, the number of
dimensions per node, the storage of the observation history and the transport of the flip state may
all differ in a reimplementation. What may not differ is the *default and the direction*: an absent
snapshot, an absent flip row, an absent table or a thrown projector all resolve to the incumbent
being served unchanged; a projection is compared before it is trusted; the comparison is recorded
durably rather than inferred; and the field always flows one way — resolved, then projected, never
projected and then resolved to justify it.

## IPE-1 — The projector consumes a field; it never resolves one

A projection is computed over a field that was resolved elsewhere. The projector may read a field,
weight it, compare it and record the comparison; it may not construct the field it is about to
project.

- **Provenance:** adversarially-derived
- **Status:** proposed
- **Stage:** observed
- **Broke it:** **This holds for the bridge and does not hold for the engine.** `services/invariants/projectionBridge.ts` is clean — it imports `ResolvedConstitutionalField` as a type only and composes two pure functions, and `services/invariants/engine.ts:100-103` states the rule explicitly: *"engine.ts (the IPE) never imports the IRE, so there is no cycle: the projector consumes a field, it does not construct one."* But CFS-039 §1 designates `engine.ts` itself as the IPE, and that module **does** construct fields: `computeFieldSnapshot` (`:47-53`) builds one from `buildInvariantSlice`, `groundReasoning` (`:60-65`) is that call under another name, and `getCachedFieldSnapshot` (`:150-166`) is how every decision node obtains the snapshot it weights from. So the Constitutional Projection face weights from a snapshot the IPE resolved for itself, and the Reasoning face resolves a slice for seven consumers with no IRE involvement at all. CFS-039 §2 anticipates this — *"the slice it returns is the IRE-resolved region, so grounding is intent-scoped by construction"* — but records it as an upgrade to be made, not a property that holds.
- **Enforced by:** `tests/instrument-engine-briefs.test.ts` — asserts, for the bridge, that `projectionBridge.ts` imports the resolution module as a type import and never as a value, and that `compareProjection` performs no substrate read.
- **Remediated — landed 2026-07-28.** The engine-wide half, which this record said could not honestly be canaried until the contract was either satisfied or narrowed, was **satisfied rather than narrowed**. A concurrent session moved field construction out of `engine.ts` into `services/invariants/grounding.ts` (the substrate reader), composed upward by `resolution.ts` (the IRE); `engine.ts` now imports only the type, exactly as the bridge already did. Crucially, no self-resolving fallback was introduced — "accept an injected field, resolve when absent" is prohibited rather than implemented, so an absent field yields a faithful projection reporting `engaged: false` (a refusal to measure) instead of a silent fetch, and both derivations stay synchronous so the fallback cannot be smuggled back in. The nine grounding surfaces are now classified as data a readiness check reads rather than as prose in this brief: five routed to the IRE, two already governed, and two (`compose-artifact`, `run-artifact`) honestly classified `governed-unrouted` because neither input type carries an intent text. That last pair is the honest residue — it is excluded from constitutional claims rather than quietly counted.

## IPE-2 — Absent inputs project faithfully

A weight derivation with no snapshot, no coordinates, or no positive earned value returns all-1 —
mathematically the identity — so a node stays behaviour-preserving until its governing invariants
have earned something. The coordinate path is additive: a caller that does not opt in sees no
change.

- **Provenance:** proposed
- **Status:** proposed
- **Stage:** candidate
- **Broke it:** No defect on record. The property is designed in from CFS-039 §2's additive/backward-compatible requirement and stated at `services/invariants/engine.ts:119-123`; recorded at `proposed` rather than claiming evidence that does not exist.
- **Enforced by:** `tests/instrument-engine-briefs.test.ts` — asserts both derivations return all-1 for a null input, an empty input, and an input whose governing invariants carry zero, and that a non-trivial input produces mean-normalised weights that are not all-1, so the faithful case is proved to be a real branch rather than the only branch.

## IPE-3 — Shadow is observe-only: it never mutates the served answer and never throws

A shadow run computes the projection, compares it with the incumbent, emits and records the
comparison, and returns. The caller always serves the incumbent. Any failure anywhere in that path
degrades to no observation, never to an error on the observed surface.

- **Provenance:** proposed
- **Status:** proposed
- **Stage:** candidate
- **Broke it:** No defect on record. Designed in from CFS-017's observe-mode-first seam and CFS-035 §11; recorded at `proposed` rather than claiming evidence that does not exist.
- **Enforced by:** `tests/invariant-engine-discovery-shadow.test.ts` — asserts `runShadow` does not mutate the incumbent order and returns a comparison, that `compareShadow` flags disagreement when the top item differs, that rank agreement is 1.0 for identical order and 0.0 for a full reversal, and that the node's projection total is a faithful re-expression of the incumbent formula.

## IPE-4 — A divergence signal must mean what it is documented to mean

When an instrument reports that two derivations of the same quantity disagree, the disagreement must
be attributable to the difference the instrument was built to detect. A signal that fires on an
artefact of the implementation is worse than no signal, because it will be read as evidence.

- **Provenance:** adversarially-derived
- **Status:** proposed
- **Stage:** observed
- **Broke it:** **This invariant does not hold today, and the failure is doubled.** `services/invariants/projectionBridge.ts:11-16` states that *"because the default coordinate axis (evidenceDensity) IS the standing axis, the two agree by construction today"*, and that any divergence is therefore the CCR research signal; `services/invariants/engine.ts:119-122` repeats the claim. It is not accurate. The coordinate axis is **not** the standing axis: `deriveWeightsFromStanding` reads raw `standing`, which the substrate constrains to 0–100, while `evidenceDensity` is `clamp01(standing)` (`services/invariants/resolution.ts:172`), which is 1.0 for every invariant with standing ≥ 1 (see the IRE brief, IRE-6). So the standing path produces weights proportional to earned standing while the coordinate path produces a flat vector, and they diverge whenever the governing invariants have unequal standing — which the discovery node's seeds are *deliberately* given (`services/invariants/nodes/discoveryRanking.ts:35-42`: *"seed validation priors (need>importance>trust>novelty) that set their standing"*). An operator reading `diverges: true` on `/api/invariants/resolve` would be reading a units mismatch as a constitutional finding. The mirror-image failure is equally live: because the resolved field is intent-scoped, its slice frequently contains none of the four seed ids, in which case **both** derivations fall through to all-1 and report `diverges: false` — agreement produced by neither path resolving anything, which is the inert-mechanism shape (MS-7 / CB-2). The signal is therefore uninterpretable in both directions.
- **Enforced by:** Nothing at the time of the audit. `compareProjection` had no canary at all — before this pass no test file in the repository imported `projectionBridge`, `compareProjection` or `deriveWeightsFromCoordinates`. A canary asserting the documented behaviour would have failed and one asserting the current behaviour would have pinned the defect, so `tests/instrument-engine-briefs.test.ts` pinned only the substrate ranges the mismatch turns on.
- **Remediated — landed 2026-07-28.** The same concurrent session added an incomparability signal to the bridge: a projection in which either path merely defaulted is now reported as incomparable rather than as agreeing, so the mirror-image failure above can no longer render as `diverges: false`. Canaries cover both directions — that two defaulting paths are refused as agreement, that one defaulting path is enough to make the comparison incomparable, that a genuinely matched field still reports comparable (the positive control), that the trace line never prints "agrees" for an incomparable projection, and that every projection carries the calibration convention it was computed under. Combined with the IRE-6 conversion fix, the units mismatch that made `diverges` fire spuriously is also gone.

## IPE-5 — Authority is opt-in, operator-gated and receipted; the default is faithful

A node's projection is served only after an explicit flip. An absent flip row, an absent table, an
unreachable client or any error resolves to *not* authoritative, so the incumbent is served. The
flip itself is an authenticated act that writes an attributable receipt carrying a commitment to
what was flipped and to what.

- **Provenance:** proposed
- **Status:** proposed
- **Stage:** candidate
- **Broke it:** No defect on record. Designed in from CFS-035 §11 and implemented at `services/invariants/flipStore.ts:31-45` and `app/api/invariants/flip/route.ts:74-91`; recorded at `proposed` rather than claiming evidence that does not exist. This is nonetheless the only place in the three engines where a consequential act reliably produces an attributable, DVN-anchorable receipt.
- **Enforced by:** `tests/instrument-engine-briefs.test.ts` — asserts `isNodeAuthoritative` returns false when the substrate is unreachable (fail-faithful, not fail-authoritative), and that the flip route's receipt carries a commitment rather than a raw persona identifier.

## IPE-6 — One seam: every face reads the same snapshot

Nothing embeds its own invariant logic. A consumer that needs governing invariants reads the
engine's Reasoning face rather than hand-rolling a slice, and the Observatory reads the node
registry rather than re-instrumenting the nodes.

- **Provenance:** cross-capability-recurrence
- **Status:** proposed
- **Stage:** candidate
- **Broke it:** This is `inv.engineering.036` / `inv.engineering.037` inside the engine. The Phase-1 consolidation named in CFS-035 §11 exists precisely because reasoning surfaces had each hand-rolled `buildInvariantSlice`; `services/orchestration/nbeLlmRerank.ts:151-153` still carries the note recording the hand-rolled slice it replaced. Recorded at `proposed` because the consolidation is real but no canary prevents a new surface from bypassing the seam — `tests/copilot-invariant-grounding.test.ts` enforces the analogous rule only for the copilot grounding path.
- **Enforced by:** No canary covers the general rule. A structural canary over new callers of `buildInvariantSlice` is the smallest thing that would close it; it is recommended in the report rather than written here, because the set of legitimate direct callers is a scoping decision rather than an audit finding.

## Reproduction procedure

1. Provide a substrate read that returns a context-filtered, ranked, capped slice of governing invariants with their earned standing.
2. Define one snapshot object — the context it was projected from, the slice, the cited ids, and a caller-stamped time. Never read the clock inside the engine.
3. Derive dimension weights from a snapshot and a map from each dimension to the seed id of the invariant that governs it: weight proportional to earned value, mean-normalised to one. Return all-1 when there is no snapshot or no positive value.
4. Provide the same derivation over a resolved field's coordinates, on a chosen axis, defaulting to the axis that corresponds to the standing measure. **Convert the axis from its real range; do not clamp** (see IPE-4).
5. Define a node as a pure projector from inputs and an optional snapshot to a ranked or scalar decision with a per-dimension breakdown and the cited ids. Purity is what lets it run on a hot path.
6. Run every node in shadow: compute the projection, compare it with the incumbent by rank agreement or scalar delta, emit a structured log, record it in memory and persist it fire-and-forget. Never throw, never block, never change the served answer.
7. Have nodes self-register their metadata at module load, and have the observation surface read that registry rather than instrumenting the nodes a second time.
8. Store the flip state separately, defaulting to not-authoritative on every absent or failed read, and make the flip an authenticated act that emits an attributable receipt with a commitment to the act.
9. Bridge to the resolver by running both derivations over one resolved field and reporting their agreement — and make sure the two paths are commensurable before treating their difference as a finding.

## Modification rules

- Adding a decision node is additive and needs no ratification, provided it registers its metadata, runs in shadow, and defaults faithful.
- Flipping a node to authoritative is a ratification, not an implementation change. It must stay operator-gated and receipted (IPE-5).
- Any change that makes a shadow path able to throw, block, or alter the served ordering violates IPE-3.
- Any change that makes the faithful default anything other than all-1 / incumbent violates IPE-2 and silently changes behaviour on every surface that has not yet earned standing.
- Correcting the coordinate axis (IPE-4 / IRE-6) changes the divergence signal, the operational estimates, and any EXP-P1 Stage 0 reproducibility figures already taken. It needs an operator ruling and a re-baseline, not a patch.
- Completing the CFS-039 rename in code, or narrowing the "never resolves" contract to the bridge, are both legitimate resolutions of IPE-1 — but one of them must happen. A contract stated in two documents and contradicted by the module they name is the stale-duplicate defect this standard exists to eliminate.

## Known hazards

- **`diverges` is currently uninterpretable in both directions.** See IPE-4. Do not build a research claim on it, and do not read `diverges: false` as agreement.
- **The coordinate path reaches no decision.** `deriveWeightsFromCoordinates` is invoked only through `compareProjection`, which is invoked only by two read-only observation routes. The IRE-fed projection path is defined and observed but has no consequence — CFS-053's CB-2 shape, present in a mechanism that looks live because it is genuinely called.
- **`groundReasoning` is a thin alias for `computeFieldSnapshot`.** A reader who assumes the Reasoning face does something more than build a snapshot — intent scoping, IRE consumption, citation accrual — will be wrong. The Phase-1 consolidation renamed the call site; it did not change what happens.
- **Shadow observations are best-effort in a serverless container.** A post-response write may not flush. The store documents this and it is acceptable for a statistical history, but the history is not a ledger and must not be read as one.
- **The engine caches snapshots per key for sixty seconds.** A standing change does not propagate to a node's weights immediately, which will look like non-determinism to anyone measuring reproducibility across a short window — directly relevant to EXP-P1 Stage 0's IPE reproducibility question.
- **The rename is deliberately incomplete.** The module is `engine.ts`, the symbols are `computeFieldSnapshot` / `groundReasoning`, and CFS-039 §1 records that this is intentional and low-risk. Searching the codebase for "IPE" will not find the engine.

## Operational evidence

- Two decision nodes are registered and run in shadow on live paths — `services/invariants/nodes/discoveryRanking.ts`, `services/invariants/nodes/nbeRanking.ts`; their projection parity with the incumbent formula is asserted by `tests/invariant-engine-discovery-shadow.test.ts`.
- Shadow observations persist to `invariant_shadow_observations` (migration `supabase/migrations/20260718000000_invariant_shadow_observations.sql`) and are rolled up for the Observatory by `getObservationHistory`.
- The flip act is receipted with a DVN-anchorable action type — `app/api/invariants/flip/route.ts:86`, with the receipt type added by `supabase/migrations/20260718020000_invariant_node_flipped_receipt_type.sql`.
- The Observatory surface reads the engine rather than re-instrumenting it — `components/registry/FieldView.tsx:179`.
- The Phase-1 coordinate path and the bridge are recorded as shipped in `codexes/packs/agentiq/updates/2026-07-17_ire-prd-family-phase0-builds.md`; the engine's Phases 1–4 in `codexes/packs/agentiq/updates/2026-07-18_cfs-035-engine-phases-1-4.md`.
- Full suite at the time of writing: 157 files / 2199 tests passing, exit 0 (2026-07-27).

## Commons publication record

| Field | Value |
|-------|-------|
| Proof class | constitutional |
| Claim scope | These six invariants, as governing the Invariant Projection Engine on this platform, at the state of the code audited on 2026-07-27. IPE-1 and IPE-4 are recorded as NOT HOLDING. This is not a claim that projections are better decisions than the heuristics they shadow — that is what the shadow comparison and a flip exist to establish — only a claim about the direction the field must flow and about what must remain true before a projection may be served. |
| Evidence references | `tests/invariant-engine-discovery-shadow.test.ts`, `tests/instrument-engine-briefs.test.ts`, `tests/capability-completion.test.ts` |
| Approval record | None — not yet submitted |
| Published | no |
| Lineage — capability | `invariant-projection-engine` |
| Lineage — artifact | `codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-projection-engine.md` |
| Lineage — sources | `services/invariants/engine.ts`, `services/invariants/projectionBridge.ts`, `services/invariants/nodes/discoveryRanking.ts`, `services/invariants/nodes/nbeRanking.ts`, `services/invariants/observationStore.ts`, `services/invariants/flipStore.ts`, `app/api/invariants/flip/route.ts` |
