/**
 * deriveRuntimeReadinessProjection — dedicated unit tests (2026-08-23).
 *
 * Proves the four independent readiness facts the operator asked for
 * ("Eligibility: ready, Standing: ready, Authority: ready/pending,
 * Confidential execution: Vela Live attestation pending") resolve correctly
 * and independently — never collapsed into one boolean, never fabricated as
 * `ready` before the real underlying fact is known.
 */

import { describe, it, expect } from 'vitest';
import { deriveRuntimeReadinessProjection } from '@/services/financialServices/runtimeReadinessProjection';
import { MONEYPENNY_RUNTIME, MONEYPENNY_RUNTIME_CONSTITUTIONAL } from '@/services/financialServices/serviceCatalog';
import type { FinancialServiceAgentContext } from '@/services/financialServices/agentEligibilityContext';
import type { FinancialServiceAuthorityPrerequisite } from '@/services/financialServices/discovery';

function baseContext(overrides: Partial<FinancialServiceAgentContext> = {}): FinancialServiceAgentContext {
  return {
    agent: { runtimeAgentId: 'aigent-nakamoto' } as any,
    admission: { registryActivated: true, agentRootId: 'root-1', agentRootDid: 'did:example:root-1', auditGaps: [] } as any,
    structurallyAssigned: true,
    activeGrant: null,
    hasCurrentDelegationToAgent: false,
    verification: undefined,
    standingPersonaId: 'standing-persona-1',
    standing: { score: 30 } as any,
    callerPersonaId: 'caller-1',
    callerAuthProfileId: 'auth-1',
    ...overrides,
  };
}

function authority(overrides: Partial<FinancialServiceAuthorityPrerequisite> = {}): FinancialServiceAuthorityPrerequisite {
  return { state: 'ACTIVE', met: true, code: 'AUTHORITY_ACTIVE', reason: 'active', ...overrides };
}

describe('deriveRuntimeReadinessProjection — eligibility', () => {
  it('is unresolved when admission itself could not be read', () => {
    const projection = deriveRuntimeReadinessProjection(
      baseContext({ admission: undefined }),
      MONEYPENNY_RUNTIME,
      authority(),
    );
    expect(projection.eligibility).toBe('unresolved');
  });

  it('is unresolved when structural assignment itself could not be read', () => {
    const projection = deriveRuntimeReadinessProjection(
      baseContext({ structurallyAssigned: undefined }),
      MONEYPENNY_RUNTIME,
      authority(),
    );
    expect(projection.eligibility).toBe('unresolved');
  });

  it('is ready when registry-activated and structurally assigned are both true', () => {
    const projection = deriveRuntimeReadinessProjection(baseContext(), MONEYPENNY_RUNTIME, authority());
    expect(projection.eligibility).toBe('ready');
  });

  it('is not-ready when registry-activated is false, even though the read succeeded', () => {
    const projection = deriveRuntimeReadinessProjection(
      baseContext({ admission: { registryActivated: false, agentRootId: 'root-1', agentRootDid: 'did:example:root-1', auditGaps: [] } as any }),
      MONEYPENNY_RUNTIME,
      authority(),
    );
    expect(projection.eligibility).toBe('not-ready');
  });

  it('is not-ready when the agent is not structurally assigned, even though registry-activated is true', () => {
    const projection = deriveRuntimeReadinessProjection(
      baseContext({ structurallyAssigned: false }),
      MONEYPENNY_RUNTIME,
      authority(),
    );
    expect(projection.eligibility).toBe('not-ready');
  });
});

