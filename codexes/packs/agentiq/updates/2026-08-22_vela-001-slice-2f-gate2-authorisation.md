# VELA-001 Slice 2F — MoneyPenny's capability through the existing Gate 2, plus the Slice 2E precedence refinement

**Date:** 2026-08-22
**Workstream:** VELA-001 — MoneyPenny × Vela: Confidential Constitutional Execution
**Status:** Slice 2F closed. Live traversal proven 20/20 against the real local Vela enclave.

## Part 1 — Slice 2E ratified refinement

The operator's acceptance of Slice 2E came with a precedence clarification:

**Precedence** `UNACCEPTABLE > UNRESOLVED > ACCEPTABLE` decides `disposition` **only**. Two new independent fields carry the rest of the picture:

- `completeness: 'COMPLETE' | 'PARTIAL'`
- `unresolvedComponents: string[]`

So `UNACCEPTABLE(public) + UNRESOLVED(confidential)` now composes to `disposition: UNACCEPTABLE, completeness: PARTIAL, unresolvedComponents: ['confidential']` — the refusal is reported and acted on, and the gap in the evidence stays visible rather than being silently absorbed into a clean-looking verdict. This is the literal fix for "do not hide a known refusal behind unresolved evidence."

**Attestation requirement** became an explicit three-state policy: `CompositionPolicy.requireVerifiedAttestation?: boolean` (defaulted `false`, i.e. permissive) is replaced by `attestationRequirement: 'NOT_REQUIRED' | 'REQUIRED' | 'UNSPECIFIED'`. **`UNSPECIFIED` — the default when a caller supplies no policy at all — fails closed**, treated exactly as `REQUIRED`. A caller must say `NOT_REQUIRED` explicitly to compose from an unattested result; omission is never read as permission. Both live scripts (Slice 2E and 2F) now pass `attestationRequirement: 'NOT_REQUIRED'` explicitly, with a comment naming why (the local deployment runs `NoAttestationTeeAuthenticator` by construction).

A canary proves the symmetric treatment this policy demands: an unattested `ACCEPTABLE` verdict and an unattested `UNACCEPTABLE` verdict both compose to `UNRESOLVED` under `REQUIRED` — attestation is evidence *quality*, never projected *consequence*, so it can never selectively rescue an optimistic reading while blocking a pessimistic one (or vice versa).

**50 canaries** (up from 38), all green.

## Part 2 — Slice 2F: the existing Gate 2, not a parallel path

The narrow, structural exception lives entirely inside `evaluateCapabilityAndRuntimeGate` (`services/registry/capabilityInvocationGates.ts`), which is what the design doc and this repo's own code both call **Gate 2** — the exact function that already unconditionally refuses `authoritative` execution mode with `MODE_NOT_PERMITTED`. One `capabilityId` constant, one `if`:

```
executionMode === 'authoritative' AND capabilityId === 'CONFIDENTIAL_CONSEQUENCE_PROJECTION'
  → projection.disposition === 'ACCEPTABLE'   → pass
  → projection.disposition === 'UNACCEPTABLE' → refuse CONSEQUENCE_PROJECTION_UNACCEPTABLE
  → projection.disposition === 'UNRESOLVED'   → refuse CONSEQUENCE_PROJECTION_UNRESOLVED
  → no projection attached                    → refuse CONSEQUENCE_PROJECTION_UNRESOLVED
otherwise: unchanged — MODE_NOT_PERMITTED, exactly as before
```

Every other capability's authoritative-mode refusal is untouched — a regression canary calls the same exported function with `bitcoin_decentralisation_expertise` and an *ACCEPTABLE* projection attached, and it still refuses `MODE_NOT_PERMITTED`. Gate 1 (identity/authority) and Gate 3 (policy/consequence) are unmodified; a Gate 1 refusal (no active delegation) still blocks the gated capability regardless of an ACCEPTABLE projection — proven directly.

`CapabilityInvocation` gained one optional field, `consequenceProjection?: ConsequenceProjection`, computed by the caller *before* constructing the envelope. Gate 2 is the only code that reads it.

### The authorisation is a separate, downstream derivation — never the gate itself

