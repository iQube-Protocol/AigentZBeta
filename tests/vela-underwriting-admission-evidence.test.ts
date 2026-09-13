/**
 * services/vela/velaUnderwritingAdmissionEvidence.ts — Use Case Zero
 * build-order item 8. Proves the ten operator-mandated invariants named in
 * that file's own header, one describe block per structural/behavioural
 * property. Mirrors `tests/factor-selection-artifact.test.ts`'s (item 7)
 * mocking pattern and `tests/_lib/sourceAuthority.ts` import-boundary
 * technique.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readSource, stripComments, forbiddenImportFindings } from './_lib/sourceAuthority';

const createActivityReceiptMock = vi.fn(async (input: any) => ({ id: 'receipt-stub', ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceiptMock(...args),
}));

const getCurrentAssessmentMock = vi.fn();
const listFindingsMock = vi.fn();
vi.mock('@/services/aegis/aegisAssessmentService', () => ({
  getCurrentAssessment: (...args: any[]) => getCurrentAssessmentMock(...args),
  listFindings: (...args: any[]) => listFindingsMock(...args),
}));

import { proposeFactorSelection, type FactorSelectionArtifact, type FactorSelectionInput } from '@/services/factor/factorSelectionArtifact';
import {
  composeUnderwritingAdmissionEvidence,
  recordUnderwritingAdmissionEvidence,
  DEFAULT_MAX_ASSESSMENT_AGE_MS,
  type UnderwritingAdmissionEvidenceInput,
} from '@/services/vela/velaUnderwritingAdmissionEvidence';

const ADMISSION_SOURCE_PATH = 'services/vela/velaUnderwritingAdmissionEvidence.ts';

const BASE_FACTOR_INPUT: FactorSelectionInput = {
  requestRef: 'req-1',
  applicationId: 'app-1',
  candidateAgentSlug: 'nakamoto',
  selectionReason: 'best available coverage candidate',
  factorAgentId: 'aigent-factor',
};

const FAKE_ADMIN = {} as any;

/** A representative AegisAssessmentRow fixture — enough fields for this
 *  module's own logic, matching the real shape in aegisAssessmentService.ts. */
function makeAssessmentRow(overrides: Partial<Record<string, any>> = {}) {
  return {
    assessment_id: 'aegis-aigent-nakamoto-abc123',
    subject_type: 'agent',
    subject_ref: 'aigent-nakamoto',
    case_id: null,
    state: 'ratified',
    decision: 'admissible',
    policy_version: 'v1',
    evidence_snapshot: {},
    evidence_snapshot_hash: 'hash',
    conditions: [],
    assessment_hash: 'hash2',
    requested_by_agent_ref: 'aigent-factor',
    assessed_by_agent_ref: 'aigent-aegis',
    rationale: 'looks fine',
    actor_persona_id: 'persona-1',
    receipt_ref: null,
    supersedes_assessment_id: null,
    superseded_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ratified_at: new Date().toISOString(),
    subject_didqube_id: null,
    subject_didqube_class: null,
    subject_resolution_commitment: null,
    subject_resolution_commitment_version: null,
    identity_resolution_snapshot_hash: null,
    ...overrides,
  };
}

beforeEach(() => {
  createActivityReceiptMock.mockClear();
  getCurrentAssessmentMock.mockReset();
  listFindingsMock.mockReset();
  listFindingsMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function baseFactorSelection(): FactorSelectionArtifact {
  return proposeFactorSelection(BASE_FACTOR_INPUT);
}

describe('structural privacy gate — UnderwritingAdmissionEvidenceInput cannot carry raw financial inputs', () => {
  it('the TypeScript signature rejects an object shaped like raw party financial data', () => {
    // @ts-expect-error — UnderwritingAdmissionEvidenceInput has no field
    // shape for a party's raw financial inputs; this object must fail to
    // typecheck.
    const bad: UnderwritingAdmissionEvidenceInput = {
      currentExposure: 0,
      proposedSpend: 800,
      privateSpendLimit: 1000,
      privateRiskLimit: 1000,
    };
    expect(bad).toBeDefined();
  });
});

describe('candidateAgentId cannot be substituted', () => {
  it('the composed evidence always equals factorSelection.candidateAgentId verbatim', async () => {
    getCurrentAssessmentMock.mockResolvedValue(null);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });
    expect(evidence.candidateAgentId).toBe(factorSelection.candidateAgentId);
  });

  it('UnderwritingAdmissionEvidenceInput has no second field naming a candidate', () => {
    const factorSelection = baseFactorSelection();
    // @ts-expect-error — UnderwritingAdmissionEvidenceInput has no
    // candidateAgentId field; excess-property checking on this object
    // literal must reject it.
    const bad: UnderwritingAdmissionEvidenceInput = {
      factorSelection,
      candidateAgentId: 'aigent-someone-else',
    };
    expect(bad).toBeDefined();
  });
});

