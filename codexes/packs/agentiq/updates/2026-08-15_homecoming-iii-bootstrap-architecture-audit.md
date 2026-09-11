# Homecoming III Bootstrap — Architecture Audit and Reuse Map

**Date:** 2026-08-15
**Programme:** Operation Chrysalis → Homecoming → DevOn
**Phase:** 0 (preflight, reuse map, Common Ground terminology). No code.
**Base:** `origin/dev` @ `2268d5f8e`
**Governing rule:** PRD §29 — `reuse > extend > create`.

---

## The central finding

> **The bootstrap is primarily closing an existing loop, not building parallel infrastructure.**

The loop already exists in parts. Every organ is in production. What is missing is that they are
not connected to each other:

```
Invariant Resolution / IDE 2.0  →  DevOn  →  DCIR  →  Consequence  →  Resolution Record / Crystal
        (exists, wired               (exists,   (exists,      (exists,          (exists, 23 records
         to the copilot)             complete)  observes      forecaster)        + 50 candidates)
                                                DevOn today)
```

Roughly two-thirds of the Homecoming III PRD is **wiring**. The single highest-leverage
disconnection: `services/invariants/resolution.ts` is a working invariant retrieval, compression
and prompt-injection engine — it already performs PRD §13 retrieval and §14 compression — but it
is wired to the **copilot**, not to DevOn. That one gap is most of why DevOn is not yet
invariant-driven.

This finding is recorded here because it is the thing most likely to be lost. An agent reading
the PRD cold sees a list of components to build. The correct reading is a list of connections to
make.

---

## Role map — the four runtimes

Canonical definitions now live in `docs/platform-ontology.md` (mandatory reading). Summarised:

| Role | Responsibility | Implementation |
|---|---|---|
| **IDE 2.0** | Discovers and retrieves invariants; constructs the causal and risk field | `services/invariants/{resolution,discoveryEngine,grounding}.ts` |
| **DevOn** | Orchestrates the development lifecycle | `services/devCommandCenter/**`, `app/api/dev-command-center/**` |
| **DCIR** | Dynamic Constitutional Interaction Runtime — observes and governs actions and consequences. DevOn is one context it serves | `types/dcir.ts`, `services/dcir/**` |
| **Crystal** | Governed, falsifiable invariant memory | `services/research/crystal*.ts`, `canonical-invariants.seed.json` |

**DCIR is general, not development-specific.** See the terminology correction below.

---

## Reuse / extend / create map

### Reuse — exists, call it

| PRD requirement | Existing implementation |
|---|---|
| §13 invariant retrieval, scope-aware | `resolveConstitutionalField()`, `resolveCitableInvariants()` — `services/invariants/resolution.ts` |
| §14 prompt compression / minimal set | `INVARIANT_BUDGET` (`currentTurn: 8`, `withSessionMemory: 12`) + `formatCitableInvariantsBlock()`, same module |
| Live discovery | `services/invariants/discoveryEngine.ts` — evidence, candidates, convergence, recurrence, compression, classification |
| §19 learning receipt | `types/resolutionRecords.ts` — `ResolutionRecord`, `CandidateInvariant`, `CandidateCanary`, the ten `RESOLUTION_TRIGGERS`. Live registry: 23 records, 50 candidates |
| §20 no auto-canonization | `AGENT_MAX_STAGE = 'validated'` enforced by the validator; `BehaviouralInvariant.status` cannot express `'canonical'` |
| §22 capability sovereignty | Already a seam — `repository_dispatch` → `claude-implement.yml` → CI → PR. Provider identity is not in constitutional state |
| Field query / counterfactual | `services/research/invariantFieldQuery.ts` |

### Extend — exists, needs a new capability

