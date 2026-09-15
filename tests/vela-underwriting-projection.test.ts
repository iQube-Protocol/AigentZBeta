/**
 * services/vela/velaUnderwritingProjection.ts — Use Case Zero's first
 * underwriting vertical slice (2026-09-13). Proves the eight NEW
 * operator-mandated acceptance gates for this item, one describe block per
 * gate, through the REAL substrate (`velaMultiPartyProjection.ts`) and the
 * REAL `VelaTestTransport` — never a second, parallel simulator.
 *
 * `multiPartyVerdictForRecipient` below is the SAME test-only, minimal JS
 * mirror of `app.go`'s authorization/combination logic that
 * `tests/vela-multi-party-projection.test.ts` uses (duplicated here rather
 * than extracted to a shared fixture, matching that file's own choice not to
 * export it — it is not production code and does not replace or duplicate
 * anything in `services/vela/velaUnderwritingProjection.ts` itself, which
 * contains no combination logic of its own).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const createActivityReceiptMock = vi.fn(async (input: any) => ({ id: 'receipt-stub', ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceiptMock(...args),
}));

const recordVelaUnderwritingRiskTelemetryMock = vi.fn(async (_input: any) => ({ id: 'telemetry-stub' }));
vi.mock('@/services/vela/velaUnderwritingRiskTelemetry', () => ({
  recordVelaUnderwritingRiskTelemetry: (...args: any[]) => recordVelaUnderwritingRiskTelemetryMock(...args),
}));

import {
  runVelaUnderwritingProjection,
  type RunVelaUnderwritingProjectionParams,
} from '@/services/vela/velaUnderwritingProjection';
import {
  VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
  VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
  VELA_SCOPE_ACTION_COMPUTE_WITH,
  VELA_SCOPE_ACTION_DISCLOSE_TO,
  type BuildVelaMultiPartyProjectionRequestParams,
  type VelaMultiPartyDisclosureScope,
  type VelaMultiPartyPartyInput,
} from '@/services/vela/velaMultiPartyProjection';
import { deriveVelaPartyNamespaceRef } from '@/services/vela/velaPartyNamespace';
import { VelaTestTransport } from '@/services/vela/velaTestTransport';
import { VELA_LOCAL_DEPLOYMENT } from '@/services/vela/velaConfig';
import { ETH_SENTINEL_ADDRESS, type VelaAssetRef } from '@/services/vela/velaTypes';
import type { UnderwritingProvider, UnderwritingQuote } from '@/services/financialServices/providers/underwriting/underwritingProviderTypes';
import { SimulatedUnderwritingProvider } from '@/services/financialServices/providers/underwriting/simulatedUnderwritingProvider';

const APP_ID = '42';
const SIGNER = '0x2a0fba02cee7fb70899648037c7E8203881e2D55';

const PARTY_A_IDENTITIES = { authorityPrincipal: 'principal-a', confidentialPrivacyIdentity: 'privacy-a' };
const PARTY_B_IDENTITIES = { authorityPrincipal: 'principal-b', confidentialPrivacyIdentity: 'privacy-b' };
const ADDR_A = '0x1111111111111111111111111111111111111111';
const ADDR_B = '0x2222222222222222222222222222222222222222';

const REF_A = deriveVelaPartyNamespaceRef(APP_ID, PARTY_A_IDENTITIES);
const REF_B = deriveVelaPartyNamespaceRef(APP_ID, PARTY_B_IDENTITIES);

/** Own-standalone ACCEPTABLE, joint-combined UNACCEPTABLE — same fixture the
 *  substrate's own gate 4 test uses, reused here for the identical reason. */
function partyInputs(): Record<string, number> {
  return { currentExposure: 0, proposedSpend: 800, privateSpendLimit: 1000, privateRiskLimit: 1000 };
}

function twoParties(): VelaMultiPartyPartyInput[] {
  return [
    { identities: PARTY_A_IDENTITIES, recipientAddress: ADDR_A, inputs: partyInputs() },
    { identities: PARTY_B_IDENTITIES, recipientAddress: ADDR_B, inputs: partyInputs() },
  ];
}