describe('no assessment exists', () => {
  it('resolves UNRESOLVED with all assessment-derived fields honestly null/empty', async () => {
    getCurrentAssessmentMock.mockResolvedValue(null);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    expect(evidence.admissionStatus).toBe('UNRESOLVED');
    expect(evidence.assessmentRef).toBeNull();
    expect(evidence.assessmentVersion).toBeNull();
    expect(evidence.freshnessMs).toBeNull();
    expect(evidence.evidenceRefs).toEqual([]);
    expect(evidence.reason).toMatch(/no aegis assessment exists/i);
    expect(listFindingsMock).not.toHaveBeenCalled();
  });
});

describe('assessment exists but not yet ratified', () => {
  it.each(['draft', 'evidence_locked', 'running', 'review_required'] as const)(
    "state '%s' resolves UNRESOLVED with assessmentRef/assessmentVersion populated and freshnessMs null",
    async (state) => {
      getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ state, decision: null, ratified_at: null }));
      const factorSelection = baseFactorSelection();
      const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

      expect(evidence.admissionStatus).toBe('UNRESOLVED');
      expect(evidence.assessmentRef).toBe('aegis-aigent-nakamoto-abc123');
      expect(evidence.assessmentVersion).toBe('v1');
      expect(evidence.freshnessMs).toBeNull();
      expect(evidence.evidenceRefs).toEqual(['aegis-aigent-nakamoto-abc123']);
    },
  );
});

describe("assessment state === 'failed'", () => {
  it('resolves UNRESOLVED (never REFUSED), distinguishing a process failure from a substantive verdict', async () => {
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ state: 'failed', decision: null, ratified_at: null }));
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    expect(evidence.admissionStatus).toBe('UNRESOLVED');
    expect(evidence.admissionStatus).not.toBe('REFUSED');
    expect(evidence.reason).toMatch(/process failed/i);
  });
});

describe('ratified, decision admissible, fresh, no critical-fail findings', () => {
  it('resolves ADMITTED', async () => {
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ decision: 'admissible' }));
    listFindingsMock.mockResolvedValue([{ is_critical: false, result: 'pass' }]);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    expect(evidence.admissionStatus).toBe('ADMITTED');
    expect(evidence.trustSummary.decision).toBe('admissible');
    expect(evidence.trustSummary.criticalFailedFindingCount).toBe(0);
  });
});

describe('ratified, decision admissible_with_conditions, fresh, no critical-fail findings', () => {
  it('resolves ADMITTED, with conditions populated from the mocked row', async () => {
    const conditions = [{ text: 'quarterly re-review required' }];
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ decision: 'admissible_with_conditions', conditions }));
    listFindingsMock.mockResolvedValue([]);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    expect(evidence.admissionStatus).toBe('ADMITTED');
    expect(evidence.trustSummary.conditions).toEqual(conditions);
  });
});

describe('ratified, decision not_admissible', () => {
  it('resolves REFUSED', async () => {
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ decision: 'not_admissible' }));
    listFindingsMock.mockResolvedValue([]);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    expect(evidence.admissionStatus).toBe('REFUSED');
  });
});

describe('ratified, decision insufficient_evidence', () => {
  it('resolves UNRESOLVED', async () => {
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ decision: 'insufficient_evidence' }));
    listFindingsMock.mockResolvedValue([]);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    expect(evidence.admissionStatus).toBe('UNRESOLVED');
  });
});

describe('ratified, decision admissible, but a critical failed finding exists (contradictory)', () => {
  it('resolves UNRESOLVED and names the contradiction explicitly', async () => {
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ decision: 'admissible' }));
    listFindingsMock.mockResolvedValue([{ is_critical: true, result: 'fail' }]);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    expect(evidence.admissionStatus).toBe('UNRESOLVED');
    expect(evidence.trustSummary.criticalFailedFindingCount).toBe(1);
    expect(evidence.reason).toMatch(/contradictory/i);
  });
});