| PRD requirement | Extension point |
|---|---|
| §15 Gap Analysis causal split | `capabilityGapAnalyzer.ts` — has `existing`/`missing`, lacks causal-capability vs mechanism |
| §16 Consequence Canvas bindings | `consequenceCanvas.ts`, `consequenceValidator.ts` |
| §17 development-consequence observation | `services/dcir/eventStream.ts` — **already emits nine DevOn event types**; needs invariant-evidence vocabulary appended |
| §18 failure → risk observation → candidate | `mineBehaviouralInvariants()` in `services/dcir/stateEngine.ts`, under the no-canonical constraint |
| §11 risk field | `services/consequence/` — `risk_analysis` stage, `assessRiskHeuristic()`. **See the Lehigh boundary below** |

### Create — genuinely absent

Bearing as an independent axis (`positive` / `negative` / `dual`) · Intent Risk Field ·
`ProofOfRisk` · `InvariantDevelopmentEnvelope`.

That is the whole create list.

---

## Terminology correction — DCIR

**Ruled by the operator, 2026-08-15.** `DCIR = Dynamic Constitutional Interaction Runtime`
(CFS-020). The PRD's "Development Constitutional Invariant Runtime" is **incorrect — not an
alias**, and is not registered as a synonym.

The correction is architectural, not cosmetic. Reading DCIR as development-specific implied a
second observation runtime parallel to the ratified one. DCIR already observes DevOn:
`devStageAdvancedEvent`, `devStageProposalReceivedEvent`, `devProposalApprovedEvent`,
`devProposalDismissedEvent`, `devCapsuleOpened/ClosedEvent`,
`devImplementationPackGeneratedEvent`, `devDeploymentProposedEvent`, `devToolUsedEvent`.

The real gap is narrow: DCIR observes *that a stage advanced*, not *whether the invariant that
stage relied upon held*. That is an appended vocabulary, not a runtime.

Full account: `RES-2026-08-15-CANONICAL-TERM-RESOLUTION-001`.
Candidate invariant: `CI-2026-08-15-CANONICAL-TERM-RESOLUTION-001` — *a canonical term's meaning
is resolved from governed Common Ground before it is inferred from context.*

---

## Lehigh boundary — audit result is NEGATIVE

The PRD §9/§11 describe the risk work as a "bridge to the existing Lehigh-derived risk work."
**The audit does not support that premise.** Recorded plainly so no later document inherits it:

1. **There is no code linkage between the Lehigh capstone programme and any risk model.**
   `lehigh` appears only in `services/research/researchWorkspace.ts`,
   `PartnerProgrammesTab.tsx`, `LockerTab.tsx` and `tests/research-workspace-spec.test.ts` — all
   **research workspace and cohort structure** (the MFE capstone's risk-management, pricing and
   financial-systems tracks). An institutional collaboration, not an implemented model.

2. **`assessRiskHeuristic()` is self-described as a placeholder.** Its section header reads
   `Risk / Value (v1 heuristics; wire to phase2 when it lands)`. Its three dimensions —
   uncertainty × blast radius × reversibility — are seeded from confidence, knowledge size and a
   coherence boolean.

3. **The thing it defers to is an explicit stub.** `services/registry/phase2/risk.ts`
   `assessRisk()` throws: *"Phase 2 stub — implementation gated on dedicated Phase 2 PRD."*

**Therefore:** the existing heuristic is reused as the risk primitive and `riskVectorRef`
semantics are kept extensible, but **it is not described as the complete Lehigh risk model,**
because the audit does not prove that implementation. Fuller Lehigh risk / value / price
integration is subsequent development from home, on its own evidence.

---

## Preflight (CLAUDE.md mandate)

`npm run report:resolutions` → **`clear: true`**, no blockers.

**Applicable prior resolutions.** Twelve-plus candidate invariants declare `devon` projections
pending ratification — including `PREPARED-EXECUTION`, `EXCEPTION-TERMINATES-IN-ACT`,
`EXECUTION-CONSTRAINT-ABSORPTION`, `SETTLED-STAGE-OUTCOME-MONOTONIC`,
`SCHEMA-ENRICHMENT-RECOVERY`, `IDENTIFIER-RECOVERY-CONTRACT`. These are *pending, not live* —
they inform the work; they do not bind it.