function scope(requestRef: string, grants: VelaMultiPartyDisclosureScope['grants']): VelaMultiPartyDisclosureScope {
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

function buildParams(requestRef: string, grants: VelaMultiPartyDisclosureScope['grants']): BuildVelaMultiPartyProjectionRequestParams {
  return { applicationId: APP_ID, requestRef, parties: twoParties(), scope: scope(requestRef, grants) };
}

// ── Test-only mirror of app.go's multi-party authorization + combination
// (duplicated from tests/vela-multi-party-projection.test.ts — NOT production
// code; see this file's header). ────────────────────────────────────────────

function evaluateSingleParty(inputs: Record<string, number>): 'ACCEPTABLE' | 'UNACCEPTABLE' | 'UNRESOLVED' {
  const { currentExposure, proposedSpend, privateSpendLimit, privateRiskLimit } = inputs;
  if ([currentExposure, proposedSpend, privateSpendLimit, privateRiskLimit].some((v) => v === undefined || v < 0)) {
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
    if (evaluateSingleParty(inputs) === 'UNRESOLVED') return 'UNRESOLVED';
    totalExposure += inputs.currentExposure;
    totalSpend += inputs.proposedSpend;
  }
  const combined = totalExposure + totalSpend;
  for (const inputs of group) {
    if (totalSpend > inputs.privateSpendLimit || combined > inputs.privateRiskLimit) return 'UNACCEPTABLE';
  }
  return 'ACCEPTABLE';
}

function multiPartyVerdictForRecipient(forRef: string) {
  return (plaintextJson: string): string => {
    const req = JSON.parse(plaintextJson) as {
      type: string;
      requestRef: string;
      inputs: Record<string, { recipientAddress: string; inputs: Record<string, number> }>;
      scope: VelaMultiPartyDisclosureScope;
    };
    const presentRefs = Object.keys(req.inputs);
    const own = req.inputs[forRef]?.inputs;
    const unresolved = () => JSON.stringify({ verdict: 'UNRESOLVED' });
    if (presentRefs.length <= 1) return own ? JSON.stringify({ verdict: evaluateSingleParty(own) }) : unresolved();

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
      // A grant naming a party ref that is not actually present in this
      // request's `inputs` (a "mismatching COMPUTE_WITH grant") is exactly
      // the ambiguous case app.go's own resolveAuthorizedCombination refuses
      // to combine — resolves UNRESOLVED, never a partial/best-effort combine.
      if (!presentRefs.includes(g.party) || seen.has(g.party)) return unresolved();
      seen.add(g.party);
      combination.push(g.party);
    }

    const haveJoint = combination.length >= 2;
    let jointVerdict: string | undefined;
    if (haveJoint) jointVerdict = evaluateCombined(combination.map((ref) => req.inputs[ref].inputs));

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
  return new VelaTestTransport({ deployment: VELA_LOCAL_DEPLOYMENT, registeredTeeSigner: SIGNER, verdictFor: multiPartyVerdictForRecipient(forRef) });
}

function baseCallParams(overrides: Partial<RunVelaUnderwritingProjectionParams> = {}): RunVelaUnderwritingProjectionParams {
  return {
    build: buildParams('req-1', []),
    transport: makeTransport(REF_A),
    actorPersonaId: 'persona-operator-1',
    requestedByAgentRef: 'aigent-factor',
    ...overrides,
  };
}

beforeEach(() => {
  createActivityReceiptMock.mockClear();
  recordVelaUnderwritingRiskTelemetryMock.mockClear();
  recordVelaUnderwritingRiskTelemetryMock.mockImplementation(async () => ({ id: 'telemetry-stub' }));
});

// ── Gate 1 ───────────────────────────────────────────────────────────────

describe('gate 1 — risk inputs remain private and separately namespaced', () => {
  it('the underwriting provider is called with ONLY the resolved disposition, never the raw parties/inputs', async () => {
    const seenArgs: unknown[][] = [];
    const spyProvider: UnderwritingProvider = {
      mode: 'SIMULATED',
      policyVersion: 'test-provider-v1',
      async quoteForVerdict(...args: any[]) {
        seenArgs.push(args);
        return new SimulatedUnderwritingProvider().quoteForVerdict(args[0]);
      },
    };
    const transport = makeTransport(REF_A);
    await runVelaUnderwritingProjection(
      baseCallParams({ build: buildParams('req-1', []), transport, underwritingProvider: spyProvider }),
    );
    expect(seenArgs).toHaveLength(1);
    expect(seenArgs[0]).toHaveLength(1); // exactly one argument
    expect(typeof seenArgs[0][0]).toBe('string'); // the bare verdict string, never an object
    expect(['ACCEPTABLE', 'UNACCEPTABLE', 'UNRESOLVED']).toContain(seenArgs[0][0]);
  });
});

// ── Gate 2 ───────────────────────────────────────────────────────────────

describe('gate 2 — joint computation happens only under explicit, well-formed COMPUTE_WITH scope', () => {
  it('(a) no COMPUTE_WITH grants at all -> each party receives their OWN standalone verdict, never a joint one', async () => {
    const result = await runVelaUnderwritingProjection(baseCallParams({ build: buildParams('req-1', []) }));
    // Standalone inputs (800/1000/1000) are individually ACCEPTABLE while the
    // joint combination (1600 spend) would be UNACCEPTABLE — seeing ACCEPTABLE
    // proves no unauthorized combination occurred.
    expect(result.disposition).toBe('ACCEPTABLE');
    expect(result.quote.coverageEligible).toBe(true);
  });

  it('(b) a COMPUTE_WITH grant naming a party ref NOT present in this request -> UNRESOLVED, never a computed accept/reject quote', async () => {
    const mismatchedGrants: VelaMultiPartyDisclosureScope['grants'] = [
      { action: 'COMPUTE_WITH', party: 'namespace-ref-that-does-not-exist-in-this-request' },
      { action: 'COMPUTE_WITH', party: REF_B },
    ];
    const result = await runVelaUnderwritingProjection(baseCallParams({ build: buildParams('req-1', mismatchedGrants) }));
    expect(result.disposition).toBe('UNRESOLVED');
    expect(result.quote.coverageEligible).toBe(false);
    expect(result.quote.confidence).toBe(0);
    expect(result.quote.riskBand).toBe('UNKNOWN');
  });

  it('(c) a scope bound to a DIFFERENT requestRef than the one actually submitted is rejected BEFORE any transport call', async () => {
    const transport = makeTransport(REF_A);
    const encryptSpy = vi.spyOn(transport, 'encryptForTee');
    const submitSpy = vi.spyOn(transport, 'submitProcessRequest');
    const staleBuild: BuildVelaMultiPartyProjectionRequestParams = {
      applicationId: APP_ID,
      requestRef: 'req-1',
      parties: twoParties(),
      scope: scope('a-different-request-ref', []),
    };
    await expect(runVelaUnderwritingProjection(baseCallParams({ build: staleBuild, transport }))).rejects.toThrow(
      /scope binding does not match/,
    );
    expect(encryptSpy).not.toHaveBeenCalled();
    expect(submitSpy).not.toHaveBeenCalled();
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
  });
});

// ── Gate 3 ───────────────────────────────────────────────────────────────

describe('gate 3 — outputs disclose only the minimum authorized result (disclosure asymmetry)', () => {
  it('a party granted DISCLOSE_TO receives the joint verdict; a party NOT granted it receives only their OWN standalone verdict', async () => {
    // A discloses to B; B does NOT disclose to A — deliberately asymmetric.
    const grants: VelaMultiPartyDisclosureScope['grants'] = [
      { action: 'COMPUTE_WITH', party: REF_A },
      { action: 'COMPUTE_WITH', party: REF_B },
      { action: 'DISCLOSE_TO', party: REF_A, to: REF_B },
    ];
    const build = buildParams('req-1', grants);

    const resultForA = await runVelaUnderwritingProjection(baseCallParams({ build, transport: makeTransport(REF_A) }));
    const resultForB = await runVelaUnderwritingProjection(baseCallParams({ build, transport: makeTransport(REF_B) }));

    // A never received B's disclosure back -> A sees only A's own standalone
    // verdict (ACCEPTABLE), never the joint UNACCEPTABLE one.
    expect(resultForA.disposition).toBe('ACCEPTABLE');
    expect(resultForA.quote.riskBand).toBe('LOW');
    expect(resultForA.quote.coverageEligible).toBe(true);

    // B WAS granted disclosure from A -> B sees the joint verdict.
    expect(resultForB.disposition).toBe('UNACCEPTABLE');
    expect(resultForB.quote.riskBand).toBe('HIGH');
    expect(resultForB.quote.coverageEligible).toBe(false);
  });
});

// ── Gate 4 ───────────────────────────────────────────────────────────────

describe('gate 4 — premium/coverage output is clearly, structurally marked SIMULATED', () => {
  it('every quote this orchestration produces (default provider) carries providerMode "SIMULATED"', async () => {
    const result = await runVelaUnderwritingProjection(baseCallParams());
    expect(result.quote.providerMode).toBe('SIMULATED');
  });

  it('the receipt itself binds providerMode explicitly, not merely nested inside the quote', async () => {
    await runVelaUnderwritingProjection(baseCallParams());
    const call = createActivityReceiptMock.mock.calls[0][0];
    expect(call.actionInput.providerMode).toBe('SIMULATED');
    expect(call.actionInput.quote.providerMode).toBe('SIMULATED');
  });
});

// ── Gates 5 & 7 ────────────────────────────────────────────────────────────

describe('gates 5 & 7 — simulated coverage never automatically creates a real financial obligation', () => {
  it('omitting asset routes through the no-funds path regardless of the resulting quote\'s non-zero premium', async () => {
    const transport = makeTransport(REF_A);
    const submitNoAsset = vi.spyOn(transport, 'submitProcessRequest');
    const submitAsset = vi.spyOn(transport, 'submitAssetBearingProcessRequest');

    // ACCEPTABLE fixture -> quote.premium > 0 (proven in the provider suite) —
    // still never routed through the asset-bearing path without an EXPLICIT
    // caller-supplied asset.
    const result = await runVelaUnderwritingProjection(baseCallParams({ build: buildParams('req-1', []), transport }));

    expect(result.quote.premium).toBeGreaterThan(0);
    expect(submitNoAsset).toHaveBeenCalledTimes(1);
    expect(submitAsset).not.toHaveBeenCalled();
  });

  it('supplying an explicit VelaAssetRef routes through the asset-bearing path with EXACTLY that ref', async () => {
    const transport = makeTransport(REF_A);
    const submitNoAsset = vi.spyOn(transport, 'submitProcessRequest');
    const submitAsset = vi.spyOn(transport, 'submitAssetBearingProcessRequest');
    const asset: VelaAssetRef = { tokenAddress: ETH_SENTINEL_ADDRESS, assetAmount: 999n };

    const result = await runVelaUnderwritingProjection(baseCallParams({ build: buildParams('req-1', []), transport, asset }));

    expect(submitAsset).toHaveBeenCalledTimes(1);
    expect(submitAsset.mock.calls[0][2]).toEqual(asset);
    expect(submitNoAsset).not.toHaveBeenCalled();
    expect(transport.assetSubmittedFor(result.onChainRequestId)).toEqual(asset);
  });

  it('"carries value" means a caller-supplied asset ref only — a zero/negative amount is refused before ever reaching this function\'s submission step (validateVelaAssetRef, velaTypes.ts), so no separate zero-amount check is needed here', async () => {
    const transport = makeTransport(REF_A);
    const zeroAsset: VelaAssetRef = { tokenAddress: ETH_SENTINEL_ADDRESS, assetAmount: 0n };
    await expect(
      runVelaUnderwritingProjection(baseCallParams({ build: buildParams('req-1', []), transport, asset: zeroAsset })),
    ).rejects.toThrow(/must be > 0/);
  });
});

// ── Gate 6 ───────────────────────────────────────────────────────────────

describe('gate 6 — the causal receipt binds request, parties, scope, risk calculation, result, app identity, Vela execution evidence, and simulated/live status', () => {
  it('every one of the eight elements is present as its own named field', async () => {
    const grants: VelaMultiPartyDisclosureScope['grants'] = [
      { action: 'COMPUTE_WITH', party: REF_A },
      { action: 'COMPUTE_WITH', party: REF_B },
      { action: 'DISCLOSE_TO', party: REF_A, to: REF_B },
      { action: 'DISCLOSE_TO', party: REF_B, to: REF_A },
    ];
    const build = buildParams('req-1', grants);
    const result = await runVelaUnderwritingProjection(baseCallParams({ build, transport: makeTransport(REF_A), requestingPartyNamespaceRef: REF_A }));

    expect(createActivityReceiptMock).toHaveBeenCalledTimes(1);
    const call = createActivityReceiptMock.mock.calls[0][0];
    expect(call.personaId).toBe('persona-operator-1');
    expect(call.actionType).toBe('vela_underwriting_projection_completed');
    expect(call.agentsInvoked).toEqual(['aigent-factor']);

    const ai = call.actionInput;
    // 1. Request.
    expect(ai.requestRef).toBe('req-1');
    expect(ai.onChainRequestId).toBe(result.onChainRequestId);
    // 2. App identity.
    expect(ai.applicationId).toBe(APP_ID);
    // 3. Parties — namespace refs only.
    expect(ai.partyNamespaceRefs.sort()).toEqual([REF_A, REF_B].sort());
    expect(ai.requestingPartyNamespaceRef).toBe(REF_A);
    // 4. Scope actually used.
    expect(ai.scopeBinding).toEqual(build.scope.binding);
    expect(ai.scopeGrants).toEqual(grants);
    // 5. Risk calculation result.
    expect(ai.disposition).toBe(result.disposition);
    // 6. Vela execution evidence available at this layer.
    expect(typeof ai.payloadCommitment).toBe('string');
    expect(ai.payloadCommitment).toHaveLength(64); // sha256 hex
    expect(ai.attestationMode).toBe('NO_ATTESTATION_LOCAL');
    // 7. Underwriting quote's own fields, in full.
    expect(ai.quote).toEqual(result.quote);
    // 8. Simulated/live status, explicit.
    expect(ai.providerMode).toBe('SIMULATED');
  });

  it('9. binds the AUTHORITATIVE on-chain completion evidence — applicationFees and the matching StateRootUpdate roots (2026-09-16 Vela/Horizen v0.2.0 feedback)', async () => {
    const build = buildParams('req-1', []);
    const transport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A),
      applicationFees: '25',
    });
    await runVelaUnderwritingProjection(baseCallParams({ build, transport }));

    const ai = createActivityReceiptMock.mock.calls[0][0].actionInput;
    // The ACTUAL fee charged, from RequestCompleted — never inferred/guessed.
    expect(ai.applicationFees).toBe('25');
    // The matching StateRootUpdate: newStateRoot (stateRootHex) and the
    // PRIOR root it replaced (prevStateRootHex) — both present, both
    // well-formed hex, and (by construction of the deterministic test
    // double) genuinely distinct values, never a placeholder/blank pair.
    expect(typeof ai.stateRootHex).toBe('string');
    expect(ai.stateRootHex.length).toBeGreaterThan(0);
    expect(typeof ai.prevStateRootHex).toBe('string');
    expect(ai.prevStateRootHex.length).toBeGreaterThan(0);
    expect(ai.prevStateRootHex).not.toBe(ai.stateRootHex);
    expect(typeof ai.stateUpdateTxHash).toBe('string');
    expect(ai.stateUpdateTxHash.length).toBeGreaterThan(0);
  });

  it('never leaks a party\'s raw financial inputs, recipientAddress, or any T0 identifier into the receipt', async () => {
    const build = buildParams('req-1', []);
    await runVelaUnderwritingProjection(baseCallParams({ build, transport: makeTransport(REF_A) }));
    const serialized = JSON.stringify(createActivityReceiptMock.mock.calls[0][0]);

    // Raw financial figures from partyInputs() must never appear as a
    // top-level numeric field of the receipt's own data (the sha256 hex
    // commitment can coincidentally contain these digit substrings, so this
    // checks the STRUCTURED fields, not a blind substring search).
    const ai = createActivityReceiptMock.mock.calls[0][0].actionInput;
    expect(ai).not.toHaveProperty('inputs');
    expect(ai).not.toHaveProperty('parties');
    expect(ai).not.toHaveProperty('recipientAddress');
    expect(JSON.stringify(ai.partyNamespaceRefs)).not.toContain(ADDR_A);
    expect(JSON.stringify(ai.partyNamespaceRefs)).not.toContain(ADDR_B);
    // Never the T0 authority-principal identity strings the namespace refs
    // were derived FROM (the refs are one-way commitments — this asserts the
    // raw source strings, not just their hashes, never separately ride
    // along).
    expect(serialized).not.toContain('principal-a');
    expect(serialized).not.toContain('principal-b');
    expect(serialized).not.toContain('privacy-a');
    expect(serialized).not.toContain('privacy-b');
    expect(serialized).not.toContain(ADDR_A);
    expect(serialized).not.toContain(ADDR_B);
  });
});

