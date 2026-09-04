/**
 * Authority chains (PRD §2.1/§9.15-17) + MoneyPenny's sole admission
 * authority (PRD Journey C, §2 hard invariant 3) — unit tests against the
 * in-memory fakeSupabase fixture.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'receipt-stub' })),
}));

const activeGrant = {
  grant_id: 'grant-1',
  persona_id: 'persona-1',
  agent_root_did: 'did:factor:root',
  status: 'active',
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
};

const readActiveGrantForAgentMock = vi.fn(async (personaId: string, agentRootDid: string) => {
  if (personaId === activeGrant.persona_id && agentRootDid === activeGrant.agent_root_did) return activeGrant;
  return null;
});

vi.mock('@/services/delegation/delegationGrantStore', () => ({
  readActiveGrantForAgent: (personaId: string, agentRootDid: string) => readActiveGrantForAgentMock(personaId, agentRootDid),
}));

import { establishDirectChain, establishMediatedChain, revokeChain, validateChainForAction, AuthorityChainError } from '@/services/factor/authorityChain';
import { createOrResumeCase, transitionCaseState } from '@/services/factor/factorCaseService';
import { createAssessment, beginRunning, requireReview, ratifyAssessment, addFinding } from '@/services/aegis/aegisAssessmentService';
import { decideAdmission, AdmissionAuthorityError } from '@/services/moneypenny/admissionAuthority';

describe('authorityChain', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
    readActiveGrantForAgentMock.mockClear();
  });

  it('refuses to establish a direct chain with no active delegation_grants row', async () => {
    await expect(
      establishDirectChain(admin, { principalPersonaId: 'persona-no-grant', targetAgentRef: 'aigent-factor', targetAgentRootDid: 'did:factor:root', allowedActions: ['candidate.intake'] }),
    ).rejects.toMatchObject({ code: 'no-active-delegation-grant' });
  });

  it('establishes a direct chain when an active delegation_grants row exists', async () => {
    const chain = await establishDirectChain(admin, {
      principalPersonaId: 'persona-1',
      targetAgentRef: 'aigent-factor',
      targetAgentRootDid: 'did:factor:root',
      allowedActions: ['candidate.intake'],
    });
    expect(chain.chain_mode).toBe('direct');
    expect(chain.delegation_grant_id).toBe('grant-1');
    expect(chain.status).toBe('active');
  });

  it('refuses a MoneyPenny-mediated chain without explicit subdelegationPermitted=true', async () => {
    await expect(
      establishMediatedChain(admin, {
        principalPersonaId: 'persona-1',
        mediatorAgentRef: 'aigent-moneypenny',
        targetAgentRef: 'aigent-factor',
        subdelegationPermitted: false,
        allowedActions: ['candidate.intake'],
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'subdelegation-not-permitted' });
  });

  it('establishes a mediated chain when subdelegation is explicitly permitted', async () => {
    const chain = await establishMediatedChain(admin, {
      principalPersonaId: 'persona-1',
      mediatorAgentRef: 'aigent-moneypenny',
      targetAgentRef: 'aigent-factor',
      subdelegationPermitted: true,
      allowedActions: ['candidate.intake'],
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(chain.chain_mode).toBe('moneypenny_mediated');
    expect(chain.mediator_agent_ref).toBe('aigent-moneypenny');
    expect(chain.delegation_grant_id).toBeNull();
  });

  it('revocation is immediate — validateChainForAction refuses on the very next check', async () => {
    const chain = await establishDirectChain(admin, {
      principalPersonaId: 'persona-1',
      targetAgentRef: 'aigent-factor',
      targetAgentRootDid: 'did:factor:root',
      allowedActions: ['candidate.intake'],
    });
    await revokeChain(admin, chain.chain_id, 'persona-1', 'operator revoked');
    const result = await validateChainForAction(admin, { chainId: chain.chain_id, action: 'candidate.intake' });
    expect(result.allowed).toBe(false);
  });

  it('validateChainForAction allows a granted action on an active chain', async () => {
    const chain = await establishDirectChain(admin, {
      principalPersonaId: 'persona-1',
      targetAgentRef: 'aigent-factor',
      targetAgentRootDid: 'did:factor:root',
      allowedActions: ['candidate.intake'],
    });
    const result = await validateChainForAction(admin, { chainId: chain.chain_id, action: 'candidate.intake' });
    expect(result.allowed).toBe(true);
  });
});

async function admitablePreconditions(admin: any) {
  const { case: c } = await createOrResumeCase(admin, {
    ownerPersonaId: 'persona-1',
    createdByPersonaId: 'persona-1',
    candidateIdentityKey: 'candidate-admit',
    candidateDisplayName: 'Candidate Admit',
  });
  await transitionCaseState(admin, { caseId: c.case_id, toState: 'preparing', actorPersonaId: 'persona-1' });
  await transitionCaseState(admin, { caseId: c.case_id, toState: 'assessment_pending', actorPersonaId: 'persona-1' });
  await transitionCaseState(admin, { caseId: c.case_id, toState: 'assessment_in_progress', actorPersonaId: 'persona-1' });
  await transitionCaseState(admin, { caseId: c.case_id, toState: 'assessment_complete', actorPersonaId: 'persona-1' });
  await transitionCaseState(admin, { caseId: c.case_id, toState: 'registry_ready', actorPersonaId: 'persona-1' });
  await transitionCaseState(admin, { caseId: c.case_id, toState: 'admission_pending', actorPersonaId: 'persona-1' });

  const assessment = await createAssessment(admin, {
    subjectType: 'factor_case',
    subjectRef: c.case_id,
    caseId: c.case_id,
    policyVersion: 'v1',
    evidenceSnapshot: { ok: true },
    requestedByAgentRef: 'aigent-factor',
    actorPersonaId: 'persona-1',
  });
  await beginRunning(admin, assessment.assessment_id);
  await requireReview(admin, assessment.assessment_id);
  await addFinding(admin, {
    assessmentId: assessment.assessment_id,
    dimension: 'capability',
    claim: 'ok',
    method: 'review',
    result: 'pass',
    confidence: 0.9,
    falsificationCondition: 'n/a',
  });
  await ratifyAssessment(admin, { assessmentId: assessment.assessment_id, decision: 'admissible', ratifiedByPersonaId: 'persona-moneypenny' });

  return c.case_id;
}

describe('admissionAuthority', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
  });

  it('refuses admission outside admission_pending', async () => {
    const { case: c } = await createOrResumeCase(admin, {
      ownerPersonaId: 'persona-1',
      createdByPersonaId: 'persona-1',
      candidateIdentityKey: 'candidate-early',
      candidateDisplayName: 'Candidate Early',
    });
    await expect(decideAdmission(admin, { caseId: c.case_id, decision: 'admitted', decidingPersonaId: 'persona-moneypenny' })).rejects.toMatchObject({
      code: 'not-admission-pending',
    });
  });

  it('refuses to admit without a ratified Aegis assessment', async () => {
    const { case: c } = await createOrResumeCase(admin, {
      ownerPersonaId: 'persona-1',
      createdByPersonaId: 'persona-1',
      candidateIdentityKey: 'candidate-noassess',
      candidateDisplayName: 'Candidate No Assess',
    });
    await transitionCaseState(admin, { caseId: c.case_id, toState: 'preparing', actorPersonaId: 'persona-1' });
    await transitionCaseState(admin, { caseId: c.case_id, toState: 'assessment_pending', actorPersonaId: 'persona-1' });
    await transitionCaseState(admin, { caseId: c.case_id, toState: 'assessment_in_progress', actorPersonaId: 'persona-1' });
    await transitionCaseState(admin, { caseId: c.case_id, toState: 'assessment_complete', actorPersonaId: 'persona-1' });
    await transitionCaseState(admin, { caseId: c.case_id, toState: 'registry_ready', actorPersonaId: 'persona-1' });
    await transitionCaseState(admin, { caseId: c.case_id, toState: 'admission_pending', actorPersonaId: 'persona-1' });

    await expect(decideAdmission(admin, { caseId: c.case_id, decision: 'admitted', decidingPersonaId: 'persona-moneypenny' })).rejects.toMatchObject({
      code: 'no-ratified-assessment',
    });
  });

  it('admits a candidate whose ratified assessment supports it', async () => {
    const caseId = await admitablePreconditions(admin);
    const result = await decideAdmission(admin, { caseId, decision: 'admitted', decidingPersonaId: 'persona-moneypenny' });
    expect(result.case.state).toBe('admitted');
    expect(result.replay).toBe(false);
  });

  it("MoneyPenny may still reject an admissible candidate — its own judgment call", async () => {
    const caseId = await admitablePreconditions(admin);
    const result = await decideAdmission(admin, { caseId, decision: 'rejected', decidingPersonaId: 'persona-moneypenny', reason: 'policy exception' });
    expect(result.case.state).toBe('rejected');
  });

  it('an admission command replayed with the same idempotency key returns the same outcome without re-deciding', async () => {
    const caseId = await admitablePreconditions(admin);
    const first = await decideAdmission(admin, { caseId, decision: 'admitted', decidingPersonaId: 'persona-moneypenny', idempotencyKey: 'idem-admit-1' });
    const second = await decideAdmission(admin, { caseId, decision: 'admitted', decidingPersonaId: 'persona-moneypenny', idempotencyKey: 'idem-admit-1' });
    expect(second.replay).toBe(true);
    expect(second.case.state).toBe(first.case.state);
    // Only ONE admission_decided event was ever recorded.
    const events = admin.table('factor_case_events').filter((e: any) => e.event_type === 'admission_decided');
    expect(events.length).toBe(1);
  });
});
