/**
 * factor_authority_chains + moneypenny/admissionAuthority — the
 * separation-of-powers spine (PRD §2.1, §9.15-17, Journey C, acceptance
 * criteria 9/10/24/25, failure-path tests "missing or revoked delegation",
 * "MoneyPenny attempts to invoke Factor without subdelegation permission",
 * "revoked direct Factor mandate", "replayed admission command").
 */
import { describe, it, expect } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';
import { createOrResumeCase, transitionCaseState } from '../services/factor/factorCaseService';
import { createAssessment, beginRunning, requireReview, ratifyAssessment, addFinding } from '../services/aegis/aegisAssessmentService';
import { decideAdmission, AdmissionAuthorityError } from '../services/moneypenny/admissionAuthority';
import {
  establishDirectChain,
  establishMediatedChain,
  revokeChain,
  validateChainForAction,
  AuthorityChainError,
} from '../services/factor/authorityChain';

const PRINCIPAL = '22222222-2222-4222-8222-222222222222';
const FUTURE = new Date(Date.now() + 3600_000).toISOString();
const PAST = new Date(Date.now() - 3600_000).toISOString();

describe('authorityChain', () => {
  it('refuses MoneyPenny-mediated mode without an explicit subdelegationPermitted=true', async () => {
    const admin = makeFakeAdmin();
    await expect(
      establishMediatedChain(admin, {
        principalPersonaId: PRINCIPAL,
        mediatingAgentRootDid: 'did:agent:root:moneypenny',
        delegateAgentRootDid: 'did:agent:root:factor',
        subdelegationPermitted: false,
        allowedActions: ['propose_admission'],
        scope: {},
        expiresAt: FUTURE,
      }),
    ).rejects.toBeInstanceOf(AuthorityChainError);
  });

  it('records principal → MoneyPenny → Factor when subdelegation is explicitly permitted', async () => {
    const admin = makeFakeAdmin();
    const chain = await establishMediatedChain(admin, {
      principalPersonaId: PRINCIPAL,
      mediatingAgentRootDid: 'did:agent:root:moneypenny',
      delegateAgentRootDid: 'did:agent:root:factor',
      subdelegationPermitted: true,
      allowedActions: ['propose_admission'],
      scope: { maxCaseSpend: 0 },
      expiresAt: FUTURE,
    });
    expect(chain.mode).toBe('moneypenny_mediated');
    expect(chain.mediating_agent_root_did).toBe('did:agent:root:moneypenny');

    const check = await validateChainForAction(admin, { chainId: chain.chain_id, action: 'propose_admission' });
    expect(check.allowed).toBe(true);

    const denied = await validateChainForAction(admin, { chainId: chain.chain_id, action: 'transfer_funds' });
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.code).toBe('action-not-granted');
  });

  it('records principal → Factor directly, with no mediator', async () => {
    const admin = makeFakeAdmin();
    const chain = await establishDirectChain(admin, {
      principalPersonaId: PRINCIPAL,
      delegateAgentRootDid: 'did:agent:root:factor',
      allowedActions: ['submit_to_aegis'],
      scope: {},
      expiresAt: FUTURE,
    });
    expect(chain.mode).toBe('direct');
    expect(chain.mediating_agent_root_did).toBeNull();
  });

  it('revocation is immediate — a revoked chain fails validation on the very next check', async () => {
    const admin = makeFakeAdmin();
    const chain = await establishDirectChain(admin, {
      principalPersonaId: PRINCIPAL,
      delegateAgentRootDid: 'did:agent:root:factor',
      allowedActions: ['submit_to_aegis'],
      scope: {},
      expiresAt: FUTURE,
    });
    await revokeChain(admin, chain.chain_id, 'principal revoked');
    const check = await validateChainForAction(admin, { chainId: chain.chain_id, action: 'submit_to_aegis' });
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.code).toBe('chain-revoked');
  });

  it('an expired chain fails validation', async () => {
    const admin = makeFakeAdmin();
    const chain = await establishDirectChain(admin, {
      principalPersonaId: PRINCIPAL,
      delegateAgentRootDid: 'did:agent:root:factor',
      allowedActions: ['submit_to_aegis'],
      scope: {},
      expiresAt: PAST,
    });
    const check = await validateChainForAction(admin, { chainId: chain.chain_id, action: 'submit_to_aegis' });
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.code).toBe('chain-expired');
  });

  it('a fresh grant supersedes (revokes) the prior active grant of the same shape', async () => {
    const admin = makeFakeAdmin();
    const first = await establishDirectChain(admin, {
      principalPersonaId: PRINCIPAL,
      delegateAgentRootDid: 'did:agent:root:factor',
      allowedActions: ['submit_to_aegis'],
      scope: {},
      expiresAt: FUTURE,
    });
    const second = await establishDirectChain(admin, {
      principalPersonaId: PRINCIPAL,
      delegateAgentRootDid: 'did:agent:root:factor',
      allowedActions: ['submit_to_aegis', 'request_evidence'],
      scope: {},
      expiresAt: FUTURE,
    });
    const firstRow = admin.table('factor_authority_chains').find((r: any) => r.chain_id === first.chain_id);
    expect(firstRow.status).toBe('revoked');
    expect(second.status).toBe('active');
  });
});

