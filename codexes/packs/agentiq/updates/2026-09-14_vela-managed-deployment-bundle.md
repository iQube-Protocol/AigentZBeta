# Vela Managed Deployment Bundle — Production Testnet Intake Prep

**Date:** 2026-09-14
**Status:** Preparation document — not yet a submission. Answers Priority F, item 20 of
`docs/vela/accelerator/constitutional-financial-services/08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-11.md`
("what artifact bundle do you want from us") from OUR side, against what Use Case Zero build-order
items 5-11 have actually shipped. Two items below are genuinely blocked in this environment and are
named explicitly rather than filled with a guess (CLAUDE.md No-Guessing).

## What this is for

Once items 5-11 land (the full local/simulated Use Case Zero chain — Factor selection → Aegis
admission → disclosure authorization → party bindings → frozen envelope → Vela projection →
underwriting quote → receipt → telemetry, all running against the LOCAL deterministic kernel with a
`SIMULATED` provider), the next real milestone is the one the operator named explicitly: **replacing
the fake transport with the Vela Engineering-managed Base Sepolia/Horizen deployment.** This document
is the bundle we'd hand the Vela team to request that deployment, per their own intake form.

**Intake form (real, from the accelerator handoff package, not guessed):**
`docs/vela/accelerator/constitutional-financial-services/09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md`
line 22 and `docs/vela/accelerator/constitutional-financial-services/12_VELA_SOURCE_REGISTER_2026-09-10.md`
line 6 both cite the same URL: **https://tally.so/r/xXWL1v**. Whether this has already been submitted
is not something this repo can tell you — I could not find a submission record or confirmation
anywhere in the codebase. If it has already been sent, treat this document as a status/readiness
check against what you sent, not a new submission.

## Bundle contents — what we can supply today, and what's still open

### 1. WASM binary + SHA-256 — **BLOCKED in this environment, real build command given below**

The kernel source is `services/vela/wasm/projector/` (Go, TinyGo/WASI target,
`app.go`/`main.go`). The build target is defined in that directory's own `Makefile`:

```makefile
APP := moneypenny_projector
production_build:
	$(TINYGO) build -o production_build/$(APP).wasm -opt=s -no-debug -target=wasi .
```

**This session's environment has no TinyGo toolchain installed** (`/usr/local/tinygo/bin/tinygo` —
the Makefile's own default path — does not exist here; standard `go` 1.24.7 is present but TinyGo is
a separate compiler needed for the WASI target). I did not fabricate a hash. To produce the real
artifact + hash, run this on a machine with TinyGo installed:

```bash
cd services/vela/wasm/projector && make production_build && sha256sum production_build/moneypenny_projector.wasm
```

Paste the resulting hash into this document (or directly into the Tally submission) before sending —
per the accelerator spec's own rule (`05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md` §17): "the showcase
must freeze and record the exact `applicationId` and WASM SHA-256 used for every consequential risk
or coverage result; a new WASM means a new application ID and fresh private state."

### 2. Expected app name/version — proposed, ready

- **App name:** `moneypenny_projector` (the Makefile's own `APP` variable — already the canonical
  build artifact name, not invented here).
- **Version/policy tag:** `vela-use-case-zero-underwriting-simulated-v1` — the exact
  `policyVersion` string `SimulatedUnderwritingProvider` (`services/financialServices/providers/
  underwriting/simulatedUnderwritingProvider.ts`) already stamps on every quote it produces. Using
  the SAME string as the deployed WASM's own version tag keeps one version identity across the
  simulated-provider layer and the enclave layer, rather than inventing a second version scheme.
  **This is a proposal, not yet confirmed with Vela Engineering** — flag it as such in the
  submission.

### 3. Constructor params / trigger contract — **not yet drafted in this repo**

I found no existing constructor-parameter list or trigger-contract reference anywhere in
`services/vela/` or the accelerator docs beyond the open question itself (`08_VELA_OFFICE_HOURS_
QUESTIONS_2026-09-11.md` item 20 asks Vela what THEY need here). This is a genuine gap, not
something to fill with an invented shape — it's really a question the Vela team needs to answer
first (their own item 6 in the same doc: "confirm the exact signed update payload schema"). Submit
the question as-is; do not propose a constructor schema we haven't validated against their actual
deploy tooling.