describe('freshness discipline', () => {
  const FIXED_NOW = new Date('2026-09-14T00:00:00.000Z').getTime();

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  it('ratified but stale (older than maxAssessmentAgeMs) resolves UNRESOLVED and names staleness', async () => {
    const staleRatifiedAt = new Date(FIXED_NOW - (DEFAULT_MAX_ASSESSMENT_AGE_MS + 1)).toISOString();
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ decision: 'admissible', ratified_at: staleRatifiedAt }));
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    expect(evidence.admissionStatus).toBe('UNRESOLVED');
    expect(evidence.reason).toMatch(/stale/i);
    expect(listFindingsMock).not.toHaveBeenCalled();
  });

  it('ratified and exactly at the freshness boundary resolves normally (not stale)', async () => {
    const boundaryRatifiedAt = new Date(FIXED_NOW - DEFAULT_MAX_ASSESSMENT_AGE_MS).toISOString();
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ decision: 'admissible', ratified_at: boundaryRatifiedAt }));
    listFindingsMock.mockResolvedValue([]);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    expect(evidence.admissionStatus).toBe('ADMITTED');
    expect(evidence.reason).not.toMatch(/stale/i);
  });

  it('ratified and just under the freshness boundary resolves normally (not stale)', async () => {
    const underRatifiedAt = new Date(FIXED_NOW - (DEFAULT_MAX_ASSESSMENT_AGE_MS - 1)).toISOString();
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ decision: 'admissible', ratified_at: underRatifiedAt }));
    listFindingsMock.mockResolvedValue([]);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    expect(evidence.admissionStatus).toBe('ADMITTED');
  });

  it('a custom maxAssessmentAgeMs override is honoured (looser threshold admits an otherwise-stale assessment)', async () => {
    const ratifiedAt = new Date(FIXED_NOW - (DEFAULT_MAX_ASSESSMENT_AGE_MS + 1)).toISOString();
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ decision: 'admissible', ratified_at: ratifiedAt }));
    listFindingsMock.mockResolvedValue([]);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, {
      factorSelection,
      maxAssessmentAgeMs: DEFAULT_MAX_ASSESSMENT_AGE_MS * 10,
    });

    expect(evidence.admissionStatus).toBe('ADMITTED');
  });

  it('a custom maxAssessmentAgeMs override is honoured (tighter threshold stales an otherwise-fresh assessment)', async () => {
    const ratifiedAt = new Date(FIXED_NOW - 1000).toISOString();
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ decision: 'admissible', ratified_at: ratifiedAt }));
    listFindingsMock.mockResolvedValue([]);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, {
      factorSelection,
      maxAssessmentAgeMs: 500,
    });

    expect(evidence.admissionStatus).toBe('UNRESOLVED');
    expect(evidence.reason).toMatch(/stale/i);
  });
});

describe('admissionRef determinism', () => {
  it('the same (selectionRef, requestRef, candidateAgentId, assessmentRef, assessmentVersion) tuple produces the same admissionRef across two calls', async () => {
    const row = makeAssessmentRow({ decision: 'admissible' });
    getCurrentAssessmentMock.mockResolvedValue(row);
    listFindingsMock.mockResolvedValue([]);
    const factorSelection = baseFactorSelection();

    const a = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });
    const b = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });
    expect(a.admissionRef).toBe(b.admissionRef);
  });

  it('a different mocked assessment_id (a new assessment superseding the old one) produces a different admissionRef', async () => {
    const factorSelection = baseFactorSelection();

    getCurrentAssessmentMock.mockResolvedValueOnce(makeAssessmentRow({ decision: 'admissible', assessment_id: 'aegis-aigent-nakamoto-abc123' }));
    listFindingsMock.mockResolvedValueOnce([]);
    const a = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    getCurrentAssessmentMock.mockResolvedValueOnce(makeAssessmentRow({ decision: 'admissible', assessment_id: 'aegis-aigent-nakamoto-def456' }));
    listFindingsMock.mockResolvedValueOnce([]);
    const b = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    expect(a.admissionRef).not.toBe(b.admissionRef);
  });
});

