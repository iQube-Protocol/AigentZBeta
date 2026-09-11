# VELA-LIVE-ACTIVATION-001 — Stage 3.3 Promotion Runbook

**Date:** 2026-08-22
**Status:** Not started. Blocked entirely on Horizen granting Vela early-access/testnet instance
access (outreach note drafted, not yet sent — `docs/vela/VELA_EARLY_ACCESS_HANDOFF.md` §11).
**Purpose:** This is the exact, runnable checklist for the day access arrives. It operationalizes
the already-drafted VELA-002 plan (`VELA_EARLY_ACCESS_HANDOFF.md` §9) into ordered, verifiable
steps with pass/fail criteria — nothing here changes the plan, it makes it executable without
re-deriving it.

## Read this first

Stage 3.3 is **not an engineering redesign**. Every module this runbook touches already exists,
already passed its local proof (`2026-08-22_vela-001-slice-2f-gate2-authorisation.md`,
`2026-08-22_vela-001-slice-2g-execution-observation-validation.md`), and is already structured to
consume a real attested deployment the moment one exists (`AttestationMode`, `provenStatesFor()`,
`AttestationRequirement` all already model `NITRO_ATTESTED` as a first-class value). This runbook
promotes the **assurance class** of an already-complete mechanism — it does not build a new one.

**Do not, at any point in this runbook:**
- Modify `types/constitutionalCommerce.ts` (frozen).
- Modify Gate 2 (`services/registry/capabilityInvocationGates.ts`) or add a second authoritative-mode
  exception.
- Modify the projector WASM (sha256 `b287b7e838d172d2acb196f248dc1d6a35ee70d4450ef88ca3dd11c83bd81c1c`)
  — deploy it unchanged.
- Widen `services/financialServices/` eligibility, catalog, or orchestrator behavior. Runtime's
  `attestationRequirement: 'REQUIRED'` policy flip (step 6 below) is a **data** change to
  `services/vela/velaConfig.ts`'s deployment descriptor and `unifiedConsequenceProjection.ts`'s
  policy input, not a code change to any of those modules.

## Prerequisites

- [ ] Horizen has granted a dedicated Vela early-access/testnet instance (the outreach note in
      `VELA_EARLY_ACCESS_HANDOFF.md` §11 has been sent and a response received naming the
      instance/endpoint).
- [ ] The instance runs a genuine AWS Nitro Enclave TEE (real remote-attestation chain) —
      confirm this explicitly with Horizen before starting; a second local/emulated deployment
      does not satisfy Stage 3.3.
- [ ] `scripts/vela-slice2g-live-proof.ts`, `scripts/vela-slice2g-redeploy.ts`,
      `scripts/vela-slice2g-associate-key.ts` are present on the branch that runs this (they are
      the reusable machinery this runbook re-points, not rewrites).

## Step-by-step

### 1. Provision and point the stack at the early-access instance