async function caseThroughToAdmissionPending(admin: ReturnType<typeof makeFakeAdmin>, key: string) {
  const { case: c } = await createOrResumeCase(admin, {
    ownerPersonaId: PRINCIPAL,
    createdByPersonaId: PRINCIPAL,
    candidateIdentityKey: key,
    candidateDisplayName: 'Admission Candidate',
  });
  await transitionCaseState(admin, { caseId: c.case_id, toState: 'preparing', actorPersonaId: PRINCIPAL });
  await transitionCaseState(admin, { caseId: c.case_id, toState: 'assessment_pending', actorPersonaId: PRINCIPAL });
  await transitionCaseState(admin, { caseId: c.case_id, toState: 'assessment_in_progress', actorPersonaId: PRINCIPAL });
  await transitionCaseState(admin, { caseId: c.case_id, toState: 'assessment_complete', actorPersonaId: PRINCIPAL });
  await transitionCaseState(admin, { caseId: c.case_id, toState: 'registry_ready', actorPersonaId: PRINCIPAL });
  return transitionCaseState(admin, { caseId: c.case_id, toState: 'admission_pending', actorPersonaId: PRINCIPAL });
}

async function ratifiedAdmissible(admin: ReturnType<typeof makeFakeAdmin>, caseId: string, decision: 'admissible' | 'admissible_with_conditions') {
  const a = await createAssessment(admin, {
    caseId,
    policyId: 'p',
    policyVersion: '1',
    evidenceSnapshot: { ok: true },
    subjectAgentRef: 'agent-ref-candidate',
    requestedByAgentRef: 'agent-ref-factor',
  });
  await beginRunning(admin, a.assessment_id);
  await requireReview(admin, a.assessment_id);
  await addFinding(admin, {
    assessmentId: a.assessment_id,
    dimension: 'capability_evidence',
    claim: 'ok',
    method: 'manual',
    result: 'pass',
    confidence: 'high',
    falsificationCondition: 'n/a',
  });
  const ratified = await ratifyAssessment(admin, { assessmentId: a.assessment_id, decision, ratifiedByPersonaRef: 'persona-ref-reviewer' });
  await admin.from('factor_cases').update({ current_aegis_assessment_id: ratified.assessment_id }).eq('case_id', caseId);
  return ratified;
}

describe('moneypenny admissionAuthority — separation of powers', () => {
  it('refuses to admit a case not in admission_pending', async () => {
    const admin = makeFakeAdmin();
    const { case: c } = await createOrResumeCase(admin, {
      ownerPersonaId: PRINCIPAL,
      createdByPersonaId: PRINCIPAL,
      candidateIdentityKey: 'adm-1',
      candidateDisplayName: 'Adm 1',
    });
    await expect(
      decideAdmission(admin, { caseId: c.case_id, decision: 'admitted', decidingPersonaId: PRINCIPAL }),
    ).rejects.toMatchObject({ code: 'not-admission-pending' });
  });

  it('refuses to admit without a ratified Aegis assessment', async () => {
    const admin = makeFakeAdmin();
    const c = await caseThroughToAdmissionPending(admin, 'adm-2');
    await expect(
      decideAdmission(admin, { caseId: c.case_id, decision: 'admitted', decidingPersonaId: PRINCIPAL }),
    ).rejects.toMatchObject({ code: 'no-ratified-assessment' });
  });

  it('admits when the ratified assessment says admissible', async () => {
    const admin = makeFakeAdmin();
    const c = await caseThroughToAdmissionPending(admin, 'adm-3');
    await ratifiedAdmissible(admin, c.case_id, 'admissible');
    const result = await decideAdmission(admin, { caseId: c.case_id, decision: 'admitted', decidingPersonaId: PRINCIPAL });
    expect(result.case.state).toBe('admitted');
    expect(result.replay).toBe(false);
  });

  it('MoneyPenny may still reject an admissible-rated candidate (its own judgment call)', async () => {
    const admin = makeFakeAdmin();
    const c = await caseThroughToAdmissionPending(admin, 'adm-4');
    await ratifiedAdmissible(admin, c.case_id, 'admissible');
    const result = await decideAdmission(admin, { caseId: c.case_id, decision: 'rejected', decidingPersonaId: PRINCIPAL, reason: 'operator override' });
    expect(result.case.state).toBe('rejected');
  });

  it('a replayed admission command returns the same outcome without re-deciding', async () => {
    const admin = makeFakeAdmin();
    const c = await caseThroughToAdmissionPending(admin, 'adm-5');
    await ratifiedAdmissible(admin, c.case_id, 'admissible');
    const first = await decideAdmission(admin, { caseId: c.case_id, decision: 'admitted', decidingPersonaId: PRINCIPAL, idempotencyKey: 'k1' });
    const second = await decideAdmission(admin, { caseId: c.case_id, decision: 'admitted', decidingPersonaId: PRINCIPAL, idempotencyKey: 'k1' });
    expect(second.replay).toBe(true);
    expect(second.case.state).toBe(first.case.state);
  });
});
