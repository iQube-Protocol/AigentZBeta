/**
 * services/factor/factorSelectionArtifact.ts — Use Case Zero build-order
 * item 7. Proves the six operator-mandated invariants named in that file's
 * own header, one describe block per structural/behavioural property.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readSource, stripComments, forbiddenImportFindings } from './_lib/sourceAuthority';

const createActivityReceiptMock = vi.fn(async (input: any) => ({ id: 'receipt-stub', ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceiptMock(...args),
}));

import {
  proposeFactorSelection,
  recordFactorSelection,
  type FactorSelectionArtifact,
  type FactorSelectionInput,
} from '@/services/factor/factorSelectionArtifact';

const FACTOR_SOURCE_PATH = 'services/factor/factorSelectionArtifact.ts';

const BASE_INPUT: FactorSelectionInput = {
  requestRef: 'req-1',
  applicationId: 'app-1',
  candidateAgentSlug: 'nakamoto',
  selectionReason: 'best available coverage candidate',
  factorAgentId: 'aigent-factor',
};

beforeEach(() => {
  createActivityReceiptMock.mockClear();
});

describe('structural privacy gate — FactorSelectionInput cannot carry raw financial inputs', () => {
  it('the TypeScript signature rejects an object shaped like raw party financial data', () => {
    // @ts-expect-error — FactorSelectionInput has no field shape for a
    // party's raw financial inputs; this object must fail to typecheck.
    const bad: FactorSelectionInput = {
      currentExposure: 0,
      proposedSpend: 800,
      privateSpendLimit: 1000,
      privateRiskLimit: 1000,
    };
    expect(bad).toBeDefined();
  });
});

describe('providerMode is always SIMULATED and not caller-settable', () => {
  it('the artifact always carries providerMode: "SIMULATED"', () => {
    const artifact = proposeFactorSelection(BASE_INPUT);
    expect(artifact.providerMode).toBe('SIMULATED');
  });

  it('FactorSelectionInput has no providerMode field at all', () => {
    // @ts-expect-error — providerMode is not a settable input field; a
    // caller attempting to pass one must fail to typecheck.
    const withProviderMode: FactorSelectionInput = { ...BASE_INPUT, providerMode: 'LIVE' };
    expect(withProviderMode).toBeDefined();
  });
});

describe('selectionRef determinism', () => {
  it('the same (requestRef, candidateAgentSlug) pair produces the same selectionRef', () => {
    const a = proposeFactorSelection(BASE_INPUT);
    const b = proposeFactorSelection(BASE_INPUT);
    expect(a.selectionRef).toBe(b.selectionRef);
  });

  it('a different requestRef produces a different selectionRef', () => {
    const a = proposeFactorSelection(BASE_INPUT);
    const b = proposeFactorSelection({ ...BASE_INPUT, requestRef: 'req-2' });
    expect(a.selectionRef).not.toBe(b.selectionRef);
  });

  it('a different (but still valid) candidateAgentSlug produces a different selectionRef', () => {
    const a = proposeFactorSelection(BASE_INPUT);
    const b = proposeFactorSelection({ ...BASE_INPUT, candidateAgentSlug: 'kn0w1' });
    expect(a.selectionRef).not.toBe(b.selectionRef);
  });
});

describe('quotedTermsRef commitment discipline', () => {
  it('rawQuotedTerms omitted -> quotedTermsRef is null (never fabricated)', () => {
    const artifact = proposeFactorSelection(BASE_INPUT);
    expect(artifact.quotedTermsRef).toBeNull();
  });

  it('rawQuotedTerms supplied -> quotedTermsRef is a 64-char hex string', () => {
    const artifact = proposeFactorSelection({ ...BASE_INPUT, rawQuotedTerms: { premium: 100 } });
    expect(artifact.quotedTermsRef).toMatch(/^[0-9a-f]{64}$/);
  });

  it('two different rawQuotedTerms objects for the same candidate/request produce two different quotedTermsRef values', () => {
    const a = proposeFactorSelection({ ...BASE_INPUT, rawQuotedTerms: { premium: 100 } });
    const b = proposeFactorSelection({ ...BASE_INPUT, rawQuotedTerms: { premium: 200 } });
    expect(a.quotedTermsRef).not.toBe(b.quotedTermsRef);
  });

  it('the artifact never contains a rawQuotedTerms field itself', () => {
    const artifact = proposeFactorSelection({ ...BASE_INPUT, rawQuotedTerms: { premium: 100 } });
    expect(Object.prototype.hasOwnProperty.call(artifact, 'rawQuotedTerms')).toBe(false);
  });
});

describe('unknown candidate slug refuses cleanly', () => {
  it('throws rather than inventing a candidateAgentId for an unrecognised slug', () => {
    expect(() => proposeFactorSelection({ ...BASE_INPUT, candidateAgentSlug: 'not-a-real-agent' })).toThrow(
      /unknown candidate agent slug/,
    );
  });
});

describe('evidenceRefs defaults', () => {
  it('defaults to [] when omitted, never fabricated to something non-empty', () => {
    const artifact = proposeFactorSelection(BASE_INPUT);
    expect(artifact.evidenceRefs).toEqual([]);
  });

  it('preserves caller-supplied evidenceRefs verbatim', () => {
    const artifact = proposeFactorSelection({ ...BASE_INPUT, evidenceRefs: ['ev-1', 'ev-2'] });
    expect(artifact.evidenceRefs).toEqual(['ev-1', 'ev-2']);
  });
});

describe('recordFactorSelection writes exactly the right receipt', () => {
  it('binds the artifact verbatim as actionInput, with the correct actionType/personaId/agentsInvoked', async () => {
    const artifact = proposeFactorSelection(BASE_INPUT);
    const result = await recordFactorSelection(artifact, {
      actorPersonaId: 'persona-1',
      requestedByAgentRef: 'aigent-factor',
    });

    expect(createActivityReceiptMock).toHaveBeenCalledTimes(1);
    const call = createActivityReceiptMock.mock.calls[0][0];
    expect(call.actionType).toBe('factor_selection_proposed');
    expect(call.personaId).toBe('persona-1');
    expect(call.agentsInvoked).toEqual(['aigent-factor']);
    expect(call.actionInput).toEqual(artifact);
    expect(result.receiptId).toBe('receipt-stub');
  });

  it('leak check — the receipt actionInput carries no rawQuotedTerms, no T0 identifier, no raw financial figures', async () => {
    const artifact = proposeFactorSelection({
      ...BASE_INPUT,
      rawQuotedTerms: { premium: 999, currentExposure: 1234 },
    });
    await recordFactorSelection(artifact, { actorPersonaId: 'persona-1', requestedByAgentRef: 'aigent-factor' });

    const call = createActivityReceiptMock.mock.calls[0][0];
    const actionInputKeys = Object.keys(call.actionInput);
    expect(actionInputKeys).not.toContain('rawQuotedTerms');
    expect(actionInputKeys).not.toContain('personaId');
    expect(actionInputKeys).not.toContain('authProfileId');
    expect(actionInputKeys).not.toContain('rootDid');
    expect(JSON.stringify(call.actionInput)).not.toContain('999');
    expect(JSON.stringify(call.actionInput)).not.toContain('1234');
  });

  it('defaults activeCartridge to moneypenny when not supplied', async () => {
    const artifact = proposeFactorSelection(BASE_INPUT);
    await recordFactorSelection(artifact, { actorPersonaId: 'persona-1', requestedByAgentRef: 'aigent-factor' });
    const call = createActivityReceiptMock.mock.calls[0][0];
    expect(call.activeCartridge).toBe('moneypenny');
  });
});

describe('import-boundary — structural proof for invariants 1, 2, and "never call Vela/underwriting directly"', () => {
  const FORBIDDEN_SPECIFIERS = [
    '@/services/factor/authorityChain',
    '@/services/delegation/',
    '@/services/access/evaluateAccess',
    '@/services/identity/getActivePersona',
    '@/services/aegis/',
    '@/services/vela/velaMultiPartyProjection',
    '@/services/vela/velaUnderwritingProjection',
    '@/services/financialServices/providers/underwriting/',
  ];

  it('the module source contains no import from any forbidden authority/delegation/Aegis/Vela/underwriting path', () => {
    const src = readSource(FACTOR_SOURCE_PATH);
    const stripped = stripComments(src);
    const offenders = FORBIDDEN_SPECIFIERS.filter((specifier) => stripped.includes(specifier));
    expect(offenders, `forbidden import specifiers found in source: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no forbidden binding is reachable via named/namespace/dynamic import (importAuthority-based check)', () => {
    const src = readSource(FACTOR_SOURCE_PATH);
    const findings = forbiddenImportFindings(
      src,
      [
        'authorizeAgreement',
        'evaluateAccess',
        'getActivePersona',
        'runVelaUnderwritingProjection',
        'submitVelaMultiPartyProjection',
        'prepareVelaMultiPartyProjection',
        'getVelaMultiPartyProjectionDisposition',
        'createUnderwritingProvider',
      ],
      [
        'services/factor/authorityChain',
        'services/delegation/',
        'services/access/evaluateAccess',
        'services/identity/getActivePersona',
        'services/aegis/',
        'services/vela/velaMultiPartyProjection',
        'services/vela/velaUnderwritingProjection',
        'services/financialServices/providers/underwriting/',
      ],
    );
    expect(findings).toEqual([]);
  });
});
