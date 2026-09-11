# Invariant Resolution Engine (IRE) — Constitutional Capability Brief (CCB v2)

**The second of three instrument briefs.** Discover → Resolve → Project. The IDE
(`2026-07-27_ccb-invariant-discovery-engine.md`) discovers, the IRE **resolves**, the IPE
(`2026-07-27_ccb-invariant-projection-engine.md`) projects. `services/invariants/resolution.ts:5-9`
states the constitutional rule this engine exists to hold — **"RESOLUTION PRECEDES REASONING"** —
and the separation it depends on: *"the IRE resolves; the Invariant Projection Engine projects. The
IPE never resolves a field; it consumes one produced here."*

Schema `capability-completion-artifact/v2.0`. CFS-049 Brief carrying CCR-001's completion sections.
The status discipline used here is stated in the IDE brief and applies unchanged: `validated`
requires both a canary and an observed defect on record; everything else is `proposed`.

**Read-only audit.** No engine behaviour was changed. IRE-6 records a defect that is live in the
code today and is escalated rather than fixed, because fixing it changes calibration numbers that
EXP-P1 Stage 0 is chartered to measure.

## Capability identity

| Field | Value |
|-------|-------|
| Capability ID | `invariant-resolution-engine` |
| Display label | Invariant Resolution Engine (IRE) |
| Artifact version | 1.0 |
| Schema | `capability-completion-artifact/v2.0` |
| Date | 2026-07-27 |
| Governing documents | `CFS-037`, `CFS-038`, `CFS-041`, `CCR-001`, `CFS-049` |
| Artifact path | `codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-resolution-engine.md` |
| Canon caveat | `codexes/packs/irl/foundation/CFS-037_invariant-resolution-engine.md` carries the PRD-IRE-001 designation and exists. Its own header still reads **"Architectural Foundation — DRAFT, awaiting operator ratification (2026-07-17)"**, while the shipped code header reads *"RATIFIED 2026-07-17"* and `codexes/packs/agentiq/updates/2026-07-17_cfs-037-ire-ratified-p0.md` records the ratification. The spec document was never updated to match. There is no separate `PRD-IRE-001*.md` file. |
| Registry status | Registration prepared in `scripts/register-ccb-capabilities.ts` (this pass). **Not yet executed** — the script needs a live DB and an operator persona. |

## Behavioural capability statement

The Resolution Engine answers, before any reasoning happens, which invariants govern the thing about
to be reasoned about. Given a statement of intent it qualifies what the intent is about, grounds a
universal constitutional baseline, expands that baseline with whatever domains the intent localises
to, calibrates each resulting invariant against the axes the record has actually earned, and
assembles the result into one field object carrying its own confidence, the identifiers it cited,
and an honest marker of what this phase of the engine can and cannot claim. It never gates anything
and never writes anything; a caller that fails to reach the substrate receives a field with the
qualification intact and the grounding empty, rather than an exception or a fabricated slice.

## Purpose

Grounding a copilot in "the invariants" is meaningless unless something decides *which* invariants,
and the naive answers are both wrong: the whole library is too large to inject and dominated by
whatever happens to have the highest standing, while a per-surface hand-picked list is a parallel
implementation that drifts. The IRE is the constitutional analogue of a query planner — it analyses
the intent, resolves the governing region, and returns it with citations — so that every grounded
surface stands on one substrate resolved one way, and a cartridge context narrows what surfaces
without ever deciding whether the substrate exists at all.

## Location

### Surfaces
- iQube Registry → Browse → **Field** view → the Resolved-Field panel, where an operator enters an intent and sees the region it resolves
- Platform copilot (codex chat) → every turn's system prompt carries a "Governing platform invariants" block, cited by seed id
- MoneyPenny chat → the same block, scoped to the `finance` namespace
- The public IRL resolve endpoint, which serves the same resolution to an unauthenticated reader

### Source paths
- `services/invariants/resolution.ts` — the engine: five phases, coordinate calibration, the citable projection, the injection budget
- `services/invariants/perception.ts` — phase 1, the keyword field extractor
- `services/invariants/grounding.ts` — the `GroundingContext` shape and the slice builder the engine grounds through
- `services/invariants/coordinates.ts` — the Constitutional Coordinates Registry that supplies every coordinate's basis string
- `app/api/invariants/resolve/route.ts` — the Observatory's Resolved-Field backbone
- `app/api/public/irl/resolve/route.ts` — the public surface over the same call
- `services/companion/observerContext.ts` — the browser-observation input path (composed, not yet produced from)

