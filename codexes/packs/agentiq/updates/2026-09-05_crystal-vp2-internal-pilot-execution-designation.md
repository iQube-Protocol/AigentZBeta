# Crystal Freeze — Execution Designation (Confirmatory vs. Internal/Pilot)

**Date:** 2026-09-05
**Scope:** Crystal-lineage freeze mechanism (`services/research/artifacts.ts`, `types/research.ts`,
`app/api/research/crystal/[experimentId]/freeze/route.ts`) — generalized Crystal-wide, prompted by an
operator ruling on Crystal vP2 / EXP-P1.

## The operator's ruling (relayed, verbatim intent)

Adopt iterative Crystal versioning for EXP-P1 and close Crystal vP2 for an internal experimental run.

> A Crystal freeze makes that Crystal generation immutable; it does not terminate the Crystal
> lineage. EXP-P1 may be run internally against a frozen generation, and findings from that run may
> justify constitutionally expanding the corpus into a new successor generation. The frozen
> generation itself is never mutated.

`EXP-P1/crystal-vP2` was reported (by the operator, relaying the ruling) as holding 63 scientifically
eligible, externally grounded, validated, distinct invariants — satisfying the registered
selection-space requirement (≥ 60) — but with measured deficiencies in derivation-headroom and
boundary-coverage. Those limitations must remain recorded exactly as observed, never marked passed or
weakened, but must not by themselves block an explicitly-designated *internal/pilot* EXP-P1 execution
if the constitutional architecture permits an operator-authorized scientific deviation.

Generalized instruction: *"Frozen generations are immutable; Crystal lineages are evolutionary… That
is a much better model for IRL generally. Science shouldn't require us to perfect the experimental
substrate before we're allowed to experiment with it. It requires us to preserve exactly what we
experimented with, learn from it, and make subsequent changes explicit and reproducible."*

## What was found before any code change (preflight)

- The Crystal freeze/readiness/artifact machinery already exists and is mature:
  `services/research/artifacts.ts` (`checkFreezeGate`, `freezeArtifact`, `currentCrystalArtifactId`),
  `services/research/crystalReadiness.ts` (the nine/ten-check Crystal Intrinsic Readiness Report),
  `services/research/crystalInstrumentSuite.ts` (the check contract — tiers, remediation classes),
  `services/research/crystalPopulationRequirement.ts` (the frozen ⊆40% selection-space guard),
  `app/api/research/crystal/[experimentId]/freeze/route.ts` (the freeze act's HTTP surface).
- `derivation-headroom` and `boundary-coverage` are both `tier: 'scientific-readiness'` in
  `CRYSTAL_READINESS_CHECK_CONTRACT` — hard, unconditional freeze gates. `checkFreezeGate` required
  `readiness.ok` (every scientific-readiness check passing) before any crystal-version freeze, with
  **no explicit pilot/deviation mechanism** — exactly the narrow gap the operator's ruling asked to
  close. This was confirmed by reading the gate logic directly, not assumed.
- `freezeRationale` was validated as required by the freeze route but was **never persisted anywhere**
  — not on the artifact payload, not in the lifecycle receipt summary. A pre-existing completeness gap,
  surfaced because this ruling requires the rationale text to actually be recorded verbatim.
- **No crystal-version freeze for EXP-P1 exists yet in this repository's view of the substrate.**
  `codexes/packs/agentiq/updates/2026-09-05_exp-p1-stage8-successor-assignment-and-generation-gap.md`
  (same day, prior act) reports the LIVE assigned population for `financial-risk-value-systems` as
  **64** (11 predecessor `vP1` + 53 newly-assigned successor members) with derivation-headroom and
  boundary-coverage **still failing** — consistent in KIND with the operator's ruling (the same two
  checks failing) but the exact count differs from the ruling's stated 63. This discrepancy is flagged
  here rather than silently reconciled — the mechanism below is agnostic to the exact invariant count
  and does not hardcode 63, 64, or any other figure; the operator should re-verify the live count
  before invoking the actual freeze act.
- **No live Supabase/admin-persona access is available from this session** (no authenticated admin
  persona, no `SUPABASE_SERVICE_ROLE_KEY`) — so the actual, governed freeze act against production data
  was **not executed here**. What was built is the mechanism the operator (or an admin session with
  live access) invokes via the existing, unchanged HTTP contract.
- No execution-run runner exists anywhere in the codebase (`execution-run` artifacts are only ever
  read/counted by `services/research/readinessDashboard.ts`, never created) — building one is
  out of scope for this change (see "What was NOT done" below).

## The narrow gap, and the mechanism that closes it

`checkFreezeGate` conflated two different governance questions into one boolean: *may this generation
be frozen at all* and *is it fit for a confirmatory result*. The fix adds an explicit, per-check,
operator-authorized deviation mechanism — never a blanket waiver, never a weakened threshold:

- **`types/research.ts`** — `ArtifactExecutionDesignation` (`'confirmatory' | 'internal-pilot'`,
  defaulting to `'confirmatory'`), `ScientificDeviation` (`{checkName, measuredDetail, rationale}`),
  and four new optional `FrozenArtifact` fields: `executionDesignation`, `scientificDeviations`,
  `freezeRationale`, `readinessReportAtFreeze`. Documented as the generalized, Crystal-wide statement
  of the operator's ruling — not EXP-P1-specific.