describe('deriveRuntimeReadinessProjection — standing', () => {
  it('is not-required for a service whose policy declares no Standing floor', () => {
    const definitionWithNoFloor = {
      ...MONEYPENNY_RUNTIME,
      eligibilityPolicy: { ...MONEYPENNY_RUNTIME.eligibilityPolicy, minimumStandingScore: null },
    };
    const projection = deriveRuntimeReadinessProjection(baseContext(), definitionWithNoFloor, authority());
    expect(projection.standing).toBe('not-required');
  });

  it('is unresolved when there is no Standing persona to read a score from', () => {
    const projection = deriveRuntimeReadinessProjection(
      baseContext({ standingPersonaId: null, standing: null }),
      MONEYPENNY_RUNTIME,
      authority(),
    );
    expect(projection.standing).toBe('unresolved');
  });

  it('is unresolved when a Standing persona exists but the score read itself failed', () => {
    const projection = deriveRuntimeReadinessProjection(
      baseContext({ standingPersonaId: 'standing-persona-1', standing: null }),
      MONEYPENNY_RUNTIME,
      authority(),
    );
    expect(projection.standing).toBe('unresolved');
  });

  it('is ready when the resolved score meets the policy floor', () => {
    const projection = deriveRuntimeReadinessProjection(
      baseContext({ standing: { score: 25 } as any }),
      MONEYPENNY_RUNTIME,
      authority(),
    );
    expect(projection.standing).toBe('ready');
  });

  it('is not-ready when the resolved score is below the policy floor', () => {
    const projection = deriveRuntimeReadinessProjection(
      baseContext({ standing: { score: 24 } as any }),
      MONEYPENNY_RUNTIME,
      authority(),
    );
    expect(projection.standing).toBe('not-ready');
  });
});

describe('deriveRuntimeReadinessProjection — authority', () => {
  it('is unresolved when no authority prerequisite was computed at all', () => {
    const projection = deriveRuntimeReadinessProjection(baseContext(), MONEYPENNY_RUNTIME, null);
    expect(projection.authority).toBe('unresolved');
  });

  it('is ready when the resolved authority state is ACTIVE', () => {
    const projection = deriveRuntimeReadinessProjection(baseContext(), MONEYPENNY_RUNTIME, authority({ state: 'ACTIVE' }));
    expect(projection.authority).toBe('ready');
  });

  it('is pending when the resolved authority state is BOUNDED (grant exists, no authorized mandate yet)', () => {
    const projection = deriveRuntimeReadinessProjection(
      baseContext(),
      MONEYPENNY_RUNTIME,
      authority({ state: 'BOUNDED', met: false, code: 'AUTHORITY_MANDATE_REQUIRED' }),
    );
    expect(projection.authority).toBe('pending');
  });

  it('is pending (never a hard failure) when the resolved authority state is NONE', () => {
    const projection = deriveRuntimeReadinessProjection(
      baseContext(),
      MONEYPENNY_RUNTIME,
      authority({ state: 'NONE', met: false, code: 'AUTHORITY_UNRESOLVED' }),
    );
    expect(projection.authority).toBe('pending');
  });
});

describe('deriveRuntimeReadinessProjection — confidentialExecution', () => {
  it('is pending for the Confidential Runtime service (attestationRequirement: REQUIRED) — never fabricated as ready pre-Vela', () => {
    const projection = deriveRuntimeReadinessProjection(baseContext(), MONEYPENNY_RUNTIME, authority());
    expect(MONEYPENNY_RUNTIME.attestationRequirement).toBe('REQUIRED');
    expect(projection.confidentialExecution).toBe('pending');
  });

  it('is not-required for the Constitutional Runtime service (attestationRequirement: NOT_REQUIRED) — it was never subject to the Vela gate', () => {
    const projection = deriveRuntimeReadinessProjection(baseContext(), MONEYPENNY_RUNTIME_CONSTITUTIONAL, authority());
    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.attestationRequirement).toBe('NOT_REQUIRED');
    expect(projection.confidentialExecution).toBe('not-required');
  });
});

describe('deriveRuntimeReadinessProjection — independence of the four fields', () => {
  it('a fully ready operator (eligibility+standing+authority all ready) still reports confidentialExecution pending for the Confidential Runtime service', () => {
    const projection = deriveRuntimeReadinessProjection(baseContext(), MONEYPENNY_RUNTIME, authority({ state: 'ACTIVE' }));
    expect(projection).toEqual({
      eligibility: 'ready',
      standing: 'ready',
      authority: 'ready',
      confidentialExecution: 'pending',
    });
  });

  it('an operator who is eligible but below Standing and without authority reports each field independently, not collapsed', () => {
    const projection = deriveRuntimeReadinessProjection(
      baseContext({ standing: { score: 10 } as any }),
      MONEYPENNY_RUNTIME,
      authority({ state: 'NONE', met: false, code: 'AUTHORITY_UNRESOLVED' }),
    );
    expect(projection).toEqual({
      eligibility: 'ready',
      standing: 'not-ready',
      authority: 'pending',
      confidentialExecution: 'pending',
    });
  });
});
