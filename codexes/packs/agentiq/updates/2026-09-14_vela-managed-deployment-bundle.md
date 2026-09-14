# Vela Managed Deployment Bundle — Production Testnet Intake Prep

**Date:** 2026-09-14 (updated same day: real WASM built, Vela-confirmed guidance folded in)
**Status:** Preparation document — not yet a submission. Answers Priority F, item 20 of
`docs/vela/accelerator/constitutional-financial-services/08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-11.md`
("what artifact bundle do you want from us") against what Use Case Zero build-order items 5-11 have
actually shipped.

## Update — operator-confirmed guidance from Vela Engineering (this revision)

The operator supplied confirmed answers from Vela Engineering that close most of what this
document's first revision listed as open. Restated here as ground truth for this bundle, not
re-derived:

- Vela repos are the implementation source of truth.
- Deployment is managed BY Vela Engineering via the Production Testnet Deployment Intake — we do
  not self-serve a deployment.
- The environment is shared across apps; **no direct terminal access is provided.**
- **Base Sepolia is available; Horizen testnet is also in scope** through the managed process.
- **Multi-app with isolated per-app state/funds is implemented** (confirms this repo's own
  `services/vela/velaMultiPartyProjection.ts` party-namespace design was built against a real,
  already-implemented isolation guarantee, not an assumption).
- **Native ETH, ERC-20, and a facilitator path are implemented** on Vela's side.
- **A new WASM deployment means a new `applicationId` and fresh state** — there is no in-place
  upgrade/migration path yet. This matches `05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md` §17's own
  rule (a new WASM needs a new `applicationId` and fresh private state) — now confirmed from Vela's
  side too, not just inferred from our own spec doc.
- **Attestation establishes the trusted TEE signing key for the Vela instance**; later updates are
  verified against that registered key.

**Only four questions remain genuinely open** (the operator's own framing — do not treat the
managed-testnet path as unknown beyond these):

1. The exact deployment intake artifact/constructor/config bundle.
2. Canonical evidence binding `applicationId` to the exact WASM hash/version.
3. Whether Base Sepolia and Horizen testnet are separate trust domains / TEE registrations.
4. Local TinyGo availability for producing the real WASM binary + SHA-256 — **RESOLVED this
   revision, see §1 below.**

Repo-side preparation that does not depend on these four continues regardless — nothing in this
bundle, or in Use Case Zero build-order items 5-11, waits on them.

**Intake form (real, from the accelerator handoff package, not guessed):**
`docs/vela/accelerator/constitutional-financial-services/09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md`
line 22 and `docs/vela/accelerator/constitutional-financial-services/12_VELA_SOURCE_REGISTER_2026-09-10.md`
line 6 both cite the same URL: **https://tally.so/r/xXWL1v**. Whether this has already been submitted
is not something this repo can tell you. If it has already been sent, treat this document as a
status/readiness check against what you sent, not a new submission.

## Bundle contents

### 1. WASM binary + SHA-256 — **REAL ARTIFACT PRODUCED THIS REVISION**

The kernel source is `services/vela/wasm/projector/` (Go, TinyGo/WASI target, `app.go`/`main.go`).
The prior revision of this document reported no TinyGo toolchain available and named the exact
build command as blocked. Per the operator's own instruction, before treating "TinyGo not
installed" as "cannot build," this repo was checked for a Dockerized/CI TinyGo build path first —
**none exists** (`services/vela/wasm/projector/` has no `Dockerfile`; no `.github/workflows/*`
references `tinygo` or builds this WASM; the Makefile hardcodes a bare host-path default,
`TINYGO ?= /usr/local/tinygo/bin/tinygo`, with no containerized alternative). Outbound HTTPS from
this session's environment turned out to be reachable to GitHub Releases (verified with a direct
`curl` before assuming otherwise), so **TinyGo 0.39.0 — the exact version this codebase's own prior
update doc already names as the pinned version
(`codexes/packs/agentiq/updates/2026-08-22_vela-001-slice-2b-confidential-projection-proven.md`)
— was downloaded directly** and used to run the real, unmodified `make production_build` target:

```makefile
APP := moneypenny_projector
production_build:
	$(TINYGO) build -o production_build/$(APP).wasm -opt=s -no-debug -target=wasi .
```

**Result — a real, verified WebAssembly (WASI) binary:**

| Field | Value |
|---|---|
| File | `moneypenny_projector.wasm` |
| Size | 519,641 bytes |
| SHA-256 | `085869849896aa423a5fa6c13cc5651a4446240b538e37c6a517dbd3cbdecf02` |
| TinyGo version | 0.39.0 (linux/amd64, go1.24.7, LLVM 19.1.2) |
| Verified format | `file` confirms: WebAssembly (wasm) binary module version 0x1 (MVP) |

This is the artifact + hash to paste directly into the Tally submission, per the accelerator spec's
own rule (`05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md` §17): "the showcase must freeze and record the
exact `applicationId` and WASM SHA-256 used for every consequential risk or coverage result; a new
WASM means a new application ID and fresh private state." The binary itself is a build artifact — it
is `.gitignore`'d (`services/vela/wasm/projector/.gitignore` already excludes `production_build/`)
and was never committed to this repo, per CLAUDE.md's Dense Materials rule; it was handed to the
operator directly as a file, and this hash is the durable record.