describe('recordUnderwritingAdmissionEvidence writes exactly the right receipt', () => {
  it('binds the evidence verbatim as actionInput, with the correct actionType/agentsInvoked', async () => {
    getCurrentAssessmentMock.mockResolvedValue(makeAssessmentRow({ decision: 'admissible' }));
    listFindingsMock.mockResolvedValue([]);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });

    const result = await recordUnderwritingAdmissionEvidence(evidence, {
      actorPersonaId: 'persona-1',
      requestedByAgentRef: 'aigent-aegis',
    });

    expect(createActivityReceiptMock).toHaveBeenCalledTimes(1);
    const call = createActivityReceiptMock.mock.calls[0][0];
    expect(call.actionType).toBe('vela_underwriting_admission_evidence_composed');
    expect(call.personaId).toBe('persona-1');
    expect(call.agentsInvoked).toEqual(['aigent-aegis']);
    expect(call.actionInput).toEqual(evidence);
    expect(result.receiptId).toBe('receipt-stub');
  });

  it('defaults activeCartridge to moneypenny when not supplied', async () => {
    getCurrentAssessmentMock.mockResolvedValue(null);
    const factorSelection = baseFactorSelection();
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });
    await recordUnderwritingAdmissionEvidence(evidence, { actorPersonaId: 'persona-1', requestedByAgentRef: 'aigent-aegis' });
    const call = createActivityReceiptMock.mock.calls[0][0];
    expect(call.activeCartridge).toBe('moneypenny');
  });

  it('leak check — the receipt actionInput carries no raw financial figures or T0 identifiers', async () => {
    getCurrentAssessmentMock.mockResolvedValue(
      makeAssessmentRow({ decision: 'admissible', rationale: 'reviewed OK' }),
    );
    listFindingsMock.mockResolvedValue([]);
    const factorSelection = proposeFactorSelection({
      ...BASE_FACTOR_INPUT,
      rawQuotedTerms: { premium: 999, currentExposure: 1234 },
    });
    const evidence = await composeUnderwritingAdmissionEvidence(FAKE_ADMIN, { factorSelection });
    await recordUnderwritingAdmissionEvidence(evidence, { actorPersonaId: 'persona-1', requestedByAgentRef: 'aigent-aegis' });

    const call = createActivityReceiptMock.mock.calls[0][0];
    const actionInputKeys = Object.keys(call.actionInput);
    expect(actionInputKeys).not.toContain('rawQuotedTerms');
    expect(actionInputKeys).not.toContain('personaId');
    expect(actionInputKeys).not.toContain('authProfileId');
    expect(actionInputKeys).not.toContain('rootDid');
    expect(actionInputKeys).not.toContain('currentExposure');
    expect(actionInputKeys).not.toContain('proposedSpend');
    expect(JSON.stringify(call.actionInput)).not.toContain('999');
    expect(JSON.stringify(call.actionInput)).not.toContain('1234');
  });
});

describe('import-boundary — structural proof for invariants 4 and 10 ("never call Vela/underwriting/MoneyPenny directly")', () => {
  const FORBIDDEN_SPECIFIERS = [
    '@/services/vela/velaMultiPartyProjection',
    '@/services/vela/velaUnderwritingProjection',
    '@/services/financialServices/providers/underwriting/',
    '@/services/moneypenny/admissionAuthority',
  ];

  it('the module source contains no import from any forbidden Vela/underwriting/MoneyPenny path', () => {
    const src = readSource(ADMISSION_SOURCE_PATH);
    const stripped = stripComments(src);
    const offenders = FORBIDDEN_SPECIFIERS.filter((specifier) => stripped.includes(specifier));
    expect(offenders, `forbidden import specifiers found in source: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no forbidden binding is reachable via named/namespace/dynamic import (importAuthority-based check)', () => {
    const src = readSource(ADMISSION_SOURCE_PATH);
    const findings = forbiddenImportFindings(
      src,
      [
        'submitVelaMultiPartyProjection',
        'submitAssetBearingProcessRequest',
        'runVelaUnderwritingProjection',
        'decideAdmission',
      ],
      [
        'services/vela/velaMultiPartyProjection',
        'services/vela/velaUnderwritingProjection',
        'services/financialServices/providers/underwriting/',
        'services/moneypenny/admissionAuthority',
      ],
    );
    expect(findings).toEqual([]);
  });
});
