# PUBLIC VELA v0.2.0 DEVNET — EMULATED TEE

**Date:** 14 September 2026
**Status:** Milestone achieved and reproducible. This is NOT the managed Horizen/Vela Engineering Nitro-attested testnet, NOT the seeded Use Case Zero product demo, and NOT a durable deployment.

## What this milestone means

Our actual MoneyPenny multi-party Vela guest (`services/vela/wasm/projector/app/app.go`, already carrying the merged multi-party namespace/`COMPUTE_WITH`/`DISCLOSE_TO`/non-transitivity/fail-closed-`UNRESOLVED` enforcement) has executed through the remote Vela v0.2.0 lifecycle — Authority Service upload → `submitDeployRequest` → `applicationId` → `ASSOCIATEKEY` → `PROCESS` request → state update → decode — against a real, publicly reachable Vela devnet instance operated by Synsema (`https://devnet.synsema.app/`), not our local Docker Compose stack.

**This explicitly does NOT mean:**
- Nitro hardware attestation (the devnet runs `NoAttestationTeeAuthenticator`, `attestationMode: 'no_attestation'`, confirmed both from its own public documentation and from the deployment descriptor returned by its token endpoint).
- Production or managed-testnet persistence (the instance is explicitly described by its operator as reset "from time to time: a place to iterate, not to keep value," and every `applicationId` obtained is ephemeral — same discipline as `RES-2026-08-22-VELA-APPLICATION-ID-EPHEMERAL-001`).
- The managed Horizen/Vela Engineering deployment tracked in `docs/vela/VELA-LIVE-ACTIVATION-001.md` / `VELA_EARLY_ACCESS_HANDOFF.md` (still blocked on the four open items named in `2026-09-14_vela-managed-deployment-bundle.md`).
- Live underwriting or live settlement.
- Durable state of any kind.

## Source and build

- **Guest source:** `services/vela/wasm/projector/app/app.go` at commit `de4222fe7` ("Add guest-side disclosure-scope enforcement for multi-party Vela projections") — unchanged since that commit, confirmed via `git log` before this run.
- **WASM artifact:** `services/vela/wasm/projector/production_build/moneypenny_projector.wasm`, 519,641 bytes, SHA-256 `085869849896aa423a5fa6c13cc5651a4446240b538e37c6a517dbd3cbdecf02` — the same artifact built and recorded on 2026-09-14 in `2026-09-14_vela-managed-deployment-bundle.md`. Verified byte-identical (same SHA-256) immediately before this run, so no rebuild was needed; the Authority Service's own upload response independently confirmed the same hash.
- **Toolchain:** TinyGo 0.39.0 (`-target=wasi`), from the prior session's build; not reinstalled for this run since the artifact was already current.

## Real deployment/execution contract (source-verified, not guessed)

The public devnet's own homepage names `novaw` (`github.com/HorizenOfficial/vela-nova`) as its reference CLI but gives no HTTP contract for artifact upload. That contract was read directly from `vela-nova`'s pinned `wallet/cmd/deployapp.go` (tag-consistent with the rest of this codebase's Vela integration, which is source-verified against v0.2.0 throughout):

```
POST {AuthorityServiceURL}/deploy/upload   (multipart, field "wasm", filename "app.wasm")
  -> { artifactId: "sha256:<hex>", wasmSha256: "<hex>" }
submitDeployRequest(protocolVersion, DeployDescriptor{mode:"artifact_ref", artifactId, wasmSha256, constructorParams})
  -> DeployRequestSubmitted{applicationId, requestId} -> poll DeployRequestCompleted
```

This exactly matches the existing `VelaDeployDescriptor` shape already defined in `services/vela/velaTypes.ts` — no drift between the proposed local type and the real wire contract.

## What was run

`scripts/vela/public-devnet-smoke.ts` (new, reproducible, credential-free of any hardcoded secret):

1. Reads devnet coordinates + the granted account's key from a token-response JSON file (`VELA_PUBLIC_DEVNET_TOKEN_FILE`, obtained via `POST https://devnet.synsema.app/token` — never committed, never hardcoded).
2. Uploads the WASM artifact to the Authority Service and deploys it via `submitDeployRequest`, polling `DeployRequestCompleted` (bounded, 60 × 3s).
3. Generates two fresh local EVM keypairs (Party B, Party C — transport/test identities only, explicitly not ArkAgent/Nakamoto/Kn0w1 persona bindings), funds them from the devnet-granted account, and registers all three parties' P-521 communication keys via `ASSOCIATEKEY` (RequestType=3).
4. Submits three real multi-party requests and independently decodes each party's own result using that party's own registered P-521 key (never a shared or submitter-side decode).

### Case A — unauthorized joint computation (invalid scope binding)

A `MultiPartyProjectionRequest` whose `scope.binding.requestRef` deliberately does not match the request's own `requestRef` — constructed at the raw wire level (bypassing this codebase's own client-side `assertVelaMultiPartyScopeBindingMatchesContext` gate, which would otherwise refuse to submit it) specifically to prove the **guest's own** in-enclave enforcement, independent of our TS-side gates.