`services/constitutionalCommerce/actionAuthorisation.ts::deriveActionAuthorisation()` is what actually computes `Consequential Authority ∩ Acceptable Consequence Projection = Action Authorised`. `allow` from `invokeCapability()` is a **governance-layer** permission to dispatch — necessary, never sufficient. The function:

- independently **re-checks** the projection's own `disposition` and `completeness` rather than trusting the gate decision (the same discipline the composition module applies to a provider's own claimed verdict — never trust a downstream signal blindly);
- maps a `CONSEQUENCE_PROJECTION_UNRESOLVED` refusal to `ActionAuthorisation.status: 'UNRESOLVED'` (nothing was established) and every *other* refusal reason to `REFUSED` (something concrete blocked it — inactive authority, depth exceeded, an established UNACCEPTABLE projection, etc.);
- treats `allow-with-approval` as `UNRESOLVED` (pending, not yet authorised) and `shadow-only` as `REFUSED` (shadow execution never authorises the real action).

Owned by neither CFS-006a nor Vela, matching the composition seam it sits beside.

## Test methodology — this repo's own existing convention, not a new one

`tests/vela-slice2f-capability-invocation.test.ts` mirrors `tests/governed-capability-invocation.test.ts`'s established mocking pattern for this exact gateway function: only the DB-backed capability-registry and admission-state seams (`resolveCapabilityProviders`, `resolveRegistrableAgentByRuntimeId`, `resolveAgentAdmissionState`, `emitReceipt`, Supabase) are stood in — the same seams that file already stands in for the Nakamoto capability, for the same reason (no live Supabase/DB in this sandbox, as already established in Slices 2A/2E). **Nothing about Vela, the composition seam, Gate 2's consequence-projection logic, or authorisation derivation is mocked anywhere.**

Two tiers:
1. **Deterministic** (19 tests, no Docker) — `VelaTestTransport`-backed projections drive the full matrix.
2. **Live** (opt-in, `VELA_SLICE2F_LIVE=1`) — the identical traversal against the real running local Vela stack.

## Live result

```
ACCEPTABLE + active authority + Gate 2 pass          → AUTHORISED  ✓
UNACCEPTABLE (live confidential verdict)              → REFUSED     ✓
REQUIRED confidential deliberately absent             → UNRESOLVED  ✓

authority -> CFS-006a public projection -> LIVE Vela confidential
projection (real enclave-executed WASM, real on-chain tx, applicationId
2089125378143059424) -> unified projection -> real Gate 2 (inside real
invokeCapability()) -> real deriveActionAuthorisation()

20/20 tests passed (19 deterministic + 1 live, which itself covers all
three dispositions in a single traversal).
```

## What remains explicitly out of scope for this slice (unchanged from the plan)

Registering `CONFIDENTIAL_CONSEQUENCE_PROJECTION` as a live capability descriptor for MoneyPenny in the real Agent Bench / registrable-agent data is a **data change**, not a code change, and requires live Supabase credentials this sandbox does not have — same category of gap as the CFS-006a invariant-store fallback already documented in Slice 2E. The code path is complete and proven; the production data row is a deployment step.

## Links

- `services/constitutionalCommerce/actionAuthorisation.ts`
- `services/registry/capabilityInvocationGates.ts` (Gate 2 change)
- `types/capabilityInvocation.ts` (`consequenceProjection` field)
- `types/constitutionalCommerce.ts` (`completeness`, `unresolvedComponents`, `AttestationRequirement`)
- `tests/vela-slice2f-capability-invocation.test.ts`
- `tests/unified-consequence-projection.test.ts` (50 canaries)
- Prior session docs: `2026-08-22_vela-001-slice-2e-unified-consequence-projection.md`, `2026-08-22_vela-001-slice-2b-confidential-projection-proven.md`

## Next

Remaining VELA-001 tracked work: receipt/event ontology extension (§22), SmartWallet `CONFIDENTIAL_PROJECTION_REQUEST` pending-action type, Journey Consequence Modal alignment, the full §31 security/constitutional canary list, and `VELA_EARLY_ACCESS_HANDOFF.md` once locally-provable work is exhausted.
