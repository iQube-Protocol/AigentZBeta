/**
 * services/vela/velaUnderwritingChainProjection.ts — Use Case Zero
 * build-order item 10a. Proves: every step resolves 'not_started' when no
 * evidence exists; each step's state-vocabulary mapping (Aegis
 * ADMITTED/REFUSED/UNRESOLVED; a frozen envelope present -> Freeze complete;
 * a projection-completed receipt with disposition UNACCEPTABLE -> Quote
 * reflects that honestly, never silently upgraded); a leak-check that no raw
 * party financial figures ever appear in the returned state; and the
 * import-boundary proving this new service never imports from the
 * unrelated, pre-existing "Use Case Zero" readiness system or the other
 * case-scoped/chat-context modules items 7-9 already disambiguated.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readSource, stripComments, forbiddenImportFindings } from './_lib/sourceAuthority';
import { createFakeSupabase } from './_lib/fakeSupabase';

const mockListActivityReceiptsForPersona = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  listActivityReceiptsForPersona: (...args: any[]) => mockListActivityReceiptsForPersona(...args),
}));

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: (...args: any[]) => mockGetSupabaseServer(...args),
}));

import { proposeFactorSelection, type FactorSelectionArtifact } from '@/services/factor/factorSelectionArtifact';
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
} from '@/services/vela/velaMultiPartyProjection';
import { getConstitutionalRiskFlowState } from '@/services/vela/velaUnderwritingChainProjection';

const CHAIN_SOURCE_PATH = 'services/vela/velaUnderwritingChainProjection.ts';
const PERSONA_ID = 'persona-1';
const APP_ID = 'app-1';
const REQUEST_REF = 'req-1';

function makeFactorSelection(overrides: Partial<Parameters<typeof proposeFactorSelection>[0]> = {}): FactorSelectionArtifact {
  return proposeFactorSelection({
    requestRef: REQUEST_REF,
    applicationId: APP_ID,
    candidateAgentSlug: 'nakamoto',
    selectionReason: 'best available coverage candidate',
    factorAgentId: 'aigent-factor',
    ...overrides,
  });
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

function makeDisclosureAuthorization(factorSelection: FactorSelectionArtifact): VelaUnderwritingDisclosureAuthorization {
  return authorizeUnderwritingDisclosure({
    selectionRef: factorSelection.selectionRef,
    requestRef: factorSelection.requestRef,
    applicationId: APP_ID,
    scope: makeScope(),
    authorizedByAgentRef: 'aigent-moneypenny',
  });
}

let seq = 0;
function makeReceipt(
  actionType: string,
  actionInput: Record<string, unknown>,
  overrides: Partial<{ receiptStatus: string; createdAt: string; id: string }> = {},
) {
  seq += 1;
  return {
    id: overrides.id ?? `receipt-${seq}`,
    sessionId: null,
    intentId: null,
    activeCartridge: 'moneypenny',
    actionType,
    summary: 'test receipt',
    agentsInvoked: [],
    toolsUsed: [],
    iqubesUsed: [],
    invariantsUsed: [],
    contextShared: [],
    artifactsCreated: [],
    approvalsGranted: [],
    policyEnvelopeId: null,
    receiptStatus: overrides.receiptStatus ?? 'local',
    dvnReceiptId: null,
    commitmentHash: null,
    posStatus: null,
    dvnStatus: null,
    btcAnchorTxid: null,
    btcBatchRoot: null,
    specialistResponse: null,
    actionConnectorId: null,
    actionConnectorLabel: null,
    actionInput,
    createdAt: overrides.createdAt ?? new Date(2026, 0, 1, 0, 0, seq).toISOString(),
  };
}

function frozenEnvelopeActionInput(
  factorSelection: FactorSelectionArtifact,
  admissionEvidence: AegisAdmissionEvidence,
  disclosureAuthorization: VelaUnderwritingDisclosureAuthorization,
  overrides: Partial<{ disposition: string; providerMode: string; onChainRequestId: string }> = {},
) {
  return {
    envelopeRef: 'envelope-ref-1',
    selectionRef: factorSelection.selectionRef,
    admissionRef: admissionEvidence.admissionRef,
    disclosureAuthorizationRef: disclosureAuthorization.authorizationRef,
    requestRef: factorSelection.requestRef,
    applicationId: disclosureAuthorization.applicationId,
    candidateAgentId: factorSelection.candidateAgentId,
    onChainRequestId: overrides.onChainRequestId ?? 'onchain-1',
    disposition: overrides.disposition ?? 'ACCEPTABLE',
    providerMode: overrides.providerMode ?? 'SIMULATED',
    veloProjectionReceiptId: 'projection-receipt-1',
    telemetryRecordId: 'telemetry-1',
  };
}

function projectionCompletedActionInput(
  factorSelection: FactorSelectionArtifact,
  overrides: Partial<{ disposition: string; coverageEligible: boolean; riskBand: string }> = {},
) {
  return {
    requestRef: factorSelection.requestRef,
    onChainRequestId: 'onchain-1',
    applicationId: APP_ID,
    partyNamespaceRefs: ['ns-a', 'ns-b'],
    requestingPartyNamespaceRef: 'ns-a',
    scopeBinding: makeScope().binding,
    scopeGrants: makeScope().grants,
    disposition: overrides.disposition ?? 'ACCEPTABLE',
    payloadCommitment: 'commitment-abc',
    attestationMode: 'SIMULATED',
    quote: {
      riskBand: overrides.riskBand ?? 'LOW',
      estimatedExposure: 100,
      riskOfRepair: 'LOW',
      coverageEligible: overrides.coverageEligible ?? true,
      coverageLimit: overrides.coverageEligible === false ? 0 : 1000,
      premium: overrides.coverageEligible === false ? 0 : 10,
      conditions: overrides.coverageEligible === false ? ['risk exceeds coverable threshold'] : [],
      confidence: overrides.disposition === 'UNRESOLVED' ? 0 : 1,
      providerMode: 'SIMULATED',
    },
    providerMode: 'SIMULATED',
  };
}

beforeEach(() => {
  seq = 0;
  mockListActivityReceiptsForPersona.mockReset();
  mockGetSupabaseServer.mockReset();
  mockGetSupabaseServer.mockReturnValue(null); // no telemetry unless a test opts in
});

describe('every step resolves not_started when no evidence exists', () => {
  it('an empty receipt list produces not_started for every step, with no receipt/telemetry evidence', async () => {
    mockListActivityReceiptsForPersona.mockResolvedValue([]);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.requestRef).toBe(REQUEST_REF);
    expect(state.select.state).toBe('not_started');
    expect(state.admit.state).toBe('not_started');
    expect(state.authorize.state).toBe('not_started');
    expect(state.freeze.state).toBe('not_started');
    expect(state.execute.state).toBe('not_started');
    expect(state.quote.state).toBe('not_started');
    expect(state.settle.state).toBe('not_started');
    expect(state.settle.settlementOccurred).toBeNull();
    expect(state.receipt.state).toBe('not_started');
    expect(state.receipt.receipts).toEqual([]);
    expect(state.telemetry.state).toBe('not_started');
  });

  it('a receipt list scoped to a DIFFERENT requestRef still resolves not_started (requestRef filtering is real, not a no-op)', async () => {
    const factorSelection = makeFactorSelection({ requestRef: 'a-different-request' });
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('factor_selection_proposed', factorSelection as unknown as Record<string, unknown>),
    ]);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.select.state).toBe('not_started');
  });
});

describe('Select step', () => {
  it('a factor_selection_proposed receipt for this requestRef resolves complete, carrying the real artifact fields', async () => {
    const factorSelection = makeFactorSelection();
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('factor_selection_proposed', factorSelection as unknown as Record<string, unknown>),
    ]);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.select.state).toBe('complete');
    expect(state.select.selectionRef).toBe(factorSelection.selectionRef);
    expect(state.select.candidateAgentId).toBe(factorSelection.candidateAgentId);
    expect(state.select.providerMode).toBe('SIMULATED');
  });
});

describe('Admit step — AegisAdmissionStatus -> ConstitutionalRiskFlowStepState mapping', () => {
  it('ADMITTED maps to complete', async () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection, { admissionStatus: 'ADMITTED' });
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('vela_underwriting_admission_evidence_composed', admissionEvidence as unknown as Record<string, unknown>),
    ]);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.admit.state).toBe('complete');
    expect(state.admit.admissionStatus).toBe('ADMITTED');
  });

  it('REFUSED maps to blocked', async () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection, {
      admissionStatus: 'REFUSED',
      reason: 'Aegis ratified this candidate as not admissible',
    });
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('vela_underwriting_admission_evidence_composed', admissionEvidence as unknown as Record<string, unknown>),
    ]);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.admit.state).toBe('blocked');
    expect(state.admit.admissionStatus).toBe('REFUSED');
  });

  it('UNRESOLVED maps to unresolved (distinct from not_started — Aegis WAS consulted)', async () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection, {
      admissionStatus: 'UNRESOLVED',
      reason: 'no Aegis assessment exists yet for this candidate',
    });
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('vela_underwriting_admission_evidence_composed', admissionEvidence as unknown as Record<string, unknown>),
    ]);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.admit.state).toBe('unresolved');
    expect(state.admit.admissionStatus).toBe('UNRESOLVED');
  });
});

describe('Freeze step', () => {
  it('a vela_underwriting_envelope_frozen receipt present resolves Freeze complete', async () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection);
    const disclosureAuthorization = makeDisclosureAuthorization(factorSelection);
    const envelopeInput = frozenEnvelopeActionInput(factorSelection, admissionEvidence, disclosureAuthorization);
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('vela_underwriting_envelope_frozen', envelopeInput),
    ]);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.freeze.state).toBe('complete');
    expect(state.freeze.envelopeRef).toBe('envelope-ref-1');
    // Execute derives from the SAME receipt's own disposition/onChainRequestId.
    expect(state.execute.state).toBe('complete');
    expect(state.execute.onChainRequestId).toBe('onchain-1');
    expect(state.execute.disposition).toBe('ACCEPTABLE');
  });

  it('Execute resolves unresolved (never complete) when the frozen envelope itself carries disposition UNRESOLVED', async () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection);
    const disclosureAuthorization = makeDisclosureAuthorization(factorSelection);
    const envelopeInput = frozenEnvelopeActionInput(factorSelection, admissionEvidence, disclosureAuthorization, {
      disposition: 'UNRESOLVED',
    });
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('vela_underwriting_envelope_frozen', envelopeInput),
    ]);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.execute.state).toBe('unresolved');
  });
});

describe('Quote step — honesty: complete never implies approval', () => {
  it('a projection-completed receipt with disposition UNACCEPTABLE resolves complete, but the quote data itself honestly shows the unfavourable outcome verbatim', async () => {
    const factorSelection = makeFactorSelection();
    const projectionInput = projectionCompletedActionInput(factorSelection, {
      disposition: 'UNACCEPTABLE',
      coverageEligible: false,
      riskBand: 'HIGH',
    });
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('vela_underwriting_projection_completed', projectionInput),
    ]);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    // The step DID conclude and was recorded — 'complete' describes that,
    // never approval (see the service's own header on this exact point).
    expect(state.quote.state).toBe('complete');
    expect(state.quote.quote).not.toBeNull();
    expect(state.quote.quote!.riskBand).toBe('HIGH');
    expect(state.quote.quote!.coverageEligible).toBe(false);
    expect(state.quote.quote!.coverageLimit).toBe(0);
    expect(state.quote.quote!.premium).toBe(0);
    expect(state.quote.reason).toMatch(/UNACCEPTABLE/);
  });

  it('disposition UNRESOLVED resolves the Quote step unresolved, not complete', async () => {
    const factorSelection = makeFactorSelection();
    const projectionInput = projectionCompletedActionInput(factorSelection, { disposition: 'UNRESOLVED' });
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('vela_underwriting_projection_completed', projectionInput),
    ]);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.quote.state).toBe('unresolved');
  });
});

describe('Settlement — never fabricated, reads the real execution_evidence.settlementOccurred fact', () => {
  it('no telemetry row at all resolves not_started with settlementOccurred null', async () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection);
    const disclosureAuthorization = makeDisclosureAuthorization(factorSelection);
    const envelopeInput = frozenEnvelopeActionInput(factorSelection, admissionEvidence, disclosureAuthorization);
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('vela_underwriting_envelope_frozen', envelopeInput),
    ]);
    mockGetSupabaseServer.mockReturnValue(null);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.settle.state).toBe('not_started');
    expect(state.settle.settlementOccurred).toBeNull();
    expect(state.telemetry.state).toBe('not_started');
  });

  it('a telemetry row with execution_evidence.settlementOccurred=true resolves Settle complete', async () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection);
    const disclosureAuthorization = makeDisclosureAuthorization(factorSelection);
    const envelopeInput = frozenEnvelopeActionInput(factorSelection, admissionEvidence, disclosureAuthorization, {
      onChainRequestId: 'onchain-settle-1',
    });
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('vela_underwriting_envelope_frozen', envelopeInput),
    ]);

    const fake = createFakeSupabase();
    fake.tables.golden_cycle_records = [
      {
        id: 'telemetry-row-1',
        record_key: 'vela-underwriting:onchain-settle-1',
        action_ref: 'onchain-settle-1',
        execution_evidence: { settlementOccurred: true },
        created_at: new Date().toISOString(),
      },
    ];
    mockGetSupabaseServer.mockReturnValue(fake.admin);

    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.settle.state).toBe('complete');
    expect(state.settle.settlementOccurred).toBe(true);
    expect(state.telemetry.state).toBe('complete');
    expect(state.telemetry.telemetryRecordId).toBe('telemetry-row-1');
  });

  it('a telemetry row with execution_evidence.settlementOccurred=false resolves Settle not_started (never a fabricated "pending")', async () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection);
    const disclosureAuthorization = makeDisclosureAuthorization(factorSelection);
    const envelopeInput = frozenEnvelopeActionInput(factorSelection, admissionEvidence, disclosureAuthorization, {
      onChainRequestId: 'onchain-settle-2',
    });
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('vela_underwriting_envelope_frozen', envelopeInput),
    ]);
    const fake = createFakeSupabase();
    fake.tables.golden_cycle_records = [
      {
        id: 'telemetry-row-2',
        record_key: 'vela-underwriting:onchain-settle-2',
        action_ref: 'onchain-settle-2',
        execution_evidence: { settlementOccurred: false },
        created_at: new Date().toISOString(),
      },
    ];
    mockGetSupabaseServer.mockReturnValue(fake.admin);

    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    expect(state.settle.state).toBe('not_started');
    expect(state.settle.settlementOccurred).toBe(false);
    // Telemetry itself DID record — distinct from settlement.
    expect(state.telemetry.state).toBe('complete');
  });
});

describe('Receipt step — rollup + leak check', () => {
  it('leak check — no raw party financial figures ever appear anywhere in the returned state', async () => {
    const factorSelection = makeFactorSelection();
    const admissionEvidence = makeAdmissionEvidence(factorSelection);
    const disclosureAuthorization = makeDisclosureAuthorization(factorSelection);
    const envelopeInput = frozenEnvelopeActionInput(factorSelection, admissionEvidence, disclosureAuthorization);
    const projectionInput = projectionCompletedActionInput(factorSelection);
    mockListActivityReceiptsForPersona.mockResolvedValue([
      makeReceipt('factor_selection_proposed', factorSelection as unknown as Record<string, unknown>),
      makeReceipt('vela_underwriting_admission_evidence_composed', admissionEvidence as unknown as Record<string, unknown>),
      makeReceipt('vela_underwriting_disclosure_authorized', disclosureAuthorization as unknown as Record<string, unknown>),
      makeReceipt('vela_underwriting_envelope_frozen', envelopeInput),
      makeReceipt('vela_underwriting_projection_completed', projectionInput),
    ]);
    const state = await getConstitutionalRiskFlowState({ personaId: PERSONA_ID, requestRef: REQUEST_REF });
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain('currentExposure');
    expect(serialized).not.toContain('proposedSpend');
    expect(serialized).not.toContain('privateSpendLimit');
    expect(serialized).not.toContain('privateRiskLimit');
    expect(serialized).not.toMatch(/"personaId"/);
    expect(serialized).not.toMatch(/"authProfileId"/);
    expect(serialized).not.toMatch(/"rootDid"/);
    expect(state.receipt.state).toBe('complete');
    expect(state.receipt.receipts).toHaveLength(5);
  });
});

describe('import-boundary — velaUnderwritingChainProjection.ts', () => {
  it('never imports the pre-existing, unrelated case-scoped "Use Case Zero" readiness system, the case-scoped MoneyPenny admission decision, or the conversation-context disclosure policy', () => {
    const FORBIDDEN_SPECIFIERS = [
      '@/services/factor/useCaseZeroOrchestrator',
      '@/services/factor/useCaseZeroReadinessProjection',
      '@/services/factor/useUseCaseZeroReadiness',
      '@/services/moneypenny/admissionAuthority',
      '@/services/qubetalk/disclosurePolicy',
    ];
    const src = readSource(CHAIN_SOURCE_PATH);
    const stripped = stripComments(src);
    const offenders = FORBIDDEN_SPECIFIERS.filter((specifier) => stripped.includes(specifier));
    expect(offenders, `forbidden import specifiers found in source: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no forbidden binding is reachable via named/namespace/dynamic import (importAuthority-based check)', () => {
    const src = readSource(CHAIN_SOURCE_PATH);
    const findings = forbiddenImportFindings(
      src,
      ['decideAdmission', 'evaluateDisclosure', 'isDisclosableTo'],
      [
        'services/factor/useCaseZeroOrchestrator',
        'services/factor/useCaseZeroReadinessProjection',
        'services/factor/useUseCaseZeroReadiness',
        'services/moneypenny/admissionAuthority',
        'services/qubetalk/disclosurePolicy',
      ],
    );
    expect(findings).toEqual([]);
  });

  it('this file writes NOTHING — no createActivityReceipt, no golden_cycle_records write path', () => {
    const src = readSource(CHAIN_SOURCE_PATH);
    const stripped = stripComments(src);
    expect(stripped).not.toContain('createActivityReceipt');
    expect(stripped).not.toContain('.insert(');
    expect(stripped).not.toContain('.upsert(');
    expect(stripped).not.toContain('.update(');
  });
});
