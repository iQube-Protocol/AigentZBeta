# VELA-001 Slice 2E — Unified Consequence Projection

**Date:** 2026-08-22
**Workstream:** VELA-001 — MoneyPenny × Vela: Confidential Constitutional Execution
**Status:** Slice 2E closed. Composition seam built, 38 canaries green, live composition proven 5/5 with real on-chain confidential projections.

## What this slice actually is

Not a Vela feature. The **canonical consequence-composition seam** — shared substrate for Vela, the Ian experimental substrate, Conditional Commerce and eventually Qriptosentience.

```
CFS-006a forecastConsequences()   →  public / invariant-graph projection
ConfidentialProjectionProvider    →  confidential projection evidence
ConsequenceProjection             →  the composition envelope
```

Owned by neither side. It lives at `services/constitutionalCommerce/unifiedConsequenceProjection.ts` — deliberately outside both `services/consequence/` (CFS-006a) and `services/vela/`, because neither the invariant graph nor a confidential provider owns the final constitutional projection alone.

## Composition semantics

| Required components | Composed |
|---|---|
| all ACCEPTABLE | **ACCEPTABLE** |
| any UNACCEPTABLE | **UNACCEPTABLE** |
| any UNRESOLVED (none unacceptable) | **UNRESOLVED** |
| zero components | **UNRESOLVED** |

`ACCEPTABLE` requires *every* required component to be acceptable. One acceptable component can never rescue another.

**`confidentialRequirement` is explicit `REQUIRED | NOT_REQUIRED`,** never inferred from presence. "We did not get evidence" and "this action never needed any" are different facts; conflating them is precisely how missing evidence would silently read as ACCEPTABLE. `REQUIRED` + absent ⇒ `UNRESOLVED`.

### One precedence call the ruling left open

`UNACCEPTABLE` outranks `UNRESOLVED`. Both block execution, so *safety* does not distinguish them — *accountability* does. If a component established a definite reason to refuse, reporting `UNRESOLVED` would hide a known refusal behind "we could not tell" and would invite a pointless retry of an action already known to be unacceptable. The unresolved component stays visible in its own provenance either way. Flagged here because it was a judgment call, not a specified one.

## The proven distinction, preserved

| | Meaning |
|---|---|
| `UNACCEPTABLE` | a projection **was** established, and the projected consequence is not acceptable |
| `UNRESOLVED` | a projection **could not be** established |

Infrastructure failure, fee failure, missing evidence and unverifiable attestation are all `UNRESOLVED`. None can become `UNACCEPTABLE`. Canaries cover each path — including that an `UNACCEPTABLE` verdict whose protocol execution is *unverified* still composes to `UNRESOLVED`, because a verdict we cannot trace to its environment is not an established refusal.

The attestation policy (`requireVerifiedAttestation`) defaults **permissive** so a local/emulated deployment composes at all. That default is safe only because `teeAttestationVerified` travels through as independent provenance for any consumer that requires hardware trust — and a canary proves an identical composed disposition on attested and unattested deployments, so attestation is never smuggled into the verdict.

## Provenance is never flattened

Independently inspectable on every composed projection:

- **public:** `source`, `disposition`, `forecastRef`, the full CFS-006a `forecast` (findings intact), `reason`
- **confidential:** `requirement`, `disposition`, `provider`, `requestRef`, `evidenceRef`, `payloadCommitment`, `protocolExecutionVerified`, `teeAttestationVerified`, `attestationMode`, `reason`
- **composition:** `disposition`, `compositionRationale` naming the deciding component

A canary fails the build if a `score` / `confidence` / `weight` / `total` / `aggregate` field ever appears on the projection or either component.

`projectionContextRef` survives composition **verbatim**, so the Ian experiment can attribute a projected-vs-observed delta to a specific decision context. Two projections of the same action under different contexts get different `projectionRef`s — the property Ian needs to separate context effects from action effects.

## Public-component mapping (CFS-006a forecast → disposition)

| Forecast | Disposition | Why |
|---|---|---|
| no seed invariants | UNRESOLVED | absence of applicable invariants is **not acceptance** — the same absence-≠-permission rule the confidential projector already enforces for a missing limit |
| constitutional constraint reaches the action | UNACCEPTABLE | established knowledge that the projected consequence is not acceptable |
| reachable contradiction | UNRESOLVED | self-contradictory knowledge cannot establish a coherent projection |
| canonical (non-constitutional) constraint | UNACCEPTABLE | a constraint bounds the action |
| clean | ACCEPTABLE | |

Note on vocabulary: CFS-006a calls the constrained case "escalate". **Escalation is an Authorisation-Plane decision**, not a projection outcome — the Authorisation Plane may escalate for ratification rather than refuse outright. The projection's job is only to report what it established.

## Authority boundary

The composition module cannot emit an authorisation. It never imports `ActionAuthorisation`, and a canary sweeps the full nine-case composition matrix for `AUTHORISED` / `AUTHORIZED` / `ACTION_AUTHORISED` / `AUTHORITY_VALID` / `MANDATE_VALID` / `authorisationRef`.

```
Consequential Authority + Proposed Action + Unified Consequence Projection
    → Authorisation Plane
```

## Evidence

**38 canaries** (`tests/unified-consequence-projection.test.ts`) — the eleven required invariants plus the full matrix. **203/203** across the composition suite, the Vela provider suite, CFS-006a's own suites (`consequence-pipeline`, `consequence-fork-projection`), the source-of-truth parity canary and repo-weight.

**Live composition** (`scripts/vela-slice2e-live-composition.ts`), 5/5, with genuinely on-chain confidential projections from the local enclave:

```
public ACCEPTABLE   + confidential ACCEPTABLE (live)     → ACCEPTABLE    ✓
public ACCEPTABLE   + confidential UNACCEPTABLE (live)   → UNACCEPTABLE  ✓
public UNACCEPTABLE + confidential ACCEPTABLE (live)     → UNACCEPTABLE  ✓
public ACCEPTABLE   + confidential REQUIRED but absent   → UNRESOLVED    ✓
public ACCEPTABLE   + confidential NOT_REQUIRED          → ACCEPTABLE    ✓

Provider invocations: 3 of 5 cases — the absent and not-required cases are
proven not to invoke it.
```

**Stated limitation:** the live script prefers the real invariant store and falls back to locally-constructed forecasts of CFS-006a's own `ConsequenceForecast` type where `SUPABASE_URL`/`SUPABASE_ANON_KEY` are absent, as in this offline sandbox. It labels which source it used on every case. The confidential half is live in every case; the composition under test is identical either way. Run where Supabase is configured and it uses the real store automatically.

## Next

Slice 2F — MoneyPenny's `CONFIDENTIAL_CONSEQUENCE_PROJECTION` capability, attached to the existing `services/registry/invocationGateway.ts` Gate 2 refusal point rather than a parallel invocation system.