### 4. TokenAllowlist requirements — asset-neutral, so: none required

Per `11_VELA_TEAM_CONFIRMED_BASELINE_v0.1.md` §10, the Vela-side asset model already supports ETH,
ERC-20-via-allowlist, and a facilitator path, with an explicit team-confirmed rule: "the MoneyPenny
confidential kernel should remain asset-agnostic." The Use Case Zero build order's own item 2
("widen transport asset-neutrality") and the multi-party wiring (`services/vela/
velaMultiPartyProjection.ts`) do not hardcode any specific token — `VelaMultiPartyPartyInput.inputs`
is a generic `Record<string, number>`, and every party input in this chain is a private numeric
value (exposure/spend/limits), never a token-denominated on-chain amount. **Our answer to Vela:** no
TokenAllowlist entries are required for the current Use Case Zero scope (a private risk/coverage
verdict, not an on-chain asset transfer) — if/when a real settlement instruction is added, this
answer will need revisiting, and should not be assumed to still hold at that point.

### 5. Expected network

**Base Sepolia and/or Horizen testnet** — per the operator's own framing of this milestone ("the
Vela Engineering-managed Base Sepolia/Horizen deployment") and per open question 22 in
`08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-11.md` ("Are Base Sepolia and Horizen testnet instances
separate trust domains / separate TEE signer registrations?") — that question is still open and
should be asked, not assumed answered, before committing to one network over the other.

### 6. Test wallets/agents — **BLOCKED: live DB unreachable this session**

The real, already-provisioned agent identities this deployment would exercise are the four
`REGISTRABLE_AGENTS` entries (`services/horizen/registrableAgents.ts`): `aigent-moneypenny`,
`aigent-nakamoto`, `aigent-kn0w1`, `aigent-factor` — each with its own `agent_keys` row (custodied
wallet) and `fio_handle` (`moneypenny@aigent`, `nakamoto@aigent`, `kn0w1@aigent`, `factor@aigent`).
**Their actual on-chain wallet addresses live in the `agent_keys` table, and Supabase is down for
this entire session** (confirmed: schema-metadata queries succeed, real table reads time out
platform-wide) — I could not pull the real addresses to include here. Once Supabase is back:

```sql
select agent_id, fio_handle, address
from public.agent_keys
where agent_id in ('aigent-moneypenny', 'aigent-nakamoto', 'aigent-kn0w1', 'aigent-factor');
```

(Table/column names taken from `RegistrableAgentConfig`'s own doc comments — verify the exact
column name for the address field against the live schema before running, since I have not been
able to confirm it directly this session.)

### 7. `applicationId` ↔ WASM hash evidence — the open question, carried forward verbatim

This is already Priority B, question 5 in `08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-11.md`: *"On
deploy, what canonical fields should we record to bind `applicationId` to the exact WASM? Is the
deploy-time SHA-256 sufficient/canonical?"* — still open, still exactly the right question. Once
answered, the binding needs to be recorded somewhere in this codebase's own evidence trail (most
naturally alongside `velaUnderwritingRiskTelemetry.ts`'s own `protocol_ref`/`action_ref` fields, or a
new field on the frozen-envelope receipt) — that is a follow-on implementation item once Vela's
answer is in hand, not something to build speculatively now.

## What to actually send

1. This document (or its "ready" sections 2, 4, 5, 7) as narrative context.
2. The real WASM SHA-256, once built on a TinyGo-equipped machine (command in §1).
3. The real test-wallet addresses, once Supabase is reachable again (query in §6).
4. Sections 3 (constructor params/trigger contract) and the network choice (§5) submitted as
   OPEN QUESTIONS to Vela, not as our own proposed answers — we don't have enough from their side
   yet to propose either confidently.

## Relationship to the local/simulated milestone

This bundle is deliberately independent of item 11's seed/fixture work (the local, `SIMULATED`-only
demo). Nothing here blocks that work, and that work does not block this bundle — see the companion
demo-completion checklist doc for how the two milestones are tracked separately.