## Invocation

- `POST /api/invariants/resolve` with an intent and optional domains — spine-gated, any authenticated persona; returns the resolved field, its coordinates, the operational estimates and the CCR basis summary.
- `POST /api/public/irl/resolve` — the same resolution on a public surface.
- `app/api/codex/chat/route.ts:2986-3012` calls `resolveCommonConstitutionalGround` once per turn and folds the result into the system prompt, topped up from session memory to the budget ceiling.
- `app/api/moneypenny/chat/route.ts:107-108` calls `resolveCitableInvariants` scoped to `finance` and formats the same block.
- `services/constitutional/constitutionalServicePipeline.ts:154-156` calls `resolveConstitutionalField` and `describeResolvedField` to produce the pipeline's step-1 trace string.
- `components/registry/FieldView.tsx:338` posts to the resolve route from the Observatory panel.
- `services/companion/observerContext.ts` composes arguments for `resolveConstitutionalField` from a browser observation. **No producer exists** — the module's own header records that nothing constructs a live observation and that it is wired into no surface. It is a prepared input path, not an invocation.

## Capability boundary

### Owns
- Which invariants govern a given intent, and the confidence attached to that answer
- The five-phase resolution sequence — qualify, universal pass, domain expansion, calibration, assembly
- The structural coordinate calibration, and the rule that a coordinate needing actor context is null rather than estimated
- The invariant injection budget shared by every grounded surface
- The rule that an overlay narrows the resolved region and never removes it

### Does not own
- Whether the reasoning that follows actually uses what was resolved. The IRE offers a field; it gates nothing.
- The projection of a resolved field into weights, rankings or routing — that is the IPE's, and the IRE never calls it.
- Discovery. The IRE resolves over invariants that already exist; it never creates one.
- Semantic qualification. Phase 1 is a keyword estimator, named as such, with the semantic drop-in deferred.
- Constitutional-class coordinates (authority, consent, delegability). They need actor context the engine does not have and are carried as null.

### Dependencies
- `services/invariants/engine.ts` `computeFieldSnapshot` — the shared substrate read both engines compose over
- `services/invariants/perception.ts` `extractField` — phase-1 qualification
- `services/invariants/coordinates.ts` `basisFor` — every coordinate's provenance string, so no basis is ever an inline literal
- A reachable invariant substrate. Absent one, the engine degrades to a null-snapshot field rather than failing.

### External authorities
- The identity and access spine — the authenticated resolve route resolves the caller through `getActivePersona`
- The T1 exposure boundary — a resolved field carries statements, scores and domains, never a persona identifier
- The invariant substrate's own scales — `standing` and `reach` are database-constrained to 0–100, which is the authority IRE-6 turns on

### Emits

- None.

### Emission rationale

The IRE emits nothing: no receipt, no row, no structured log. `resolveConstitutionalField` is pure composition over a read, and `services/invariants/resolution.ts` binds no Supabase client and no receipt writer at all (IRE-7, canaried). **This is recorded as an unresolved finding, not as a design property, and the convenient rationale is the wrong one.** Read-only-ness does justify emitting no *receipt* — CFS-053 §5.3 bounds CB-3 and CB-4 to mechanisms that effect a state transition of record, and a resolver effects none — but it does not justify emitting *nothing*, because CB-1 and CB-2 bind every constitutional mechanism without exception. The consequence is concrete rather than theoretical: because a resolution leaves no trace, there is no evidence from which anyone can establish whether a given governed turn was grounded through this engine or bypassed it, and seven of the nine grounded reasoning surfaces do bypass it (see Known hazards). An instrument whose operation is unobservable cannot have its readiness established, which is exactly what EXP-P1 Stage 0 is chartered to do. IRE-8 records the invariant this violates; `emits: []` here is the honest present state, not the target one.

## Implementation freedom

The qualification method, the slice cap, the universal proxy namespaces, the confidence weighting,
the coordinate axes and the number of phases may all differ in a reimplementation, and the engine's
own header says the keyword estimator is a placeholder for a semantic one. What may not differ is
the *ordering and the honesty*: resolution happens before reasoning and not alongside it; the
substrate is resolved unconditionally and an overlay may only narrow it; a value that cannot be
derived is null rather than estimated; every derived number carries the basis that produced it; and
a failure to reach the substrate degrades the answer rather than fabricating one.

