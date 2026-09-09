# Constitutional Financial Services / Vela Accelerator Package

**Date:** 9 September 2026  
**Status:** Working architecture and research package; candidate invariants and research constructs are unratified unless explicitly marked otherwise.  
**Primary system:** metaMe / AgentiQ / MoneyPenny / Invariant Research Lab  
**Accelerator context:** Horizen × Crecimiento / Vela

## Purpose

This package captures the architecture, research extensions, candidate invariants, Vela masterclass refinements, accelerator Use Case Zero, implementation handoff, and office-hours questions established through the current Financial Services / Constitutional Computing work.

It is intentionally split into:
1. **Research claims and candidate invariants** — hypotheses and falsifiable constructs, not product claims.
2. **Architecture** — system boundaries and operating roles.
3. **Accelerator specification** — the bounded build target.
4. **Implementation hardening** — concrete changes supported by what is currently known about Vela.
5. **Open questions** — matters that must be resolved with the Vela technical team rather than guessed.

## Package contents

| File | Purpose |
|---|---|
| `01_CONSTITUTIONAL_YIELD_AND_RISK_THESIS_v0.2.md` | Extends the Golden Cycle with Constitutional Yield, Constitutional Risk, price, time and Invariant Intelligence. |
| `02_CONSTITUTIONAL_RISK_CANDIDATE_INVARIANTS_v0.1.md` | Candidate invariants uncovered in the current risk/yield work. |
| `03_MONEYPENNY_DISCLOSURE_AND_RISK_ARCHITECTURE_v0.1.md` | Three-tier disclosure architecture, risk localization and system-role boundaries. |
| `04_VELA_MASTERCLASS_ARCHITECTURE_DELTA_v0.1.md` | Exact architecture refinements implied by the 8 Sep Vela masterclass. |
| `05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md` | Bounded accelerator showcase: confidential programmable underwriting / constitutional risk. |
| `06_EXP_P1_P4_ALIGNMENT_EXTENSION_v0.1.md` | Preserves the frozen P1–P3 programme while adding this bounded financial-services research use case. |
| `07_CONSTITUTIONAL_RISK_MARKETS_VENTURE_INCUBATION_v0.1.md` | Venture Studio incubation thesis for transaction-native micro-underwriting. |
| `08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-09.md` | Questions to resolve with Vela technical leads. |
| `09_CLAUDE_IMPLEMENTATION_HANDOFF.md` | Implementation brief for Claude; minimal, evidence-based, no speculative Vela behavior. |
| `10_constitutional-risk-envelope.schema.v0.1.json` | Proposed machine-readable implementation schema; not canonical until reconciled with existing repo types. |

## Canonical boundary

**metaMe = constitutional/control plane**  
**MoneyPenny = Financial Services Runtime and coordination/orchestration plane**  
**Factor = economic discovery, party/service assembly and network expansion**  
**Aegis = independent trust/admission membrane**  
**iQubes + QubeTalk = selective disclosure and sovereign information-sharing plane**  
**Vela = verified confidential deterministic execution substrate**

The first Vela application should be a narrow MoneyPenny workload, not metaMe itself:

> **MoneyPenny Constitutional Consequence & Settlement Kernel**

Its purpose is to receive a frozen, minimized, strongly pseudonymous ("semi-anonymous" in the metaMe lexicon) execution envelope, apply deterministic confidential logic over private state/parameters, and return a signed result suitable for constitutional authorization, settlement and receipt binding.

## Non-negotiable scientific boundary

The current Golden Cycle programme remains:

**P1 Compression → P2 Consequential Performance → P3 Representation → P4 Interaction (Reserved)**

This package does **not** modify frozen P1–P3 protocols or convert accelerator telemetry into confirmatory evidence. The accelerator pilot produces operational / hypothesis-generating Golden Cycle records unless and until separately registered under the scientific programme.


## Revision 0.3 — 9 September 2026

The bounded pilot is now **a confidential multi-party liquidity portfolio with selective participation and granular risk/value allocation**. Portfolio management focuses Constitutional Yield; process-risk underwriting focuses Constitutional Risk. The same narrow kernel evaluates one action against each affected mandate.

Mandate-local veto replaces a blanket pool veto where economic independence is evidenced. Returns follow deployed capital and explicitly assumed exposure, not declared risk appetite. One frozen participation schedule binds mandates, allocations, costs and receipts. Higher-risk layers are deferred.

All 12 artifacts are revised: 01 thesis and portfolio discipline; 02 six provisional MP candidate invariants; 03 participant/state/privacy architecture; 04 multi-party Vela delta; 05 concrete three-party pilot and delivery gates; 06 participant-level research/comparators; 07 family-office/manager/insurer positioning; 08 questions 56–64; 09 implementation and adversarial checks; 10 expanded schema; this README; regenerated manifest.

Filenames retain earlier version suffixes to preserve cross-references; internal versions and manifest are authoritative. The schema remains a proposal and requires semantic validation beyond JSON Schema. Masterclass/build claims are historical inputs, not newly verified infrastructure facts.

Working package; public repository publication authorized by the operator on 9 September 2026. Candidate invariants remain unratified. Original collaboration agreement and edited admission statement are outside this package and unchanged. This documentation does not assert a deployed implementation.

## Repository reconciliation at publication

Baseline inspected: `d12f55b54` on `origin/dev` (9 September 2026). This is a documentation commit, not implementation of the proposed pilot.

| Existing repository surface | Reuse / extension boundary |
|---|---|
| `services/vela/velaTypes.ts` | Existing wire types and five request opcodes, including TRUSTPROCESS; confirm accelerator compatibility rather than inventing an enum. |
| `services/vela/velaProjectionProvider.ts` | Existing domain/wire boundary and coarse three-valued verdict; preserve separation from action authorization. |
| `services/vela/wasm/projector/app/app.go` | Existing private-input projector, encrypted PlainEvent verdict and no balances/fund movement. Multi-party schedules and participant outputs are proposed extensions, not existing capabilities. |
| `services/venture/trading/serviceLedger.ts` | Existing deterministic simulated service obligations and explicit liability timing. Reconcile reusable accounting patterns without changing its registered compensation treatment or claiming real settlement. |
| `docs/vela/VELA-PRIVACY-BOUNDARY-001.md` | Existing privacy boundary remains authoritative; richer participant receipts require an explicitly reviewed extension. |

The proposed schema is a semantic design aid, not a replacement for canonical types. Implementers must re-inspect the then-current branch. Do not describe the existing projector as a custody or settlement engine, and do not put rich participant results into its existing coarse-verdict channel.
