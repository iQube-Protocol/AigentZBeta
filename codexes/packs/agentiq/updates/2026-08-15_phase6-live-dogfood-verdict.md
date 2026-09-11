# Homecoming III Phase 6 — Live Dogfood and Threshold Verdict

**Date:** 2026-08-15
**Programme:** Homecoming III — Phase 6 (live-model dogfood, Homecoming threshold verdict)
**Commit range:** `a04ea9d3b` (Phase 5 gate) → `7939bfc26` (Phase 6 HEAD)
**Governing constraint:** structural success (Phases 0-5) does not imply behavioral success; no tuning
the task after inspecting the result.

---

## Verdict

## NOT YET — THRESHOLD GAPS REMAIN

One primary, precisely-located behavioral gap; one secondary, environmental gap. Both are named
below with exact evidence. Everything else the live trace exercised — discovery quality, causal
abstraction, cross-domain reach, DCIR binding, governed-learning discipline — worked correctly and
is reported as such.

---

## The dogfood task

Used the real, unmodified Phase 1-5 production functions end-to-end, for the first time, to scope
the first internal Crystal 2.0 implementation assignment: a contract-first type definition for the
deferred context-binding axis (`platform / workspace / project / developer / principal-user /
session-intent`), recorded as a design requirement in
`RES-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001`.

## The live trace

`scripts/homecoming-iii-phase6-dogfood.ts` (full output:
`codexes/packs/agentiq/updates/2026-08-15_phase6-dogfood-trace.json`) runs, in order:

1. **Intent** — `StructuredDevIntent` stating the assignment above, `status: 'approved'`.
2. **Grounded context / established invariant retrieval** — real `buildInvariantEnvelope()` call.
   `resolveConstitutionalField()` and `buildInvariantSlice()` (both Supabase-backed) failed and
   fail-opened per their documented contract — **this sandbox has no Supabase credentials** (verified:
   no `.env.local`, no `SUPABASE_*` in `process.env`). The `devon`-projection leg
   (`loadDevonProjectedCandidates()`) is filesystem-backed and ran for real: **33 real, on-disk
   candidate invariants retrieved, 3 of them `ratified` (established)**.
3. **Initial Intent Risk Field** — three genuinely projected `RiskVectorRef`s: scope/context-binding
   re-litigation risk, T0-identifier-leak risk, premature-adoption risk.
4. **Positive-bearing discovery** — three live, genuine causal conditions (pinned-order canary,
   in-file ruling cross-reference, schema-version convention).
5. **Risk-informed negative-bearing discovery** — one genuine causal condition per risk vector,
   each stated causally (not as a prohibition), two of them expanding scope out of `devon` into
   `constitutional-computing` and `repository` respectively.
6. **Convergence** — none occurred. Reported honestly rather than forced: none of the six live
   discoveries shared a `claimKey()` with another.
7. **Invariant Development Envelope** — real `rankByMateriality()` merge of retrieved + discovered.
8. **Compressed implementation context** — real `composeImplementationContext()`.

## The primary finding: compression crowds out live discovery and the most relevant candidate

The compressed context that is documented as "what actually reaches the model"
(`services/devCommandCenter/implementationContext.ts`) carried:

- **3 established** (ratified) candidates — genuinely relevant, not dumped wholesale.
- **9 candidate signals** — almost entirely about an *unrelated* subsystem (Pulse admission, P&L
  verification, RootDID authority, receipt-subject-scoping).
- **0 of the 6 live discoveries.**
- **Not** `CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001` — the single candidate most directly on
  point for this exact assignment, which was retrieved but omitted.

Root cause, traced and evidenced (not asserted): `fromCandidate()` (`invariantEnvelope.ts`) sets
`materiality: 'unknown'` for every devon-projected candidate unconditionally, so all 33 rank by the
same scope-derived constant and tie-break by array insertion order — not by relevance to the intent
being served. `composeImplementationContext`'s fixed partition order (established, then signals,
then discoveries, each admitted via sequential `take()`) has no mechanism to reserve budget for
discoveries, or to prefer a highly relevant signal over an unrelated one, once the non-established
population exceeds the budget. This was invisible in every Phase 1-5 canary because those canaries
exercise small fixture populations that never exhaust the budget — it surfaced only once dogfooded
against the real, current-scale registry (33 members and growing with every resolution this loop
records).

**Practical consequence:** an implementer who reads only the compressed context — the designed
consumption path — would see none of this run's live discovery and would not see the one candidate
that names the exact ruling this assignment implements, while receiving several candidates about an
unrelated financial-verification subsystem instead. This assignment's real implementation (below)
only reflects the live discoveries because this session, as the live discoverer, carried them
directly into the canaries — not because the pipeline delivered them downstream.

