# CRP-003a — money-moving domains: Domain 1/2 executors, LLM analysis, settlement

**Date:** 2026-07-17
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`

The three remaining CFSP pieces are built — the pilot now spans all three
capability domains, has a live analysis layer, and binds settlement under the P3
spend cap.

## 1. Domain 1/2 executors + per-domain verification

`financialIntelligenceExecutor` is now domain-parameterised
(`runFinancialCapability(domain, …)`) over **intelligence · investment ·
market**, each with its candidate invariants and per-domain verification:

- investment → F-001 Verifiable State · F-002 Explainable Allocation · F-003 Delegation Boundaries
- market → F-101 Separation of Advice & Execution · F-102 Standing-Weighted Selection · F-103 Verification Before Standing
- intelligence → F-201/202/203 (unchanged)

Verification is evidence-backed where the result can show it, and **structural
(passed-by-construction)** where honesty requires — the requirement `detail`
names which. All executors are **advice-only**: they recommend, they never move
funds (F-003 / F-101). Fund movement is the separate settlement step.

## 2. Live LLM analysis layer over the grounded evidence

The executor takes an injected `analyze` fn wired by default to
**`callSovereign('analysis', …)`** (invariant-governed, sovereign-fallback
ladder — not a direct provider call). It reasons ONLY over the grounded
invariant evidence, produces the brief + a calibrated confidence, and **only
runs when grounding returned evidence** — otherwise it falls back to the grounded
summary (never a fabricated analysis). Grounding + analysis are both injected, so
the executor stays node-testable.

## 3. Settlement binding (rail) under the P3 cap

`settlementExecutor.buildSettlementIntent` binds an agreement's settlement terms
onto a deterministic, T2-safe settlement **intent** — AFTER `spendWithinCap`
passes. **MONEY IS PARAMOUNT: it never signs or broadcasts.** On-chain execution
stays the operator's supervised wallet path (x402 / Base USDC / Q¢) — the D1
discipline applied to money. Pipeline step 9 creates the intent in authoritative
mode within cap; shadow neither settles nor accrues (CFS-017).

## 4. Money-moving agreement UI

`FinancialServicesTab` gains a **domain selector** and, for money-moving domains,
an **enforced spend-ceiling (P3)** input + **settlement fields** (rail / amount /
currency). The form sends `valueCeiling` + `settlementTerms` + domain-specific
governing invariants (adds CFI-001 for money movement); the run passes the
domain; the trace panel shows the domain + the settlement intent/status.

## Verification

- **22/22 drill** (`scratchpad/n2c_pipeline_harness.mts`): all 3 domain executors
  grounded + analysed + per-domain verify; un-grounded fails; settlement intent
  deterministic / refuses invalid / never broadcasts; pipeline — authoritative
  money-moving executes + creates settlement intent + cites (real accrual),
  shadow does neither, over-cap blocks@9. Pure modules parse-clean under Node.
- Prior N1 (23/23) + N2 (16/16) + N2b (21/21) drills still hold.

## Honest limits (what "money-moving" still does NOT do)

- **No autonomous transfer.** The constitutional layer builds + records the
  settlement intent under the cap; the actual on-chain transfer is the operator's
  supervised wallet action (by design — money is PARAMOUNT). Wiring the intent to
  a one-click supervised `planCheckout` USDC / x402 execution is the next step.
- **The analysis layer needs a provider at runtime** (`callSovereign`); with none
  configured it degrades to the grounded summary (honest, not broken).
- **Domain 1/2 executors are grounded+analysed advice**, not live market/portfolio
  data feeds — data-source integration is a further increment.
- **Still shadow by default** on the surface; the authoritative flip per
  capability is an operator ratification.