Update `services/vela/velaConfig.ts`'s deployment descriptor to the early-access instance's
endpoint/chain details. This is the ONLY config surface that should change to retarget from local
Docker Compose to the real instance — if anything else needs to change to make this work, stop and
treat that as a genuine gap (per the operator's freeze ruling: escalate before adding a primitive).

**Pass:** the provider (`VelaConfidentialProjectionProvider`) can reach the instance (a
connectivity/health check succeeds) without any code change beyond the config descriptor.

### 2. Deploy the SAME projector WASM — no changes

Deploy sha256 `b287b7e838d172d2acb196f248dc1d6a35ee70d4450ef88ca3dd11c83bd81c1c` to the early-access
instance, using the same deploy mechanism `scripts/vela-slice2g-redeploy.ts` already implements
(re-point its target instance, do not fork it).

**Pass:** the deploy returns a fresh `applicationId` for the early-access instance. Record it —
per the ephemerality rule (`RES-2026-08-22-VELA-APPLICATION-ID-EPHEMERAL-001`), verify it still
exists before reusing it in any later step or re-run.

### 3. Associate the MoneyPenny requester key (provisioning, not transaction-time)

Run `scripts/vela-slice2g-associate-key.ts` (or its logic as a standalone provisioning phase)
against the early-access instance for MoneyPenny's requester P-521 key —
per `RES-2026-08-22-VELA-ASSOCIATEKEY-PROVISIONING-001`, this is onboarding, done once, never
reactively inside execution code.

**Pass:** the ASSOCIATEKEY (RequestType=3) call succeeds. If a subsequent PROCESS request fails
with `errorCode 9 "no Secp521r1_PubKey found"`, this step did not actually complete — do not treat
it as a projection problem.

### 4. Run ACCEPTABLE / UNACCEPTABLE / UNRESOLVED against the attested enclave

Re-run the same three confidential-projection cases Slice 2F/2G already proved locally, now against
the early-access instance:

- [ ] `ACCEPTABLE` — a confidential verdict where the projected consequence is acceptable.
- [ ] `UNACCEPTABLE` — a confidential verdict where it is not.
- [ ] Confidential evidence absent/unreachable — must still compose to `UNRESOLVED` (never guessed).

**Pass:** all three dispositions match the local proof's behavior exactly, sourced from the real
enclave instead of the local one. Any divergence in disposition logic (not attestation) is a
regression — stop and investigate before continuing; do not proceed to step 5 on a disposition
mismatch.

### 5. Verify genuine TEE attestation

Confirm `teeAttestationVerified` reads `true` for the first time anywhere in this codebase's live
history — currently `false` everywhere by construction under `NoAttestationTeeAuthenticator`.
Cross-check the attestation document/chain the instance returns actually validates (do not accept
a bare boolean from the provider without confirming what backs it — this is the entire point of the
independent-booleans discipline in `docs/vela/VELA-ATTESTATION-BOUNDARY-001.md`).

**Pass:** `teeAttestationVerified: true`, backed by a real, checkable attestation chain, on at least
one request. `protocolExecutionVerified` and `teeAttestationVerified` remain independent booleans —
never infer one from the other.

### 6. Flip `attestationRequirement = REQUIRED` — now legitimate

In `services/constitutionalCommerce/unifiedConsequenceProjection.ts`'s `CompositionPolicy` usage for
MoneyPenny Runtime (already `REQUIRED` in `services/financialServices/serviceCatalog.ts` — this
step is about the Vela-side deployment now being able to SATISFY that requirement, not about
changing the requirement itself, which has been `REQUIRED` since Stage 3.1). Confirm this is a
**data/deployment** change (which Vela deployment descriptor is active), not a code change to
`unifiedConsequenceProjection.ts`, `serviceCatalog.ts`, or any `financialServices/` module.

**Pass:** no source file changes; only the active deployment descriptor changes.

### 7. Prove AUTHORISED is reachable ONLY when attestation verifies

Re-run the exact test shape `tests/financial-services-runtime.test.ts`'s "Phase 3 hard dependency"
group already encodes, but against the real instance instead of the SYNTHETIC FIXTURE:

- [ ] Real attested `ACCEPTABLE` evidence → `AUTHORISED`, execution bound.
- [ ] Real but UNATTESTED evidence (if the instance can produce this state, e.g. attestation
      temporarily unavailable) → still `UNRESOLVED`, zero execution — symmetric with the existing
      local canary, now proven against live infrastructure instead of a local stand-in.

**Pass:** the SYNTHETIC FIXTURE test's assertions (`tests/financial-services-runtime.test.ts`,
"SYNTHETIC FIXTURE... proves the mechanism, not a live claim") now hold with REAL evidence. Update
that test's comment to remove the "SYNTHETIC" qualifier and cite the real `applicationId` once this
passes — do not delete or fork the test; correct its evidentiary status in place.

### 8. Bind and execute a harmless real consequence

Using `bindExecution()` exactly as today — an intent record only, never a signed/broadcast
transfer, per this codebase's standing no-production-execution discipline. Do not extend this step
to a real signed transaction unless and until the operator explicitly authorises going further, in
a separate, later ruling.

**Pass:** a real `CommerceExecution` intent is bound against a real attested `ActionAuthorisation`.
`transactionRef` remains absent (execution binding is never confirmation — unchanged invariant).

### 9. Observe and validate the consequence

Run `recordObservedConsequence()` against the bound execution exactly as Slice 2G's chain already
does, for at least the `MATCHED_PROJECTION` and `DIVERGED_FROM_PROJECTION` cases.

**Pass:** validation states match Slice 2G's local behavior, now on real attested evidence.

### 10. Persist the complete attested causal chain

Use the existing `assembleCausalChain()`/receipt machinery unchanged. Persist the full reference
chain (mirroring `2026-08-22_vela-001-slice-2g-live-proof-evidence.json`'s shape) to a new evidence
file, e.g. `codexes/packs/agentiq/updates/<date>_vela-002-live-attestation-proof-evidence.json`, and
write the accompanying session doc under `codexes/packs/agentiq/updates/` per this repo's
Codebase Update Documentation convention.

**Pass:** the evidence file carries a REAL `teeAttestationVerified: true`, the real `applicationId`,
and the complete `ActionAuthorisation → CommerceExecution → ObservedConsequence` reference chain —
no fields fabricated or inferred.

## After this runbook completes

Update the frozen-state block in `VELA_EARLY_ACCESS_HANDOFF.md` and
`2026-08-22_phase3-stage-3.1-3.2-freeze-and-tracks-abc.md`:

```
STAGE 3.3 (Vela live attestation): LIVE-PROVEN
```

Runtime's structural fail-closed gate (per Track A/B/C's parent freeze doc) then legitimately opens
for real consequential execution — this is the ONLY event that changes it. No code change is
required to "unlock" Runtime; it unlocks itself the moment `composeUnifiedConsequenceProjection()`
is fed genuinely attested evidence, because that is exactly what the frozen composition logic was
built to do.

## If Horizen's instance does NOT provide genuine Nitro attestation

Stop. Do not flip `attestationRequirement` expectations or relax any test based on a
non-Nitro-attested deployment — that would silently re-create exactly the local/dev gap this
runbook exists to close. Report back to Horizen naming the specific gap (e.g. attestation document
absent, chain unverifiable) rather than proceeding on a partial promotion.
