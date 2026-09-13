/**
 * services/vela/velaUnderwritingCompositionGate.ts — Use Case Zero
 * build-order item 9. Proves the eight operator-mandated hard gates named in
 * that file's own header, one describe block per gate, using REAL upstream
 * artifacts (`proposeFactorSelection`, `authorizeUnderwritingDisclosure`)
 * wherever a real constructor exists, and a mocked
 * `runVelaUnderwritingProjection` (this file's one legitimate import from a
 * business-logic module — see the composition gate's own header on why that
 * import is a positive, not forbidden, property here).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readSource, stripComments, forbiddenImportFindings } from './_lib/sourceAuthority';

const createActivityReceiptMock = vi.fn(async (input: any) => ({ id: 'receipt-stub', ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceiptMock(...args),
}));

const runVelaUnderwritingProjectionMock = vi.fn();
vi.mock('@/services/vela/velaUnderwritingProjection', () => ({
  runVelaUnderwritingProjection: (...args: any[]) => runVelaUnderwritingProjectionMock(...args),
}));

import { proposeFactorSelection, type FactorSelectionArtifact, type FactorSelectionInput } from '@/services/factor/factorSelectionArtifact';
import type { AegisAdmissionEvidence, AegisAdmissionStatus } from '@/services/vela/velaUnderwritingAdmissionEvidence';
import {
  authorizeUnderwritingDisclosure,
  type VelaUnderwritingDisclosureAuthorization,
} from '@/services/vela/velaUnderwritingDisclosureAuthorization';
import {
  VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
  VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
  VELA_SCOPE_ACTION_COMPUTE_WITH,
  type VelaMultiPartyDisclosureScope,
  type VelaMultiPartyPartyInput,
} from '@/services/vela/velaMultiPartyProjection';
import type { VelaTransport } from '@/services/vela/velaTypes';
import {
  composeUnderwritingEnvelope,
  submitFrozenUnderwritingEnvelope,
  VelaCompositionError,
  type FrozenUnderwritingEnvelope,
} from '@/services/vela/velaUnderwritingCompositionGate';

const COMPOSITION_SOURCE_PATH = 'services/vela/velaUnderwritingCompositionGate.ts';

const APP_ID = 'app-1';
const REQUEST_REF = 'req-1';

const BASE_FACTOR_INPUT: FactorSelectionInput = {
  requestRef: REQUEST_REF,
  applicationId: APP_ID,
  candidateAgentSlug: 'nakamoto',
  selectionReason: 'best available coverage candidate',
  factorAgentId: 'aigent-factor',
};

function makeFactorSelection(overrides: Partial<FactorSelectionInput> = {}): FactorSelectionArtifact {
  return proposeFactorSelection({ ...BASE_FACTOR_INPUT, ...overrides });
}

function makeAdmissionEvidence(
  factorSelection: FactorSelectionArtifact,
  overrides: Partial<AegisAdmissionEvidence> = {},
): AegisAdmissionEvidence {
  return {
    admissionRef: 'admission-ref-1',
    selectionRef: factorSelection.selectionRef,
    requestRef: factorSelection.requestRef,
    candidateAgentId: factorSelection.candidateAgentId,
    serviceId: null,
    assessmentRef: 'aegis-assessment-1',
    assessmentVersion: 'v1',
    admissionStatus: 'ADMITTED' as AegisAdmissionStatus,
    trustSummary: { decision: 'admissible', conditions: [], rationale: 'looks fine', criticalFailedFindingCount: 0 },
    evidenceRefs: ['aegis-assessment-1'],
    effectiveAt: new Date().toISOString(),
    freshnessMs: 1000,
    aegisAgentId: 'aigent-aegis',
    reason: 'Aegis ratified this candidate as admissible',
    ...overrides,
  };
}

function makeScope(): VelaMultiPartyDisclosureScope {
  return {
    binding: {
      applicationId: APP_ID,
      requestRef: REQUEST_REF,
      operationType: VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
      outputClass: VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
    },
    grants: [{ action: VELA_SCOPE_ACTION_COMPUTE_WITH, party: 'party-a' }],
  };
}

function makeDisclosureAuthorization(
  factorSelection: FactorSelectionArtifact,
  overrides: { applicationId?: string; requestRef?: string; scope?: VelaMultiPartyDisclosureScope } = {},
): VelaUnderwritingDisclosureAuthorization {
  return authorizeUnderwritingDisclosure({
    selectionRef: factorSelection.selectionRef,
    requestRef: overrides.requestRef ?? factorSelection.requestRef,
    applicationId: overrides.applicationId ?? APP_ID,
    scope: overrides.scope ?? makeScope(),
    authorizedByAgentRef: 'aigent-moneypenny',
  });
}

/** A full, correctly-paired triple — the common-case fixture every gate test
 *  starts from and then perturbs exactly one field of. */
