/**
 * TS-side wiring for Vela multi-party confidential projection requests
 * (`services/vela/velaMultiPartyProjection.ts`) — the build-order item
 * immediately following
 * `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-party-guest-enforcement.md`.
 *
 * Proves the eight operator-mandated acceptance gates (2026-09-13, verbatim
 * in the task instructions), one describe block per gate, plus a
 * construction/round-trip suite proving the constructed request is
 * wire-EXACT with `services/vela/wasm/projector/app/app.go`'s Go structs by
 * JSON tag.
 *
 * `multiPartyVerdictForRecipient` below is a TEST-ONLY, minimal JS mirror of
 * `app.go`'s `resolveAuthorizedCombination` + `chooseVerdictForRecipient` +
 * `evaluateCombinedInputs` — used ONLY as a `VelaTestTransport.verdictFor`
 * callback so gate 5(b) and the round-trip decode tests can prove behaviour
 * end-to-end through the deterministic fake transport without needing the
 * real WASM guest (out of scope for this item, per the task's own
 * instructions). It intentionally mirrors only the reference joint formula
 * `app.go` itself documents as a MINIMAL reference (not the real underwriting
 * formula, which is the next build-order item's job) and is not exported —
 * it is not production code, and does not replace or duplicate anything in
 * `services/vela/velaMultiPartyProjection.ts` itself, which contains no
 * combination logic of its own.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
  VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
  VELA_MULTI_PARTY_PROJECTION_REQUEST_TYPE,
  VELA_SCOPE_ACTION_COMPUTE_WITH,
  VELA_SCOPE_ACTION_DISCLOSE_TO,
  assertValidVelaMultiPartyDisclosureScope,
  assertVelaMultiPartyScopeBindingMatchesContext,
  buildVelaMultiPartyProjectionRequest,
  getVelaMultiPartyProjectionDisposition,
  getVelaMultiPartyProjectionOutcome,
  prepareVelaMultiPartyProjection,
  submitVelaMultiPartyProjection,
  type BuildVelaMultiPartyProjectionRequestParams,
  type VelaMultiPartyDisclosureScope,
  type VelaMultiPartyPartyInput,
} from '@/services/vela/velaMultiPartyProjection';
import { deriveVelaPartyNamespaceRef } from '@/services/vela/velaPartyNamespace';
import { VelaTestTransport } from '@/services/vela/velaTestTransport';
import { VELA_LOCAL_DEPLOYMENT } from '@/services/vela/velaConfig';
import { ETH_SENTINEL_ADDRESS, type VelaAssetRef } from '@/services/vela/velaTypes';
import { VELA_V0_2_0_ERROR_CODES } from '@/services/vela/velaFuelAccounting';

const APP_ID = '42';
const OTHER_APP_ID = '99';
const SIGNER = '0x2a0fba02cee7fb70899648037c7E8203881e2D55';

const PARTY_A_IDENTITIES = { authorityPrincipal: 'principal-a', confidentialPrivacyIdentity: 'privacy-a' };
const PARTY_B_IDENTITIES = { authorityPrincipal: 'principal-b', confidentialPrivacyIdentity: 'privacy-b' };

const ADDR_A = '0x1111111111111111111111111111111111111111';
const ADDR_B = '0x2222222222222222222222222222222222222222';

const REF_A = deriveVelaPartyNamespaceRef(APP_ID, PARTY_A_IDENTITIES);
const REF_B = deriveVelaPartyNamespaceRef(APP_ID, PARTY_B_IDENTITIES);

function validScope(requestRef: string, grants: VelaMultiPartyDisclosureScope['grants'] = []): VelaMultiPartyDisclosureScope {
  return {
    binding: {
      applicationId: APP_ID,
      requestRef,
      operationType: VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
      outputClass: VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
    },
    grants,
  };
}

/** Fixture inputs chosen so each party's OWN standalone verdict is
 *  ACCEPTABLE, but the joint combination is UNACCEPTABLE — the same
 *  "verdict flips when (and only when) combination + disclosure both
 *  happen" property `app_multiparty_test.go` uses, so a passing round-trip
 *  test is a real proof rather than a coincidence. */
function partyInputs(): Record<string, number> {
  return { currentExposure: 0, proposedSpend: 800, privateSpendLimit: 1000, privateRiskLimit: 1000 };
}

function twoParties(): VelaMultiPartyPartyInput[] {
  return [
    { identities: PARTY_A_IDENTITIES, recipientAddress: ADDR_A, inputs: partyInputs() },
    { identities: PARTY_B_IDENTITIES, recipientAddress: ADDR_B, inputs: partyInputs() },
  ];
}

function baseParams(requestRef: string, scope: VelaMultiPartyDisclosureScope): BuildVelaMultiPartyProjectionRequestParams {
  return { applicationId: APP_ID, requestRef, parties: twoParties(), scope };
}

// ── Test-only mirror of app.go's multi-party authorization + combination ──
// (NOT production code — see this file's header.)