**Result:** both parties' decoded disposition = `UNRESOLVED`, confirmed via the raw on-chain result (`errorCode: 0`, decrypted payload `{"verdict":"UNRESOLVED"}` for both) — a genuine guest-computed refusal, not an execution/fee error.

### Case B — authorized joint computation, restricted disclosure

Party A and Party B both grant `COMPUTE_WITH`; only Party B grants `DISCLOSE_TO` naming Party A (Party A may see the joint result; Party B may not). Inputs were deliberately chosen so the joint verdict and Party B's own standalone verdict are **provably different values** — the guest's conservative combine rule (aggregate must respect every contributing party's own limits) makes the combined spend exceed Party B's own limit while each party's own standalone projection alone is acceptable:

- Party A's own standalone (uncombined): ACCEPTABLE.
- Party B's own standalone (uncombined): ACCEPTABLE.
- Joint (combined) verdict: UNACCEPTABLE.

**Result:** Party A received `UNACCEPTABLE` (the joint verdict — confirmed via raw decrypt); Party B received `ACCEPTABLE` (its own standalone verdict). Because these two values differ, this is a decisive proof — not a coincidence of matching verdicts — that Party B received something other than the joint result it was never disclosed, and that neither party's raw operands crossed to the other (they never leave the enclave in cleartext at all).

### Case C — scope replay / non-transitivity

Case B's exact scope (same grants, same `binding.requestRef`) resubmitted against a genuinely new request (a fresh top-level `requestRef`). A scope minted for one request is rejected against another, even with identical parties and identical grants.

**Result:** both parties' decoded disposition = `UNRESOLVED` (confirmed via raw on-chain result, `errorCode: 0`).

## A real execution-fee finding (recorded so it is never re-debugged from scratch)

The first run submitted every multi-party `PROCESS` request at the bare `minFeePerRequest()` (10 wei on this devnet) and every case decoded as `UNRESOLVED`, including Case B's genuinely authorized combination. Raw on-chain inspection (`errorCode`, not just the decoded disposition) revealed `errorCode: 12, "insufficient fuel: required 25 wei, provided 10 wei"` on **every** case — an execution/fee failure, not a guest disposition, and it decodes identically to a genuine authorization refusal (`getVelaMultiPartyProjectionDisposition` maps any non-zero `errorCode` to `UNRESOLVED`) unless the raw result is inspected directly. Multi-party requests process more than one party's `ProjectionInputs`, so they cost more execution "fuel" than the single-party minimum this devnet's `minFeePerRequest()` reflects. Fixed by setting a generous `maxFeeValueWei` (1,000,000 wei — still negligible against the devnet's 10,000 test-ETH grant) on every party's `VelaClientAdapter`. Re-running with real, differentiated verdicts and raw `errorCode: 0` checks on every case is what produced the results above.

## Acceptance gates (operator-specified, all twelve)

