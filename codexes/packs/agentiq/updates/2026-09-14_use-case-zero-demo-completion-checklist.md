# Use Case Zero — Demo Completion Checklist

**Date:** 14 September 2026
**Status:** Local demo-complete. Managed Vela testnet-complete NOT started (blocked — see §2).
**Base:** `claude/amplify-build-handoff-doc-prubcy` @ `f71a5e710` (build-order items 5–11, all
merged and pushed).

## Why this doc exists

The operator's own framing, stated when scoping this work: "local demo-complete" and "managed
Vela testnet-complete" are two SEPARATE milestones, not one continuum — reaching the first must
never be described as having reached the second. This checklist makes that boundary explicit and
durable, rather than left as something the reader has to reconstruct from a chain of update docs.

## 1. Local demo-complete — ACHIEVED

**Definition:** the entire causal chain (Factor selection → Aegis admission → disclosure
authorization → party bindings → frozen envelope → Vela projection → underwriting quote →
optional settlement → receipt → telemetry) is implemented, tested, and provably correct against
the LOCAL deterministic kernel with a `SIMULATED` underwriting provider — reproducible without any
live Vela deployment.

| Item | What | Status | Evidence |
|---|---|---|---|
| 5 | Underwriting vertical slice (WASM guest logic) | Done | `services/vela/wasm/projector/app/app.go`, `tests/vela-underwriting-composition-gate.test.ts` |
| 6 | Risk/Invariant Telemetry Hook | Done | `services/vela/velaUnderwritingRiskTelemetry.ts` |
| 7 | Factor selection artifact | Done | `services/factor/factorSelectionArtifact.ts` |
| 8 | Aegis underwriting admission evidence | Done | `services/vela/velaUnderwritingAdmissionEvidence.ts` |
| 9 | MoneyPenny composition gate + disclosure authorization | Done | `services/vela/velaUnderwritingCompositionGate.ts`, `services/vela/velaUnderwritingDisclosureAuthorization.ts` |
| 10a | Constitutional Risk Flow chain viewer (operator/global view) | Done | `services/vela/velaUnderwritingChainProjection.ts`, `app/api/moneypenny/constitutional-risk-flow/route.ts`, `ConstitutionalRiskFlowPanel.tsx` |
| 10b | Three-party contributor views + persona↔party binding | Done | `services/vela/velaUnderwritingPartyBinding.ts` (migration `20261001001100_vela_underwriting_party_bindings.sql`, live-applied), `services/vela/velaUnderwritingPartyView.ts` |
| 11 | First real seeded end-to-end demo transaction (ArkAgent/Nakamoto/Kn0w1) | Done, NOT yet run live | `scripts/seedUseCaseZeroDemo.ts`, local fixture + dev-gated viewer route, copilot quick-prompt wiring |

**What "done" means precisely for item 11:** the entire demo chain is composed, tested (245 tests,
including the exact asymmetric A/B/C disclosure-visibility scenario and a full idempotency proof),
and browsable in a local, non-live fixture at `app/(shell)/moneypenny/dev-fixtures/use-case-zero/`
(dev-only, gated by `NODE_ENV`). It has NOT been run against live Supabase — Supabase was down
platform-wide for the entirety of this build window, and persona resolution for ArkAgent / Aigent
Nakamoto / Aigent Kn0w1 is a dependency the script accepts as injected parameters, never hardcoded.
**The only remaining step to close this last gap is operational, not architectural:** once
Supabase is reachable, resolve the three real personaIds
(`resolveUseCaseZeroDemoPersonaIds()` in `scripts/seedUseCaseZeroDemo.ts`) and run:

```bash
npx tsx scripts/seedUseCaseZeroDemo.ts \
  --arkagent=<ArkAgent's real personaId> \
  --nakamoto=<Aigent Nakamoto's real personaId> \
  --kn0w1=<Aigent Kn0w1's real personaId> \
  --evm-key=<hex> --p521-key=<hex>
```

This persists the SAME chain the fixture already demonstrates, against real personas and real
`activity_receipts` rows — idempotently (safe to re-run).

### What "local demo-complete" does NOT mean

- It does not mean the demo has been run against a live database even once.
- It does not mean any real Vela (Horizen CCE) deployment exists or was exercised — every quote in
  this chain comes from `SimulatedUnderwritingProvider`, and `providerMode` is `SIMULATED`
  throughout every test and fixture.
- It does not mean settlement has ever occurred — `settlementOccurred: false` throughout; this is a
  no-funds-path demonstration of the risk/coverage verdict, not an asset transfer.

## 2. Managed Vela testnet-complete — NOT STARTED (partially unblocked)

**Definition:** the SAME chain runs against a real Vela Engineering-managed deployment (Base
Sepolia and/or Horizen testnet), replacing the local WASM/simulated path with genuine TEE-attested
confidential execution — a categorically different milestone, not an extension of §1.

**Update:** the operator supplied confirmed guidance from Vela Engineering closing most of what
this table originally listed as open (multi-app isolated state/funds implemented, native
ETH/ERC-20/facilitator paths implemented, new-WASM-means-new-`applicationId` confirmed, attestation
model confirmed — see the deployment bundle doc's own "Update" section for the full statement).
**Only four items remain genuinely open**, and the WASM row below is now RESOLVED — a real WASM
binary was built and handed to the operator this same session, after checking for (and finding
none) a Dockerized/CI TinyGo build path first, per the operator's own instruction, then downloading
TinyGo 0.39.0 directly (outbound HTTPS to GitHub Releases turned out to be reachable).

Full bundle-preparation status: `codexes/packs/agentiq/updates/2026-09-14_vela-managed-deployment-bundle.md`.

| Blocker | Detail | Status |
|---|---|---|
| WASM binary + SHA-256 | `moneypenny_projector.wasm`, TinyGo 0.39.0 | **RESOLVED** — SHA-256 `085869849896aa423a5fa6c13cc5651a4446240b538e37c6a517dbd3cbdecf02`, delivered to operator |
| Constructor params / trigger contract | Not yet drafted anywhere in this repo | **Open — Vela question 1** |
| `applicationId` ↔ WASM-hash binding | Canonical evidence-binding fields | **Open — Vela question 2** |
| Base Sepolia vs. Horizen trust domains | Both networks confirmed in scope; separate TEE registrations? | **Open — Vela question 3** |
| Test wallet addresses | Live Supabase query against `agent_keys` needed | Still blocked — Supabase unreachable (`Aigent Z` project shows `INACTIVE`, direct query times out, re-checked this session) — unrelated to the three Vela questions above |
| Tally intake submission | `https://tally.so/r/xXWL1v` — whether already submitted is unverifiable from this repo | Needs operator confirmation |

**Nothing in §1's completion unblocks any row in this table.** Conversely, nothing in this table
was required to reach §1 — the two milestones are deliberately independent, per the operator's own
framing when this work was scoped. Per the operator's explicit instruction, none of the four
remaining open items should block further repo-side preparation.

## 3. What NOT to infer from this checklist

- A future session completing the "Running it once Supabase is back" step in §1 reaches **the end
  of §1**, not any part of §2. Do not report the demo as "live" or "on testnet" from that alone.
- A future session that gets a real WASM SHA-256 or a Vela deployment ID reaches progress on §2,
  but §1's own local/simulated proof remains the correct evidence for the causal chain's
  correctness — §2 does not need to re-litigate that the chain logic is right, only that the same
  logic now executes inside a real confidential enclave instead of the local WASI runtime.