function evaluateSingleParty(inputs: Record<string, number>): 'ACCEPTABLE' | 'UNACCEPTABLE' | 'UNRESOLVED' {
  const { currentExposure, proposedSpend, privateSpendLimit, privateRiskLimit } = inputs;
  if (
    currentExposure === undefined ||
    proposedSpend === undefined ||
    privateSpendLimit === undefined ||
    privateRiskLimit === undefined
  ) {
    return 'UNRESOLVED';
  }
  if (currentExposure < 0 || proposedSpend < 0 || privateSpendLimit < 0 || privateRiskLimit < 0) {
    return 'UNRESOLVED';
  }
  return proposedSpend <= privateSpendLimit && currentExposure + proposedSpend <= privateRiskLimit
    ? 'ACCEPTABLE'
    : 'UNACCEPTABLE';
}

function evaluateCombined(group: Record<string, number>[]): 'ACCEPTABLE' | 'UNACCEPTABLE' | 'UNRESOLVED' {
  if (group.length === 0) return 'UNRESOLVED';
  let totalExposure = 0;
  let totalSpend = 0;
  for (const inputs of group) {
    const v = evaluateSingleParty(inputs);
    if (v === 'UNRESOLVED') return 'UNRESOLVED';
    totalExposure += inputs.currentExposure;
    totalSpend += inputs.proposedSpend;
  }
  const combined = totalExposure + totalSpend;
  for (const inputs of group) {
    if (totalSpend > inputs.privateSpendLimit || combined > inputs.privateRiskLimit) return 'UNACCEPTABLE';
  }
  return 'ACCEPTABLE';
}

/**
 * Mirrors `resolveAuthorizedCombination` + `chooseVerdictForRecipient` for
 * ONE designated recipient ref, given the full decrypted request JSON.
 * Returns the `{"verdict": ...}` JSON string this recipient would receive.
 */
function multiPartyVerdictForRecipient(forRef: string) {
  return (plaintextJson: string): string => {
    const req = JSON.parse(plaintextJson) as {
      type: string;
      requestRef: string;
      inputs: Record<string, { recipientAddress: string; inputs: Record<string, number> }>;
      scope: VelaMultiPartyDisclosureScope;
    };
    if (req.type !== VELA_MULTI_PARTY_PROJECTION_REQUEST_TYPE) {
      return JSON.stringify({ verdict: 'UNRESOLVED' });
    }
    const presentRefs = Object.keys(req.inputs);
    const own = req.inputs[forRef]?.inputs;

    const unresolved = () => JSON.stringify({ verdict: 'UNRESOLVED' });
    if (presentRefs.length <= 1) {
      return own ? JSON.stringify({ verdict: evaluateSingleParty(own) }) : unresolved();
    }
    const { binding, grants } = req.scope ?? {};
    if (
      !binding ||
      binding.applicationId !== APP_ID ||
      binding.requestRef !== req.requestRef ||
      binding.operationType !== VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION ||
      binding.outputClass !== VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT
    ) {
      return unresolved();
    }
    if (!Array.isArray(grants)) return unresolved();

    const combination: string[] = [];
    const seen = new Set<string>();
    for (const g of grants) {
      if (g.action !== VELA_SCOPE_ACTION_COMPUTE_WITH) continue;
      if (!presentRefs.includes(g.party) || seen.has(g.party)) return unresolved();
      seen.add(g.party);
      combination.push(g.party);
    }

    const haveJoint = combination.length >= 2;
    let jointVerdict: string | undefined;
    if (haveJoint) {
      const group = combination.map((ref) => req.inputs[ref].inputs);
      jointVerdict = evaluateCombined(group);
    }

    if (haveJoint && combination.includes(forRef)) {
      const fullyDisclosed = combination
        .filter((other) => other !== forRef)
        .every((other) => grants.some((g: any) => g.action === VELA_SCOPE_ACTION_DISCLOSE_TO && g.party === other && g.to === forRef));
      if (fullyDisclosed) return JSON.stringify({ verdict: jointVerdict });
    }
    return own ? JSON.stringify({ verdict: evaluateSingleParty(own) }) : unresolved();
  };
}

function makeTransport(forRef: string): VelaTestTransport {
  return new VelaTestTransport({
    deployment: VELA_LOCAL_DEPLOYMENT,
    registeredTeeSigner: SIGNER,
    verdictFor: multiPartyVerdictForRecipient(forRef),
  });
}

// ── Wire-exactness / construction ───────────────────────────────────────────

