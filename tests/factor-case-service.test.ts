/**
 * factorCaseService — state machine, idempotency, and duplicate-candidate
 * prevention (PRD Journey A, §6.1, acceptance criterion 1, failure-path
 * test "duplicate candidate submission").
 */
import { describe, it, expect } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';
import {
  createOrResumeCase,
  transitionCaseState,
  pauseCase,
  resumeCase,
  FactorCaseTransitionError,
} from '../services/factor/factorCaseService';

const OWNER = '11111111-1111-4111-8111-111111111111';

describe('factorCaseService', () => {
  it('creates a new case on first call', async () => {
    const admin = makeFakeAdmin();
    const { case: c, created } = await createOrResumeCase(admin, {
      ownerPersonaId: OWNER,
      createdByPersonaId: OWNER,
      candidateIdentityKey: 'candidate-a',
      candidateDisplayName: 'Candidate A',
    });
    expect(created).toBe(true);
    expect(c.state).toBe('discovered');
  });

  it('resolves the SAME case on a repeat candidate submission — never a duplicate', async () => {
    const admin = makeFakeAdmin();
    const first = await createOrResumeCase(admin, {
      ownerPersonaId: OWNER,
      createdByPersonaId: OWNER,
      candidateIdentityKey: 'candidate-b',
      candidateDisplayName: 'Candidate B',
    });
    const second = await createOrResumeCase(admin, {
      ownerPersonaId: OWNER,
      createdByPersonaId: OWNER,
      candidateIdentityKey: 'candidate-b',
      candidateDisplayName: 'Candidate B (resubmitted)',
    });
    expect(second.created).toBe(false);
    expect(second.case.case_id).toBe(first.case.case_id);

    const all = admin.table('factor_cases');
    expect(all.filter((r: any) => r.candidate_identity_key === 'candidate-b')).toHaveLength(1);
  });

  it('is idempotent on an explicit idempotency key', async () => {
    const admin = makeFakeAdmin();
    const first = await createOrResumeCase(admin, {
      ownerPersonaId: OWNER,
      createdByPersonaId: OWNER,
      candidateIdentityKey: 'candidate-c',
      candidateDisplayName: 'Candidate C',
      idempotencyKey: 'idem-1',
    });
    const second = await createOrResumeCase(admin, {
      ownerPersonaId: OWNER,
      createdByPersonaId: OWNER,
      candidateIdentityKey: 'candidate-c',
      candidateDisplayName: 'Candidate C',
      idempotencyKey: 'idem-1',
    });
    expect(second.case.case_id).toBe(first.case.case_id);
    expect(second.created).toBe(false);
  });

  it('walks the forward state machine and refuses an invalid jump', async () => {
    const admin = makeFakeAdmin();
    const { case: c } = await createOrResumeCase(admin, {
      ownerPersonaId: OWNER,
      createdByPersonaId: OWNER,
      candidateIdentityKey: 'candidate-d',
      candidateDisplayName: 'Candidate D',
    });

    const preparing = await transitionCaseState(admin, { caseId: c.case_id, toState: 'preparing', actorPersonaId: OWNER });
    expect(preparing.state).toBe('preparing');

    await expect(
      transitionCaseState(admin, { caseId: c.case_id, toState: 'registry_ready', actorPersonaId: OWNER }),
    ).rejects.toThrow(FactorCaseTransitionError);
  });

  it('refuses to set admitted/conditionally_admitted/rejected directly — Factor cannot self-admit', async () => {
    const admin = makeFakeAdmin();
    const { case: c } = await createOrResumeCase(admin, {
      ownerPersonaId: OWNER,
      createdByPersonaId: OWNER,
      candidateIdentityKey: 'candidate-e',
      candidateDisplayName: 'Candidate E',
    });
    await transitionCaseState(admin, { caseId: c.case_id, toState: 'preparing', actorPersonaId: OWNER });

    let threw: unknown = null;
    try {
      await transitionCaseState(admin, { caseId: c.case_id, toState: 'admitted', actorPersonaId: OWNER });
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(FactorCaseTransitionError);
    expect((threw as FactorCaseTransitionError).code).toBe('admission-requires-moneypenny-authority');
  });

  it('pause/resume never loses state', async () => {
    const admin = makeFakeAdmin();
    const { case: c } = await createOrResumeCase(admin, {
      ownerPersonaId: OWNER,
      createdByPersonaId: OWNER,
      candidateIdentityKey: 'candidate-f',
      candidateDisplayName: 'Candidate F',
    });
    await transitionCaseState(admin, { caseId: c.case_id, toState: 'preparing', actorPersonaId: OWNER });
    await transitionCaseState(admin, { caseId: c.case_id, toState: 'assessment_pending', actorPersonaId: OWNER });

    const paused = await pauseCase(admin, c.case_id, OWNER, 'operator stepped away');
    expect(paused.state).toBe('paused');
    expect(paused.paused_from_state).toBe('assessment_pending');

    const resumed = await resumeCase(admin, c.case_id, OWNER);
    expect(resumed.state).toBe('assessment_pending');
    expect(resumed.paused_from_state).toBeNull();
  });

  it('a terminal (rejected) case cannot transition further', async () => {
    const admin = makeFakeAdmin();
    const { case: c } = await createOrResumeCase(admin, {
      ownerPersonaId: OWNER,
      createdByPersonaId: OWNER,
      candidateIdentityKey: 'candidate-g',
      candidateDisplayName: 'Candidate G',
    });
    await admin
      .from('factor_cases')
      .update({ state: 'rejected' })
      .eq('case_id', c.case_id);

    await expect(
      transitionCaseState(admin, { caseId: c.case_id, toState: 'preparing', actorPersonaId: OWNER }),
    ).rejects.toThrow(/terminal/);
  });
});