## IRE-1 — The substrate is unconditional; an overlay is an argument, never a gate

Every turn resolves the common constitutional ground, and the cartridge overlay is passed as an
argument to that resolution. A caller must never guard the resolution call itself on the overlay
being present.

- **Provenance:** regression-derived
- **Status:** validated
- **Stage:** validated
- **Broke it:** Grounding was gated on `groundContext`, a cartridge signal, so the richest copilot surfaces — the ones with no cartridge context — were grounded on nothing at all. The category error is recorded in the function's own contract at `services/invariants/resolution.ts:388-402` and in `codexes/packs/agentiq/updates/2026-07-26_constitutional-ground-base-vs-overlay.md`.
- **Enforced by:** `tests/copilot-invariant-grounding.test.ts` — the negative canary asserts common ground resolves with no cartridge context at all, that resolution happens before the prompt-path split so the composer is grounded too, and that the base block renders outside every `groundContext` branch.

## IRE-2 — A scoped miss falls back to the unscoped field

When an overlay narrows the resolution to a region that comes back thin or empty, the engine
re-resolves unscoped rather than returning nothing. This holds for every scoping signal —
namespaces, domains and ontology classes — not just the one that first exhibited the problem.

- **Provenance:** regression-derived
- **Status:** validated
- **Stage:** validated
- **Broke it:** A domain-scoped resolution over a small library (`finance`, with a handful of invariants) returned an empty citation list, which made the common ground conditional on the overlay — the same category error as IRE-1, arriving through the data rather than the control flow. Recorded at `services/invariants/resolution.ts:325-347`.
- **Enforced by:** `tests/copilot-invariant-grounding.test.ts` — asserts the fallback triggers for every scoping signal, not only namespaces.

## IRE-3 — One injection budget, not three literals

The caps governing how many invariants reach a prompt live in a single exported constant, and every
injection site consumes it. The property the rule is about is the *sum*, so nothing may bound its
own share with a bare number.

- **Provenance:** regression-derived
- **Status:** validated
- **Stage:** validated
- **Broke it:** Three bare literals at three independent injection sites meant nothing bounded their total; a fourth uncapped path would have crowded out the cartridge corpus with no single place to notice. Recorded at `services/invariants/resolution.ts:366-374`.
- **Enforced by:** `tests/copilot-invariant-grounding.test.ts` — asserts the caps live in one exported constant, that every injection site consumes it rather than a bare number, and that the client-side cap equals the server ceiling.

## IRE-4 — Resolution never fabricates: an empty resolution yields an empty block

When the engine resolves nothing relevant, the formatted grounding block is the empty string, and
when perception localises no domain and the caller supplies none, the engine grounds in the named
universal baseline rather than unscoped.

- **Provenance:** integration-derived
- **Status:** validated
- **Stage:** validated
- **Broke it:** The IRV-001 shakedown (2026-07-18) found that an unscoped grounding returns the global highest-standing slice, which is dominated by high-standing engine-node invariants irrelevant to a domain-reasoning intent — so "no domain localised" was silently answered with "here is the global top", which reads as a confident answer. Recorded at `services/invariants/resolution.ts:235-241`.
- **Enforced by:** `tests/instrument-engine-briefs.test.ts` — asserts `formatCitableInvariantsBlock([])` is exactly the empty string, that a non-empty list produces a block naming each seed id and statement, and that `resolveCitableInvariants` returns an empty list for blank intent text without reaching the substrate.

## IRE-5 — Every coordinate carries its basis, and a coordinate that needs actor context is null

Structural coordinates are derived only from axes the record has actually earned, each carrying the
basis string that produced it from the Constitutional Coordinates Registry rather than an inline
literal. Constitutional-class coordinates need actor context the engine does not have and are
carried as null — never estimated.

- **Provenance:** proposed
- **Status:** proposed
- **Stage:** candidate
- **Broke it:** No defect on record. The discipline is designed in from CFS-037 §5 and CFS-038 and has not been observed to fail; recorded at `proposed` rather than claiming evidence that does not exist.
- **Enforced by:** `tests/instrument-engine-briefs.test.ts` — asserts `calibrateStructural` returns `constitutional: null`, that all three structural coordinates carry a non-empty basis string, and that the basis strings come from the coordinates registry rather than being hardcoded in the calibration.