function goodTriple() {
  const factorSelection = makeFactorSelection();
  const admissionEvidence = makeAdmissionEvidence(factorSelection);
  const disclosureAuthorization = makeDisclosureAuthorization(factorSelection);
  return { factorSelection, admissionEvidence, disclosureAuthorization };
}

beforeEach(() => {
  createActivityReceiptMock.mockClear();
  runVelaUnderwritingProjectionMock.mockReset();
});

describe('gate 1 — Factor selection <-> Aegis admission cross-reference integrity (THROWS on mismatch)', () => {
  it('a mismatched admissionEvidence.selectionRef throws VelaCompositionError naming the mismatch', () => {
    const { factorSelection, disclosureAuthorization } = goodTriple();
    const admissionEvidence = makeAdmissionEvidence(factorSelection, { selectionRef: 'wrong-selection-ref' });
    expect(() => composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization })).toThrow(
      VelaCompositionError,
    );
    try {
      composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization });
      throw new Error('expected a throw');
    } catch (e) {
      expect(e).toBeInstanceOf(VelaCompositionError);
      expect((e as VelaCompositionError).code).toBe('selection-admission-mismatch');
      expect((e as Error).message).toMatch(/selectionRef/);
    }
  });

  it('a mismatched admissionEvidence.requestRef throws naming requestRef', () => {
    const { factorSelection, disclosureAuthorization } = goodTriple();
    const admissionEvidence = makeAdmissionEvidence(factorSelection, { requestRef: 'wrong-request-ref' });
    expect(() => composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization })).toThrow(
      /requestRef/,
    );
  });

  it('a mismatched admissionEvidence.candidateAgentId throws naming candidateAgentId', () => {
    const { factorSelection, disclosureAuthorization } = goodTriple();
    const admissionEvidence = makeAdmissionEvidence(factorSelection, { candidateAgentId: 'aigent-someone-else' });
    expect(() => composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization })).toThrow(
      /candidateAgentId/,
    );
  });
});

describe('gate 2 — Factor selection <-> disclosure authorization cross-reference integrity (THROWS on mismatch)', () => {
  it('a mismatched disclosureAuthorization.selectionRef throws VelaCompositionError naming the mismatch', () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection);
    const wrongSelection = makeFactorSelection({ requestRef: 'other-req' });
    const disclosureAuthorization = makeDisclosureAuthorization(wrongSelection, { requestRef: factorSelection.requestRef });
    expect(() => composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization })).toThrow(
      VelaCompositionError,
    );
    try {
      composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization });
      throw new Error('expected a throw');
    } catch (e) {
      expect((e as VelaCompositionError).code).toBe('selection-disclosure-mismatch');
    }
  });

  it('a mismatched disclosureAuthorization.requestRef throws naming requestRef', () => {
    const { factorSelection, admissionEvidence } = goodTriple();
    const disclosureAuthorization = makeDisclosureAuthorization(factorSelection, { requestRef: 'wrong-request-ref' });
    expect(() => composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization })).toThrow(
      /requestRef/,
    );
  });
});

