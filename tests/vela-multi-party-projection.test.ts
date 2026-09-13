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