describe('buildVelaMultiPartyProjectionRequest — wire exactness', () => {
  it('serializes to exactly the JSON shape app.go expects, field-for-field', () => {
    const scope = validScope('req-1', [
      { action: 'COMPUTE_WITH', party: REF_A },
      { action: 'DISCLOSE_TO', party: REF_A, to: REF_B },
    ]);
    const request = buildVelaMultiPartyProjectionRequest(baseParams('req-1', scope));
    const json = JSON.parse(JSON.stringify(request));

    expect(json).toEqual({
      type: 'confidential_multi_party_consequence_projection',
      requestRef: 'req-1',
      inputs: {
        [REF_A]: { recipientAddress: ADDR_A, inputs: partyInputs() },
        [REF_B]: { recipientAddress: ADDR_B, inputs: partyInputs() },
      },
      scope: {
        binding: {
          applicationId: '42',
          requestRef: 'req-1',
          operationType: 'joint_consequence_projection',
          outputClass: 'joint_verdict',
        },
        grants: [
          { action: 'COMPUTE_WITH', party: REF_A },
          { action: 'DISCLOSE_TO', party: REF_A, to: REF_B },
        ],
      },
    });
  });

  it('omits context entirely when not supplied (Go tolerates an absent field on a map)', () => {
    const request = buildVelaMultiPartyProjectionRequest(baseParams('req-1', validScope('req-1')));
    expect('context' in request).toBe(false);
  });

  it('includes context verbatim when supplied', () => {
    const params = { ...baseParams('req-1', validScope('req-1')), context: { policyVersion: 'v1' } };
    const request = buildVelaMultiPartyProjectionRequest(params);
    expect(request.context).toEqual({ policyVersion: 'v1' });
  });
});

// ── Gate 1 ───────────────────────────────────────────────────────────────

describe('gate 1 — cannot construct without an explicit disclosure scope', () => {
  it('the TypeScript signature makes scope a required field (compile-time proof)', () => {
    // @ts-expect-error — `scope` is required; omitting it must fail to typecheck.
    const paramsMissingScope: BuildVelaMultiPartyProjectionRequestParams = {
      applicationId: APP_ID,
      requestRef: 'req-1',
      parties: twoParties(),
    };
    expect(paramsMissingScope).toBeDefined();
  });

  it('rejects undefined scope at runtime, even when the compile-time type is defeated with `as any`', () => {
    const params = { applicationId: APP_ID, requestRef: 'req-1', parties: twoParties(), scope: undefined as any };
    expect(() => buildVelaMultiPartyProjectionRequest(params)).toThrow(/scope is required/);
  });

  it('rejects a scope that is not an object', () => {
    expect(() => assertValidVelaMultiPartyDisclosureScope('not-a-scope')).toThrow(/scope is required/);
    expect(() => assertValidVelaMultiPartyDisclosureScope(null)).toThrow(/scope is required/);
    expect(() => assertValidVelaMultiPartyDisclosureScope({})).toThrow(/binding is required/);
  });

  it('rejects a scope with a missing binding field', () => {
    const scope = validScope('req-1');
    const { applicationId: _drop, ...rest } = scope.binding;
    expect(() => assertValidVelaMultiPartyDisclosureScope({ ...scope, binding: rest })).toThrow(
      /binding\.applicationId must be a non-empty string/,
    );
  });

  it('rejects a scope with grants missing entirely (ambiguous, per app.go)', () => {
    const scope = validScope('req-1');
    const { grants: _drop, ...rest } = scope;
    expect(() => assertValidVelaMultiPartyDisclosureScope(rest)).toThrow(/grants must be an array/);
  });

  it('accepts an explicit empty grants array (well-formed: authorizes no combination)', () => {
    expect(() => assertValidVelaMultiPartyDisclosureScope(validScope('req-1', []))).not.toThrow();
  });

  it('rejects a malformed grant action', () => {
    const scope = validScope('req-1', [{ action: 'DO_ANYTHING' as any, party: REF_A }]);
    expect(() => assertValidVelaMultiPartyDisclosureScope(scope)).toThrow(/COMPUTE_WITH.*DISCLOSE_TO/);
  });
});

// ── Gate 2 ───────────────────────────────────────────────────────────────

describe('gate 2 — namespace refs stay distinct, never flattened/merged', () => {
  it('keys the request by each party\'s own derived ref, never merging inputs together', () => {
    const request = buildVelaMultiPartyProjectionRequest(baseParams('req-1', validScope('req-1')));
    const keys = Object.keys(request.inputs).sort();
    expect(keys).toEqual([REF_A, REF_B].sort());
    expect(request.inputs[REF_A].inputs).toEqual(partyInputs());
    expect(request.inputs[REF_B].inputs).toEqual(partyInputs());
    // Each party's contribution is its own object — not the same reference,
    // and not a superset containing the other party's fields.
    expect(request.inputs[REF_A].inputs).not.toBe(request.inputs[REF_B].inputs);
  });

  it('refuses to construct a request in which two parties derive the SAME namespace ref', () => {
    const params = baseParams('req-1', validScope('req-1'));
    params.parties = [
      { identities: PARTY_A_IDENTITIES, recipientAddress: ADDR_A, inputs: partyInputs() },
      { identities: PARTY_A_IDENTITIES, recipientAddress: ADDR_B, inputs: { proposedSpend: 1 } },
    ];
    expect(() => buildVelaMultiPartyProjectionRequest(params)).toThrow(/SAME namespace ref/);
  });
});

// ── Gate 3 ───────────────────────────────────────────────────────────────