## IRE-6 — A coordinate must be calibrated in the units the substrate actually uses

A calibration that maps a substrate axis into the unit interval must convert that axis's real range,
not clamp it. Clamping a wider range collapses every distinguishable value above the ceiling onto a
single point, and a coordinate that cannot distinguish is not a calibration.

- **Provenance:** adversarially-derived
- **Status:** proposed
- **Stage:** observed
- **Broke it:** **This invariant does not hold today.** `services/invariants/resolution.ts:172` computes `evidenceDensity: { value: clamp01(item.standing) }`, but `standing` is a 0–100 score — `supabase/migrations/20260703200000_invariant_substrate.sql:60` constrains it with `CHECK (standing >= 0 AND standing <= 100)` and `computeStandingScore` (`services/invariants/lifecycle.ts:285-293`) returns `100 * base / (base + 40)`. Every invariant with standing ≥ 1 therefore has `evidenceDensity` exactly 1.0, so an invariant validated once and an invariant validated eight hundred times are indistinguishable on the axis meant to measure evidence density. This propagates: `reusePotential` is the mean of that saturated value and `timeToValue` is derived from it (`resolution.ts:185-192`), so both operational estimates saturate too, and the IPE's divergence signal inherits it (see the IPE brief, IPE-4). The neighbouring `adoption` coordinate carries the same misreading in its comment — it squashes `reach / (reach + 5)` while calling reach an *"unbounded adoption count"*, when `reach` is likewise database-constrained to 0–100 (`supabase/migrations/20260703230000_law_xii_truth_standing_reach.sql:15-16`). Only `verifiability` is correct, because `confidence` genuinely is a 0–1 value.
- **Enforced by:** Nothing at the time of the audit. A canary asserting the correct behaviour would have failed and one asserting the current behaviour would have pinned the defect, so `tests/instrument-engine-briefs.test.ts` pinned only the substrate ranges (`standing` and `reach` are 0–100) as the authority a future calibration must check itself against.
- **Promotion gate — the four conditions, and nothing less (operator ruling, 2026-07-27).** *"The code fix does not itself validate the invariant."* IRE-6 may move from `proposed` only after **all four** hold. This list exists so a future agent can see precisely what would earn promotion and cannot talk itself into it; a fix plus a green test suite satisfies only the first.
  1. **The corrected coordinate calculation is tested.** — ✅ met: `tests/instrument-engine-briefs.test.ts` pins the conversion behaviourally (boundaries 0→0 · 50→0.5 · 100→1, non-collapse above 1, proportionality, reach on the same scale, and that `calibrateStructural` *applies* the conversion rather than declaring it).
  2. **The IRE→IPE boundary is exercised through the governed surfaces.** — ⏳ partially met: the boundary is bound (field construction moved out of the IPE; `engine.ts` imports the snapshot type-only; no self-resolving fallback) and 7 of 9 grounding surfaces route through the IRE, but two remain `governed-unrouted` (`compose-artifact`, `run-artifact` — see `GROUNDING_SURFACES` in `services/invariants/resolution.ts`). `instrumentReadiness()` reports **unready** while either stands.
  3. **Reproducibility is rerun.** — ⛔ not met: Stage 0 has not been rerun on the corrected calibration. Requirements + the copyable command are in `codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/STAGE-0_HANDOFF.md` § "Rerun requirements". The harness refuses to score IPV against a host serving the old calibration.
  4. **The new result is recorded with hashes and formula version.** — ⛔ not met: no post-fix result exists. `scripts/run-instrument-validation.mjs` now stamps `calibration` into the payload and writes the `.manifest.json` sha256, so a rerun satisfies this by construction; `publishExperimentResult` refuses any coordinate-derived result that declares no calibration.
- **Remediated — landed 2026-07-28.** A concurrent session replaced the clamp with a proportional conversion across `services/invariants/{resolution,coordinates,engine,projectionBridge}.ts` and extended `tests/instrument-engine-briefs.test.ts` with the matching behavioural assertions — that standing converts at the boundaries (0 → 0, 50 → 0.5, 100 → 1), that standings above 1 do not all collapse to 1, that the coordinate is proportional so the two projection paths *can* agree, that reach converts on the same 0–100 scale, and that `calibrateStructural` applies the conversions rather than merely declaring them. The **Broke it** record above is kept verbatim: it is the history that earned the invariant, and CCR-INV-9 turns on being able to recognise a repeat. Status stays `proposed` pending the operator ruling this record asks for, because the correction changes every coordinate, both operational estimates and any EXP-P1 Stage 0 figures already taken.