describe('gate 3 — scope-binding-matches-context, reused from the substrate (THROWS on mismatch)', () => {
  it('a scope.binding.applicationId that differs from the authorization\'s own applicationId throws (propagated from assertVelaMultiPartyScopeBindingMatchesContext)', () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection);
    // The authorization's own top-level applicationId disagrees with its
    // embedded scope.binding.applicationId — an internal-consistency defect
    // this gate's reuse of the substrate's own assertion must catch.
    const mismatchedScope: VelaMultiPartyDisclosureScope = {
      binding: {
        applicationId: 'a-different-app-id',
        requestRef: REQUEST_REF,
        operationType: VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
        outputClass: VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
      },
      grants: [{ action: VELA_SCOPE_ACTION_COMPUTE_WITH, party: 'party-a' }],
    };
    const disclosureAuthorization = makeDisclosureAuthorization(factorSelection, {
      applicationId: APP_ID,
      scope: mismatchedScope,
    });
    expect(() => composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization })).toThrow(
      /applicationId/,
    );
  });

  it('a scope.binding.requestRef that differs from the Factor selection\'s own requestRef throws', () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection);
    const mismatchedScope: VelaMultiPartyDisclosureScope = {
      binding: {
        applicationId: APP_ID,
        requestRef: 'a-different-request-ref',
        operationType: VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
        outputClass: VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
      },
      grants: [{ action: VELA_SCOPE_ACTION_COMPUTE_WITH, party: 'party-a' }],
    };
    // Build the authorization directly (bypassing makeDisclosureAuthorization's
    // own requestRef defaulting) so selectionRef/requestRef still match
    // factorSelection (passing gates 1/2) while ONLY the scope binding's
    // requestRef disagrees.
    const disclosureAuthorization = authorizeUnderwritingDisclosure({
      selectionRef: factorSelection.selectionRef,
      requestRef: factorSelection.requestRef,
      applicationId: APP_ID,
      scope: mismatchedScope,
      authorizedByAgentRef: 'aigent-moneypenny',
    });
    expect(() => composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization })).toThrow(
      /requestRef/,
    );
  });
});

describe('gate 4 — admission gate (BLOCKED, never a throw, for a correctly-paired but non-ADMITTED candidate)', () => {
  it('admissionStatus UNRESOLVED resolves BLOCKED, naming UNRESOLVED, no envelope', () => {
    const { factorSelection, disclosureAuthorization } = goodTriple();
    const admissionEvidence = makeAdmissionEvidence(factorSelection, {
      admissionStatus: 'UNRESOLVED',
      reason: 'no Aegis assessment exists yet for this candidate',
    });
    const result = composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization });
    expect(result.outcome).toBe('BLOCKED');
    if (result.outcome === 'BLOCKED') {
      expect(result.blockedReason).toMatch(/UNRESOLVED/);
    }
  });

  it('admissionStatus REFUSED resolves BLOCKED, naming REFUSED, no envelope', () => {
    const { factorSelection, disclosureAuthorization } = goodTriple();
    const admissionEvidence = makeAdmissionEvidence(factorSelection, {
      admissionStatus: 'REFUSED',
      reason: 'Aegis ratified this candidate as not admissible',
    });
    const result = composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization });
    expect(result.outcome).toBe('BLOCKED');
    if (result.outcome === 'BLOCKED') {
      expect(result.blockedReason).toMatch(/REFUSED/);
    }
  });

  it('admissionStatus ADMITTED with everything else consistent resolves FROZEN with every field populated verbatim', () => {
    const { factorSelection, admissionEvidence, disclosureAuthorization } = goodTriple();
    const result = composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization });
    expect(result.outcome).toBe('FROZEN');
    if (result.outcome === 'FROZEN') {
      expect(result.envelope.selectionRef).toBe(factorSelection.selectionRef);
      expect(result.envelope.admissionRef).toBe(admissionEvidence.admissionRef);
      expect(result.envelope.disclosureAuthorizationRef).toBe(disclosureAuthorization.authorizationRef);
      expect(result.envelope.requestRef).toBe(factorSelection.requestRef);
      expect(result.envelope.applicationId).toBe(disclosureAuthorization.applicationId);
      expect(result.envelope.candidateAgentId).toBe(factorSelection.candidateAgentId);
      expect(result.envelope.scope).toEqual(disclosureAuthorization.scope);
      expect(typeof result.envelope.frozenAt).toBe('string');
    }
  });
});

describe('envelopeRef determinism', () => {
  it('the same (selectionRef, admissionRef, disclosureAuthorizationRef, requestRef) tuple produces the same envelopeRef across two calls', () => {
    const { factorSelection, admissionEvidence, disclosureAuthorization } = goodTriple();
    const a = composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization });
    const b = composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization });
    expect(a.outcome).toBe('FROZEN');
    expect(b.outcome).toBe('FROZEN');
    if (a.outcome === 'FROZEN' && b.outcome === 'FROZEN') {
      expect(a.envelope.envelopeRef).toBe(b.envelope.envelopeRef);
    }
  });

  it('a different admissionRef (a re-assessed candidate) produces a different envelopeRef', () => {
    const { factorSelection, disclosureAuthorization } = goodTriple();
    const admissionEvidenceA = makeAdmissionEvidence(factorSelection, { admissionRef: 'admission-ref-1' });
    const admissionEvidenceB = makeAdmissionEvidence(factorSelection, { admissionRef: 'admission-ref-2' });
    const a = composeUnderwritingEnvelope({ factorSelection, admissionEvidence: admissionEvidenceA, disclosureAuthorization });
    const b = composeUnderwritingEnvelope({ factorSelection, admissionEvidence: admissionEvidenceB, disclosureAuthorization });
    expect(a.outcome).toBe('FROZEN');
    expect(b.outcome).toBe('FROZEN');
    if (a.outcome === 'FROZEN' && b.outcome === 'FROZEN') {
      expect(a.envelope.envelopeRef).not.toBe(b.envelope.envelopeRef);
    }
  });
});