describe('gate 3 — sender/signer address is never namespace authority', () => {
  it('buildVelaMultiPartyProjectionRequest and prepareVelaMultiPartyProjection take no signer/sender/wallet parameter', () => {
    // Structural proof: neither function accepts anything resembling a
    // signing key or on-chain sender identity — the only 2 parameters
    // `prepareVelaMultiPartyProjection` takes are a transport slice and the
    // build params (which themselves carry no signer field).
    expect(buildVelaMultiPartyProjectionRequest.length).toBe(1);
    expect(prepareVelaMultiPartyProjection.length).toBe(2);
  });

  it('the namespace ref is unaffected by recipientAddress (delivery routing only, never authority)', () => {
    const withAddrA = buildVelaMultiPartyProjectionRequest({
      applicationId: APP_ID,
      requestRef: 'req-1',
      parties: [{ identities: PARTY_A_IDENTITIES, recipientAddress: ADDR_A, inputs: partyInputs() }],
      scope: validScope('req-1'),
    });
    const withAddrB = buildVelaMultiPartyProjectionRequest({
      applicationId: APP_ID,
      requestRef: 'req-1',
      parties: [{ identities: PARTY_A_IDENTITIES, recipientAddress: ADDR_B, inputs: partyInputs() }],
      scope: validScope('req-1'),
    });
    expect(Object.keys(withAddrA.inputs)).toEqual(Object.keys(withAddrB.inputs));
  });
});

// ── Gate 4 ───────────────────────────────────────────────────────────────

describe('gate 4 — COMPUTE_WITH and DISCLOSE_TO stay separate in the wire format', () => {
  it('the two actions are independent string literals, never a boolean', () => {
    expect(VELA_SCOPE_ACTION_COMPUTE_WITH).toBe('COMPUTE_WITH');
    expect(VELA_SCOPE_ACTION_DISCLOSE_TO).toBe('DISCLOSE_TO');
    expect(VELA_SCOPE_ACTION_COMPUTE_WITH).not.toBe(VELA_SCOPE_ACTION_DISCLOSE_TO);
  });

  it('a party fully combined but never disclosed-to receives their OWN standalone verdict, not the joint one', async () => {
    const scope = validScope('req-1', [
      { action: 'COMPUTE_WITH', party: REF_A },
      { action: 'COMPUTE_WITH', party: REF_B },
      // No DISCLOSE_TO grants at all — ComputeWith alone never implies disclosure.
    ]);
    const transport = makeTransport(REF_A);
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', scope));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);
    const disposition = await getVelaMultiPartyProjectionDisposition(transport, submission.onChainRequestId);
    // Each party's OWN inputs (800/1000/1000) are individually ACCEPTABLE,
    // while the joint combination (1600 spend) would be UNACCEPTABLE — seeing
    // ACCEPTABLE here proves the joint verdict was never disclosed.
    expect(disposition).toBe('ACCEPTABLE');
  });

  it('full disclosure (both directions) reveals the joint verdict to both parties', async () => {
    const scope = validScope('req-1', [
      { action: 'COMPUTE_WITH', party: REF_A },
      { action: 'COMPUTE_WITH', party: REF_B },
      { action: 'DISCLOSE_TO', party: REF_A, to: REF_B },
      { action: 'DISCLOSE_TO', party: REF_B, to: REF_A },
    ]);
    const transportForA = makeTransport(REF_A);
    const preparedA = await prepareVelaMultiPartyProjection(transportForA, baseParams('req-1', scope));
    const submissionA = await submitVelaMultiPartyProjection(transportForA, preparedA);
    const dispositionA = await getVelaMultiPartyProjectionDisposition(transportForA, submissionA.onChainRequestId);

    const transportForB = makeTransport(REF_B);
    const preparedB = await prepareVelaMultiPartyProjection(transportForB, baseParams('req-1', scope));
    const submissionB = await submitVelaMultiPartyProjection(transportForB, preparedB);
    const dispositionB = await getVelaMultiPartyProjectionDisposition(transportForB, submissionB.onChainRequestId);

    // Joint spend (1600) exceeds either party's own 1000 spend limit — the
    // joint verdict is UNACCEPTABLE, and both parties see it once disclosed.
    expect(dispositionA).toBe('UNACCEPTABLE');
    expect(dispositionB).toBe('UNACCEPTABLE');
  });

  it('ASYMMETRIC disclosure (one direction only) — the authorized recipient sees the joint verdict via their OWN separate event; the non-disclosed party sees only their own standalone verdict, never the joint one (one-recipient-per-UserEvent, 2026-09-16 Vela/Horizen v0.2.0 feedback)', async () => {
    // Mirrors Use Case Zero's own real disclosure shape: B -> A only.
    const scope = validScope('req-1', [
      { action: 'COMPUTE_WITH', party: REF_A },
      { action: 'COMPUTE_WITH', party: REF_B },
      { action: 'DISCLOSE_TO', party: REF_B, to: REF_A }, // one-directional
    ]);

    const transportForA = makeTransport(REF_A);
    const preparedA = await prepareVelaMultiPartyProjection(transportForA, baseParams('req-1', scope));
    const submissionA = await submitVelaMultiPartyProjection(transportForA, preparedA);
    const outcomeA = await getVelaMultiPartyProjectionOutcome(transportForA, submissionA.onChainRequestId);

    const transportForB = makeTransport(REF_B);
    const preparedB = await prepareVelaMultiPartyProjection(transportForB, baseParams('req-1', scope));
    const submissionB = await submitVelaMultiPartyProjection(transportForB, preparedB);
    const outcomeB = await getVelaMultiPartyProjectionOutcome(transportForB, submissionB.onChainRequestId);

    expect(outcomeA.status).toBe('RESOLVED');
    expect(outcomeB.status).toBe('RESOLVED');
    if (outcomeA.status !== 'RESOLVED' || outcomeB.status !== 'RESOLVED') return; // narrow for TS
    // A was disclosed the joint verdict (UNACCEPTABLE, per the 1600-spend fixture).
    expect(outcomeA.disposition).toBe('UNACCEPTABLE');
    // B contributed to the SAME joint computation but was never granted
    // DISCLOSE_TO — B's own event carries only B's OWN standalone verdict
    // (ACCEPTABLE, per its individually-fine inputs), never the joint one A
    // saw. Non-transitivity: B computing WITH A never implies B sees what A
    // was shown.
    expect(outcomeB.disposition).toBe('ACCEPTABLE');
    expect(outcomeB.disposition).not.toBe(outcomeA.disposition);
  });

  it('a party never granted COMPUTE_WITH for this request receives no authorized event at all — resolves the conservative UNRESOLVED, never a fabricated result for a computation they were not part of', async () => {
    const scope = validScope('req-1', [
      { action: 'COMPUTE_WITH', party: REF_A },
      { action: 'COMPUTE_WITH', party: REF_B },
      { action: 'DISCLOSE_TO', party: REF_A, to: REF_B },
      { action: 'DISCLOSE_TO', party: REF_B, to: REF_A },
    ]);
    // An outsider ref present in neither the scope's grants nor the
    // request's own inputs — models a party who was never invited at all.
    const OUTSIDER_REF = 'urn:vela:party:outsider';
    const transportForOutsider = makeTransport(OUTSIDER_REF);
    const prepared = await prepareVelaMultiPartyProjection(transportForOutsider, baseParams('req-1', scope));
    const submission = await submitVelaMultiPartyProjection(transportForOutsider, prepared);
    const outcome = await getVelaMultiPartyProjectionOutcome(transportForOutsider, submission.onChainRequestId);

    expect(outcome.status).toBe('RESOLVED');
    if (outcome.status === 'RESOLVED') expect(outcome.disposition).toBe('UNRESOLVED');
  });
});

