# Phase 4 (Stage 5) — runtime adoption: grounding slice, constitutional veto legibility, closed Reach arc

**Date:** 2026-07-04
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Constitutional anchor:** CFS-006 (Adaptive Runtime), CFS-008 (Reasoning Compression), CFS-010 §Stage 5.

## Context: Phase 4 was not greenfield

The Consequence Operating Model (Phase 3, CFS-006a) already built most of Stage 5's
machinery — `runConsequencePipeline` already computes dispositions from the invariant
graph, and `forecastConsequences` already makes the guardian's veto invariant-informed
rather than lexical. Reconnaissance against the live code found the **real** remaining
gaps, and this increment closes the four highest-value, lowest-risk ones.

## What shipped

### 1. Runtime grounding module — `services/invariants/grounding.ts` (new)

The runtime-facing layer of the Invariant Service. Two operations, both wired:

- **`buildInvariantSlice(context)`** — turns a runtime context (domains, ontology
  classes, namespaces) into the context-filtered, **standing-ranked** (Law XII: standing
  primary, reach a tiebreak only — adoption can never masquerade as authority),
  T1-safe slice of applicable **validated/canonical** invariants. Draft/proposed
  statements are candidates, not knowledge (CFS-008 §1), and are excluded. Multi-domain /
  multi-class contexts resolve as a de-duplicated union of single-filter queries.
- **`citeInvariants(ids)`** — the consequence return path (CFS-006 §4, CFS-008 §2 reuse
  count). Records that grounding invariants were *used*, bumping usage → Reach.

Everything returned is a projection of `InvariantRecord` (T0 excluded by construction);
slices carry statement-level meta only, never blakQube payloads.

### 2. Grounding mandate extended (CFS-006 §2) — `services/orchestration/groundingContract.ts`

- `GROUNDING_MANDATE` gains one line: when validated invariants are supplied, treat them
  as canonical memory, reason FROM them, never contradict one, cite what you rely on.
- New `INVARIANT_GROUNDING_CLAUSE` — appended by surfaces that render a ranked slice into
  the prompt body. Kept separate so surfaces without a slice don't carry an instruction
  they can't honour.

### 3. Invariant slice in specialist packets (CFS-006 §2) — `specialistRouter.ts` + `ask-agent/route.ts`

- `SpecialistContext` gains an optional `invariantSlice` (seedId + statement + namespace).
- `userPromptFor` renders it as a canonical-memory block; `systemPromptFor` appends the
  invariant clause only when a slice is present.
- **Citation by seedId, not UUID** — the router's `redact()` pass strips all UUIDs (its
  T0 safety net), so the raw invariant UUID would be blanked; the human-legible seed
  marker (`inv.constitutional.001`) survives and is a better citation token.
- `ask-agent/route.ts` builds the slice scoped to the active cartridges, with a broad
  highest-standing fallback so it's never empty on a seeded substrate. Enrichment-only:
  any failure yields no slice and the consultation proceeds ungrounded. This path only
  *grounds* — it does **not** record usage (a consult is advisory; CFS-008 §2 scopes
  reuse-count to executions).

### 4. Guardian veto made constitutionally legible (CFS-006 §2) — `stages.ts` + `types/consequence.ts`

`forecastConsequences` now distinguishes a **constitutional constraint** (a reachable
`constrains` edge from a `canonical`, `constitutional`-namespace, `constraint`/`law`
invariant) from an ordinary canonical constraint. New forecast fields
`constitutionalConstraint` + `constitutionalConstraintIds` and an enriched rationale name
the constitutional basis of an escalation. **Additive — `forcesEscalation` is unchanged,
so this never widens or narrows what escalates; it only makes the strongest reason
legible.**

### 5. The flywheel's Reach arc closed (CFS-006 §4) — `operatingModel.ts`

`executeApproved` already closed the **Standing** arc (`recordConsequence` →
validation-class). The **Reach** arc (adoption-class, orthogonal per Law XII) was open:
`recordUsage` existed but was **called nowhere** — the runtime spent knowledge and never
recorded that it earned adoption. `executeApproved` now calls `citeInvariants` on the
plan's grounding invariants, sequenced **after** the evolution loop so the two
read-modify-write arcs never race on a row.

## Deferred (explicitly not claimed done)

- **Session-start knowledge initialization** (CFS-006 §3 / CFS-008 §5) — the cacheable
  dependency-closure pre-load. The bootstrap surface is browser-bound and the real
  consumer is the server-side agent context; this needs a server-side consumer + a
  proper `(context, class-set, canon version)` cache, built when that consumer lands.
- **Dedicated `invariantsUsed` receipt column** — reuse-count currently rides the
  invariant's own `timesUsed`/Reach (via `citeInvariants`) plus the existing
  `compressed_invariant_ids` in consequence outcome-event metadata. A first-class receipt
  column is an additive migration for the CFS-008 measurement paper.
- **CFS-007 renderer abstraction** over CopilotKit + liquid templates.
- **Context-domain precision** for the specialist slice — currently active-cartridge
  scoped with a top-standing fallback; tighter domain/ontology mapping once the seeded
  context-domain vocabulary is confirmed.

## Verification

All eight touched files parse-check clean (esbuild). The one consequence test
(`tests/consequence-pipeline.test.ts`) exercises only the pure heuristics and pipeline
constants — untouched here — so it stays green; the substrate-touching stages
(curation, forecasting, grounding) are DB-dependent and verified in the operator
environment, per the repo's stated convention. No migrations, no seed changes.

## Operator actions

None. Live after the next deploy: specialist consultations (Ask specialists) are now
grounded on validated invariants; consequence-plan executions record invariant adoption
(Reach); and a constitutional constraint in a forecast is now named as such.