describe('submitFrozenUnderwritingEnvelope', () => {
  const PARTY_INPUTS: VelaMultiPartyPartyInput[] = [
    {
      identities: { authorityPrincipal: 'principal-a', confidentialPrivacyIdentity: 'privacy-a' },
      recipientAddress: '0x1111111111111111111111111111111111111111',
      inputs: { currentExposure: 0, proposedSpend: 800, privateSpendLimit: 1000, privateRiskLimit: 1000 },
    },
  ];
  const FAKE_TRANSPORT = {} as unknown as VelaTransport;

  function frozenEnvelope(): FrozenUnderwritingEnvelope {
    const { factorSelection, admissionEvidence, disclosureAuthorization } = goodTriple();
    const result = composeUnderwritingEnvelope({ factorSelection, admissionEvidence, disclosureAuthorization });
    if (result.outcome !== 'FROZEN') throw new Error('expected FROZEN in test fixture setup');
    return result.envelope;
  }

  it('the scope object passed into runVelaUnderwritingProjection.build.scope is the EXACT SAME object as envelope.scope (gate 7: no swap after freeze)', async () => {
    const envelope = frozenEnvelope();
    runVelaUnderwritingProjectionMock.mockResolvedValue({
      onChainRequestId: 'onchain-1',
      disposition: 'ACCEPTABLE',
      quote: { riskBand: 'LOW', estimatedExposure: 100, riskOfRepair: 'LOW', coverageEligible: true, coverageLimit: 1000, premium: 10, conditions: [], confidence: 1, providerMode: 'SIMULATED' },
      receiptId: 'vela-projection-receipt-1',
      telemetryRecordId: 'telemetry-1',
    });

    await submitFrozenUnderwritingEnvelope({
      envelope,
      parties: PARTY_INPUTS,
      transport: FAKE_TRANSPORT,
      actorPersonaId: 'persona-1',
      requestedByAgentRef: 'aigent-moneypenny',
    });

    expect(runVelaUnderwritingProjectionMock).toHaveBeenCalledTimes(1);
    const callArgs = runVelaUnderwritingProjectionMock.mock.calls[0][0];
    // Referential identity, not just deep equality — proving no recomputation
    // happened between freeze and submission.
    expect(callArgs.build.scope).toBe(envelope.scope);
    expect(callArgs.build.applicationId).toBe(envelope.applicationId);
    expect(callArgs.build.requestRef).toBe(envelope.requestRef);
  });

  it('binds all named fields into the final vela_underwriting_envelope_frozen receipt', async () => {
    const envelope = frozenEnvelope();
    const velaResult = {
      onChainRequestId: 'onchain-2',
      disposition: 'ACCEPTABLE' as const,
      quote: { riskBand: 'LOW' as const, estimatedExposure: 100, riskOfRepair: 'LOW' as const, coverageEligible: true, coverageLimit: 1000, premium: 10, conditions: [], confidence: 1, providerMode: 'SIMULATED' as const },
      receiptId: 'vela-projection-receipt-2',
      telemetryRecordId: 'telemetry-2',
    };
    runVelaUnderwritingProjectionMock.mockResolvedValue(velaResult);

    const result = await submitFrozenUnderwritingEnvelope({
      envelope,
      parties: PARTY_INPUTS,
      transport: FAKE_TRANSPORT,
      actorPersonaId: 'persona-1',
      requestedByAgentRef: 'aigent-moneypenny',
    });

    expect(createActivityReceiptMock).toHaveBeenCalledTimes(1);
    const call = createActivityReceiptMock.mock.calls[0][0];
    expect(call.actionType).toBe('vela_underwriting_envelope_frozen');
    expect(call.personaId).toBe('persona-1');
    expect(call.agentsInvoked).toEqual(['aigent-moneypenny']);
    expect(call.actionInput).toEqual({
      envelopeRef: envelope.envelopeRef,
      selectionRef: envelope.selectionRef,
      admissionRef: envelope.admissionRef,
      disclosureAuthorizationRef: envelope.disclosureAuthorizationRef,
      requestRef: envelope.requestRef,
      applicationId: envelope.applicationId,
      candidateAgentId: envelope.candidateAgentId,
      onChainRequestId: velaResult.onChainRequestId,
      disposition: velaResult.disposition,
      providerMode: velaResult.quote.providerMode,
      veloProjectionReceiptId: velaResult.receiptId,
      telemetryRecordId: velaResult.telemetryRecordId,
    });
    expect(result.compositionReceiptId).toBe('receipt-stub');
    expect(result.velaResult).toEqual(velaResult);
  });

  it('leak check — the final receipt actionInput carries no raw financial figures or T0 identifiers', async () => {
    const envelope = frozenEnvelope();
    runVelaUnderwritingProjectionMock.mockResolvedValue({
      onChainRequestId: 'onchain-3',
      disposition: 'ACCEPTABLE',
      quote: { riskBand: 'LOW', estimatedExposure: 100, riskOfRepair: 'LOW', coverageEligible: true, coverageLimit: 1000, premium: 10, conditions: [], confidence: 1, providerMode: 'SIMULATED' },
      receiptId: 'vela-projection-receipt-3',
      telemetryRecordId: 'telemetry-3',
    });

    await submitFrozenUnderwritingEnvelope({
      envelope,
      parties: [
        {
          identities: { authorityPrincipal: 'principal-a', confidentialPrivacyIdentity: 'privacy-a' },
          recipientAddress: '0x1111111111111111111111111111111111111111',
          inputs: { currentExposure: 12345, proposedSpend: 67890, privateSpendLimit: 1000, privateRiskLimit: 1000 },
        },
      ],
      transport: FAKE_TRANSPORT,
      actorPersonaId: 'persona-1',
      requestedByAgentRef: 'aigent-moneypenny',
    });

    const call = createActivityReceiptMock.mock.calls[0][0];
    const actionInputKeys = Object.keys(call.actionInput);
    expect(actionInputKeys).not.toContain('personaId');
    expect(actionInputKeys).not.toContain('authProfileId');
    expect(actionInputKeys).not.toContain('rootDid');
    expect(actionInputKeys).not.toContain('parties');
    expect(actionInputKeys).not.toContain('inputs');
    expect(JSON.stringify(call.actionInput)).not.toContain('12345');
    expect(JSON.stringify(call.actionInput)).not.toContain('67890');
  });
});