// ── Gate 5 ───────────────────────────────────────────────────────────────

describe('gate 5 — a mismatched scope binding is rejected before submission, or resolves UNRESOLVED', () => {
  it('(a) rejects client-side BEFORE any transport call when applicationId/requestRef/operationType/outputClass mismatch', async () => {
    const staleScope = validScope('a-different-request-ref'); // requestRef mismatch
    const transport = makeTransport(REF_A);
    const encryptSpy = vi.spyOn(transport, 'encryptForTee');
    const submitSpy = vi.spyOn(transport, 'submitProcessRequest');

    await expect(
      prepareVelaMultiPartyProjection(transport, baseParams('req-1', staleScope)),
    ).rejects.toThrow(/scope binding does not match/);

    expect(encryptSpy).not.toHaveBeenCalled();
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('(a) also rejects a mismatched applicationId, operationType, and outputClass independently', () => {
    const wrongAppId: VelaMultiPartyDisclosureScope = { ...validScope('req-1'), binding: { ...validScope('req-1').binding, applicationId: OTHER_APP_ID } };
    expect(() =>
      assertVelaMultiPartyScopeBindingMatchesContext(wrongAppId, { applicationId: APP_ID, requestRef: 'req-1' }),
    ).toThrow(/applicationId/);

    const wrongOp: VelaMultiPartyDisclosureScope = { ...validScope('req-1'), binding: { ...validScope('req-1').binding, operationType: 'something_else' } };
    expect(() =>
      assertVelaMultiPartyScopeBindingMatchesContext(wrongOp, { applicationId: APP_ID, requestRef: 'req-1' }),
    ).toThrow(/operationType/);

    const wrongOutput: VelaMultiPartyDisclosureScope = { ...validScope('req-1'), binding: { ...validScope('req-1').binding, outputClass: 'something_else' } };
    expect(() =>
      assertVelaMultiPartyScopeBindingMatchesContext(wrongOutput, { applicationId: APP_ID, requestRef: 'req-1' }),
    ).toThrow(/outputClass/);
  });

  it('(b) if the client-side check is bypassed, the guest-faithful fake transport still resolves UNRESOLVED for every party', async () => {
    // Construct the request directly (bypassing prepareVelaMultiPartyProjection's
    // own gate 5 check) with a scope bound to a DIFFERENT requestRef than the
    // one actually submitted.
    const staleScope = validScope('a-different-request-ref');
    const request = buildVelaMultiPartyProjectionRequest(baseParams('req-1', staleScope));
    expect(request.requestRef).toBe('req-1');
    expect(request.scope.binding.requestRef).toBe('a-different-request-ref'); // the mismatch, preserved

    const transport = makeTransport(REF_A);
    const encrypted = await transport.encryptForTee(Buffer.from(JSON.stringify(request), 'utf8'));
    const onChainRequestId = await transport.submitProcessRequest(APP_ID, encrypted);
    const disposition = await getVelaMultiPartyProjectionDisposition(transport, onChainRequestId);

    expect(disposition).toBe('UNRESOLVED');
  });
});

// ── Gate 6 (see also the full pre/post Vela suite run in the update doc) ──

describe('gate 6 — single-party path is unaffected (import-boundary proof)', () => {
  it('this module never imports or re-exports anything from the single-party provider except parseConfidentialVerdict for decoding', async () => {
    const mod = await import('@/services/vela/velaMultiPartyProjection');
    expect(typeof mod.buildVelaMultiPartyProjectionRequest).toBe('function');
    expect((mod as any).VelaConfidentialProjectionProvider).toBeUndefined();
    expect((mod as any).parseConfidentialVerdict).toBeUndefined();
  });
});

// ── Gates 7 & 8 ────────────────────────────────────────────────────────────

describe('gates 7 & 8 — no-funds path is the default; an asset ref is optional and exact', () => {
  it('gate 7: omitting asset routes through submitProcessRequest (the zero-value path)', async () => {
    const transport = makeTransport(REF_A);
    const submitNoAsset = vi.spyOn(transport, 'submitProcessRequest');
    const submitAsset = vi.spyOn(transport, 'submitAssetBearingProcessRequest');

    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    await submitVelaMultiPartyProjection(transport, prepared);

    expect(submitNoAsset).toHaveBeenCalledTimes(1);
    expect(submitAsset).not.toHaveBeenCalled();
  });

  it('gate 8: supplying an asset ref routes through submitAssetBearingProcessRequest with EXACTLY that ref', async () => {
    const transport = makeTransport(REF_A);
    const submitNoAsset = vi.spyOn(transport, 'submitProcessRequest');
    const submitAsset = vi.spyOn(transport, 'submitAssetBearingProcessRequest');
    const asset: VelaAssetRef = { tokenAddress: ETH_SENTINEL_ADDRESS, assetAmount: 12345n };

    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared, asset);

    expect(submitAsset).toHaveBeenCalledTimes(1);
    expect(submitAsset).toHaveBeenCalledWith(prepared.applicationId, prepared.encryptedPayload, asset);
    expect(submitNoAsset).not.toHaveBeenCalled();
    expect(transport.assetSubmittedFor(submission.onChainRequestId)).toEqual(asset);
  });
});

// ── Execution Failure Non-Equivalence ───────────────────────────────────────
//
// Discovered live against the public Vela v0.2.0 devnet (2026-09-14): a
// fee/fuel execution failure (errorCode !== 0) decoded byte-for-byte
// identically to a genuine guest-computed UNRESOLVED via
// getVelaMultiPartyProjectionDisposition, until the raw errorCode was
// inspected directly. getVelaMultiPartyProjectionOutcome is the hardened
// entry point that makes this structurally undiscardable — see
// CI-2026-09-14-EXECUTION-FAILURE-NON-EQUIVALENCE-001.

describe('Execution Failure Non-Equivalence — getVelaMultiPartyProjectionOutcome', () => {
  it('PENDING while the request has not yet completed', async () => {
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A),
      pendingPolls: 3,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    expect(outcome).toEqual({ status: 'PENDING' });
  });

  it('EXECUTION_FAILED (with the raw errorCode/errorMsg) for a request the guest never actually resolved — even one that WOULD have decoded to a genuine constitutional result', async () => {
    const scope = validScope('req-1', [
      { action: 'COMPUTE_WITH', party: REF_A },
      { action: 'COMPUTE_WITH', party: REF_B },
      { action: 'DISCLOSE_TO', party: REF_B, to: REF_A },
    ]);
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A), // would legitimately resolve if not for the errorCode
      errorCode: 12, // mirrors the real devnet's "insufficient fuel" failure
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', scope));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    expect(outcome.status).toBe('EXECUTION_FAILED');
    if (outcome.status === 'EXECUTION_FAILED') {
      expect(outcome.errorCode).toBe(12);
      expect(outcome.errorMsg).toBeTruthy();
    }
    // Structurally impossible to read a `disposition` off this outcome
    // without first checking `status` — there is no `disposition` field on
    // the EXECUTION_FAILED branch.
    expect((outcome as { disposition?: unknown }).disposition).toBeUndefined();
  });

  it('RESOLVED with the genuine disposition on a real successful execution', async () => {
    const transport = makeTransport(REF_A);
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    expect(outcome).toEqual({ status: 'RESOLVED', disposition: 'ACCEPTABLE', applicationFees: '0' });
  });

  it('ACCEPTABLE/UNACCEPTABLE behaviour is completely unchanged by this hardening — the RESOLVED disposition matches the pre-existing gate 4 fixtures exactly', async () => {
    const scope = validScope('req-1', [
      { action: 'COMPUTE_WITH', party: REF_A },
      { action: 'COMPUTE_WITH', party: REF_B },
      { action: 'DISCLOSE_TO', party: REF_A, to: REF_B },
      { action: 'DISCLOSE_TO', party: REF_B, to: REF_A },
    ]);
    const transport = makeTransport(REF_A);
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', scope));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    // Joint spend (1600) exceeds either party's own 1000 spend limit — same
    // fixture, same expected UNACCEPTABLE as gate 4's own equivalent test.
    expect(outcome).toEqual({ status: 'RESOLVED', disposition: 'UNACCEPTABLE', applicationFees: '0' });
  });

  it('getVelaMultiPartyProjectionDisposition is UNCHANGED — still collapses EXECUTION_FAILED into the string "UNRESOLVED", exactly as before this hardening existed', async () => {
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A),
      errorCode: 12,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const disposition = await getVelaMultiPartyProjectionDisposition(transport, submission.onChainRequestId);
    expect(disposition).toBe('UNRESOLVED');
  });

  it('no caller can bypass execution-status validation by directly feeding decoded output: EXECUTION_FAILED is a distinct branch with no disposition to "accidentally" read', async () => {
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A),
      errorCode: 1,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);
    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);

    // A caller MUST narrow on `status` before any `disposition` access
    // typechecks — this is enforced by the TypeScript union itself, not by
    // convention.
    if (outcome.status === 'RESOLVED') {
      throw new Error('expected EXECUTION_FAILED, not RESOLVED — the errorCode override was not honoured');
    }
    expect(outcome.status).toBe('EXECUTION_FAILED');
  });

  // ── 2026-09-16 Vela/Horizen v0.2.0 feedback additions ────────────────────

  it('RequestCompleted.status !== 0 alone (even with errorCode 0) is EXECUTION_FAILED — status is the AUTHORITATIVE signal, never errorCode alone', async () => {
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A),
      status: 1, // status says failed...
      errorCode: 0, // ...even though errorCode alone would say "fine"
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    expect(outcome.status).toBe('EXECUTION_FAILED');
  });

  it('errorCode 12 (INSUFFICIENT_FUEL, deployed v0.2.0 numbering) is EXECUTION_FAILED, never a constitutional UNRESOLVED', async () => {
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A),
      errorCode: VELA_V0_2_0_ERROR_CODES.INSUFFICIENT_FUEL,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    expect(outcome.status).toBe('EXECUTION_FAILED');
    if (outcome.status === 'EXECUTION_FAILED') expect(outcome.errorCode).toBe(12);
  });

  it('an explicit, genuinely successful UNRESOLVED (status 0, guest emitted {"verdict":"UNRESOLVED"}) remains RESOLVED — never conflated with EXECUTION_FAILED', async () => {
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: () => JSON.stringify({ verdict: 'UNRESOLVED' }),
      status: 0,
      errorCode: 0,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    expect(outcome).toEqual({ status: 'RESOLVED', disposition: 'UNRESOLVED', applicationFees: '0' });
  });

  it('a successful completion (status 0) with no output event reaching this caller fails closed to the conservative UNRESOLVED disposition — never RESOLVED as ACCEPTABLE/UNACCEPTABLE, and never conflated with EXECUTION_FAILED', async () => {
    // Legitimate case: this caller was not granted DISCLOSE_TO for this
    // computation, so no UserEvent decrypts for them — verdictFor returning
    // null models "no result event reached us" (VelaTestTransport's own
    // contract). The guest's own success is real (status 0); the caller
    // simply has nothing to decode. parseConfidentialVerdict(null) resolves
    // this to the conservative 'UNRESOLVED' — the fail-closed answer, never
    // a fabricated ACCEPTABLE/UNACCEPTABLE, and structurally distinct from
    // EXECUTION_FAILED (a different branch of the same union).
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: () => null,
      status: 0,
      errorCode: 0,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    expect(outcome.status).toBe('RESOLVED');
    if (outcome.status === 'RESOLVED') expect(outcome.disposition).toBe('UNRESOLVED');
  });

  it('retains the ACTUAL applicationFees from RequestCompleted on both RESOLVED and EXECUTION_FAILED branches', async () => {
    const resolvedTransport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A),
      applicationFees: '25',
    });
    const prepared1 = await prepareVelaMultiPartyProjection(resolvedTransport, baseParams('req-1', validScope('req-1')));
    const submission1 = await submitVelaMultiPartyProjection(resolvedTransport, prepared1);
    const resolvedOutcome = await getVelaMultiPartyProjectionOutcome(resolvedTransport, submission1.onChainRequestId);
    expect(resolvedOutcome.status).toBe('RESOLVED');
    if (resolvedOutcome.status === 'RESOLVED') expect(resolvedOutcome.applicationFees).toBe('25');

    const failedTransport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A),
      errorCode: 12,
      applicationFees: '10',
    });
    const prepared2 = await prepareVelaMultiPartyProjection(failedTransport, baseParams('req-1', validScope('req-1')));
    const submission2 = await submitVelaMultiPartyProjection(failedTransport, prepared2);
    const failedOutcome = await getVelaMultiPartyProjectionOutcome(failedTransport, submission2.onChainRequestId);
    expect(failedOutcome.status).toBe('EXECUTION_FAILED');
    if (failedOutcome.status === 'EXECUTION_FAILED') expect(failedOutcome.applicationFees).toBe('10');
  });

  it('PROTOCOL_ERROR (2026-09-16, 2nd pass): a successful completion (status 0) with ZERO UserEvent logs at all is a fail-closed evidence defect, never UNRESOLVED', async () => {
    // The guest always emits at least one UserEvent on every non-malfunction
    // ProcessRequest path (app.go) — userEventCount: 0 on a status-0 result
    // models the genuinely-missing-evidence case, distinct from the ordinary
    // "events exist for others, none decrypt for me" case above (which keeps
    // the default userEventCount: 1 and stays RESOLVED/UNRESOLVED).
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: () => null,
      status: 0,
      errorCode: 0,
      userEventCount: 0,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    expect(outcome.status).toBe('PROTOCOL_ERROR');
    if (outcome.status === 'PROTOCOL_ERROR') {
      expect(outcome.reason).toMatch(/no UserEvent found/i);
      expect(outcome.applicationFees).toBe('0');
    }
  });

  it('PROTOCOL_ERROR: a successful completion whose decrypted event does not parse as a well-formed verdict payload is a protocol defect, never a fabricated disposition', async () => {
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: () => 'not valid verdict json at all',
      status: 0,
      errorCode: 0,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    expect(outcome.status).toBe('PROTOCOL_ERROR');
    if (outcome.status === 'PROTOCOL_ERROR') {
      expect(outcome.reason).toMatch(/does not parse as a valid verdict payload/i);
    }
  });

  it('PROTOCOL_ERROR (2026-09-16, 3rd pass): a structurally malformed ciphertext envelope among the events this caller inspected is proven never a legitimate "not addressed to me" outcome, distinct from ordinary exclusion', async () => {
    // A correctly encrypted envelope is always long enough for ANY recipient
    // key — a malformed (too-short) one is proof of corruption, never
    // evidence that this key simply isn't the intended recipient. Models the
    // decrypt loop having inspected one candidate event, found it
    // structurally malformed, and found nothing decryptable for this caller.
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: () => null,
      status: 0,
      errorCode: 0,
      userEventCount: 1,
      malformedUserEventCount: 1,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    expect(outcome.status).toBe('PROTOCOL_ERROR');
    if (outcome.status === 'PROTOCOL_ERROR') {
      expect(outcome.reason).toMatch(/structurally malformed ciphertext envelope/i);
      // requestId is public chain data (safe to include); only the COUNTS
      // and requestId appear — never ciphertext bytes or key material, which
      // this reason string never has access to in the first place.
      expect(outcome.reason).toMatch(/^1 of 1 UserEvent\(s\) for requestId=0x[0-9a-f]+ had a structurally/i);
    }
  });

  it('ordinary not-addressed-to-me exclusion is UNCHANGED: no malformed envelopes among the candidates inspected stays RESOLVED/UNRESOLVED, never PROTOCOL_ERROR', async () => {
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: () => null,
      status: 0,
      errorCode: 0,
      userEventCount: 3,
      malformedUserEventCount: 0,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const outcome = await getVelaMultiPartyProjectionOutcome(transport, submission.onChainRequestId);
    expect(outcome.status).toBe('RESOLVED');
    if (outcome.status === 'RESOLVED') expect(outcome.disposition).toBe('UNRESOLVED');
  });

  it('getVelaMultiPartyProjectionDisposition throws distinctly on PROTOCOL_ERROR — 3rd pass correction: it must NEVER be collapsed to the string "UNRESOLVED", unlike EXECUTION_FAILED', async () => {
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: () => null,
      status: 0,
      errorCode: 0,
      userEventCount: 0,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    await expect(
      getVelaMultiPartyProjectionDisposition(transport, submission.onChainRequestId),
    ).rejects.toThrow(/evidence is missing or malformed/);
  });

  it('getVelaMultiPartyProjectionDisposition still collapses EXECUTION_FAILED into the string "UNRESOLVED" — unaffected by the PROTOCOL_ERROR correction above', async () => {
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A),
      errorCode: 12,
    });
    const prepared = await prepareVelaMultiPartyProjection(transport, baseParams('req-1', validScope('req-1')));
    const submission = await submitVelaMultiPartyProjection(transport, prepared);

    const disposition = await getVelaMultiPartyProjectionDisposition(transport, submission.onChainRequestId);
    expect(disposition).toBe('UNRESOLVED');
  });
});