- **`services/research/artifacts.ts::checkFreezeGate`** — for `kind: 'crystal-version'`, when
  `readiness.ok` is `false` and `executionDesignation === 'internal-pilot'`, every currently-failing
  `scientific-readiness` check must be individually named in `scientificDeviations`; any uncovered
  failing check still blocks the freeze unconditionally. When every failure is named, the gate returns
  `ok: true` while `readiness.ok` and every check's `passed`/`detail` remain **exactly as measured** —
  nothing is marked passed, no threshold moves.
- **`services/research/artifacts.ts::freezeArtifact`** — accepts `freezeRationale`,
  `executionDesignation`, and `scientificDeviations` (caller supplies only `checkName` + `rationale`;
  `measuredDetail` is **always** computed server-side from the live readiness report the gate just ran
  — never accepted as caller input, so a recorded limitation can never drift from what was actually
  measured). Persists all four fields, including the full `CrystalReadinessReport` verbatim
  (`readinessReportAtFreeze`). The lifecycle receipt summary now names the designation, the
  acknowledged deviations, and the rationale text.
- **`services/research/artifacts.ts::nextGovernedActionForFrozenCrystal`** (new, pure, generic) —
  given any frozen crystal-version artifact, returns a "Run EXP-P1 internally (pilot)" or "Run EXP-P1
  (confirmatory)" description, explicitly `executed: false`, naming the acknowledged deviations and
  restating the unchanged remediation path for an insufficient substrate. Explicitly states that no
  execution-run runner exists yet — exposure is never mistaken for execution.
- **`app/api/research/crystal/[experimentId]/freeze/route.ts`** — `POST` accepts
  `executionDesignation`/`scientificDeviations` (defaulting to `'confirmatory'`/`[]` — every existing
  caller is completely unaffected), validates them, passes them through, and returns
  `nextGovernedAction` on success. `GET` also surfaces `nextGovernedAction` for the resolved artifact
  (`null` when not frozen). No existing field, guard, or default was altered.

## Generalized invariant

Recorded as `CI-2026-09-05-FROZEN-GENERATIONS-IMMUTABLE-LINEAGES-EVOLUTIONARY-001`
(`codexes/packs/agentiq/resolution-records/candidate-invariants/`), derived from
`RES-2026-09-05-CRYSTAL-FREEZE-EXECUTION-DESIGNATION-001`
(`codexes/packs/agentiq/resolution-records/records/`). Status: `candidate` (a single occurrence — the
Resolution → Invariant Loop's own rule against auto-promotion above `validated` applies in full; this
is not ratified or canonical, and was not raised there).

## What was NOT done (explicit)

- **The actual freeze of `EXP-P1/crystal-vP2` was not executed.** This session has no live,
  authenticated admin persona and no service-role Supabase access — performing it here would mean
  writing to production state outside the governed identity spine, which this repo's rules forbid.
  The mechanism is ready: an admin session calls
  `POST /api/research/crystal/EXP-P1/freeze` with `action: "freeze"`, the usual `contentHash`/
  `signedBy`/`boundaryAcknowledged`/`freezeRationale` fields, plus
  `executionDesignation: "internal-pilot"` and one `scientificDeviations` entry per currently-failing
  scientific-readiness check (at minimum `derivation-headroom` and `boundary-coverage`, pending
  reconciliation of the exact live count against the 63/64 discrepancy noted above).
- **No invariant was added, and no invariant text, provenance, validation state, relationships, task
  design, readiness threshold, namespace ontology, remediation profile, or the 40% guard was altered.**
  Confirmed by `git diff` scope: four files changed (`types/research.ts`,
  `services/research/artifacts.ts`, the freeze route, `tests/crystal-freeze-route.test.ts`) plus one
  new test file — none touch `crystalReadiness.ts`'s checks, `crystalPopulationRequirement.ts`'s
  guard, or `crystalInstrumentSuite.ts`'s contract.
- **No execution-run runner was built.** "Run EXP-P1 internally" is exposed as the next governed
  action (`nextGovernedActionForFrozenCrystal`), truthfully stating that no runner exists yet — building
  one is a separately-chartered, materially larger change.
- **No existing freeze-act guard was weakened** — the T0 signatory check, the domain-boundary
  never-an-input rule, the content-hash staleness guard, and the one-time-freeze immutability check are
  all unchanged and still run for every freeze, `internal-pilot` included.

## Tests

New: `tests/crystal-internal-pilot-execution-designation.test.ts` (13 tests) — pins the default
`'confirmatory'` behavior being unaffected, the per-check deviation requirement, that `readiness.ok`
is never laundered to `true`, that `measuredDetail` is always server-computed, and
`nextGovernedActionForFrozenCrystal`'s exposure-not-execution contract.

Extended: `tests/crystal-freeze-route.test.ts` (+6 tests) — the new body fields' validation and
pass-through, and `nextGovernedAction` in the response.

Results: the full Crystal/EXP-P1-related test surface (96 files matched by
`crystal|research/artifacts|EXP-P1|freezeArtifact|checkFreezeGate`, run as one substring filter —
361 tests across 24 files) — **all pass**. `npx tsc --noEmit` — **679 errors**, identical to the
`dev` baseline measured before this change; none in the four changed files.

## Links

- Resolution record: `codexes/packs/agentiq/resolution-records/records/RES-2026-09-05-CRYSTAL-FREEZE-EXECUTION-DESIGNATION-001.json`
- Candidate invariant: `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-05-FROZEN-GENERATIONS-IMMUTABLE-LINEAGES-EVOLUTIONARY-001.json`
- Changed code: `types/research.ts`, `services/research/artifacts.ts`,
  `app/api/research/crystal/[experimentId]/freeze/route.ts`
- New test: `tests/crystal-internal-pilot-execution-designation.test.ts`