## IRE-7 — The engine observes; it never gates and never writes

Resolution is read-only and best-effort by construction: a substrate failure degrades to a
null-snapshot field with the qualification intact, and the citable projection returns an empty list
rather than throwing, so a grounding hiccup never blocks the turn it would otherwise ground.

- **Provenance:** proposed
- **Status:** proposed
- **Stage:** candidate
- **Broke it:** No defect on record. Shadow-first is designed in from CFS-017 and stated at `services/invariants/resolution.ts:32-34`; recorded at `proposed` rather than claiming evidence that does not exist.
- **Enforced by:** `tests/instrument-engine-briefs.test.ts` — asserts the resolution module contains no write to the substrate (no `insert`, `update`, `upsert` or `delete` call) and that the citable projection's fail-open contract returns a list rather than propagating.

## IRE-8 — An instrument's operation must be observable

A resolution that governs a reasoning turn must leave evidence that it occurred.
Read-only-ness excuses a mechanism from emitting a *receipt*; it does not excuse
it from emitting *anything*, because a mechanism that leaves no trace cannot be
distinguished from one that never ran.

- **Provenance:** adversarially-derived
- **Status:** proposed
- **Stage:** observed
- **Broke it:** **This invariant does not hold today**, and it is the reason the boundary claim above can only be settled by reading import graphs rather than by reading evidence. The IRE emits nothing (see `### Emits`), so nothing on the platform records that a field was resolved, for which intent, with what confidence, or by which surface. The concrete cost: seven of nine grounded reasoning surfaces call `groundReasoning` directly and never touch this engine, and that was discoverable only by static audit — no receipt, row or log would ever have shown it, and none would show it regressing. `describeResolvedField` exists and produces exactly the trace line that would close this, and it is used only for an in-memory pipeline string and two API response bodies. Under CFS-053 this is CB-1/CB-2, not CB-3: the mechanism is bound to an observable event but produces no observable consequence.
- **Enforced by:** Nothing. A canary asserting the correct behaviour would fail on work that has not been authorised; one asserting the current absence would pin it. The `### Emits` section is now the machine-readable record of the gap — `CAN-CCR-9` enforces that it must be stated, which is what turns this from an audit finding into a queryable readiness fact.

## Reproduction procedure

1. Provide an invariant substrate with, per invariant, a statement, a namespace, a status, a confidence in 0–1, and earned standing and reach scores on a declared range.
2. Provide a grounding facility that returns a context-filtered, standing-ranked, capped slice of that substrate, and a coordinates registry that supplies a provenance string for each coordinate name.
3. Qualify: extract the domains and a confidence from the intent text. A keyword estimator is an honest v0 provided it is labelled as one and its confidence is weighted low.
4. Ground a universal baseline over the constitutional and epistemology namespaces. When the real universal library is seeded, ground in it instead — do not fabricate one meanwhile.
5. Expand: ground again over the perceived domains plus any caller-supplied context. If perception localised nothing and the caller supplied nothing, ground the universal baseline again rather than unscoped — an unscoped grounding returns the global top slice, which is a different answer wearing the same shape.
6. Calibrate per invariant from the axes the record has earned, converting each axis from its real range into the unit interval (see IRE-6 — this implementation clamps instead). Carry a basis string with every value. Leave constitutional-class coordinates null.
7. Calibrate field-level operational estimates from the calibrated set, naming each as a proxy.
8. Assemble one field object carrying the qualified intent, both snapshots, the coordinates, the estimates, an overall confidence, the union of cited ids, and a phase marker stating what this resolution may claim.
9. Expose a citable projection — seed id and statement only — with a scoped-miss fallback to the unscoped field, a single shared injection budget, and an empty-list-to-empty-string formatter.
10. Call it for every turn, passing any overlay as an argument. Never guard the call on the overlay.

## Modification rules