| # | Gate | Status |
|---|---|---|
| 1 | Deployed WASM built from current guest source | ✅ same commit/SHA-256 as the 2026-09-14 build |
| 2 | SHA-256 recorded | ✅ `085869849896aa423a5fa6c13cc5651a4446240b538e37c6a517dbd3cbdecf02` |
| 3 | Public Vela instance returns a real `applicationId` | ✅ (ephemeral per run — see below) |
| 4 | At least two Vela users registered | ✅ three (A, B, C) via real `ASSOCIATEKEY` |
| 5 | A real request runs through the deployed guest | ✅ three real requests (Cases A/B/C) |
| 6 | Result decoded successfully | ✅ each party decoded with its own P-521 key |
| 7 | Unauthorized multi-party computation fails closed | ✅ Case A: `UNRESOLVED` for both |
| 8 | Authorized joint computation works | ✅ Case B: Party A receives the real joint `UNACCEPTABLE` verdict |
| 9 | Disclosure remains narrower than computation permission | ✅ Case B: Party B (combined but not disclosed) receives its own `ACCEPTABLE`, decisively differs from the joint `UNACCEPTABLE` |
| 10 | Execution explicitly classified EMULATED, never hardware-attested | ✅ `attestationMode: 'no_attestation'` throughout this doc and the config |
| 11 | No secrets committed | ✅ token/keys held only in this session's ignored scratchpad; never written to the repo |
| 12 | Existing Vela/local/fake-transport tests remain green | ✅ all 17 Vela test files, 287 passed / 2 pre-existing skips (unchanged) |

Applications deployed during this session (`783626515995577684` for the final, decisive run; two earlier ones from the fee-diagnosis iterations) are ephemeral per this devnet's own reset cadence — they are evidence of a completed run, not a durable identity to be reused later.

## Adapter/config changes (additive only)

- `services/vela/velaConfig.ts`: added `'public_devnet'` to `VelaEnv` and `resolvePublicDevnetDeployment()`, mirroring `resolveEarlyAccessDeployment()`'s exact fail-closed discipline (every coordinate from a `VELA_PUBLIC_DEVNET_*` env var, no guessed value, specific missing-var errors). `attestationMode` is fixed to `'no_attestation'` for this profile (not env-configurable) since this specific public instance is unconditionally unattested — there is no attestation-mode var to mis-set. `'local'` and `'early_access'` are entirely unchanged.
- No change to `velaClientAdapter.ts`, `velaProjectionProvider.ts`, `velaMultiPartyProjection.ts`, `velaPartyNamespace.ts`, `velaTypes.ts`, or any frozen file — the smoke script composes existing exports plus small script-local helpers (WASM upload, deploy-request submission, `ASSOCIATEKEY` submission) mirroring the already-existing `scripts/vela-slice2g-redeploy.ts` / `scripts/vela-slice2g-associate-key.ts` patterns, generalized to an arbitrary `VelaDeploymentDescriptor` instead of the hardcoded local one.
- New test coverage: `tests/vela-config-early-access.test.ts` gained a `resolveVelaDeployment('public_devnet')` describe block (6 new tests) alongside the existing `'early_access'` coverage, same file, same conventions.

## Reproducing this

```bash
curl -sS -X POST https://devnet.synsema.app/token -o /path/outside/repo/token_response.json
VELA_PUBLIC_DEVNET_TOKEN_FILE=/path/outside/repo/token_response.json \
  npx tsx scripts/vela/public-devnet-smoke.ts
```

Never write the token response JSON inside the repository working tree.

## Remaining gap to the managed Horizen/Vela Engineering deployment

Unchanged from `2026-09-14_vela-managed-deployment-bundle.md`: exact deployment-intake artifact/constructor/config bundle; canonical `applicationId` ↔ WASM-hash evidence binding (this run's Authority Service upload response DID independently confirm the hash it stored, which is a real evidentiary data point for that open question — worth relaying to Vela Engineering); whether Base Sepolia and Horizen testnet are separate trust domains; local TinyGo availability (resolved this session — direct download works, no Docker/CI path needed). This public-devnet proof does not touch Nitro attestation and is not a substitute for it.

## New question for Vela Engineering, surfaced by this run

The `minFeePerRequest()` value returned by `ProcessorEndpoint` reflects the SINGLE-party execution cost floor; multi-party requests (more `ProjectionInputs` processed per call) can genuinely require more execution "fuel" than that floor covers, failing with `errorCode 12 "insufficient fuel"` — a fee shortfall, not an authorization decision — that a caller cannot distinguish from a legitimate `UNRESOLVED` disposition without inspecting the raw `errorCode`. Is there a documented fuel-cost model (e.g. proportional to party count / payload size) a caller could use to compute a safe `maxFeeValue` rather than a generous flat guess?