**Governing invariants for this work.** `CI-2026-08-03-CANARY-REPRODUCES-DEFECT-001` (canaries
must fail against the historical defect) · `CI-2026-08-03-CANONICAL-READER-OWNERSHIP-001` (one
canonical reader owns a fact) · `inv.engineering.036`/`037` (one authoritative location; a
parallel implementation is a defect).

**Could this work regress an earlier resolution?** The principal risk is `036`/`037` — the
bootstrap could itself become the parallel implementation it is meant to prevent. Mitigated
structurally: the envelope is one optional field on `DevLoopState` (no second session store),
learning emits into the existing resolution-record registry (no second learning store), and
observation extends DCIR (no second runtime).

**Unresolved risk carried forward.** The report raises a `[QUESTION]`: eight update docs newer
than the newest resolution record are uncited by any record. Not in this work's scope; flagged
rather than silently absorbed.

**A note on the reuse discovery.** `PROJECTION_TARGETS` already includes `'devon'`
(`services/devCommandCenter/**`). A governed channel for projecting candidate invariants into
DevOn therefore already exists and is evaluated as a retrieval source in Phase 2 — it was not
identified in the original plan.

---

## Decisions of record

| Ref | Ruling (operator, 2026-08-15) |
|---|---|
| **D1** | DCIR stays *Dynamic Constitutional Interaction Runtime*. The development expansion is incorrect, not an alias. |
| **D2** | Ten-stage `STAGE_ORDER` unchanged. IDE 2.0 is horizontal: envelope constructed at `intent_capture`, progressively enriched across the lifecycle, learning emitted at `complete`. `nextStage()` and the remediation fork are not modified. |
| **D3** | Split dogfood run. DevOn produces the real field, envelope and implementation pack; the `repository_dispatch` → Claude Code → human-merge gate is preserved; DCIR observation and learning resume against the resulting implementation. CFS-016 D1 is not weakened for the demonstration. |
| **Order** | The initial Intent Risk Field is constructed **before** negative-bearing discovery. Risk-of-Repair is a bearing that broadens discovery, not an output assembled after it. The field may then evolve from newly observed risks. |
| **Acceptance** | Positive and negative discovery must be **demonstrably independent bearings**: an acceptance scenario in which risk-driven discovery surfaces at least one materially relevant causal invariant outside the apparent intent domain that intention-driven discovery did not surface. Invoking one process twice with different labels does not satisfy IDE 2.0. |
| **Scope** | Phase 0 terminology work is bounded to recording the correction and its evidence through existing mechanisms. Not a glossary rebuild. |
| **Stop** | After the Phase 6 threshold verdict, work stops. Crystal 2.0 begins as the first new assignment from inside DevOn. |

---

## What Phase 0 changed

| File | Change |
|---|---|
| `docs/platform-ontology.md` | Added the four development-lifecycle runtime terms with role boundaries; recorded the incorrect DCIR expansion as known-wrong; added enforcement rule 5 (resolve before inferring) |
| `codexes/packs/agentiq/resolution-records/records/RES-2026-08-15-CANONICAL-TERM-RESOLUTION-001.json` | New — the terminology resolution record |
| `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-08-15-CANONICAL-TERM-RESOLUTION-001.json` | New — the causal candidate invariant, status `candidate` |
| `codexes/packs/agentiq/updates/2026-08-15_homecoming-iii-bootstrap-architecture-audit.md` | This document |

No code. No migrations.

**On the Proof of Risk.** The terminology evidence is recorded through the existing
resolution-record mechanism, per the bounding ruling. The `ProofOfRisk` *representation* of the
same evidence is instantiated in Phase 1, when the type exists, referencing this record — rather
than inventing a file format now to hold something the registry already holds.