**Reproducibility note:** this build ran in an ephemeral session container with no persistent
TinyGo install — the exact command above, with TinyGo 0.39.0, is what any future rebuild should
reproduce byte-for-byte (TinyGo/LLVM `-opt=s` output is deterministic for unchanged source).

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

### 3. Constructor params / trigger contract — **still open (Vela question 1)**

No existing constructor-parameter list or trigger-contract reference exists anywhere in
`services/vela/` or the accelerator docs beyond the open question itself. This remains a genuine
gap the Vela team needs to answer first (their own item 6 in `08_VELA_OFFICE_HOURS_QUESTIONS_
2026-09-11.md`: "confirm the exact signed update payload schema"). Submit as-is; do not propose a
constructor schema unvalidated against Vela's actual deploy tooling.

### 4. TokenAllowlist requirements — asset-neutral, so: none required

Per `11_VELA_TEAM_CONFIRMED_BASELINE_v0.1.md` §10 and the operator's own confirmed guidance above
(native ETH/ERC-20/facilitator already implemented on Vela's side, multi-app isolation already
implemented), the Use Case Zero build order's own item 2 ("widen transport asset-neutrality") and
the multi-party wiring (`services/vela/velaMultiPartyProjection.ts`) do not hardcode any specific
token — `VelaMultiPartyPartyInput.inputs` is a generic `Record<string, number>`, and every party
input in this chain is a private numeric value (exposure/spend/limits), never a token-denominated
on-chain amount. **Our answer to Vela:** no TokenAllowlist entries are required for the current Use
Case Zero scope (a private risk/coverage verdict, not an on-chain asset transfer) — if/when a real
settlement instruction is added, this answer will need revisiting.

### 5. Expected network — **partially open (Vela question 3)**

**Base Sepolia and Horizen testnet are both confirmed available/in scope** through the managed
process (operator-confirmed guidance above) — the remaining open question is narrower than the
prior revision framed it: not "which network," but **whether the two are separate trust domains /
separate TEE signer registrations**, which affects whether one deployment or two are needed. Ask
this directly rather than assuming either answer.

### 6. Test wallets/agents — **BLOCKED: live DB still unreachable this session (unrelated to the four Vela questions)**

The real, already-provisioned agent identities this deployment would exercise are the four
`REGISTRABLE_AGENTS` entries (`services/horizen/registrableAgents.ts`): `aigent-moneypenny`,
`aigent-nakamoto`, `aigent-kn0w1`, `aigent-factor` — each with its own `agent_keys` row (custodied
wallet) and `fio_handle` (`moneypenny@aigent`, `nakamoto@aigent`, `kn0w1@aigent`, `factor@aigent`).
**Their actual on-chain wallet addresses live in the `agent_keys` table.** Re-checked this revision
via the Supabase MCP connector directly (not just inferred from an earlier session note): the
`Aigent Z` project (`bsjhfvctmduxhohtllly`) now reports status `INACTIVE` in `list_projects`, and a
direct `execute_sql` query against it still times out ("Connection terminated due to connection
timeout") — still not reachable. This is independent of the four Vela-side open questions above;
it blocks only this one section. Once reachable:

```sql
select agent_id, fio_handle, address
from public.agent_keys
where agent_id in ('aigent-moneypenny', 'aigent-nakamoto', 'aigent-kn0w1', 'aigent-factor');
```

(Table/column names taken from `RegistrableAgentConfig`'s own doc comments — verify the exact
column name for the address field against the live schema before running.)

### 7. `applicationId` ↔ WASM hash evidence — **still open (Vela question 2)**

This is Priority B, question 5 in `08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-11.md`: *"On deploy, what
canonical fields should we record to bind `applicationId` to the exact WASM? Is the deploy-time
SHA-256 sufficient/canonical?"* — still open, still exactly the right question, now askable with a
REAL SHA-256 (§1) in hand rather than a placeholder. Once answered, the binding needs to be
recorded somewhere in this codebase's own evidence trail (most naturally alongside
`velaUnderwritingRiskTelemetry.ts`'s own `protocol_ref`/`action_ref` fields, or a new field on the
frozen-envelope receipt) — a follow-on implementation item once Vela's answer is in hand, not
something to build speculatively now.

## What to actually send

1. This document (or its "ready" sections 1, 2, 4, 7) as narrative context.
2. The real WASM binary + SHA-256 from §1 (already produced — the file was handed to the operator
   directly this revision).
3. The real test-wallet addresses, once Supabase is reachable again (query in §6) — independent of
   the rest of this bundle; nothing else needs to wait on it.
4. Sections 3 (constructor params/trigger contract) and the trust-domain question in §5 submitted
   as OPEN QUESTIONS to Vela — we don't have enough from their side yet to propose either
   confidently.

## Relationship to the local/simulated milestone

This bundle is deliberately independent of item 11's seed/fixture work (the local, `SIMULATED`-only
demo). Nothing here blocks that work, and that work does not block this bundle — see the companion
demo-completion checklist doc for how the two milestones are tracked separately.