// ── Gate 8 (composition/import-boundary proof; full-suite diff in the update doc) ──

describe('gate 8 — composes the existing substrate without forking it', () => {
  it('imports the multi-party wire functions verbatim and adds no method to that module', async () => {
    const substrate = await import('@/services/vela/velaMultiPartyProjection');
    expect(typeof substrate.buildVelaMultiPartyProjectionRequest).toBe('function');
    expect(typeof substrate.prepareVelaMultiPartyProjection).toBe('function');
    expect(typeof substrate.submitVelaMultiPartyProjection).toBe('function');
    expect(typeof substrate.getVelaMultiPartyProjectionDisposition).toBe('function');
    // No underwriting-shaped export leaked backward into the substrate module.
    expect((substrate as any).runVelaUnderwritingProjection).toBeUndefined();
    expect((substrate as any).createUnderwritingProvider).toBeUndefined();
  });
});

// ── Risk telemetry hook (item 6) ──────────────────────────────────────────

describe('risk telemetry hook (item 6)', () => {
  it('the result carries telemetryRecordId from the telemetry call\'s resolved id', async () => {
    recordVelaUnderwritingRiskTelemetryMock.mockResolvedValueOnce({ id: 'golden-cycle-row-1' });
    const result = await runVelaUnderwritingProjection(baseCallParams());
    expect(result.telemetryRecordId).toBe('golden-cycle-row-1');
  });

  it('the result carries telemetryRecordId null when the telemetry call resolves null (write unavailable/failed)', async () => {
    recordVelaUnderwritingRiskTelemetryMock.mockResolvedValueOnce(null);
    const result = await runVelaUnderwritingProjection(baseCallParams());
    expect(result.telemetryRecordId).toBeNull();
  });

  it('the telemetry function is called with the SAME disposition/quote/applicationId/partyNamespaceRefs/onChainRequestId this run actually produced', async () => {
    const build = buildParams('req-1', []);
    const result = await runVelaUnderwritingProjection(baseCallParams({ build, transport: makeTransport(REF_A) }));

    expect(recordVelaUnderwritingRiskTelemetryMock).toHaveBeenCalledTimes(1);
    const call = recordVelaUnderwritingRiskTelemetryMock.mock.calls[0][0];
    expect(call.onChainRequestId).toBe(result.onChainRequestId);
    expect(call.disposition).toBe(result.disposition);
    expect(call.quote).toEqual(result.quote);
    expect(call.applicationId).toBe(APP_ID);
    expect(call.partyNamespaceRefs.sort()).toEqual([REF_A, REF_B].sort());
    expect(call.receiptId).toBe(result.receiptId);
    expect(call.policyVersion).toBe('vela-use-case-zero-underwriting-simulated-v1');
  });

  it('settlementOccurred is false when no asset is supplied and true when one is', async () => {
    const noAssetBuild = buildParams('req-1', []);
    await runVelaUnderwritingProjection(baseCallParams({ build: noAssetBuild, transport: makeTransport(REF_A) }));
    expect(recordVelaUnderwritingRiskTelemetryMock.mock.calls[0][0].settlementOccurred).toBe(false);

    recordVelaUnderwritingRiskTelemetryMock.mockClear();
    const asset: VelaAssetRef = { tokenAddress: ETH_SENTINEL_ADDRESS, assetAmount: 999n };
    const assetBuild = buildParams('req-1', []);
    await runVelaUnderwritingProjection(
      baseCallParams({ build: assetBuild, transport: makeTransport(REF_A), asset }),
    );
    expect(recordVelaUnderwritingRiskTelemetryMock.mock.calls[0][0].settlementOccurred).toBe(true);
  });

  it('timeToCompletionMs passed to the telemetry call is a number >= 0', async () => {
    await runVelaUnderwritingProjection(baseCallParams());
    const call = recordVelaUnderwritingRiskTelemetryMock.mock.calls[0][0];
    expect(typeof call.timeToCompletionMs).toBe('number');
    expect(call.timeToCompletionMs).toBeGreaterThanOrEqual(0);
  });

  it('a telemetry failure (mock resolves null) never regresses the run\'s own disposition/quote/receiptId', async () => {
    recordVelaUnderwritingRiskTelemetryMock.mockImplementation(async () => ({ id: 'telemetry-stub' }));
    const passingResult = await runVelaUnderwritingProjection(baseCallParams());

    recordVelaUnderwritingRiskTelemetryMock.mockImplementation(async () => null);
    const resultWithFailedTelemetry = await runVelaUnderwritingProjection(baseCallParams());

    expect(resultWithFailedTelemetry.disposition).toBe(passingResult.disposition);
    expect(resultWithFailedTelemetry.quote).toEqual(passingResult.quote);
    // receiptId comes from the (unrelated, still-passing) receipt mock in
    // both runs — proving the telemetry outcome is fully independent of it.
    expect(typeof resultWithFailedTelemetry.receiptId).toBe(typeof passingResult.receiptId);
    expect(resultWithFailedTelemetry.telemetryRecordId).toBeNull();
  });
});