Recorded as `RES-2026-08-15-PHASE6-COMPRESSION-CROWDOUT-001`, `status: observed`,
`trigger: invariant-incomplete-or-misscoped`, `candidateInvariants: []`. Not silently patched:
per the operator's own instruction not to tune the acceptance task after inspecting the result, this
extends to not quietly patching the mechanism the task is evaluating.

## Secondary finding — environmental, distinct in kind

This sandbox cannot exercise the Supabase-backed constitutional/crystal-substrate retrieval legs at
all. Criterion 1 (useful retrieval of established memory) is positively evidenced only via the
local, file-based `devon`-projection channel in this run. Re-running with real DB credentials is
needed before that criterion is fully settled independent of this channel.

## The human-gated implementation

The smallest real slice the discovery scoped: `types/contextBinding.ts` — a contract-only stub (no
enforcement runtime, no wiring into `DevLoopState` or any live surface), with a 7-test canary
(`tests/context-binding-axis-scope.test.ts`) operationalizing all six live-discovered causal
conditions. Pushed as commit `4db726815` to `claude/compassionate-planck-vz7x29` — the existing
`repository_dispatch`-equivalent path in this repo (session branch → auto-merge-to-dev workflow →
operator review), not a bypass of it.

One real defect was caught and fixed in the canary itself before commit: the import-independence
test's first draft matched the word "InvariantScope" anywhere in the file, including the doc
comment's own legitimate prose explaining the orthogonality rule — tightened to match only a
line-anchored `import` statement.

## DCIR observation, consequence validation, learning receipt

`scripts/homecoming-iii-phase6-dcir-consequence.ts` (output:
`codexes/packs/agentiq/updates/2026-08-15_phase6-learning-receipt.json`):

- Real `bindConsequenceEvidence()` / `emitEvidenceEvents()`: all 3 negative-pass causal claims bound
  to their actual test outcomes — **3/3 `supported`**, from the real 7/7-passing test run.
- `establishedRefsUnderChallenge()`: empty — nothing challenged this cycle.
- Real `recordRiskObservation()` for the compression-crowdout finding; real
  `assessRecurrencePortability()` against an empty prior-observations list — `recurrenceCount: 1`,
  `portable: false`. Real `abstractCausalCandidate()` correctly returned `null` (CANARY-05: a
  single occurrence never auto-promotes).
- Real `buildLearningReceipt()`; `validateLearningReceiptDraft()` reports `valid: true`.

## Acceptance criteria, assessed against the real trace

| # | Criterion | Result |
|---|---|---|
| 1 | Useful retrieval of established memory | Met via the local devon-projection channel (3 ratified, genuinely relevant, not dumped); **DB-backed legs untested in this sandbox** |
| 2 | Useful residual discovery | Met — all 6 live discoveries are genuinely novel |
| 3 | Bidirectional value | Met — negative-pass findings are distinct in kind from the positive pass, not restatements |
| 4 | Cross-domain capability | Met — 2 of 3 negative findings genuinely expanded scope (`constitutional-computing`, `repository`), motivated by real risk vectors |
| 5 | Causal abstraction | Met — all 6 stated as conditions, not mechanisms or prohibitions |
| 6 | Epistemic integrity | Met narrowly — no mislabeling occurred; the omission was honest (`omittedRefs`), not a category collapse |
| 7 | Implementation relevance | **Not met via the designed channel** — 0 of 6 discoveries and the most relevant candidate survived compression; this run's real implementation only reflects them because the live discoverer carried them manually |
| 8 | Observable consequence | Met — 3/3 real evidence bindings from real test outcomes |
| 9 | Governed learning | Met — new risk evidence correctly capped below `candidate`, resolution recorded at `observed` |

Criterion 7's failure is the direct behavioral consequence of the primary finding, and is why the
overall verdict is NOT YET rather than PASS-with-caveats.

## Regression

Quiesced git-worktree comparison, Phase 5 baseline (`a04ea9d3b`) vs. Phase 6 HEAD (`7939bfc26`):
identical 17 failed files / 41 failed tests on both trees (byte-identical failing-file-list diff),
+1 file / +7 tests as the only difference (`tests/context-binding-axis-scope.test.ts`, 7/7 passing).
Zero regressions.

## What Phase 7 (or a re-run) would need to address before a PASS is possible

1. Give devon-projected candidates a real per-intent relevance signal (or a domain filter honoring
   `opts.domains`, which `loadDevonProjectedCandidates()` currently ignores entirely) so compression
   ranks by relevance-to-this-task, not array-insertion order among ties.
2. Reserve budget for live discovery and/or the highest-relevance signal rather than admitting
   established → signals → discoveries as three unconditional, sequential cuts.
3. Re-run this same dogfood with real Supabase credentials to settle criterion 1 independent of the
   local-registry channel.

None of this was fixed as part of this cycle — per the operator's explicit instruction, the
mechanism under test is not patched mid-verdict.

## Hard stop

Per the Phase 6 instruction: hard stop after the verdict. No Phase 7 work begun.
