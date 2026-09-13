/**
 * services/vela/velaUnderwritingDisclosureAuthorization.ts — Use Case Zero
 * build-order item 9's Tier-1 QubeTalk/iQube act. Mirrors
 * `tests/factor-selection-artifact.test.ts`'s mocking pattern and
 * `tests/_lib/sourceAuthority.ts`'s import-boundary technique.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readSource, stripComments, forbiddenImportFindings } from './_lib/sourceAuthority';

const createActivityReceiptMock = vi.fn(async (input: any) => ({ id: 'receipt-stub', ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceiptMock(...args),
}));

import {
  authorizeUnderwritingDisclosure,
  recordUnderwritingDisclosureAuthorization,
  type VelaUnderwritingDisclosureAuthorizationInput,
} from '@/services/vela/velaUnderwritingDisclosureAuthorization';
import {
  VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
  VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
  VELA_SCOPE_ACTION_COMPUTE_WITH,
  VELA_SCOPE_ACTION_DISCLOSE_TO,
  type VelaMultiPartyDisclosureScope,
} from '@/services/vela/velaMultiPartyProjection';

const DISCLOSURE_SOURCE_PATH = 'services/vela/velaUnderwritingDisclosureAuthorization.ts';

const APP_ID = 'app-1';
const REQUEST_REF = 'req-1';
const SELECTION_REF = 'selection-1';

function validScope(): VelaMultiPartyDisclosureScope {
  return {
    binding: {
      applicationId: APP_ID,
      requestRef: REQUEST_REF,
      operationType: VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
      outputClass: VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
    },
    grants: [
      { action: VELA_SCOPE_ACTION_COMPUTE_WITH, party: 'party-a' },
      { action: VELA_SCOPE_ACTION_DISCLOSE_TO, party: 'party-a', to: 'party-b' },
    ],
  };
}

function baseInput(overrides: Partial<VelaUnderwritingDisclosureAuthorizationInput> = {}): VelaUnderwritingDisclosureAuthorizationInput {
  return {
    selectionRef: SELECTION_REF,
    requestRef: REQUEST_REF,
    applicationId: APP_ID,
    scope: validScope(),
    authorizedByAgentRef: 'aigent-moneypenny',
    ...overrides,
  };
}

beforeEach(() => {
  createActivityReceiptMock.mockClear();
});

describe('scope validation is reused, not reimplemented (governed by assertValidVelaMultiPartyDisclosureScope)', () => {
  it('a missing grants array throws', () => {
    const badScope = { binding: validScope().binding } as unknown as VelaMultiPartyDisclosureScope;
    expect(() => authorizeUnderwritingDisclosure(baseInput({ scope: badScope }))).toThrow(/grants must be an array/i);
  });

  it('a grant with an invalid action value throws', () => {
    const badScope: VelaMultiPartyDisclosureScope = {
      binding: validScope().binding,
      grants: [{ action: 'DO_SOMETHING_ELSE' as any, party: 'party-a' }],
    };
    expect(() => authorizeUnderwritingDisclosure(baseInput({ scope: badScope }))).toThrow(/COMPUTE_WITH.*DISCLOSE_TO/i);
  });

  it('a missing/non-object binding throws', () => {
    const badScope = { grants: [] } as unknown as VelaMultiPartyDisclosureScope;
    expect(() => authorizeUnderwritingDisclosure(baseInput({ scope: badScope }))).toThrow(/binding is required/i);
  });

  it('a well-formed scope with an explicitly empty grants array is accepted', () => {
    const scope: VelaMultiPartyDisclosureScope = { binding: validScope().binding, grants: [] };
    const authorization = authorizeUnderwritingDisclosure(baseInput({ scope }));
    expect(authorization.scope.grants).toEqual([]);
  });
});

describe('authorizationRef determinism', () => {
  it('the same (selectionRef, requestRef, applicationId, scope) tuple produces the same authorizationRef', () => {
    const a = authorizeUnderwritingDisclosure(baseInput());
    const b = authorizeUnderwritingDisclosure(baseInput());
    expect(a.authorizationRef).toBe(b.authorizationRef);
  });

  it('a different scope produces a different authorizationRef', () => {
    const a = authorizeUnderwritingDisclosure(baseInput());
    const differentScope: VelaMultiPartyDisclosureScope = {
      binding: validScope().binding,
      grants: [{ action: VELA_SCOPE_ACTION_COMPUTE_WITH, party: 'party-c' }],
    };
    const b = authorizeUnderwritingDisclosure(baseInput({ scope: differentScope }));
    expect(a.authorizationRef).not.toBe(b.authorizationRef);
  });

  it('a different requestRef produces a different authorizationRef', () => {
    const a = authorizeUnderwritingDisclosure(baseInput());
    const b = authorizeUnderwritingDisclosure(baseInput({ requestRef: 'req-2' }));
    expect(a.authorizationRef).not.toBe(b.authorizationRef);
  });

  it('a different applicationId produces a different authorizationRef', () => {
    const a = authorizeUnderwritingDisclosure(baseInput());
    const b = authorizeUnderwritingDisclosure(baseInput({ applicationId: 'app-2' }));
    expect(a.authorizationRef).not.toBe(b.authorizationRef);
  });
});

describe('evidenceRefs defaults', () => {
  it('defaults to [] when omitted, never fabricated to something non-empty', () => {
    const authorization = authorizeUnderwritingDisclosure(baseInput());
    expect(authorization.evidenceRefs).toEqual([]);
  });

  it('preserves caller-supplied evidenceRefs verbatim', () => {
    const authorization = authorizeUnderwritingDisclosure(baseInput({ evidenceRefs: ['qubetalk-msg-1', 'iqube-consent-2'] }));
    expect(authorization.evidenceRefs).toEqual(['qubetalk-msg-1', 'iqube-consent-2']);
  });
});

describe('recordUnderwritingDisclosureAuthorization writes exactly the right receipt', () => {
  it('binds the authorization verbatim as actionInput, with the correct actionType/personaId/agentsInvoked', async () => {
    const authorization = authorizeUnderwritingDisclosure(baseInput());
    const result = await recordUnderwritingDisclosureAuthorization(authorization, {
      actorPersonaId: 'persona-1',
      requestedByAgentRef: 'aigent-moneypenny',
    });

    expect(createActivityReceiptMock).toHaveBeenCalledTimes(1);
    const call = createActivityReceiptMock.mock.calls[0][0];
    expect(call.actionType).toBe('vela_underwriting_disclosure_authorized');
    expect(call.personaId).toBe('persona-1');
    expect(call.agentsInvoked).toEqual(['aigent-moneypenny']);
    expect(call.actionInput).toEqual(authorization);
    expect(result.receiptId).toBe('receipt-stub');
  });

  it('defaults activeCartridge to moneypenny when not supplied', async () => {
    const authorization = authorizeUnderwritingDisclosure(baseInput());
    await recordUnderwritingDisclosureAuthorization(authorization, {
      actorPersonaId: 'persona-1',
      requestedByAgentRef: 'aigent-moneypenny',
    });
    const call = createActivityReceiptMock.mock.calls[0][0];
    expect(call.activeCartridge).toBe('moneypenny');
  });

  it('leak check — the receipt actionInput carries no T0 identifier', async () => {
    const authorization = authorizeUnderwritingDisclosure(baseInput());
    await recordUnderwritingDisclosureAuthorization(authorization, {
      actorPersonaId: 'persona-1',
      requestedByAgentRef: 'aigent-moneypenny',
    });
    const call = createActivityReceiptMock.mock.calls[0][0];
    const actionInputKeys = Object.keys(call.actionInput);
    expect(actionInputKeys).not.toContain('personaId');
    expect(actionInputKeys).not.toContain('authProfileId');
    expect(actionInputKeys).not.toContain('rootDid');
  });
});

describe('import-boundary — structural proof this file never touches submission/Aegis/authority/qubetalk-chat-disclosure paths', () => {
  const FORBIDDEN_SPECIFIERS = [
    '@/services/vela/velaUnderwritingProjection',
    '@/services/aegis/',
    '@/services/factor/authorityChain',
    '@/services/delegation/',
    '@/services/access/evaluateAccess',
    '@/services/identity/getActivePersona',
    '@/services/qubetalk/disclosurePolicy',
  ];

  it('the module source contains no import from any forbidden path', () => {
    const src = readSource(DISCLOSURE_SOURCE_PATH);
    const stripped = stripComments(src);
    const offenders = FORBIDDEN_SPECIFIERS.filter((specifier) => stripped.includes(specifier));
    expect(offenders, `forbidden import specifiers found in source: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no forbidden binding is reachable via named/namespace/dynamic import (importAuthority-based check)', () => {
    const src = readSource(DISCLOSURE_SOURCE_PATH);
    const findings = forbiddenImportFindings(
      src,
      [
        'submitVelaMultiPartyProjection',
        'prepareVelaMultiPartyProjection',
        'buildVelaMultiPartyProjectionRequest',
        'runVelaUnderwritingProjection',
        'evaluateDisclosure',
        'isDisclosableTo',
        'decideAdmission',
        'getActivePersona',
        'evaluateAccess',
      ],
      [
        'services/vela/velaUnderwritingProjection',
        'services/aegis/',
        'services/factor/authorityChain',
        'services/delegation/',
        'services/access/evaluateAccess',
        'services/identity/getActivePersona',
        'services/qubetalk/disclosurePolicy',
        'services/moneypenny/admissionAuthority',
      ],
    );
    expect(findings).toEqual([]);
  });

  it('DOES import the reused scope validator from velaMultiPartyProjection.ts (a positive, not forbidden, assertion)', () => {
    const src = readSource(DISCLOSURE_SOURCE_PATH);
    expect(src).toContain('assertValidVelaMultiPartyDisclosureScope');
    expect(src).toContain("from './velaMultiPartyProjection'");
  });
});