describe('import-boundary — velaUnderwritingCompositionGate.ts', () => {
  it('DOES import runVelaUnderwritingProjection from velaUnderwritingProjection.ts (a positive assertion — this file is its one authorized caller)', () => {
    const src = readSource(COMPOSITION_SOURCE_PATH);
    expect(src).toContain('runVelaUnderwritingProjection');
    expect(src).toContain("from './velaUnderwritingProjection'");
  });

  it('never imports Aegis/authority/delegation/MoneyPenny-admission-authority/qubetalk-chat-disclosure paths', () => {
    const FORBIDDEN_SPECIFIERS = [
      '@/services/aegis/aegisAssessmentService',
      '@/services/aegis/',
      '@/services/factor/authorityChain',
      '@/services/delegation/',
      '@/services/access/evaluateAccess',
      '@/services/identity/getActivePersona',
      '@/services/moneypenny/admissionAuthority',
      '@/services/qubetalk/disclosurePolicy',
    ];
    const src = readSource(COMPOSITION_SOURCE_PATH);
    const stripped = stripComments(src);
    const offenders = FORBIDDEN_SPECIFIERS.filter((specifier) => stripped.includes(specifier));
    expect(offenders, `forbidden import specifiers found in source: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no forbidden binding is reachable via named/namespace/dynamic import (importAuthority-based check)', () => {
    const src = readSource(COMPOSITION_SOURCE_PATH);
    const findings = forbiddenImportFindings(
      src,
      [
        'getCurrentAssessment',
        'listFindings',
        'createAssessment',
        'ratifyAssessment',
        'decideAdmission',
        'getActivePersona',
        'evaluateAccess',
        'evaluateDisclosure',
        'isDisclosableTo',
      ],
      [
        'services/aegis/',
        'services/factor/authorityChain',
        'services/delegation/',
        'services/access/evaluateAccess',
        'services/identity/getActivePersona',
        'services/moneypenny/admissionAuthority',
        'services/qubetalk/disclosurePolicy',
      ],
    );
    expect(findings).toEqual([]);
  });
});