// ── Execution Failure Non-Equivalence ───────────────────────────────────────
//
// Discovered live against the public Vela v0.2.0 devnet (2026-09-14): before
// this hardening, an execution/fee failure would have decoded to
// disposition 'UNRESOLVED' via the (now-legacy-only)
// getVelaMultiPartyProjectionDisposition and been fed straight into a quote
// and a persisted receipt as if the guest had genuinely computed it. See
// CI-2026-09-14-EXECUTION-FAILURE-NON-EQUIVALENCE-001.

describe('Execution Failure Non-Equivalence — a Vela execution failure is never persisted as a constitutional determination', () => {
  it('throws distinctly (naming the raw errorCode) instead of returning disposition UNRESOLVED', async () => {
    const failingTransport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A),
      errorCode: 12, // mirrors the real devnet's "insufficient fuel" failure
    });

    await expect(
      runVelaUnderwritingProjection(baseCallParams({ transport: failingTransport })),
    ).rejects.toThrow(/errorCode 12/);
  });

  it('never calls the underwriting provider, never creates a receipt, never records telemetry on execution failure', async () => {
    const failingTransport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: multiPartyVerdictForRecipient(REF_A),
      errorCode: 7,
    });
    const spyProvider: UnderwritingProvider = {
      mode: 'SIMULATED',
      policyVersion: 'test-provider-v1',
      quoteForVerdict: vi.fn(async (v: any) => new SimulatedUnderwritingProvider().quoteForVerdict(v)),
    };

    await expect(
      runVelaUnderwritingProjection(
        baseCallParams({ transport: failingTransport, underwritingProvider: spyProvider }),
      ),
    ).rejects.toThrow();

    expect(spyProvider.quoteForVerdict).not.toHaveBeenCalled();
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(recordVelaUnderwritingRiskTelemetryMock).not.toHaveBeenCalled();
  });

  it('a genuine ACCEPTABLE/UNACCEPTABLE/UNRESOLVED run (errorCode 0) is completely unaffected by this hardening', async () => {
    const result = await runVelaUnderwritingProjection(baseCallParams({ build: buildParams('req-1', []) }));
    expect(result.disposition).toBe('ACCEPTABLE');
    expect(createActivityReceiptMock).toHaveBeenCalledTimes(1);
    expect(recordVelaUnderwritingRiskTelemetryMock).toHaveBeenCalledTimes(1);
  });

  it('PROTOCOL_ERROR (2026-09-16, 2nd pass): a successful completion with zero UserEvent logs at all throws distinctly, never quotes/receipts/telemetry-records an UNRESOLVED that was never actually computed', async () => {
    const protocolErrorTransport = new VelaTestTransport({
      deployment: VELA_LOCAL_DEPLOYMENT,
      registeredTeeSigner: SIGNER,
      verdictFor: () => null,
      status: 0,
      errorCode: 0,
      userEventCount: 0,
    });
    const spyProvider: UnderwritingProvider = {
      mode: 'SIMULATED',
      policyVersion: 'test-provider-v1',
      quoteForVerdict: vi.fn(async (v: any) => new SimulatedUnderwritingProvider().quoteForVerdict(v)),
    };

    await expect(
      runVelaUnderwritingProjection(
        baseCallParams({ transport: protocolErrorTransport, underwritingProvider: spyProvider }),
      ),
    ).rejects.toThrow(/evidence is missing or malformed/);

    expect(spyProvider.quoteForVerdict).not.toHaveBeenCalled();
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(recordVelaUnderwritingRiskTelemetryMock).not.toHaveBeenCalled();
  });
});