- Any change that makes resolution conditional on a cartridge, surface or overlay signal violates IRE-1 and is the defect the negative canary exists to catch.
- Any change that lets a scoped miss return nothing violates IRE-2. Narrow, then fall back.
- A new injection site must consume the shared budget constant (IRE-3). Adding a bare literal cap re-creates the unbounded-sum defect.
- Replacing the keyword qualifier with a semantic one is expected and requires no ratification, provided the phase marker changes with it — a consumer must never read `p0-shadow` while getting Gen-3 behaviour.
- Seeding the real universal library and switching the universal pass off the proxy namespaces is expected; do not fabricate the library to make the pass look complete.
- Fixing IRE-6 changes every coordinate, every operational estimate, and the IPE's divergence signal. It is a measurement change with an EXP-P1 Stage 0 dependency and needs an operator ruling, not a patch.
- The engine must stay read-only (IRE-7). A resolution that writes is no longer shadow-first.

## Known hazards

- **`clamp01(standing)` saturates.** The single most consequential thing to know before reading any coordinate value out of this engine. See IRE-6.
- **The universal pass is a proxy.** `UNIVERSAL_INVARIANT_LIBRARY` names sixteen baseline invariants that are **not seeded** in the crystal; the universal pass grounds in `constitutional` and `epistemology` as the closest seeded stand-in. The constant exists so the seeding pass has one home to bind to, and the runtime never assumes the library is complete. A reader who sees the constant may reasonably but wrongly believe those sixteen are resolvable.
- **`ire://` is documentary, not resolvable.** `SPEC-CDR-001` D-8 records this as an open decision and instructs that it be treated as documentary in the interim. Nothing in this engine resolves such a reference.
- **`services/companion/observerContext.ts` has no producer.** It composes arguments for this engine from a browser observation, and its own header records that nothing constructs a live observation and that it is wired into no surface. It is honestly self-declared, but a reader counting invocation surfaces will over-count if they include it.
- **The IRE does not, in fact, precede the reasoning on most grounded surfaces.** Only the codex chat and MoneyPenny chat paths ground through this engine. The assistant, artifact, composition, rerank, instrumentation and ontology-resolution paths ground directly through `groundReasoning` — including the flagship constitutional service pipeline, where `resolveConstitutionalField` produces only a trace string while the actual reasoning evidence is grounded separately (`services/constitutional/constitutionalServicePipeline.ts:101-106` versus `:151-160`). The engine's own header states resolution precedes reasoning; the code makes that true on two surfaces out of nine. This is reported as a boundary finding, not recorded as an IRE invariant, because the obligation falls on the *callers*, not on this engine.

## Operational evidence

- The Observatory's Resolved-Field panel is live and reads this engine — `components/registry/FieldView.tsx:311-345`, backed by `app/api/invariants/resolve/route.ts`.
- Two chat surfaces inject IRE-resolved blocks into their system prompts on every turn — `app/api/codex/chat/route.ts:2986-3012` and `app/api/moneypenny/chat/route.ts:107-108`, asserted by `tests/copilot-invariant-grounding.test.ts`.
- The ratification and Phase-0 build are recorded in `codexes/packs/agentiq/updates/2026-07-17_cfs-037-ire-ratified-p0.md`; the base-versus-overlay repair in `codexes/packs/agentiq/updates/2026-07-26_constitutional-ground-base-vs-overlay.md`.
- EXP-P1 Stage 0 exists to validate this engine as an instrument — `types/research.ts:224-243`, `472-473`. It has no capability record to validate against until this brief.
- Full suite at the time of writing: 157 files / 2199 tests passing, exit 0 (2026-07-27).

## Commons publication record

| Field | Value |
|-------|-------|
| Proof class | constitutional |
| Claim scope | These seven invariants, as governing the Invariant Resolution Engine on this platform, at the state of the code audited on 2026-07-27. IRE-6 is recorded as VIOLATED in the shipped code. This is not a claim that the resolved field is the correct field for an intent — that is what EXP-P1 Stage 0's Synthetic Expert Baseline exists to calibrate — only a claim about what the engine is permitted to assert and what it must refuse to invent. |
| Evidence references | `tests/copilot-invariant-grounding.test.ts`, `tests/instrument-engine-briefs.test.ts`, `tests/capability-completion.test.ts` |
| Approval record | None — not yet submitted |
| Published | no |
| Lineage — capability | `invariant-resolution-engine` |
| Lineage — artifact | `codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-resolution-engine.md` |
| Lineage — sources | `services/invariants/resolution.ts`, `services/invariants/perception.ts`, `services/invariants/coordinates.ts`, `app/api/invariants/resolve/route.ts`, `app/api/public/irl/resolve/route.ts`, `services/companion/observerContext.ts` |
